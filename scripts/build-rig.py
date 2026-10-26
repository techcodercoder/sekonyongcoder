"""Cut a wayang parts sheet into pieces and write the rig the game assembles.

Usage: python3 scripts/build-rig.py scripts/rigs/hanoman.json [preview.png]

Config (all points in the source sheet's pixel coordinates):
  inkFixes   polylines inked onto the sheet first, to close broken outlines
             so the background fill cannot leak into a piece
  bgSeeds    extra flood points for white pockets enclosed by a piece
  pieces     name -> {seed, keep?|drop? polygon, flip?}; seed is any pixel of
             the piece; keep/drop split two pieces drawn touching (elbows)
  bones      ordered back to front; each places a piece on its parent:
             pivot (on the piece) goes to at (on the parent's piece).
             tip, when given, is where the limb points as drawn: the game
             normalises the piece so angle 0 hangs straight down.
  points     name -> {bone, at}: named spots on a bone's piece (e.g. the tail
             tip a fireball leaves from), written in that joint's local frame

The sheet is mirrored when "mirror" is set so the puppet faces right, and
pieces are downsampled by "outputScale" (rig coordinates scale with them), so
the game never has to shrink large textures, which would alias.
Writes <outDir>/<piece>.png and <outDir>/rig.json. Requires Pillow.
"""

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps


def component(alpha, seed):
    solid = alpha.point(lambda v: 255 if v > 0 else 0)
    if solid.getpixel(tuple(seed)) != 255:
        raise SystemExit(f"seed {seed} is not on a piece")
    ImageDraw.floodfill(solid, tuple(seed), 128)
    return solid.point(lambda v: 255 if v == 128 else 0)


def polygon_mask(size, points):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon([tuple(p) for p in points], fill=255)
    return mask


def main(cfg_path, preview_path=None):
    cfg = json.loads(Path(cfg_path).read_text())
    src = Image.open(cfg["source"]).convert("RGBA")
    W = src.width
    out_dir = Path(cfg["outDir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    draw = ImageDraw.Draw(src)
    for fix in cfg.get("inkFixes", []):
        draw.line([tuple(p) for p in fix["line"]], fill=(25, 22, 20, 255), width=fix["width"], joint="curve")

    h = src.height
    for seed in [(0, 0), (W - 1, 0), (0, h - 1), (W - 1, h - 1)] + [tuple(s) for s in cfg.get("bgSeeds", [])]:
        ImageDraw.floodfill(src, seed, (0, 0, 0, 0), thresh=cfg["bgThreshold"])
    alpha = src.getchannel("A")

    scale = cfg.get("outputScale", 1)
    pieces = {}
    for name, p in cfg["pieces"].items():
        mask = component(alpha, p["seed"])
        if "keep" in p:
            mask = ImageChops.multiply(mask, polygon_mask(src.size, p["keep"]))
        if "drop" in p:
            mask = ImageChops.subtract(mask, polygon_mask(src.size, p["drop"]))
        x0, y0, x1, y1 = mask.getbbox()
        img = src.copy()
        img.putalpha(mask)
        img = img.crop((x0, y0, x1, y1))
        if cfg.get("mirror"):
            img = ImageOps.mirror(img)
            x0, x1 = W - x1, W - x0
        if p.get("flip"):
            img = ImageOps.mirror(img)
        sw, sh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
        img.resize((sw, sh), Image.LANCZOS).save(out_dir / f"{name}.png", optimize=True)
        pieces[name] = {"file": f"{name}.png", "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "flip": p.get("flip", False)}

    def point(piece, pt):
        """Source-sheet point on a piece -> output coordinates."""
        x, y = pt
        if cfg.get("mirror"):
            x = W - 1 - x
        pc = pieces[piece]
        if pc["flip"]:
            x = 2 * pc["x"] + pc["w"] - 1 - x
        return [x, y]

    bones = []
    by_name = {}
    for b in cfg["bones"]:
        parent = b.get("parent")
        bone = {
            "name": b["name"],
            "piece": b["piece"],
            "parent": parent,
            "pivot": point(b["piece"], b["pivot"]),
            "at": point(by_name[parent]["piece"], b["at"]) if parent else None,
            "rest": 0.0,
            "angle": b.get("angle", 0),
        }
        if "tip" in b:
            px, py = bone["pivot"]
            tx, ty = point(b["piece"], b["tip"])
            # 0 = pointing down, positive = rotated clockwise (backward when facing right).
            bone["rest"] = round(math.degrees(math.atan2(-(tx - px), ty - py)), 1)
        if "tuding" in b:
            bone["tuding"] = point(b["piece"], b["tuding"])
        bones.append(bone)
        by_name[bone["name"]] = bone

    def scaled(pt):
        return [round(pt[0] * scale, 2), round(pt[1] * scale, 2)] if pt else pt

    for bone in bones:
        for key in ("pivot", "at", "tuding"):
            if key in bone:
                bone[key] = scaled(bone[key])

    points = {}
    for pname, pt in cfg.get("points", {}).items():
        bone = by_name[pt["bone"]]
        px, py = bone["pivot"]
        x, y = point(bone["piece"], pt["at"])
        r = math.radians(-bone["rest"])
        dx, dy = x * scale - px, y * scale - py  # pivots are already scaled here
        points[pname] = {
            "bone": pt["bone"],
            "x": round(dx * math.cos(r) - dy * math.sin(r), 2),
            "y": round(dx * math.sin(r) + dy * math.cos(r), 2),
        }

    rig = {
        "points": points,
        "pieces": {
            k: {"file": pc["file"], "x": round(pc["x"] * scale, 2), "y": round(pc["y"] * scale, 2),
                "w": round(pc["w"] * scale, 2), "h": round(pc["h"] * scale, 2)}
            for k, pc in pieces.items()
        },
        "bones": bones,
        "drawOrder": cfg["drawOrder"],
    }
    (out_dir / "rig.json").write_text(json.dumps(rig, indent=2) + "\n")
    print(f"wrote {len(pieces)} pieces and rig.json to {out_dir}")

    if preview_path:
        render_preview(out_dir, rig, preview_path, cfg.get("previewPose", {}), scale)


def render_preview(out_dir, rig, path, pose, k):
    """Assemble the puppet as the game does: drawn pose next to a test pose."""
    frames = []
    for angles in ({}, pose):
        cw, ch = round(2200 * k), round(2600 * k)
        canvas = Image.new("RGBA", (cw, ch), (208, 64, 144, 255))
        world = {}
        layers = {}
        for b in rig["bones"]:
            parent = world.get(b["parent"])
            parent_rest = next((x["rest"] for x in rig["bones"] if x["name"] == b["parent"]), 0)
            drawn = b["rest"] - parent_rest if b["rest"] else b["angle"]
            angle = angles.get(b["name"], drawn)
            if parent is None:
                origin, rot = (1100 * k, 1000 * k), angle
            else:
                pb = next(x for x in rig["bones"] if x["name"] == b["parent"])
                dx, dy = b["at"][0] - pb["pivot"][0], b["at"][1] - pb["pivot"][1]
                r = math.radians(-pb["rest"])
                dx, dy = dx * math.cos(r) - dy * math.sin(r), dx * math.sin(r) + dy * math.cos(r)
                pr = math.radians(parent[1])
                ox = parent[0][0] + dx * math.cos(pr) - dy * math.sin(pr)
                oy = parent[0][1] + dx * math.sin(pr) + dy * math.cos(pr)
                origin, rot = (ox, oy), parent[1] + angle
            world[b["name"]] = (origin, rot)
            pc = rig["pieces"][b["piece"]]
            img = Image.open(out_dir / pc["file"])
            total = math.radians(rot - b["rest"])
            c, s = math.cos(total), math.sin(total)
            ix, iy = pc["x"] - b["pivot"][0], pc["y"] - b["pivot"][1]
            # canvas = origin + R * (local + offset); PIL wants the inverse map.
            a, bb, d, e = c, -s, s, c
            tx = origin[0] + a * ix + bb * iy
            ty = origin[1] + d * ix + e * iy
            inv = (a, d, -(a * tx + d * ty), bb, e, -(bb * tx + e * ty))
            layers[b["name"]] = img.transform(canvas.size, Image.AFFINE, inv, resample=Image.BILINEAR)
        for name in rig["drawOrder"]:
            canvas.alpha_composite(layers[name])
        frames.append(canvas)
    sheet = Image.new("RGBA", (cw * 2, ch))
    sheet.paste(frames[0], (0, 0))
    sheet.paste(frames[1], (cw, 0))
    sheet.convert("RGB").resize((1100, 650)).save(path)
    print(f"preview: {path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
