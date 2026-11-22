import QRCode from 'qrcode';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Render a high-contrast, easily-scannable QR code to a canvas element.
 */
export async function renderQrCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: QrRenderOptions
): Promise<boolean> {
  if (!canvas || !text) return false;
  try {
    await QRCode.toCanvas(canvas, text, {
      width: options?.width || 180,
      margin: options?.margin ?? 1,
      color: {
        dark: options?.darkColor || '#0f172a',
        light: options?.lightColor || '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a mobile join URL suitable for QR scanning.
 */
export function buildInviteUrl(
  roomCode: string,
  connectionMode: 'online' | 'hotspot',
  autojoin = true
): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const modeParam = connectionMode === 'hotspot' ? '&mode=hotspot' : '';
  const joinParam = autojoin ? '&autojoin=1' : '';
  return `${base}?room=${encodeURIComponent(roomCode.toUpperCase())}${modeParam}${joinParam}`;
}
