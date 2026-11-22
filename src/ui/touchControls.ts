import type { InputManager, VirtualAction } from '../core/input';
import { haptic } from './haptics';

export type TouchDisplayMode = 'auto' | 'on' | 'off';
export const TOUCH_MODE_STORAGE_KEY = 'arek_slayer_touch_mode_v1';

export interface TouchControlsHandle {
  getTouchMode: () => TouchDisplayMode;
  setTouchMode: (mode: TouchDisplayMode) => boolean;
  toggleTouchOverlay: () => boolean;
  isTouchActive: () => boolean;
}

export function getStoredTouchMode(): TouchDisplayMode {
  try {
    const v = localStorage.getItem(TOUCH_MODE_STORAGE_KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch {
    // Ignore storage error
  }
  return 'auto';
}

/**
 * Ergonomic Mobile Touch Controller:
 * - Left Zone: Smooth 360° Virtual Analog Thumbstick (#joystick-zone) with multi-touch pointer tracking
 * - Right Zone: Arc-arranged Action Buttons with hold-to-attack support & multi-touch pointer tracking
 * - Explicit setting support: OTOMATIS (Deteksi) | SELALU TAMPIL | SEMBUNYIKAN
 */
export function bindTouchControls(
  input: InputManager,
  onShopClick?: () => void,
  onTouchActive?: () => void
): TouchControlsHandle {
  const appEl = document.getElementById('app')!;
  let currentMode = getStoredTouchMode();

  const applyTouchState = (mode: TouchDisplayMode): boolean => {
    currentMode = mode;
    try {
      localStorage.setItem(TOUCH_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore
    }

    let active = false;
    if (mode === 'on') {
      active = true;
    } else if (mode === 'off') {
      active = false;
    } else {
      // 'auto': On wide screens (laptops, PCs, TVs, monitor tablets > 1024px),
      // default to OFF to keep the screen uncluttered. On mobile phones/tablets <= 1024px with touch, default ON.
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const isNarrow = window.innerWidth <= 1024 || window.innerHeight <= 600;
      active = isCoarse && isNarrow;
    }

    appEl.classList.toggle('touch-active', active);
    return active;
  };

  applyTouchState(currentMode);

  // 1. Bind 360° Analog Thumbstick
  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');

  if (joyZone && joyBase && joyKnob) {
    let activePointerId: number | null = null;
    let centerX = 0;
    let centerY = 0;
    let maxRadius = 46;

    let inDeadzone = true;
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
        if (!inDeadzone) {
          inDeadzone = true;
        }
        input.setAnalogMove(0, 0);
      } else {
        if (inDeadzone) {
          inDeadzone = false;
          haptic.stick();
        }
        const mag = Math.min(1, dist / (maxRadius * 0.76));
        input.setAnalogMove(Math.cos(angle) * mag, Math.sin(angle) * mag);
      }
    };

    const resetStick = () => {
      activePointerId = null;
      inDeadzone = true;
      joyZone.classList.remove('active');
      joyKnob.style.transform = 'translate(0px, 0px)';
      input.setAnalogMove(0, 0);
    };

    joyZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      onTouchActive?.();
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      joyZone.setPointerCapture(e.pointerId);
      joyZone.classList.add('active');
      haptic.stick();

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
      onTouchActive?.();
      btnPointerId = e.pointerId;
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');

      // Authentic console-grade haptic impulse based on action
      switch (action) {
        case 'melee':
          haptic.attack();
          break;
        case 'dash':
          haptic.dash();
          break;
        case 'jump':
          haptic.jump();
          break;
        case 'proj':
          haptic.proj();
          break;
        case 'ult':
          haptic.ultimate();
          break;
        case 'shop':
          haptic.tap();
          break;
        default:
          haptic.tap();
          break;
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
    getTouchMode: () => currentMode,
    setTouchMode: (mode: TouchDisplayMode) => applyTouchState(mode),
    toggleTouchOverlay: () => {
      const isCurrentlyActive = appEl.classList.contains('touch-active');
      const nextMode = isCurrentlyActive ? 'off' : 'on';
      return applyTouchState(nextMode);
    },
    isTouchActive: () => appEl.classList.contains('touch-active'),
  };
}
