import type { PlayerInput } from './types';

export type VirtualAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'jump'
  | 'dash'
  | 'melee'
  | 'proj'
  | 'ult'
  | 'shop';

const KEY_TO_ACTION: Record<string, VirtualAction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyL: 'dash',
  KeyJ: 'melee',
  KeyZ: 'melee',
  KeyK: 'proj',
  KeyX: 'proj',
  KeyU: 'ult',
  KeyC: 'ult',
  KeyB: 'shop',
  KeyE: 'shop',
};

export class InputManager {
  private keyHeld = new Set<string>();
  private touchHeld = new Set<VirtualAction>();
  private pendingPresses = new Set<VirtualAction>();
  private analogX = 0;
  private analogY = 0;
  private lastTouchMeleeTime = 0;
  private lastTouchProjTime = 0;
  private prevState: Record<VirtualAction, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    dash: false,
    melee: false,
    proj: false,
    ult: false,
    shop: false,
  };

  private onFirstGestureCallback?: () => void;
  private gestured = false;

  constructor(onFirstGesture?: () => void) {
    this.onFirstGestureCallback = onFirstGesture;
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  private triggerGesture(): void {
    if (!this.gestured) {
      this.gestured = true;
      this.onFirstGestureCallback?.();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    this.triggerGesture();
    const action = KEY_TO_ACTION[e.code];
    if (action) {
      e.preventDefault();
      if (!this.keyHeld.has(e.code)) {
        this.pendingPresses.add(action);
      }
      this.keyHeld.add(e.code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keyHeld.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keyHeld.clear();
    this.touchHeld.clear();
    this.pendingPresses.clear();
    this.analogX = 0;
    this.analogY = 0;
  };

  public setVirtualAction(action: VirtualAction, active: boolean): void {
    if (active) {
      this.triggerGesture();
      if (!this.touchHeld.has(action)) {
        this.pendingPresses.add(action);
      }
      this.touchHeld.add(action);
    } else {
      this.touchHeld.delete(action);
    }
  }

  /**
   * 360° Mobile Analog Thumbstick vector (-1..1).
   * Also sets digital up/down/left/right flags for network delta compatibility!
   */
  public setAnalogMove(nx: number, ny: number): void {
    this.triggerGesture();
    this.analogX = nx;
    this.analogY = ny;
  }

  private isActionHeld(action: VirtualAction): boolean {
    if (this.touchHeld.has(action)) return true;
    for (const code of this.keyHeld) {
      if (KEY_TO_ACTION[code] === action) return true;
    }
    return false;
  }

  public sample(): PlayerInput {
    const stickActive = Math.hypot(this.analogX, this.analogY) > 0.14;
    const up = this.isActionHeld('up') || (stickActive && this.analogY < -0.28);
    const down = this.isActionHeld('down') || (stickActive && this.analogY > 0.28);
    const left = this.isActionHeld('left') || (stickActive && this.analogX < -0.28);
    const right = this.isActionHeld('right') || (stickActive && this.analogX > 0.28);

    const jump = this.isActionHeld('jump');
    const dash = this.isActionHeld('dash');
    const melee = this.isActionHeld('melee');
    const proj = this.isActionHeld('proj');
    const ult = this.isActionHeld('ult');
    const shop = this.isActionHeld('shop');

    const consumeEdge = (action: VirtualAction, held: boolean): boolean => {
      return (held && !this.prevState[action]) || this.pendingPresses.has(action);
    };

    // Holding KIBAS or PECUT on mobile touch auto-fires smoothly every ~220ms (not 60Hz spam!)
    const now = performance.now();
    let touchAutoMelee = false;
    if (this.touchHeld.has('melee') && now - this.lastTouchMeleeTime >= 220) {
      this.lastTouchMeleeTime = now;
      touchAutoMelee = true;
    }
    let touchAutoProj = false;
    if (this.touchHeld.has('proj') && now - this.lastTouchProjTime >= 260) {
      this.lastTouchProjTime = now;
      touchAutoProj = true;
    }

    const input: PlayerInput = {
      up,
      down,
      left,
      right,
      moveX: stickActive ? Math.round(this.analogX * 100) / 100 : undefined,
      moveY: stickActive ? Math.round(this.analogY * 100) / 100 : undefined,
      jumpPressed: consumeEdge('jump', jump),
      dashPressed: consumeEdge('dash', dash),
      meleePressed: consumeEdge('melee', melee) || touchAutoMelee,
      projPressed: consumeEdge('proj', proj) || touchAutoProj,
      ultPressed: consumeEdge('ult', ult),
      shopPressed: consumeEdge('shop', shop),
    };

    this.pendingPresses.clear();
    this.prevState = { up, down, left, right, jump, dash, melee, proj, ult, shop };
    return input;
  }
}
