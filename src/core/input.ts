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

  private isActionHeld(action: VirtualAction): boolean {
    if (this.touchHeld.has(action)) return true;
    for (const code of this.keyHeld) {
      if (KEY_TO_ACTION[code] === action) return true;
    }
    return false;
  }

  public sample(): PlayerInput {
    const up = this.isActionHeld('up');
    const down = this.isActionHeld('down');
    const left = this.isActionHeld('left');
    const right = this.isActionHeld('right');
    const jump = this.isActionHeld('jump');
    const dash = this.isActionHeld('dash');
    const melee = this.isActionHeld('melee');
    const proj = this.isActionHeld('proj');
    const ult = this.isActionHeld('ult');
    const shop = this.isActionHeld('shop');

    const consumeEdge = (action: VirtualAction, held: boolean): boolean => {
      return (held && !this.prevState[action]) || this.pendingPresses.has(action);
    };

    const input: PlayerInput = {
      up,
      down,
      left,
      right,
      jumpPressed: consumeEdge('jump', jump),
      dashPressed: consumeEdge('dash', dash),
      meleePressed: consumeEdge('melee', melee),
      projPressed: consumeEdge('proj', proj),
      ultPressed: consumeEdge('ult', ult),
      shopPressed: consumeEdge('shop', shop),
    };

    this.pendingPresses.clear();
    this.prevState = { up, down, left, right, jump, dash, melee, proj, ult, shop };
    return input;
  }
}
