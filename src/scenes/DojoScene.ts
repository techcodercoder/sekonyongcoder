import Phaser from 'phaser';
import { COLORS, FIGHTER, GAME, KELIR, MATCH, type JointKey, type MoveId } from '../constants';
import { Fighter, type FireballEvent, type HitResult } from '../entities/Fighter';
import { Fireball } from '../entities/Fireball';
import { pieceKey } from '../entities/Puppet';
import { AIController } from '../systems/AIController';
import { Effects } from '../systems/Effects';
import { Hud } from '../systems/Hud';
import { KEYMAPS, KeyboardController, NO_INPUT, type Controller, type InputState } from '../systems/InputController';
import { Lighting } from '../systems/Lighting';

const allCharacterPieces = import.meta.glob<string>('../assets/characters/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const AVAILABLE_CHARACTERS = ['hanoman', 'sugriwa', 'subali', 'rahwana', 'jatayu'];
const STEP_MS = 1000 / GAME.fps;

export class DojoScene extends Phaser.Scene {
  private p1!: Fighter;
  private dummy!: Fighter;
  private p1Char = 'sugriwa';
  private dummyChar = 'subali';
  private controllers!: [Controller, Controller];
  private fireballs: Fireball[] = [];
  private effects!: Effects;
  private hud!: Hud;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private showDebug = true;
  private dummyMode: 'stand' | 'block' | 'counter' = 'stand';
  private activeTab: 'moves' | 'tuner' = 'moves';

  private accumulator = 0;
  private pending: [InputState, InputState] = [NO_INPUT, NO_INPUT];
  private uiContainer?: HTMLDivElement;

  constructor() {
    super('DojoScene');
  }

  preload(): void {
    for (const [path, url] of Object.entries(allCharacterPieces)) {
      const parts = path.split('/');
      const piece = parts.pop()!.replace('.png', '');
      const character = parts.pop()!;
      this.load.image(pieceKey(character, piece), url);
    }
  }

  create(): void {
    new Lighting(this);
    this.drawGedebog();
    this.effects = new Effects(this);
    this.debugGraphics = this.add.graphics().setDepth(200);

    this.spawnFighters();

    this.hud = new Hud(this, [`${this.p1Char.toUpperCase()} (P1)`, `${this.dummyChar.toUpperCase()} (DUMMY)`], [0, 0]);

    this.createDomOverlay();

    this.input.keyboard!.on('keydown-ESC', () => {
      this.cleanupDom();
      this.scene.start('TitleScene');
    });

    this.input.keyboard!.on('keydown-H', () => {
      this.showDebug = !this.showDebug;
      if (!this.showDebug) this.debugGraphics.clear();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupDom());
  }

  private spawnFighters(): void {
    if (this.p1) this.p1.destroy();
    if (this.dummy) this.dummy.destroy();
    this.fireballs.forEach((b) => b.destroy());
    this.fireballs = [];

    this.p1 = new Fighter(this, MATCH.startX[0], 1, this.p1Char, undefined, true);
    this.dummy = new Fighter(this, MATCH.startX[1], -1, this.dummyChar, this.p1Char === this.dummyChar ? FIGHTER.altTint : undefined, true);
    this.p1.opponent = this.dummy;
    this.dummy.opponent = this.p1;

    this.wireEvents(this.p1);
    this.wireEvents(this.dummy);

    const fireballs = () => this.fireballs;
    this.controllers = [
      new KeyboardController(this, KEYMAPS.p1),
      new AIController(this.dummy, this.p1, fireballs),
    ];
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 4);
    this.collectInputs();
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      this.step(this.pending);
      this.pending = this.pending.map((i) => ({ ...NO_INPUT, left: i.left, right: i.right })) as [InputState, InputState];
    }

    // Keep health infinite in Dojo
    this.p1.health = FIGHTER.maxHealth;
    this.dummy.health = FIGHTER.maxHealth;
    this.hud.update([this.p1, this.dummy], 99);

    if (this.showDebug) {
      this.renderDebugVisuals();
    }
  }

  private collectInputs(): void {
    const live = this.controllers.map((c) => c.read()) as [InputState, InputState];
    const dummyInput: InputState = {
      ...NO_INPUT,
      right: this.dummyMode === 'block', // walk backward away from p1 = block
    };

    this.pending = [
      {
        left: live[0].left,
        right: live[0].right,
        jumpPressed: live[0].jumpPressed,
        handPressed: live[0].handPressed,
        kickPressed: live[0].kickPressed,
        triwikramaPressed: live[0].triwikramaPressed,
        ekorApiPressed: live[0].ekorApiPressed,
        mengecilPressed: live[0].mengecilPressed,
      },
      this.dummyMode === 'counter' ? live[1] : dummyInput,
    ];
  }

  private step(inputs: [InputState, InputState]): void {
    this.p1.tick(inputs[0]);
    this.dummy.tick(inputs[1]);
    this.fireballs.forEach((b) => b.tick());
    this.fireballs = this.fireballs.filter((b) => b.alive);
    this.separate();
    this.resolveHits();
  }

  private separate(): void {
    const [a, b] = [this.p1, this.dummy];
    const ha = a.hurtbox();
    const hb = b.hurtbox();
    if (ha.bottom < hb.top + 30 || hb.bottom < ha.top + 30) return;
    const minDist = (ha.width + hb.width) / 2;
    const dx = b.x - a.x;
    const overlap = minDist - Math.abs(dx);
    if (overlap <= 0) return;
    const dir = Math.sign(dx) || 1;
    const clamp = (x: number) => Phaser.Math.Clamp(x, KELIR.wallMargin, GAME.width - KELIR.wallMargin);
    a.x = clamp(a.x - (dir * overlap) / 2);
    b.x = clamp(b.x + (dir * overlap) / 2);
  }

  private resolveHits(): void {
    const [a, b] = [this.p1, this.dummy];
    const pairs: [Fighter, Fighter][] = [
      [a, b],
      [b, a],
    ];
    pairs.forEach(([attacker, defender], i) => {
      const hit = attacker.hitbox();
      if (!hit || defender.invulnerable) return;
      const hurt = defender.hurtbox();
      const contact = Phaser.Geom.Rectangle.Intersection(hit, hurt);
      if (!contact || contact.width <= 0 || contact.height <= 0) return;

      const move = attacker.move!;
      const result: HitResult = defender.receiveHit(move, attacker.x, attacker.power);
      attacker.onConnect(result);
      const heavy = !!move.launch || attacker.power > 1;

      if (result === 'block') {
        this.effects.guard(contact.centerX, contact.centerY, attacker.facing);
      } else {
        this.effects.spark(contact.centerX, contact.centerY, heavy);
        this.effects.label(move.label, attacker.x, attacker.y - 130 * attacker.sizeScale, heavy, `p${i}`);
      }
    });

    for (const ball of this.fireballs) {
      if (!ball.alive) continue;
      const target = ball.owner.opponent;
      if (target.invulnerable || !Phaser.Geom.Intersects.RectangleToRectangle(ball.area(), target.hurtbox())) continue;
      target.receiveHit(ball.move, ball.x - ball.direction * 40, ball.power);
      this.effects.burst(ball.x, ball.y, ball.power);
      ball.destroy();
    }
  }

  private renderDebugVisuals(): void {
    const g = this.debugGraphics;
    g.clear();

    // 1. Draw Hurtbox (Green)
    const p1Hurt = this.p1.hurtbox();
    g.lineStyle(2, 0x00ff00, 0.85);
    g.strokeRect(p1Hurt.x, p1Hurt.y, p1Hurt.width, p1Hurt.height);

    const dummyHurt = this.dummy.hurtbox();
    g.lineStyle(2, 0x00ff00, 0.6);
    g.strokeRect(dummyHurt.x, dummyHurt.y, dummyHurt.width, dummyHurt.height);

    // 2. Draw Hitbox (Red) if attacking
    const p1Hit = this.p1.hitbox();
    if (p1Hit) {
      g.lineStyle(3, 0xff0044, 0.95);
      g.fillStyle(0xff0044, 0.2);
      g.fillRect(p1Hit.x, p1Hit.y, p1Hit.width, p1Hit.height);
      g.strokeRect(p1Hit.x, p1Hit.y, p1Hit.width, p1Hit.height);
    }

    const dummyHit = this.dummy.hitbox();
    if (dummyHit) {
      g.lineStyle(3, 0xff0044, 0.95);
      g.fillStyle(0xff0044, 0.2);
      g.fillRect(dummyHit.x, dummyHit.y, dummyHit.width, dummyHit.height);
      g.strokeRect(dummyHit.x, dummyHit.y, dummyHit.width, dummyHit.height);
    }

    // 3. Draw Skeleton Joints on P1
    const joints = this.p1.getAllJoints();
    g.fillStyle(0xffd700, 1);
    g.lineStyle(2, 0xffd700, 0.8);
    for (const container of Object.values(joints)) {
      if (!container) continue;
      const matrix = container.getWorldTransformMatrix();
      const pt = matrix.transformPoint(0, 0);
      g.fillCircle(pt.x, pt.y, 4);
    }
  }

  // ---- HTML UI Overlay ----
  private createDomOverlay(): void {
    const el = document.createElement('div');
    el.id = 'dojo-overlay';
    el.style.position = 'absolute';
    el.style.top = '10px';
    el.style.right = '10px';
    el.style.width = '340px';
    el.style.maxHeight = '95vh';
    el.style.overflowY = 'auto';
    el.style.background = 'rgba(28, 17, 10, 0.92)';
    el.style.border = '2px solid #f5c451';
    el.style.borderRadius = '8px';
    el.style.padding = '12px';
    el.style.color = '#f2d49b';
    el.style.fontFamily = 'Georgia, serif';
    el.style.fontSize = '12px';
    el.style.zIndex = '10000';
    el.style.boxShadow = '0 0 15px rgba(0,0,0,0.8)';

    this.uiContainer = el;
    document.body.appendChild(el);
    this.renderDomContent();
  }

  private renderDomContent(): void {
    if (!this.uiContainer) return;
    const el = this.uiContainer;

    const charOptions = (selected: string) =>
      AVAILABLE_CHARACTERS.map(
        (c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c.toUpperCase()}</option>`,
      ).join('');

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #6b5526; padding-bottom:6px; margin-bottom:8px;">
        <strong style="color:#f5c451; font-size:14px;">🥋 DOJO: RIG SIMULATOR</strong>
        <button id="btn-esc" style="background:#4a3a1c; border:1px solid #f5c451; color:#f2d49b; border-radius:4px; cursor:pointer; padding:2px 8px;">Menu (Esc)</button>
      </div>

      <!-- Character Selectors -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
        <div>
          <label style="font-size:11px; color:#ffdd80;">Karakter P1 (Kiri):</label>
          <select id="sel-p1" style="width:100%; background:#2a170a; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; padding:3px;">
            ${charOptions(this.p1Char)}
          </select>
        </div>
        <div>
          <label style="font-size:11px; color:#ffdd80;">Dummy (Kanan):</label>
          <select id="sel-dummy" style="width:100%; background:#2a170a; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; padding:3px;">
            ${charOptions(this.dummyChar)}
          </select>
        </div>
      </div>

      <!-- Mode Tabs -->
      <div style="display:flex; gap:4px; margin-bottom:10px;">
        <button id="tab-moves" style="flex:1; padding:5px; border-radius:4px; cursor:pointer; background:${this.activeTab === 'moves' ? '#f5c451' : '#3a2212'}; color:${this.activeTab === 'moves' ? '#1c110a' : '#f2d49b'}; font-weight:bold; border:1px solid #f5c451;">Gerakan & Latihan</button>
        <button id="tab-tuner" style="flex:1; padding:5px; border-radius:4px; cursor:pointer; background:${this.activeTab === 'tuner' ? '#f5c451' : '#3a2212'}; color:${this.activeTab === 'tuner' ? '#1c110a' : '#f2d49b'}; font-weight:bold; border:1px solid #f5c451;">Penyetel Sendi (Tuner)</button>
      </div>

      <!-- Content Container -->
      <div id="tab-content">
        ${this.activeTab === 'moves' ? this.renderMovesTab() : this.renderTunerTab()}
      </div>

      <!-- Footer Options -->
      <div style="border-top:1px solid #6b5526; padding-top:8px; margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
          <input type="checkbox" id="chk-debug" ${this.showDebug ? 'checked' : ''} />
          <span>Hitbox & Rangka (H)</span>
        </label>
        <button id="btn-reset-pos" style="background:#3a2212; border:1px solid #6b5526; color:#f2d49b; border-radius:4px; cursor:pointer; padding:3px 8px;">Reset Posisi</button>
      </div>
    `;

    this.bindDomEvents();
  }

  private renderMovesTab(): string {
    return `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px; color:#ffdd80; margin-bottom:4px;">Uji Gerak Serangan (Klik untuk Picu):</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <button class="btn-move" data-move="cakar" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Cakar (Pukul 1)</button>
          <button class="btn-move" data-move="tinju" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Tinju (Pukul 2)</button>
          <button class="btn-move" data-move="gempur" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Gempur (Pukul 3)</button>
          <button class="btn-move" data-move="tendangDepan" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Tendang Depan</button>
          <button class="btn-move" data-move="tendangBelakang" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Tendang Belakang</button>
          <button class="btn-move" data-move="tendangPutar" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Tendang Putar</button>
          <button class="btn-move" data-move="ekorApi" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Aji Ekor Api</button>
          <button class="btn-move" data-move="terjang" style="padding:4px; background:#3a2212; color:#f2d49b; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Terjang (Dive)</button>
        </div>
      </div>

      <div>
        <div style="font-size:11px; color:#ffdd80; margin-bottom:4px;">Perilaku Dummy Lawan:</div>
        <div style="display:flex; gap:4px;">
          <button class="btn-dummy-mode" data-mode="stand" style="flex:1; padding:4px; background:${this.dummyMode === 'stand' ? '#f5c451' : '#3a2212'}; color:${this.dummyMode === 'stand' ? '#1c110a' : '#f2d49b'}; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Diam</button>
          <button class="btn-dummy-mode" data-mode="block" style="flex:1; padding:4px; background:${this.dummyMode === 'block' ? '#f5c451' : '#3a2212'}; color:${this.dummyMode === 'block' ? '#1c110a' : '#f2d49b'}; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Tangkis</button>
          <button class="btn-dummy-mode" data-mode="counter" style="flex:1; padding:4px; background:${this.dummyMode === 'counter' ? '#f5c451' : '#3a2212'}; color:${this.dummyMode === 'counter' ? '#1c110a' : '#f2d49b'}; border:1px solid #6b5526; border-radius:4px; cursor:pointer;">Balas (AI)</button>
        </div>
      </div>
    `;
  }

  private renderTunerTab(): string {
    const joints: { key: JointKey; label: string; min: number; max: number; current: number }[] = [
      { key: 'frontArm', label: 'Bahu Depan', min: -180, max: 180, current: Math.round(this.p1.getJointAngle?.('frontArm') ?? -45) },
      { key: 'frontElbow', label: 'Siku Depan', min: -180, max: 180, current: Math.round(this.p1.getJointAngle?.('frontElbow') ?? 75) },
      { key: 'backArm', label: 'Bahu Belakang', min: -180, max: 180, current: Math.round(this.p1.getJointAngle?.('backArm') ?? 100) },
      { key: 'backElbow', label: 'Siku Belakang', min: -180, max: 180, current: Math.round(this.p1.getJointAngle?.('backElbow') ?? -105) },
      { key: 'frontLeg', label: 'Kaki Depan', min: -90, max: 90, current: Math.round(this.p1.getJointAngle?.('frontLeg') ?? -22) },
      { key: 'backLeg', label: 'Kaki Belakang', min: -90, max: 90, current: Math.round(this.p1.getJointAngle?.('backLeg') ?? 22) },
      { key: 'tail', label: 'Ekor', min: -90, max: 90, current: Math.round(this.p1.getJointAngle?.('tail') ?? 0) },
    ];

    return `
      <div style="font-size:11px; color:#ffdd80; margin-bottom:6px;">Putar Derajat Sendi P1 Secara Live:</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${joints
          .map(
            (j) => `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span>${j.label}</span>
              <span id="val-${j.key}" style="color:#f5c451;">${j.current}°</span>
            </div>
            <input type="range" class="joint-slider" data-joint="${j.key}" min="${j.min}" max="${j.max}" value="${j.current}" style="width:100%; accent-color:#f5c451; cursor:pointer;" />
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  private bindDomEvents(): void {
    if (!this.uiContainer) return;
    const el = this.uiContainer;

    // Esc
    el.querySelector('#btn-esc')?.addEventListener('click', () => {
      this.cleanupDom();
      this.scene.start('TitleScene');
    });

    // Character selects
    el.querySelector('#sel-p1')?.addEventListener('change', (e) => {
      this.p1Char = (e.target as HTMLSelectElement).value;
      this.spawnFighters();
      this.hud = new Hud(this, [`${this.p1Char.toUpperCase()} (P1)`, `${this.dummyChar.toUpperCase()} (DUMMY)`], [0, 0]);
      this.renderDomContent();
    });

    el.querySelector('#sel-dummy')?.addEventListener('change', (e) => {
      this.dummyChar = (e.target as HTMLSelectElement).value;
      this.spawnFighters();
      this.hud = new Hud(this, [`${this.p1Char.toUpperCase()} (P1)`, `${this.dummyChar.toUpperCase()} (DUMMY)`], [0, 0]);
      this.renderDomContent();
    });

    // Tabs
    el.querySelector('#tab-moves')?.addEventListener('click', () => {
      this.activeTab = 'moves';
      this.renderDomContent();
    });

    el.querySelector('#tab-tuner')?.addEventListener('click', () => {
      this.activeTab = 'tuner';
      this.renderDomContent();
    });

    // Trigger moves
    el.querySelectorAll('.btn-move').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const move = (e.currentTarget as HTMLElement).getAttribute('data-move') as MoveId;
        if (move) this.p1.startMove(move);
      });
    });

    // Dummy mode
    el.querySelectorAll('.btn-dummy-mode').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.dummyMode = (e.currentTarget as HTMLElement).getAttribute('data-mode') as any;
        this.renderDomContent();
      });
    });

    // Joint sliders
    el.querySelectorAll('.joint-slider').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const joint = input.getAttribute('data-joint') as JointKey;
        const val = parseFloat(input.value);
        const valSpan = el.querySelector(`#val-${joint}`);
        if (valSpan) valSpan.textContent = `${val}°`;
        this.p1.setManualJointAngle(joint, val);
      });
    });

    // Debug toggle
    el.querySelector('#chk-debug')?.addEventListener('change', (e) => {
      this.showDebug = (e.target as HTMLInputElement).checked;
      if (!this.showDebug) this.debugGraphics.clear();
    });

    // Reset position
    el.querySelector('#btn-reset-pos')?.addEventListener('click', () => {
      this.p1.x = MATCH.startX[0];
      this.p1.y = GAME.height - KELIR.floorHeight - FIGHTER.bodyHeight / 2;
      this.dummy.x = MATCH.startX[1];
      this.dummy.y = GAME.height - KELIR.floorHeight - FIGHTER.bodyHeight / 2;
    });
  }

  private cleanupDom(): void {
    if (this.uiContainer) {
      this.uiContainer.remove();
      this.uiContainer = undefined;
    }
  }

  private wireEvents(f: Fighter): void {
    f.on('fireball', (e: FireballEvent) => {
      this.effects.label(e.move.label, f.x, f.y - 130 * f.sizeScale, true, `p${f === this.p1 ? 0 : 1}`);
      this.fireballs.push(new Fireball(this, e, (x, y, size) => this.effects.ember(x, y, size)));
    });
    f.on('land', (x: number, y: number, impact?: boolean) => this.effects.dust(x, y, impact ? 2 : 1));
    f.on('jump', (x: number, y: number) => this.effects.dust(x, y, 0.6));
    f.on('aji', (name: string) => {
      if (name === 'triwikrama') {
        this.cameras.main.flash(250, 255, 224, 160);
        this.cameras.main.shake(300, 0.012);
        this.effects.label('Aji Triwikrama!', f.x, f.y - 230, true);
      }
      if (name === 'mengecil') this.effects.label('Mengecil', f.x, f.y - 60);
    });
  }

  private drawGedebog(): void {
    const h = KELIR.floorHeight;
    const top = GAME.height - h;
    const g = this.add.graphics();
    g.fillStyle(COLORS.gedebog).fillRect(0, top, GAME.width, h);
    g.fillStyle(COLORS.gedebogTop).fillRect(0, top, GAME.width, 6);
    g.lineStyle(1, COLORS.gedebogTop, 0.5);
    for (let y = top + 18; y < GAME.height; y += 14) g.lineBetween(0, y, GAME.width, y);
  }
}
