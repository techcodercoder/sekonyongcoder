#!/usr/bin/env bash
# Cuts each character out of the reference sheet and removes the white background.
# Background is flood-filled from the crop border (plus extra seeds for enclosed
# pockets), so white fur inside the outlines is kept. Requires ImageMagick 7.
set -euo pipefail

OUT="src/assets/characters"
FUZZ="12%"
mkdir -p "$OUT"

# source  name  crop(WxH+X+Y)  seeds for enclosed white pockets (x,y in the trimmed output)
extract() {
  local src=$1 name=$2 crop=$3; shift 3
  local w=${crop%%x*} rest=${crop#*x}; local h=${rest%%+*}
  local draws=(-draw "color 0,0 floodfill" -draw "color $((w-1)),0 floodfill"
    -draw "color 0,$((h-1)) floodfill" -draw "color $((w-1)),$((h-1)) floodfill")

  magick "$src" -crop "$crop" +repage -alpha set -fuzz "$FUZZ" -fill none "${draws[@]}" \
    \( +clone -alpha extract -define connected-components:area-threshold=1500 \
       -define connected-components:mean-color=true -connected-components 8 \) \
    -alpha off -compose CopyOpacity -composite -trim +repage "$OUT/$name.png"

  if (($#)); then
    local seeds=()
    for seed in "$@"; do seeds+=(-draw "color $seed floodfill"); done
    magick "$OUT/$name.png" -fuzz "$FUZZ" -fill none "${seeds[@]}" "$OUT/$name.png"
  fi
  echo "$OUT/$name.png $(magick identify -format '%wx%h' "$OUT/$name.png")"
}

CAST="assets-src/wayang-cast.jpg"
extract "$CAST" rama    780x1400+50+0     370,80 120,540 290,220 580,600 600,800 640,500
extract "$CAST" sinta   520x1230+834+165  140,520 390,660 420,766
extract "$CAST" hanoman 700x1180+1335+240
extract assets-src/rahwana.jpg rahwana 2048x2048+0+0 1200,1200 680,1720 240,1000 160,1600 800,1920 120,1800 900,1600 400,1900 516,1666 858,1487 239,1348

# Gunungan (kayon): background removed from the corners only, so the white
# openwork inside stays; scaled to about twice its largest on-screen size.
read -r GW GH <<<"$(magick identify -format '%w %h' assets-src/gunungan.jpg)"
magick assets-src/gunungan.jpg -alpha set -fuzz "$FUZZ" -fill none \
  -draw "color 0,0 floodfill" -draw "color $((GW-1)),0 floodfill" \
  -draw "color 0,$((GH-1)) floodfill" -draw "color $((GW-1)),$((GH-1)) floodfill" \
  -trim +repage -resize x1000 src/assets/gunungan.png
echo "src/assets/gunungan.png $(magick identify -format '%wx%h' src/assets/gunungan.png)"
