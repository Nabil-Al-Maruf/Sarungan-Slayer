/**
 * Browser Fullscreen Helper:
 * Handles vendor prefixes, auto-fullscreen preference, and resize triggers.
 */

const STORAGE_KEY_AUTO_FS = 'arek_slayer_autofs_v1';

export function isAutoFullscreenEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY_AUTO_FS) !== '0';
}

export function setAutoFullscreenEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY_AUTO_FS, enabled ? '1' : '0');
}

export function isFullscreen(): boolean {
  const doc = document as Document & {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  };
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export async function requestFullscreen(target?: Element): Promise<boolean> {
  const elem = (target || document.documentElement) as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  };

  if (isFullscreen()) return true;

  try {
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
      tryLockLandscape();
      return true;
    }
    if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
      tryLockLandscape();
      return true;
    }
    if (elem.mozRequestFullScreen) {
      await elem.mozRequestFullScreen();
      tryLockLandscape();
      return true;
    }
    if (elem.msRequestFullscreen) {
      await elem.msRequestFullscreen();
      tryLockLandscape();
      return true;
    }
  } catch {
    // User denied or browser disallowed programmatic fullscreen
  }
  return false;
}

function tryLockLandscape(): void {
  try {
    if (screen.orientation && 'lock' in screen.orientation) {
      void (screen.orientation as any).lock('landscape').catch(() => {});
    }
  } catch {}
}

export async function exitFullscreen(): Promise<boolean> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
  };

  if (!isFullscreen()) return true;

  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return true;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    }
    if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return true;
    }
    if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
      return true;
    }
  } catch {
    // Ignore error
  }
  return false;
}

export async function toggleFullscreen(target?: Element): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return requestFullscreen(target);
}

export function triggerAutoFullscreenIfEnabled(): void {
  if (isAutoFullscreenEnabled()) {
    void requestFullscreen();
  }
}
