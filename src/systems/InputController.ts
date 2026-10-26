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

// Presses are latched from each key's 'down' event rather than read with
// JustDown: Phaser clears a key's just-down flag on release, so a tap that
// goes down and up between two frames would otherwise be lost.
export class KeyboardController implements Controller {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private pressed = new Set<Action>();

  constructor(scene: Phaser.Scene, map: KeyMap) {
    const kb = scene.input.keyboard!;
    const entries = Object.entries(map) as [Action, number[]][];
    this.keys = Object.fromEntries(entries.map(([action, codes]) => [action, codes.map((c) => kb.addKey(c))])) as Record<
      Action,
      Phaser.Input.Keyboard.Key[]
    >;

    const listeners: [Phaser.Input.Keyboard.Key, () => void][] = [];
    for (const [action, keys] of Object.entries(this.keys) as [Action, Phaser.Input.Keyboard.Key[]][]) {
      for (const key of keys) {
        const onDown = () => this.pressed.add(action);
        key.on(Phaser.Input.Keyboard.Events.DOWN, onDown);
        listeners.push([key, onDown]);
      }
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [key, fn] of listeners) key.off(Phaser.Input.Keyboard.Events.DOWN, fn);
    });
  }

  read(): InputState {
    const held = (a: Action) => this.keys[a].some((key) => key.isDown);
    const was = (a: Action) => this.pressed.has(a);
    const state: InputState = {
      left: held('left'),
      right: held('right'),
      jumpPressed: was('jump'),
      handPressed: was('hand'),
      kickPressed: was('kick'),
      triwikramaPressed: was('triwikrama'),
      ekorApiPressed: was('ekorApi'),
      mengecilPressed: was('mengecil'),
    };
    this.pressed.clear();
    return state;
  }
}
