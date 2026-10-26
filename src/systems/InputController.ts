import Phaser from 'phaser';

export interface InputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  handPressed: boolean;
  kickPressed: boolean;
  triwikramaPressed: boolean;
  ekorApiPressed: boolean;
  mengecilPressed: boolean;
}

export const NO_INPUT: InputState = {
  left: false,
  right: false,
  jumpPressed: false,
  handPressed: false,
  kickPressed: false,
  triwikramaPressed: false,
  ekorApiPressed: false,
  mengecilPressed: false,
};

// Anything that can drive a fighter: a keyboard layout or the CPU.
export interface Controller {
  read(): InputState;
}

type Action = 'left' | 'right' | 'jump' | 'hand' | 'kick' | 'triwikrama' | 'ekorApi' | 'mengecil';
type KeyMap = Record<Action, number[]>;

const K = Phaser.Input.Keyboard.KeyCodes;

// Two players share one keyboard: P1 on the left half, P2 on the right.
export const KEYMAPS: Record<'p1' | 'p2', KeyMap> = {
  p1: {
    left: [K.A],
    right: [K.D],
    jump: [K.W],
    hand: [K.J],
    kick: [K.K],
    triwikrama: [K.U],
    ekorApi: [K.I],
    mengecil: [K.O],
  },
  p2: {
    left: [K.LEFT],
    right: [K.RIGHT],
    jump: [K.UP],
    hand: [K.COMMA, K.NUMPAD_ONE],
    kick: [K.PERIOD, K.NUMPAD_TWO],
    triwikrama: [K.L, K.NUMPAD_FOUR],
    ekorApi: [K.SEMICOLON, K.NUMPAD_FIVE],
    mengecil: [K.QUOTES, K.NUMPAD_SIX],
  },
};

export class KeyboardController implements Controller {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;

  constructor(scene: Phaser.Scene, map: KeyMap) {
    const kb = scene.input.keyboard!;
    this.keys = Object.fromEntries(
      Object.entries(map).map(([action, codes]) => [action, codes.map((c) => kb.addKey(c))]),
    ) as Record<Action, Phaser.Input.Keyboard.Key[]>;
  }

  read(): InputState {
    const k = this.keys;
    const held = (a: Action) => k[a].some((key) => key.isDown);
    return {
      left: held('left'),
      right: held('right'),
      jumpPressed: anyJustDown(k.jump),
      handPressed: anyJustDown(k.hand),
      kickPressed: anyJustDown(k.kick),
      triwikramaPressed: anyJustDown(k.triwikrama),
      ekorApiPressed: anyJustDown(k.ekorApi),
      mengecilPressed: anyJustDown(k.mengecil),
    };
  }
}

// JustDown clears a key's flag when read, so every key must be read each frame.
function anyJustDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
}
