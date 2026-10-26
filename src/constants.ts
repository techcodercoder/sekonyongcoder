// All tunable values live here so feel can be adjusted without touching logic.
// Game logic runs in fixed frames (60 per second); frame counts are noted as
// "f". GSAP durations derived from them only drive the visuals. Angles are in
// degrees, speeds in px/s.

export const GAME = {
  width: 1280,
  height: 720,
  fps: 60,
  gravityY: 1600,
} as const;

export const COLORS = {
  kelir: 0xf2d49b, // warm cloth screen
  kelirEdgeRgb: '58, 31, 12', // vignette edge, used inside rgba()
  silhouette: 0x1c110a, // puppet shadow
  tatahan: 0x8a5a2b, // carved holes, lit from behind
  gedebog: 0x4a3a1c, // banana trunk the puppets stand on
  gedebogTop: 0x6b5526,
  blencongCore: 'rgba(255, 214, 140, 0.55)',
  blencongMid: 'rgba(255, 170, 80, 0.18)',
  ink: '#2a170a', // UI text
  gold: 0xf5c451,
} as const;

export const KELIR = {
  floorHeight: 80,
  wallMargin: 50, // fighters stay this far from the screen edges
  vignetteStrength: 0.85,
  // Blencong is an oil lamp: its glow flickers at random, slowly.
  blencong: {
    x: 640,
    y: 260,
    radius: 620,
    alphaMin: 0.7,
    alphaMax: 1,
    scaleMin: 0.97,
    scaleMax: 1.03,
    flickerMin: 0.15,
    flickerMax: 0.6,
  },
} as const;

export const MATCH = {
  roundsToWin: 2,
  roundSeconds: 99,
  startX: [360, 920], // P1, P2
  koFreeze: 30, // f of hit-stop on the final blow
  roundEndDelayMs: 2200,
} as const;

export const FIGHTER = {
  maxHealth: 1000,
  bodyWidth: 60, // hurtbox and push box
  bodyHeight: 150,
  walkForward: 230,
  walkBack: 170,
  jumpVelocity: 760,
  jumpForward: 230, // horizontal speed of a forward or back jump
  pushbackFriction: 0.86, // per frame, for knockback sliding
  knockdownLie: 36, // f on the floor after a launch
  getUp: 22, // f, invulnerable
  // f a press is remembered while the fighter is busy, so a press just before
  // recovering (end of a move, landing, hitstun) still comes out.
  inputBuffer: 8,
  koLaunch: { vx: 900, vy: -900, spin: 900 }, // dibuang: flung off the kelir
  // Parts-sheet puppet (src/assets/characters/hanoman). Set enabled to false
  // to fall back to the drawn placeholder.
  art: {
    enabled: true,
    height: 200, // on-screen px from crown to feet
    footDrop: 7, // px down, so feet still touch the floor with the legs spread
  },
  // Second player's colours, until each side has its own character.
  altTint: 0xa9c4ff,
} as const;

// A real wayang is one leather body with two jointed arms, each moved by its
// own tuding stick; the dalang walks it by bobbing and tilting the gapit.
// Wayang moves in quick snaps followed by short holds, hence sharp ease-outs.
// The legs are separate pieces too, so fights can add kicks.
//
// Joint angles: 0 = hanging straight down, positive swings backward,
// negative forward. Phaser wraps angles to [-180, 180], so values past 180
// (e.g. 290) mean "keep rotating backward over the top", which GSAP tweens
// the long way round.
export type JointKey = 'frontArm' | 'frontElbow' | 'backArm' | 'backElbow' | 'frontLeg' | 'backLeg' | 'tail';
export type JointPose = Partial<Record<JointKey, number>>;

export const POSE = {
  settleDuration: 0.08,
  // Kuda-kuda, the wayang fighting stance: legs planted wide, front hand on
  // the hip with the elbow out, back arm stretched back at shoulder height
  // with the forearm and claw hanging down.
  stance: { frontArm: -45, frontElbow: 75, backArm: 100, backElbow: -105, frontLeg: -22, backLeg: 22 },
  idle: {
    armSwing: 4,
    duration: 1.4,
    ease: 'sine.inOut',
  },
  walk: {
    armSwing: 22,
    legSwing: 8,
    bob: 6,
    tilt: 3,
    duration: 0.24,
    hold: 0.05,
    ease: 'power3.out',
  },
  jump: {
    backArm: 140,
    frontArm: -100,
    elbow: -30,
    frontLeg: -35,
    backLeg: 25,
    tilt: 6,
    duration: 0.12,
    ease: 'power3.out',
  },
  // A forward jump is a monkey's salto.
  salto: { duration: 0.5, ease: 'power2.out' },
  guard: { frontArm: -110, frontElbow: -70, backArm: -40, backElbow: -90, tilt: -5 },
  hurt: { frontArm: 40, backArm: 150, frontElbow: 30, backElbow: -40, tilt: -14 },
} as const;

export type MoveId =
  | 'cakar'
  | 'tinju'
  | 'gempur'
  | 'tendangDepan'
  | 'tendangBelakang'
  | 'tendangPutar'
  | 'sabetUdara'
  | 'terjang'
  | 'ekorApi';

// Frame data. A move runs windUp + strike (startup), then `active` frames
// where its hitbox can connect, then `recovery`. Pressing hand or kick during
// a move queues the branch in `next`, which starts as soon as the active
// frames end.
export interface Move {
  label: string; // shown when it connects
  windUp: JointPose;
  strike: JointPose;
  windUpFrames: number;
  strikeFrames: number;
  active: number; // 0 with `dive`: active until landing
  recovery: number;
  damage: number;
  hitstun: number; // f the defender is stunned on hit
  blockstun: number; // f on block
  pushback: number; // px/s the defender slides on hit or block
  launch?: boolean; // knocks down instead of stunning
  lunge: number; // forward px/s from the strike
  hop: number; // upward px/s at wind-up, 0 for none
  bodyTilt: { windUp: number; strike: number }; // whole puppet lean, positive = forward
  spin?: number; // degrees the whole puppet turns during the strike
  dive?: number; // downward px/s: flies until it lands
  fire?: boolean; // the tail burns through the move (Aji Ekor Api)
  fireball?: boolean; // no melee hitbox; a fireball leaves the tail tip
  // Hitbox relative to the body center when facing right.
  hit: { x: number; y: number; w: number; h: number };
  shake: { duration: number; intensity: number };
  next: { hand?: MoveId; kick?: MoveId };
}

export const COMBO = {
  start: {
    ground: { hand: 'cakar', kick: 'tendangDepan' },
    air: { hand: 'sabetUdara', kick: 'terjang' },
  } satisfies Record<'ground' | 'air', Record<'hand' | 'kick', MoveId>>,
  lungeDecay: 15, // f for a lunge to stop
  moves: {
    cakar: {
      label: 'Cakar',
      windUp: { frontArm: 160, frontElbow: 0 },
      strike: { frontArm: 290 },
      windUpFrames: 5,
      strikeFrames: 3,
      active: 3,
      recovery: 12,
      damage: 50,
      hitstun: 18,
      blockstun: 12,
      pushback: 160,
      lunge: 140,
      hop: 0,
      bodyTilt: { windUp: -8, strike: 10 },
      hit: { x: 20, y: -90, w: 90, h: 90 },
      shake: { duration: 60, intensity: 0.002 },
      next: { hand: 'tinju', kick: 'tendangDepan' },
    },
    tinju: {
      label: 'Tinju',
      windUp: { backArm: 70, backElbow: -60, frontArm: 30 },
      strike: { backArm: -95, backElbow: 0 },
      windUpFrames: 5,
      strikeFrames: 3,
      active: 3,
      recovery: 13,
      damage: 60,
      hitstun: 19,
      blockstun: 12,
      pushback: 220,
      lunge: 240,
      hop: 0,
      bodyTilt: { windUp: -4, strike: 14 },
      hit: { x: 25, y: -60, w: 85, h: 45 },
      shake: { duration: 60, intensity: 0.003 },
      next: { hand: 'gempur', kick: 'tendangPutar' },
    },
    gempur: {
      label: 'Gempur!',
      windUp: { frontArm: 165, backArm: 175, frontElbow: -20, backElbow: -20 },
      strike: { frontArm: 300, backArm: 290, frontElbow: 0, backElbow: 0 },
      windUpFrames: 11,
      strikeFrames: 5,
      active: 4,
      recovery: 22,
      damage: 120,
      hitstun: 0,
      blockstun: 18,
      pushback: 380,
      launch: true,
      lunge: 260,
      hop: 380,
      bodyTilt: { windUp: -14, strike: 18 },
      hit: { x: 10, y: -40, w: 120, h: 110 },
      shake: { duration: 160, intensity: 0.009 },
      next: {},
    },
    tendangDepan: {
      label: 'Tendang',
      windUp: { frontLeg: 20, frontArm: -40, backArm: 50 },
      strike: { frontLeg: -85 },
      windUpFrames: 5,
      strikeFrames: 3,
      active: 3,
      recovery: 13,
      damage: 55,
      hitstun: 18,
      blockstun: 12,
      pushback: 220,
      lunge: 160,
      hop: 0,
      bodyTilt: { windUp: -6, strike: -12 },
      hit: { x: 25, y: -20, w: 95, h: 50 },
      shake: { duration: 60, intensity: 0.003 },
      next: { hand: 'tinju', kick: 'tendangBelakang' },
    },
    tendangBelakang: {
      label: 'Tendang Tinggi',
      windUp: { backLeg: 40, frontArm: -60, backArm: 80 },
      strike: { backLeg: -110, frontLeg: 5 },
      windUpFrames: 6,
      strikeFrames: 5,
      active: 4,
      recovery: 15,
      damage: 70,
      hitstun: 20,
      blockstun: 14,
      pushback: 260,
      lunge: 200,
      hop: 0,
      bodyTilt: { windUp: -4, strike: -16 },
      hit: { x: 20, y: -70, w: 100, h: 70 },
      shake: { duration: 70, intensity: 0.004 },
      next: { hand: 'gempur', kick: 'tendangPutar' },
    },
    tendangPutar: {
      label: 'Tendang Putar!',
      windUp: { frontLeg: 15, backArm: 120, frontArm: -120 },
      strike: { frontLeg: -95, backLeg: 20 },
      windUpFrames: 6,
      strikeFrames: 18,
      active: 5,
      recovery: 16,
      damage: 130,
      hitstun: 0,
      blockstun: 18,
      pushback: 420,
      launch: true,
      lunge: 180,
      hop: 320,
      bodyTilt: { windUp: 0, strike: 0 },
      spin: 360,
      hit: { x: -40, y: -70, w: 150, h: 130 },
      shake: { duration: 160, intensity: 0.009 },
      next: {},
    },
    sabetUdara: {
      label: 'Sabet',
      windUp: { frontArm: 150, backArm: -60 },
      strike: { frontArm: 300, backArm: 120 },
      windUpFrames: 6,
      strikeFrames: 5,
      active: 4,
      recovery: 10,
      damage: 60,
      hitstun: 18,
      blockstun: 12,
      pushback: 180,
      lunge: 120,
      hop: 200,
      bodyTilt: { windUp: -6, strike: 12 },
      hit: { x: 0, y: -90, w: 120, h: 130 },
      shake: { duration: 60, intensity: 0.003 },
      next: { kick: 'terjang' },
    },
    terjang: {
      label: 'Terjang!',
      windUp: { frontLeg: -20, backLeg: 40, frontArm: -150, backArm: 140 },
      strike: { frontLeg: -75, backLeg: 20, frontArm: -50, backArm: 100 },
      windUpFrames: 7,
      strikeFrames: 4,
      active: 0,
      recovery: 14,
      damage: 100,
      hitstun: 0,
      blockstun: 16,
      pushback: 360,
      launch: true,
      lunge: 520,
      hop: 120,
      bodyTilt: { windUp: -10, strike: 25 },
      dive: 900,
      hit: { x: 10, y: 10, w: 90, h: 70 },
      shake: { duration: 200, intensity: 0.012 },
      next: {},
    },
    // Triggered by Aji Ekor Api, not by the hand/kick buttons: the tail is
    // drawn back, then whipped forward to fling a fireball.
    ekorApi: {
      label: 'Ekor Api!',
      windUp: { tail: -25, frontArm: -70, backArm: 70 },
      strike: { tail: 75, frontArm: -100 },
      windUpFrames: 12,
      strikeFrames: 6,
      active: 0,
      recovery: 18,
      damage: 90, // the fireball's
      hitstun: 22,
      blockstun: 16,
      pushback: 300,
      lunge: 0,
      hop: 0,
      bodyTilt: { windUp: -8, strike: 10 },
      fire: true,
      fireball: true,
      hit: { x: 0, y: 0, w: 0, h: 0 },
      shake: { duration: 90, intensity: 0.004 },
      next: {},
    },
  } satisfies Record<MoveId, Move>,
};

// Aji: powers paid for with a meter filled by landing (and taking) blows.
export const AJI = {
  max: 100,
  gainHit: 8, // attacker, per blow that connects
  gainBlock: 3, // attacker, per blocked blow
  gainHurt: 5, // defender, per blow taken
  triwikrama: {
    cost: 100, // needs a full meter; it drains while active
    frames: 8 * 60,
    scale: 1.6,
    power: 1.5, // damage and pushback multiplier
    speed: 0.85, // walk speed multiplier
    growDuration: 0.6,
  },
  ekorApi: {
    cost: 35,
  },
  mengecil: {
    scale: 0.55,
    power: 0.5,
    speed: 1.3,
    shrinkDuration: 0.3,
  },
  fireball: {
    speed: 620, // px/s forward
    drop: 70, // px/s downward, so it arcs from the tail tip toward the body
    radius: 16,
    chip: 0.1, // share of damage taken through a block
    lifeFrames: 120,
    trailEvery: 2, // f between trail embers
  },
  // Size changes step like a dalang's hand, not a smooth zoom.
  sizeEase: 'steps(5)',
} as const;

export const STICKS = {
  show: true,
  color: 0x2a1a0e,
  tudingLength: 90,
  tudingWidth: 2.5,
  tudingSlant: 12, // degrees off vertical, dalang holds them slightly behind
  gapitLength: 120, // below the feet
  gapitWidth: 4,
} as const;

export const EFFECTS = {
  hitStop: 5, // f the action freezes when a blow lands
  hitStopHeavy: 9, // launchers, fireballs, Triwikrama blows
  blockStop: 3,
  sparkColor: 0xf5c451,
  sparkCount: 10,
  dustColor: 0x6b5526,
  comboResetFrames: 40, // a combo counter clears once the defender recovers this long
} as const;

// CPU opponent ("Lawan Dalang"). Lower reaction and higher chances = harder.
export const AI = {
  decideEvery: [8, 16], // f between decisions, random in range
  blockChance: 0.55, // when the player attacks within reach
  chainChance: 0.6, // keep pressing during its own combo
  fireballChance: 0.02, // per decision at range, with meter
  jumpChance: 0.08,
  closeRange: 140,
  midRange: 260,
} as const;
