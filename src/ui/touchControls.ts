import type { InputManager, VirtualAction } from '../core/input';

export function bindTouchControls(
  input: InputManager,
  onShopClick?: () => void
): { toggleTouchOverlay: () => boolean } {
  const appEl = document.getElementById('app')!;
  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

  let touchOverlayForced = isTouchDevice;
  appEl.classList.toggle('touch-active', touchOverlayForced);

  const buttons = document.querySelectorAll<HTMLButtonElement>('.vbtn[data-action]');
  for (const btn of buttons) {
    const action = btn.dataset.action as VirtualAction;

    const press = (e: Event) => {
      e.preventDefault();
      btn.classList.add('pressed');
      if (action === 'shop') {
        onShopClick?.();
        return;
      }
      input.setVirtualAction(action, true);
    };

    const release = (e: Event) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      if (action !== 'shop') {
        input.setVirtualAction(action, false);
      }
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  return {
    toggleTouchOverlay: () => {
      touchOverlayForced = !touchOverlayForced;
      appEl.classList.toggle('touch-active', touchOverlayForced);
      return touchOverlayForced;
    },
  };
}
