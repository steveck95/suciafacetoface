export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

export interface HSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

export function normalizeHex(hex: string): string {
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = cleaned[0] + cleaned[0];
    const g = cleaned[1] + cleaned[1];
    const b = cleaned[2] + cleaned[2];
    return `#${(r + g + b).toUpperCase()}`;
  }
  if (cleaned.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return '#008C95';
}

export function hexToRgb(hex: string): RGB {
  const norm = normalizeHex(hex).slice(1);
  const num = parseInt(norm, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rNorm = clamp(r, 0, 255) / 255;
  const gNorm = clamp(g, 0, 255) / 255;
  const bNorm = clamp(b, 0, 255) / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const sNorm = clamp(s, 0, 100) / 100;
  const lNorm = clamp(l, 0, 100) / 100;

  let r: number, g: number, b: number;

  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Applies brightness modifier (-100 to +100) to a hex color
 */
export function applyBrightnessToHex(hex: string, brightnessOffset: number): string {
  if (!brightnessOffset) return normalizeHex(hex);
  const rgb = hexToRgb(hex);
  const factor = (clamp(brightnessOffset, -100, 100) / 100) * 255;
  return rgbToHex({
    r: rgb.r + factor,
    g: rgb.g + factor,
    b: rgb.b + factor,
  });
}

/**
 * Generates random vibrant hex color
 */
export function randomHexColor(): string {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 55) + 35; // 35 - 90%
  const l = Math.floor(Math.random() * 50) + 25; // 25 - 75%
  return hslToHex({ h, s, l });
}

/**
 * Generates a harmonious palette for the entire card
 */
export interface HarmoniousPalette {
  name: string;
  background: string;
  colorBand: string;
  decoration: string;
  logo: string;
  mainText: string;
  subtitle: string;
  smallText: string;
  numberText: string;
}

export function generateHarmoniousPalette(): HarmoniousPalette {
  const baseHue = Math.floor(Math.random() * 360);
  const schemes = ['analogous', 'split', 'modern-transit', 'pastel-ic'] as const;
  const scheme = schemes[Math.floor(Math.random() * schemes.length)];

  if (scheme === 'modern-transit') {
    const bgLight = Math.random() > 0.25;
    const background = bgLight
      ? hslToHex({ h: baseHue, s: 8, l: 91 })
      : hslToHex({ h: baseHue, s: 22, l: 16 });
    const colorBand = hslToHex({ h: baseHue, s: 72, l: 44 });
    const decoration = hslToHex({ h: (baseHue + 35) % 360, s: 65, l: 32 });
    const logo = hslToHex({ h: baseHue, s: 75, l: 40 });
    const mainText = '#FFFFFF';
    const subtitle = bgLight
      ? hslToHex({ h: baseHue, s: 35, l: 24 })
      : hslToHex({ h: baseHue, s: 20, l: 88 });
    const smallText = bgLight
      ? hslToHex({ h: baseHue, s: 25, l: 32 })
      : hslToHex({ h: baseHue, s: 15, l: 80 });
    const numberText = bgLight ? '#4A5568' : '#CBD5E1';

    return {
      name: '諧調交通卡配色',
      background,
      colorBand,
      decoration,
      logo,
      mainText,
      subtitle,
      smallText,
      numberText,
    };
  }

  if (scheme === 'pastel-ic') {
    const background = hslToHex({ h: baseHue, s: 20, l: 94 });
    const colorBand = hslToHex({ h: (baseHue + 15) % 360, s: 62, l: 56 });
    const decoration = hslToHex({ h: (baseHue + 180) % 360, s: 45, l: 28 });
    const logo = hslToHex({ h: (baseHue + 15) % 360, s: 65, l: 48 });
    return {
      name: '柔和紀念卡配色',
      background,
      colorBand,
      decoration,
      logo,
      mainText: '#FFFFFF',
      subtitle: hslToHex({ h: baseHue, s: 40, l: 25 }),
      smallText: hslToHex({ h: baseHue, s: 35, l: 35 }),
      numberText: hslToHex({ h: baseHue, s: 20, l: 40 }),
    };
  }

  // analogous / split
  const offset = scheme === 'analogous' ? 28 : 150;
  const background = hslToHex({ h: baseHue, s: 12, l: 90 });
  const colorBand = hslToHex({ h: baseHue, s: 68, l: 42 });
  const decoration = hslToHex({ h: (baseHue + offset) % 360, s: 58, l: 24 });
  const logo = hslToHex({ h: (baseHue + offset) % 360, s: 70, l: 40 });

  return {
    name: '色彩學諧調配色',
    background,
    colorBand,
    decoration,
    logo,
    mainText: '#FFFFFF',
    subtitle: hslToHex({ h: baseHue, s: 45, l: 22 }),
    smallText: hslToHex({ h: baseHue, s: 30, l: 30 }),
    numberText: '#475569',
  };
}
