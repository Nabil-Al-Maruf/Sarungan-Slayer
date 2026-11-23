import QRCode from 'qrcode';

export async function renderQrCodeToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: { width?: number; margin?: number }
): Promise<void> {
  try {
    await QRCode.toCanvas(canvas, text, {
      width: options?.width ?? 160,
      margin: options?.margin ?? 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to render QR Code:', err);
  }
}

export function buildInviteUrl(roomCode: string, mode: 'coop' | 'stick' = 'coop'): string {
  const loc = window.location;
  const base = `${loc.protocol}//${loc.host}${loc.pathname}`;
  return `${base}?room=${encodeURIComponent(roomCode)}&role=${mode}&autojoin=1`;
}
