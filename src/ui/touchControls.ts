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
  onTouchActive?: () => void,
  onElementClick?: () => void
): TouchControlsHandle {
  const appEl = document.getElementById('app')!;
  let currentMode = getStoredTouchMode();

  document.getElementById('vbtn-stick-elem')?.addEventListener('click', () => {
    onElementClick?.();
  });

  const detectTouchDevice = (): boolean => {
    return (
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches
    );
  };

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
      // 'auto': If device supports touch, or is on mobile/tablet dimensions (<= 1024px), enable touch controls!
      const hasTouch = detectTouchDevice();
      const isMobileOrTablet = window.innerWidth <= 1024 || window.innerHeight <= 768;
      active = hasTouch || isMobileOrTablet;
    }

    appEl.classList.toggle('touch-active', active);
    return active;
  };

  applyTouchState(currentMode);

  // Dynamic auto-activation: if the user touches the screen on any touch-capable device, activate controls!
  window.addEventListener(
    'touchstart',
    () => {
      if (currentMode !== 'off' && !appEl.classList.contains('touch-active')) {
        appEl.classList.add('touch-active');
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (
        (e.pointerType === 'touch' || e.pointerType === 'pen') &&
        currentMode !== 'off' &&
        !appEl.classList.contains('touch-active')
      ) {
        appEl.classList.add('touch-active');
      }
    },
    { passive: true }
  );

  window.addEventListener('resize', () => {
    if (currentMode === 'auto') {
      applyTouchState('auto');
    }
  });

  window.addEventListener('orientationchange', () => {
    if (currentMode === 'auto') {
      applyTouchState('auto');
    }
  });

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

    const setupStickMetrics = () => {
      const rect = joyBase.getBoundingClientRect();
      centerX = rect.left + rect.width * 0.5;
      centerY = rect.top + rect.height * 0.5;
      maxRadius = Math.max(32, rect.width * 0.42);
    };

    const joyStart = (clientX: number, clientY: number, id: number) => {
      onTouchActive?.();
      if (activePointerId !== null && activePointerId !== id) return;
      activePointerId = id;
      joyZone.classList.add('active');
      haptic.stick();
      setupStickMetrics();
      updateStick(clientX, clientY);
    };

    const joyMove = (clientX: number, clientY: number, id: number) => {
      if (activePointerId !== id) return;
      updateStick(clientX, clientY);
    };

    const joyEnd = (id: number) => {
      if (activePointerId !== id) return;
      resetStick();
    };

    // 1. Pointer Events (Desktop Mouse, Stylus & Pointer Devices)
    joyZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      try {
        joyZone.setPointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      joyStart(e.clientX, e.clientY, e.pointerId);
    });

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        if (activePointerId === e.pointerId) {
          joyMove(e.clientX, e.clientY, e.pointerId);
        }
      },
      { passive: true }
    );

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId === e.pointerId) {
        try {
          if (joyZone.hasPointerCapture(e.pointerId)) {
            joyZone.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Safe ignore
        }
        joyEnd(e.pointerId);
      }
    };
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    joyZone.addEventListener('lostpointercapture', () => resetStick());

    // 2. Touch Events (Native Multi-Touch Guarantee on Mobile)
    joyZone.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (t) joyStart(t.clientX, t.clientY, t.identifier);
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (activePointerId === null) return;
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          if (t.identifier === activePointerId) {
            joyMove(t.clientX, t.clientY, t.identifier);
            break;
          }
        }
      },
      { passive: true }
    );

    const onTouchEnd = (e: TouchEvent) => {
      if (activePointerId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activePointerId) {
          joyEnd(e.changedTouches[i].identifier);
          break;
        }
      }
    };
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Window lifecycle safety
    window.addEventListener('blur', resetStick);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetStick();
    });
  }

  // 2. Bind Right-Hand Action Buttons (multi-touch safe, zero pointer capture collisions)
  const buttons = document.querySelectorAll<HTMLButtonElement>('.vbtn[data-action]');
  for (const btn of buttons) {
    const action = btn.dataset.action as VirtualAction;
    let isPressed = false;
    let boundPointerId: number | null = null;
    let boundTouchId: number | null = null;

    const startPress = () => {
      if (isPressed) return;
      isPressed = true;
      onTouchActive?.();
      btn.classList.add('pressed');

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
      } else if ((action as string) === 'elem') {
        onElementClick?.();
      } else {
        input.setVirtualAction(action, true);
      }
    };

    const endPress = () => {
      if (!isPressed) return;
      isPressed = false;
      boundPointerId = null;
      boundTouchId = null;
      btn.classList.remove('pressed');
      if (action !== 'shop') {
        input.setVirtualAction(action, false);
      }
    };

    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      boundPointerId = e.pointerId;
      startPress();
    });

    btn.addEventListener('pointerup', (e: PointerEvent) => {
      e.preventDefault();
      if (boundPointerId === null || boundPointerId === e.pointerId) {
        endPress();
      }
    });

    btn.addEventListener('pointercancel', (e: PointerEvent) => {
      if (boundPointerId === null || boundPointerId === e.pointerId) {
        endPress();
      }
    });

    btn.addEventListener('pointerleave', (e: PointerEvent) => {
      if (boundPointerId === e.pointerId) {
        endPress();
      }
    });

    btn.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (t) {
          boundTouchId = t.identifier;
        }
        startPress();
      },
      { passive: false }
    );

    btn.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (boundTouchId === null || e.changedTouches[i].identifier === boundTouchId) {
            endPress();
            break;
          }
        }
      },
      { passive: false }
    );

    btn.addEventListener('touchcancel', () => endPress(), { passive: true });

    // Global window events only release if the matching pointer/touch released
    window.addEventListener('pointerup', (e: PointerEvent) => {
      if (boundPointerId !== null && boundPointerId === e.pointerId) {
        endPress();
      }
    });

    window.addEventListener('touchend', (e: TouchEvent) => {
      if (boundTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === boundTouchId) {
            endPress();
            break;
          }
        }
      }
    });

    window.addEventListener('blur', () => endPress());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) endPress();
    });
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
