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

export interface Controller {
  read(): InputState;
}

export type Action = 'left' | 'right' | 'jump' | 'hand' | 'kick' | 'triwikrama' | 'ekorApi' | 'mengecil';

// Drives a fighter exclusively from a gamepad/joystick.
export class GamepadController implements Controller {
  private pressed = new Set<Action>();
  private prevJump = false;
  private prevHand = false;
  private prevKick = false;
  private prevTriwikrama = false;
  private prevEkorApi = false;
  private prevMengecil = false;

  constructor(private scene: Phaser.Scene, private padIndex = 0) {
    const bindPad = (pad: Phaser.Input.Gamepad.Gamepad) => {
      if (pad.index !== this.padIndex) return;
      pad.on('down', (buttonIndex: number) => {
        this.onButtonDown(buttonIndex);
      });
    };

    if (scene.input.gamepad) {
      const current = scene.input.gamepad.getPad(this.padIndex);
      if (current) bindPad(current);
      scene.input.gamepad.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        bindPad(pad);
      });
    }
  }

  private isDirectInputPS(): boolean {
    const pad = this.scene.input.gamepad?.getPad(this.padIndex);
    const nativePads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const nativePad = nativePads[this.padIndex];
    const id = (((pad as any)?.id || nativePad?.id) || '').toLowerCase();
    const mapping = (pad as any)?.mapping || nativePad?.mapping;

    return (mapping !== 'standard') && (
      id.includes('054c') ||
      id.includes('wireless controller') ||
      id.includes('dualshock') ||
      id.includes('dualsense') ||
      id.includes('sony') ||
      id.includes('playstation') ||
      id.includes('usb gamepad') ||
      id.includes('twin') ||
      id.includes('generic')
    );
  }

  private onButtonDown(btn: number): void {
    if (this.isDirectInputPS()) {
      // DirectInput PlayStation:
      // 1: X (Cross / Jump)
      if (btn === 1 || btn === 12) this.pressed.add('jump');
      // 0: Kotak (Square / Punch)
      if (btn === 0) this.pressed.add('hand');
      // 2: O (Circle / Kick)
      if (btn === 2) this.pressed.add('kick');
      // 3: Triangle (Triwikrama)
      if (btn === 3) this.pressed.add('triwikrama');
      // 5: R1 or 7: R2 (Ekor Api)
      if (btn === 5 || btn === 7) this.pressed.add('ekorApi');
      // 4: L1 or 6: L2 (Mengecil)
      if (btn === 4 || btn === 6) this.pressed.add('mengecil');
    } else {
      // Standard / XInput:
      // 0: A / Cross (Jump)
      if (btn === 0 || btn === 12) this.pressed.add('jump');
      // 2: X / Square (Punch)
      if (btn === 2) this.pressed.add('hand');
      // 1: B / Circle (Kick)
      if (btn === 1) this.pressed.add('kick');
      // 3: Y / Triangle (Triwikrama)
      if (btn === 3) this.pressed.add('triwikrama');
      // 5: R1 or 7: R2 (Ekor Api)
      if (btn === 5 || btn === 7) this.pressed.add('ekorApi');
      // 4: L1 or 6: L2 (Mengecil)
      if (btn === 4 || btn === 6) this.pressed.add('mengecil');
    }
  }

  read(): InputState {
    const pad = this.scene.input.gamepad?.getPad(this.padIndex);
    const nativePads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    const nativePad = nativePads[this.padIndex];

    if ((!pad || !pad.connected) && (!nativePad || !nativePad.connected)) {
      return NO_INPUT;
    }

    // Directional: Analog stick (axes) or D-Pad
    let axisX = 0;
    let axisY = 0;
    let padLeft = false;
    let padRight = false;
    let padUp = false;

    if (pad && pad.connected) {
      axisX = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      axisY = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      padLeft = Boolean(pad.left);
      padRight = Boolean(pad.right);
      padUp = Boolean(pad.up);
    }
    if (nativePad && nativePad.connected) {
      if (nativePad.axes.length > 0 && Math.abs(nativePad.axes[0]) > Math.abs(axisX)) axisX = nativePad.axes[0];
      if (nativePad.axes.length > 1 && Math.abs(nativePad.axes[1]) > Math.abs(axisY)) axisY = nativePad.axes[1];
      if (nativePad.buttons[14]?.pressed) padLeft = true;
      if (nativePad.buttons[15]?.pressed) padRight = true;
      if (nativePad.buttons[12]?.pressed) padUp = true;
    }

    const isLeft = Boolean(padLeft || axisX < -0.3);
    const isRight = Boolean(padRight || axisX > 0.3);
    const isUp = Boolean(padUp || axisY < -0.5);

    const isDInput = this.isDirectInputPS();

    // Helper to query button state from both Phaser pad and native Gamepad
    const isBtnPressed = (idx: number) => {
      const pBtn = pad?.buttons?.[idx];
      const nBtn = nativePad?.buttons?.[idx];
      return Boolean(
        (pBtn && (pBtn.pressed || pBtn.value > 0.5)) ||
        (nBtn && (nBtn.pressed || nBtn.value > 0.5))
      );
    };

    // Button Mapping: DirectInput PS vs Standard XInput
    // DirectInput PS: 1=X(Jump), 0=Kotak(Punch), 2=O(Kick), 3=Triangle(Triwikrama)
    // Standard XInput: 0=A(Jump), 2=X(Punch), 1=B(Kick), 3=Y(Triwikrama)
    const jumpBtn = isDInput ? isBtnPressed(1) : isBtnPressed(0);
    const handBtn = isDInput ? isBtnPressed(0) : isBtnPressed(2);
    const kickBtn = isDInput ? isBtnPressed(2) : isBtnPressed(1);
    const triwikramaBtn = isBtnPressed(3);
    const ekorApiBtn = isBtnPressed(5) || isBtnPressed(7); // R1 or R2
    const mengecilBtn = isBtnPressed(4) || isBtnPressed(6); // L1 or L2

    // Edge triggers
    const jumpDown = Boolean(isUp || jumpBtn);
    if (jumpDown && !this.prevJump) this.pressed.add('jump');
    this.prevJump = jumpDown;

    if (handBtn && !this.prevHand) this.pressed.add('hand');
    this.prevHand = handBtn;

    if (kickBtn && !this.prevKick) this.pressed.add('kick');
    this.prevKick = kickBtn;

    if (triwikramaBtn && !this.prevTriwikrama) this.pressed.add('triwikrama');
    this.prevTriwikrama = triwikramaBtn;

    if (ekorApiBtn && !this.prevEkorApi) this.pressed.add('ekorApi');
    this.prevEkorApi = ekorApiBtn;

    if (mengecilBtn && !this.prevMengecil) this.pressed.add('mengecil');
    this.prevMengecil = mengecilBtn;

    const state: InputState = {
      left: isLeft,
      right: isRight,
      jumpPressed: this.pressed.has('jump'),
      handPressed: this.pressed.has('hand'),
      kickPressed: this.pressed.has('kick'),
      triwikramaPressed: this.pressed.has('triwikrama'),
      ekorApiPressed: this.pressed.has('ekorApi'),
      mengecilPressed: this.pressed.has('mengecil'),
    };

    this.pressed.clear();
    return state;
  }
}

// Deprecated stubs for backwards compatibility
export const KEYMAPS = { p1: {}, p2: {} } as any;
export class KeyboardController implements Controller {
  read(): InputState {
    return NO_INPUT;
  }
}
