import type { InputManager, VirtualAction } from '../core/input';

/**
 * Ergonomic Mobile Touch Controller:
 * - Left Zone: Smooth 360° Virtual Analog Thumbstick (#joystick-zone) with multi-touch pointer tracking
 * - Right Zone: Arc-arranged Action Buttons with hold-to-attack support & multi-touch pointer tracking
 */
export function bindTouchControls(
  input: InputManager,
  onShopClick?: () => void
): { toggleTouchOverlay: () => boolean } {
  const appEl = document.getElementById('app')!;
  const isTouchDevice =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches;

  let touchOverlayForced = isTouchDevice;
  appEl.classList.toggle('touch-active', touchOverlayForced);

  // 1. Bind 360° Analog Thumbstick
  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');

  if (joyZone && joyBase && joyKnob) {
    let activePointerId: number | null = null;
    let centerX = 0;
    let centerY = 0;
    let maxRadius = 46;

    const updateStick = (clientX: number, clientY: number) => {
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(maxRadius, dist);
      const angle = Math.atan2(dy, dx);
      const kx = dist > 0 ? Math.cos(angle) * clamped : 0;
      const ky = dist > 0 ? Math.sin(angle) * clamped : 0;

      joyKnob.style.transform = `translate(${Math.round(kx)}px, ${Math.round(ky)}px)`;

      if (dist < 6) {
        input.setAnalogMove(0, 0);
      } else {
        const mag = Math.min(1, dist / (maxRadius * 0.76));
        input.setAnalogMove(Math.cos(angle) * mag, Math.sin(angle) * mag);
      }
    };

    const resetStick = () => {
      activePointerId = null;
      joyZone.classList.remove('active');
      joyKnob.style.transform = 'translate(0px, 0px)';
      input.setAnalogMove(0, 0);
    };

    joyZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      joyZone.setPointerCapture(e.pointerId);
      joyZone.classList.add('active');

      const rect = joyBase.getBoundingClientRect();
      centerX = rect.left + rect.width * 0.5;
      centerY = rect.top + rect.height * 0.5;
      maxRadius = Math.max(32, rect.width * 0.36);
      updateStick(e.clientX, e.clientY);
    });

    joyZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      updateStick(e.clientX, e.clientY);
    });

    joyZone.addEventListener('pointerup', (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      resetStick();
    });

    joyZone.addEventListener('pointercancel', (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      resetStick();
    });
  }

  // 2. Bind Right-Hand Action Buttons (independent multi-touch pointer capture)
  const buttons = document.querySelectorAll<HTMLButtonElement>('.vbtn[data-action]');
  for (const btn of buttons) {
    const action = btn.dataset.action as VirtualAction;
    let btnPointerId: number | null = null;

    const press = (e: PointerEvent) => {
      e.preventDefault();
      btnPointerId = e.pointerId;
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {
          // Ignore unsupported vibrate
        }
      }
      if (action === 'shop') {
        onShopClick?.();
        return;
      }
      input.setVirtualAction(action, true);
    };

    const release = (e: PointerEvent) => {
      if (btnPointerId !== null && e.pointerId !== btnPointerId) return;
      e.preventDefault();
      btnPointerId = null;
      btn.classList.remove('pressed');
      if (action !== 'shop') {
        input.setVirtualAction(action, false);
      }
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  }

  return {
    toggleTouchOverlay: () => {
      touchOverlayForced = !touchOverlayForced;
      appEl.classList.toggle('touch-active', touchOverlayForced);
      return touchOverlayForced;
    },
  };
}
