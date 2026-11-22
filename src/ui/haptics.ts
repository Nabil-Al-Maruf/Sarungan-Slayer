export class HapticFeedback {
  private enabled = true;

  constructor() {
    try {
      this.enabled = typeof localStorage !== 'undefined' && localStorage.getItem('arek_slayer_haptic_v1') !== '0';
    } catch {
      this.enabled = true;
    }
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      localStorage.setItem('arek_slayer_haptic_v1', val ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private trigger(pattern: number | number[]): void {
    if (!this.enabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration error on unsupported devices
    }
  }

  /** Subtle tick when thumb touches stick or crosses 50% deadzone */
  public stick(): void {
    this.trigger(8);
  }

  /** Crisp button tap for UI and simple actions */
  public tap(): void {
    this.trigger(12);
  }

  /** Melee slash impact */
  public attack(): void {
    this.trigger(22);
  }

  /** Dash dodge double-kick */
  public dash(): void {
    this.trigger([14, 25, 20]);
  }

  /** Pecut whip crack */
  public proj(): void {
    this.trigger(30);
  }

  /** Jump double lift */
  public jump(): void {
    this.trigger([10, 15, 12]);
  }

  /** Ultimate skill heavy rumble */
  public ultimate(): void {
    this.trigger([45, 30, 60, 30, 90]);
  }

  /** Player damage jar */
  public damage(): void {
    this.trigger([35, 20, 25]);
  }

  /** Boss or Wave defeat celebration */
  public victory(): void {
    this.trigger([30, 40, 50, 40, 90]);
  }
}

export const haptic = new HapticFeedback();
