import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, EFFECTS, FIGHTER, GAME, KELIR, MATCH } from '../constants';
import { Fighter, type FireballEvent, type HitResult } from '../entities/Fighter';
import { Fireball } from '../entities/Fireball';
import { pieceKey } from '../entities/Puppet';
import { AIController } from '../systems/AIController';
import { Effects } from '../systems/Effects';
import { gununganTransition, preloadGunungan } from '../systems/Gunungan';
import { Hud } from '../systems/Hud';
import { GamepadController, NO_INPUT, type Controller, type InputState } from '../systems/InputController';
import { Lighting } from '../systems/Lighting';
import type { Mode } from './TitleScene';
import storyConfig from '../data/story-config.json';

const allCharacterPieces = import.meta.glob<string>('../assets/characters/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const STEP_MS = 1000 / GAME.fps;

export interface RoundData {
  mode: Mode;
  wins: [number, number];
  round: number;
  chapterIndex?: number;
  player1Char?: string;
  cpuChar?: string;
}

type Phase = 'intro' | 'fight' | 'over';

export class FightScene extends Phaser.Scene {
  private match!: RoundData;
  private fighters!: [Fighter, Fighter];
  private controllers!: [Controller, Controller];
  private fireballs: Fireball[] = [];
  private effects!: Effects;
  private hud!: Hud;
  private phase: Phase = 'intro';
  private framesLeft = 0;
  private hitStop = 0;
  private combo: [number, number] = [0, 0];
  private accumulator = 0;
  private pending: [InputState, InputState] = [NO_INPUT, NO_INPUT];
  private p1RageUsed = false;
  private p1RagePromptShown = false;
  private cpuRageUsed = false;
  private cpuRageWarningShown = false;
  private cpuRageTimer = 0;
  private matchOverActive = false;
  private matchOverHandled = false;

  constructor() {
    super('FightScene');
  }

  preload(): void {
    preloadGunungan(this);
    for (const [path, url] of Object.entries(allCharacterPieces)) {
      const parts = path.split('/');
      const piece = parts.pop()!.replace('.png', '');
      const character = parts.pop()!;
      this.load.image(pieceKey(character, piece), url);
    }
  }

  create(data: RoundData): void {
    this.match = data;
    this.phase = 'intro';
    this.fireballs = [];
    this.combo = [0, 0];
    this.hitStop = 0;
    this.accumulator = 0;
    this.pending = [NO_INPUT, NO_INPUT];
    this.framesLeft = MATCH.roundSeconds * GAME.fps;
    this.p1RageUsed = false;
    this.p1RagePromptShown = false;
    this.cpuRageUsed = false;
    this.cpuRageWarningShown = false;
    this.cpuRageTimer = 0;
    this.matchOverActive = false;
    this.matchOverHandled = false;
    gsap.globalTimeline.resume();

    new Lighting(this);
    this.drawGedebog();
    this.effects = new Effects(this);

    // Get current chapter from story-config.json if in arcade mode
    const currentChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === (data.chapterIndex ?? 1)) ?? storyConfig.chapters[0];
    const p1Char = data.player1Char ?? (data.mode === 'arcade' ? currentChapter?.player1 : 'hanoman') ?? 'hanoman';
    const cpuChar = data.cpuChar ?? (data.mode === 'arcade' ? currentChapter?.cpu : 'hanoman') ?? 'hanoman';

    const isAutoRevive = data.mode === 'arcade';
    const p1 = new Fighter(this, MATCH.startX[0], 1, p1Char, undefined, isAutoRevive);
    const p2 = new Fighter(this, MATCH.startX[1], -1, cpuChar, p1Char === cpuChar ? FIGHTER.altTint : undefined, false);
    p1.opponent = p2;
    p2.opponent = p1;
    this.fighters = [p1, p2];
    this.fighters.forEach((f) => this.wireEvents(f));

    const cpu = data.mode !== 'versus';
    const fireballs = () => this.fireballs;
    this.controllers = [
      data.mode === 'demo' ? new AIController(p1, p2, fireballs) : new GamepadController(this, 0),
      cpu ? new AIController(p2, p1, fireballs) : new GamepadController(this, 1),
    ];
    this.setupGamepadIndicators();

    const p1Label = p1Char.charAt(0).toUpperCase() + p1Char.slice(1);
    const cpuLabel = cpuChar.charAt(0).toUpperCase() + cpuChar.slice(1);
    this.hud = new Hud(this, [`${p1Label} · P1`, cpu ? `${cpuLabel} · Dalang` : `${cpuLabel} · P2`], data.wins);

    gununganTransition(this, () => {
      const bannerTitle = data.mode === 'arcade' && currentChapter ? currentChapter.title : `Babak ${data.round}`;
      const bannerSub = data.mode === 'arcade' && currentChapter ? currentChapter.subtitle : '';
      this.hud.announce(bannerTitle, bannerSub, 0.7);
      this.time.delayedCall(900, () => {
        this.hud.announce('Perang!', '', 0.5);
        this.phase = 'fight';
      });
    });

    // Exclusively joystick-driven: exit via Select/Back on gamepad
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 4);
    this.collectInputs();
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      this.step(this.pending);
      // Presses count once, even if several logic frames run this render frame.
      this.pending = this.pending.map((i) => ({ ...NO_INPUT, left: i.left, right: i.right })) as [InputState, InputState];
    }
    this.hud.update(this.fighters, this.framesLeft / GAME.fps);

    if (this.matchOverActive && !this.matchOverHandled) {
      const pad = this.input.gamepad?.getPad(0);
      if (pad && pad.connected) {
        const isRestart = Boolean(
          pad.A ||
          pad.X ||
          (pad.buttons[0] && pad.buttons[0].pressed) ||
          (pad.buttons[2] && pad.buttons[2].pressed)
        );
        const isStart = Boolean(pad.buttons[9] && pad.buttons[9].pressed);
        const isB = Boolean(pad.B || (pad.buttons[1] && pad.buttons[1].pressed));
        const isBack = Boolean(pad.buttons[8] && pad.buttons[8].pressed);

        if (isRestart) {
          this.matchOverHandled = true;
          this.scene.restart({ ...this.match, wins: [0, 0], round: 1 });
          return;
        }
        if (isStart || isB || isBack) {
          this.matchOverHandled = true;
          this.scene.start('TitleScene');
          return;
        }
      }
    }
  }

  private collectInputs(): void {
    const live = this.controllers.map((c) => c.read()) as [InputState, InputState];
    this.pending = this.pending.map((held, i) => {
      if (this.phase !== 'fight') return NO_INPUT;
      const now = live[i];
      return {
        left: now.left,
        right: now.right,
        jumpPressed: held.jumpPressed || now.jumpPressed,
        handPressed: held.handPressed || now.handPressed,
        kickPressed: held.kickPressed || now.kickPressed,
        triwikramaPressed: held.triwikramaPressed || now.triwikramaPressed,
        ekorApiPressed: held.ekorApiPressed || now.ekorApiPressed,
        mengecilPressed: held.mengecilPressed || now.mengecilPressed,
      };
    }) as [InputState, InputState];
  }

  private step(inputs: [InputState, InputState]): void {
    if (this.hitStop > 0) {
      if (--this.hitStop === 0) gsap.globalTimeline.resume();
      return;
    }

    // Check Rage Combat triggers in Arcade mode
    if (this.match.mode === 'arcade' && this.phase === 'fight') {
      const [p1, p2] = this.fighters;

      // 1. Player 1 Rage trigger (HP <= 50%)
      if (!this.p1RageUsed && p1.health <= FIGHTER.maxHealth * 0.5) {
        if (!this.p1RagePromptShown) {
          this.p1RagePromptShown = true;
          this.effects.label('⚡ AMUK SIAP! TEKAN TOMBOL SERANG! ⚡', p1.x, p1.y - 180, true);
        }
        const p1In = inputs[0];
        const anyAction = p1In.handPressed || p1In.kickPressed || p1In.jumpPressed || p1In.ekorApiPressed || p1In.triwikramaPressed || p1In.mengecilPressed;
        if (anyAction) {
          this.p1RageUsed = true;
          this.triggerRageCombat(p1, p2, false);
          return;
        }
      }

      // 2. CPU Rage trigger (HP <= 40% - Boss Phase "Last Stand" / Comeback Mechanic)
      const currentChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === (this.match.chapterIndex ?? 1)) ?? storyConfig.chapters[0];
      const cpuRageAllowed = currentChapter?.cpuRageEnabled ?? true;

      if (cpuRageAllowed && !this.cpuRageUsed && p2.health <= FIGHTER.maxHealth * 0.4) {
        if (!this.cpuRageWarningShown) {
          this.cpuRageWarningShown = true;
          this.cpuRageTimer = 75; // ~1.25 detik (75 frames @ 60fps) jeda telegraphing
          const cpuName = p2.character.toUpperCase();
          this.effects.label(`⚠️ AWAS! ${cpuName} MEMASUKI FASE MURKA! ⚠️`, p2.x, p2.y - 180, true);
          this.cameras.main.flash(350, 220, 40, 40);
          this.cameras.main.shake(350, 0.015);
        } else if (this.cpuRageTimer > 0) {
          this.cpuRageTimer--;
        } else {
          // Trigger CPU Rage Combat when timer elapses
          this.cpuRageUsed = true;
          this.triggerRageCombat(p2, p1, true);
          return;
        }
      }
    }

    this.fighters.forEach((f, i) => f.tick(inputs[i]));
    this.fireballs.forEach((b) => b.tick());
    this.fireballs = this.fireballs.filter((b) => b.alive);
    this.separate();
    this.resolveHits();
    this.trackCombos();

    if (this.phase === 'fight' && --this.framesLeft <= 0) this.timeUp();
  }

  private triggerRageCombat(attacker: Fighter, defender: Fighter, isCpu: boolean): void {
    this.phase = 'intro';
    attacker.freezeInPlace();
    defender.freezeInPlace();

    if (isCpu) {
      this.cameras.main.flash(450, 220, 20, 20);
      this.cameras.main.shake(400, 0.02);
    } else {
      this.cameras.main.flash(400, 255, 200, 50);
    }

    const currentChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === (this.match.chapterIndex ?? 1)) ?? storyConfig.chapters[0];
    const defaultRageVids = ['/videos/combo_1_sugriwa_ke_subali.mp4', '/videos/combo_2_sugriwa_ke_subali.mp4'];

    const specificVids = isCpu
      ? (currentChapter?.cpuRageVideos ?? currentChapter?.rageVideos ?? []).filter((v: string) => v && v.endsWith('.mp4'))
      : (currentChapter?.playerRageVideos ?? currentChapter?.rageVideos ?? []).filter((v: string) => v && v.endsWith('.mp4'));

    const pool = specificVids.length > 0 ? specificVids : defaultRageVids;
    const chosenVideo = pool[Math.floor(Math.random() * pool.length)];

    const attackerName = attacker.character.toUpperCase();
    const defenderName = defender.character.toUpperCase();

    const badge = isCpu
      ? `⚠️ AMUK MURKA DALANG: ${attackerName} ⚠️`
      : `⚡ RAGE COMBAT AMUK WAYANG: ${attackerName} ⚡`;

    const title = isCpu
      ? `Jurus Pamungkas ${attackerName}!`
      : 'Jurus Pamungkas Mengguncang Kelir!';

    const subtitle = isCpu
      ? `Waspada! Amukan murka memotong 40% darah ${defenderName}!`
      : `Amukan sakti ${attackerName} memotong 50% darah lawan!`;

    const damagePercent = isCpu ? 0.4 : 0.5;
    const damageAmount = Math.round(FIGHTER.maxHealth * damagePercent);

    this.time.delayedCall(300, () => {
      this.scene.pause();
      this.scene.launch('CinematicScene', {
        badge,
        title,
        subtitle,
        videoUrl: chosenVideo,
        durationSeconds: 10,
        onComplete: () => {
          this.scene.stop('CinematicScene');
          this.scene.resume();
          this.phase = 'fight';
          defender.takeDirectDamage(damageAmount);

          const dmgLabel = isCpu ? '-40% DARAH TERPOTONG!' : '-50% DARAH LAWAN!';
          this.effects.label(dmgLabel, defender.x, defender.y - 140, true);
          this.cameras.main.shake(500, 0.02);

          if (defender.health <= 1) {
            this.knockout(isCpu ? 1 : 0);
          }
        },
      });
    });
  }

  private separate(): void {
    const [a, b] = this.fighters;
    const solid = (f: Fighter) => f.state !== 'ko' && f.state !== 'lying' && f.state !== 'knockdown';
    if (!solid(a) || !solid(b)) return;
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
    const rest = minDist - Math.abs(b.x - a.x);
    if (rest > 0) {
      if (clamp(b.x + dir * rest) !== b.x + dir * rest) a.x = clamp(a.x - dir * rest);
      else b.x += dir * rest;
    }
  }

  private resolveHits(): void {
    const [a, b] = this.fighters;
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
      const result = defender.receiveHit(move, attacker.x, attacker.power);
      attacker.onConnect(result);
      const heavy = !!move.launch || attacker.power > 1;
      this.onImpact(i, result, contact.centerX, contact.centerY, heavy, attacker.facing);
      if (result !== 'block') this.effects.label(move.label, attacker.x, attacker.y - 130 * attacker.sizeScale, heavy, `p${i}`);
    });

    for (const ball of this.fireballs) {
      if (!ball.alive) continue;
      const clash = this.fireballs.find(
        (o) => o !== ball && o.alive && o.owner !== ball.owner && Phaser.Geom.Intersects.RectangleToRectangle(o.area(), ball.area()),
      );
      if (clash) {
        this.effects.burst((ball.x + clash.x) / 2, (ball.y + clash.y) / 2, 1);
        ball.destroy();
        clash.destroy();
        continue;
      }
      const target = ball.owner.opponent;
      if (target.invulnerable || !Phaser.Geom.Intersects.RectangleToRectangle(ball.area(), target.hurtbox())) continue;
      const result = target.receiveHit(ball.move, ball.x - ball.direction * 40, ball.power);
      this.effects.burst(ball.x, ball.y, ball.power);
      this.onImpact(this.fighters.indexOf(ball.owner), result, ball.x, ball.y, true, ball.direction);
      ball.destroy();
    }
  }

  private onImpact(attacker: number, result: HitResult, x: number, y: number, heavy: boolean, direction: number): void {
    if (result === 'block') {
      this.effects.guard(x, y, direction);
      this.freeze(EFFECTS.blockStop);
      return;
    }
    this.effects.spark(x, y, heavy);
    this.combo[attacker]++;
    this.hud.combo(attacker, this.combo[attacker]);
    if (result === 'ko') return this.knockout(attacker);
    this.freeze(heavy ? EFFECTS.hitStopHeavy : EFFECTS.hitStop);
  }

  private trackCombos(): void {
    this.fighters.forEach((f, i) => {
      if (this.combo[i] && f.opponent.actionable) {
        this.combo[i] = 0;
        this.hud.combo(i, 0);
      }
    });
  }

  private freeze(frames: number): void {
    this.hitStop = Math.max(this.hitStop, frames);
    gsap.globalTimeline.pause();
  }

  private knockout(winner: number): void {
    this.freeze(MATCH.koFreeze);
    this.cameras.main.flash(300, 255, 236, 200);
    this.endRound(winner, 'Kalah!');
  }

  private timeUp(): void {
    const [a, b] = this.fighters;
    const winner = a.health === b.health ? -1 : a.health > b.health ? 0 : 1;
    this.endRound(winner, 'Waktu habis');
  }

  private endRound(winner: number, reason: string): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const wins = [...this.match.wins] as [number, number];
    if (winner >= 0) {
      wins[winner]++;
      this.fighters[winner].celebrate();
    }
    this.hud.announce(reason, winner >= 0 ? `${this.sideName(winner)} unggul` : 'Seri');

    const champion = wins.findIndex((w) => w >= MATCH.roundsToWin);
    this.time.delayedCall(MATCH.roundEndDelayMs, () => {
      if (champion >= 0) return this.matchOver(champion);
      this.scene.restart({ ...this.match, wins, round: this.match.round + 1 });
    });
  }

  private matchOver(champion: number): void {
    // In Arcade Mode: If Player 1 wins, transition to Outro Film and next chapter!
    if (this.match.mode === 'arcade' && champion === 0) {
      const currentIdx = this.match.chapterIndex ?? 1;
      const currentChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === currentIdx) ?? storyConfig.chapters[0];
      const nextIdx = currentIdx + 1;
      const nextChapter = storyConfig.chapters.find((c: any) => c.chapterIndex === nextIdx);

      this.scene.pause();
      this.scene.launch('CinematicScene', {
        badge: `🎬 EPILOG BABAK ${currentIdx}`,
        title: `${currentChapter.title} Paripurna!`,
        subtitle: nextChapter ? `Bersiap menuju Babak ${nextIdx}: ${nextChapter.title}` : 'Kisah Epos Ramayana Telah Tamat Sempurna!',
        videoUrl: currentChapter.outroVideo,
        durationSeconds: 6,
        onComplete: () => {
          this.scene.stop('CinematicScene');
          if (nextChapter) {
            this.scene.launch('CinematicScene', {
              badge: `🎬 PROLOG BABAK ${nextIdx}`,
              title: nextChapter.title,
              subtitle: nextChapter.subtitle,
              videoUrl: nextChapter.introVideo,
              durationSeconds: 6,
              onComplete: () => {
                this.scene.stop('CinematicScene');
                this.scene.restart({
                  mode: 'arcade',
                  wins: [0, 0],
                  round: 1,
                  chapterIndex: nextIdx,
                  player1Char: nextChapter.player1,
                  cpuChar: nextChapter.cpu,
                });
              },
            });
          } else {
            // Victory: all chapters complete -> Show cultural CTA Prambanan before Title
            const promo = (storyConfig as any).prambananPromo;
            if (promo && promo.enabled !== false) {
              this.scene.start('PrambananScene', promo);
            } else {
              this.scene.start('TitleScene');
            }
          }
        },
      });
      return;
    }

    this.matchOverActive = true;
    this.matchOverHandled = false;
    this.hud.announce(`${this.sideName(champion)} menang!`, '🎮 [⬜] Main Lagi         [Start] Menu Utama');

    const doRestart = () => {
      if (this.matchOverHandled) return;
      this.matchOverHandled = true;
      this.scene.restart({ ...this.match, wins: [0, 0], round: 1 });
    };

    const doMenu = () => {
      if (this.matchOverHandled) return;
      this.matchOverHandled = true;
      this.scene.start('TitleScene');
    };

    // Silent keyboard fallbacks (tidak ditampilkan di UI)
    this.input.keyboard?.once('keydown-J', doRestart);
    this.input.keyboard?.once('keydown-ENTER', doRestart);
    this.input.keyboard?.once('keydown-SPACE', doRestart);
    this.input.keyboard?.once('keydown-ESC', doMenu);

    // Interactive clickable UI Buttons on screen
    const btnY = 325;
    const restartBtn = this.add
      .rectangle(GAME.width / 2 - 130, btnY, 210, 40, 0x1c110a, 0.9)
      .setStrokeStyle(2, 0xf5c451)
      .setDepth(110)
      .setInteractive({ useHandCursor: true });

    const restartText = this.add
      .text(GAME.width / 2 - 130, btnY, '🎮 [⬜] Main Lagi', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(111);

    const menuBtn = this.add
      .rectangle(GAME.width / 2 + 130, btnY, 210, 40, 0x1c110a, 0.9)
      .setStrokeStyle(1.5, 0xd4af37, 0.8)
      .setDepth(110)
      .setInteractive({ useHandCursor: true });

    const menuText = this.add
      .text(GAME.width / 2 + 130, btnY, '🔘 [Start] Menu', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#f2d49b',
      })
      .setOrigin(0.5)
      .setDepth(111);

    restartBtn.on('pointerdown', doRestart);
    menuBtn.on('pointerdown', doMenu);

    restartBtn.on('pointerover', () => {
      restartBtn.setFillStyle(0x3a1f0c, 1);
      restartBtn.setStrokeStyle(2.5, 0xffe082);
    });
    restartBtn.on('pointerout', () => {
      restartBtn.setFillStyle(0x1c110a, 0.9);
      restartBtn.setStrokeStyle(2, 0xf5c451);
    });

    menuBtn.on('pointerover', () => {
      menuBtn.setFillStyle(0x3a1f0c, 1);
      menuBtn.setStrokeStyle(2, 0xffe082);
    });
    menuBtn.on('pointerout', () => {
      menuBtn.setFillStyle(0x1c110a, 0.9);
      menuBtn.setStrokeStyle(1.5, 0xd4af37, 0.8);
    });

    gsap.to([restartBtn, restartText, menuBtn, menuText], {
      scale: 1.04,
      duration: 0.8,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    if (this.input.gamepad) {
      const pad = this.input.gamepad.getPad(0);
      const onEndBtn = (btn: number) => {
        if (btn === 0 || btn === 2) doRestart(); // 0: A/Cross, 2: X/Square (Kotak)
        else if (btn === 9 || btn === 1 || btn === 8) doMenu();
      };
      if (pad) pad.on('down', onEndBtn);
      this.input.gamepad.on('connected', (newPad: Phaser.Input.Gamepad.Gamepad) => {
        if (newPad.index === 0) newPad.on('down', onEndBtn);
      });
    }
  }

  private sideName(i: number): string {
    if (i === 0) return 'Pemain 1';
    return this.match.mode === 'versus' ? 'Pemain 2' : 'Dalang';
  }

  private wireEvents(f: Fighter): void {
    f.on('fireball', (e: FireballEvent) => {
      this.effects.label(e.move.label, f.x, f.y - 130 * f.sizeScale, true, `p${this.fighters.indexOf(f)}`);
      this.fireballs.push(new Fireball(this, e, (x, y, size) => this.effects.ember(x, y, size)));
    });
    f.on('land', (x: number, y: number, impact?: boolean) => this.effects.dust(x, y, impact ? 2 : 1));
    f.on('jump', (x: number, y: number) => this.effects.dust(x, y, 0.6));
    f.on('revive', () => {
      this.cameras.main.flash(500, 255, 215, 0);
      this.effects.label('✨ BANGKIT KEMBALI! ✨', f.x, f.y - 180, true);
      this.hud.announce('Prajurit Bangkit Kembali!', 'Takdir kemenangan belum usai', 1.2);
    });
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
  private setupGamepadIndicators(): void {
    const padText = this.add
      .text(GAME.width / 2, 22, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f5c451',
        stroke: '#1c110a',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(150);

    const updateStatus = () => {
      const nativePads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const pad0 = nativePads[0] || this.input.gamepad?.getPad(0);
      const pad1 = nativePads[1] || this.input.gamepad?.getPad(1);

      if (this.match.mode === 'versus') {
        if (pad0 && pad0.connected && pad1 && pad1.connected) {
          padText.setText('🎮 P1 & P2: DUA JOYSTICK TERHUBUNG');
          padText.setColor('#81c784');
          this.time.delayedCall(3000, () => gsap.to(padText, { alpha: 0, duration: 0.6 }));
        } else if (pad0 && pad0.connected) {
          padText.setText('🎮 P1 Siap | P2: Sambungkan Joystick 2 & tekan tombol');
          padText.setColor('#ffb74d');
          padText.setAlpha(1);
        } else {
          padText.setText('🎮 Sambungkan Joystick untuk bertarung');
          padText.setColor('#ffb74d');
          padText.setAlpha(1);
        }
      } else {
        if (pad0 && pad0.connected) {
          padText.setText('🎮 JOYSTICK 1 TERHUBUNG');
          padText.setColor('#81c784');
          this.time.delayedCall(3000, () => gsap.to(padText, { alpha: 0, duration: 0.6 }));
        } else {
          padText.setText('🎮 Sambungkan Joystick & tekan sembarang tombol');
          padText.setColor('#ffe082');
          padText.setAlpha(1);
        }
      }
    };

    updateStatus();
    this.input.gamepad?.on('connected', updateStatus);
    this.input.gamepad?.on('disconnected', updateStatus);

    if (this.input.gamepad) {
      const pad = this.input.gamepad.getPad(0);
      const onPadExit = (btn: number) => {
        if (btn === 8) this.scene.start('TitleScene');
      };
      if (pad) pad.on('down', onPadExit);
      this.input.gamepad.on('connected', (p: Phaser.Input.Gamepad.Gamepad) => {
        if (p.index === 0) p.on('down', onPadExit);
      });
    }
  }
}
