import {
  CardElement,
  CardProjectState,
  ScopeColorRule,
  ShapeCardElement,
  TextCardElement,
} from '../types/card';
import { applyBrightnessToHex } from './color';

const imageCache = new Map<string, HTMLImageElement>();

export function preloadCardImage(
  src: string,
  onReady?: () => void
): HTMLImageElement | null {
  if (!src) return null;
  const cached = imageCache.get(src);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0 && onReady) {
      onReady();
    }
    return cached;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (onReady) onReady();
  };
  img.src = src;
  imageCache.set(src, img);
  return img;
}

export interface RenderOptions {
  scale?: number;
  includeOverlays?: boolean;
  selectedElementId?: string | null;
  activeScopePreview?: {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    visible?: boolean;
  } | null;
  draggingInfo?: {
    x: number;
    y: number;
    label?: string;
  } | null;
}

function getEffectiveColor(el: CardElement, overrideColor?: string): string {
  const base = overrideColor || el.fill || el.color || '#000000';
  return applyBrightnessToHex(base, el.brightness || 0);
}

/**
 * Draws a rounded polygon path given vertices and corner radius
 */
function traceRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  radius: number
) {
  if (points.length < 3) return;
  ctx.beginPath();
  const len = points.length;
  for (let i = 0; i < len; i++) {
    const prev = points[(i - 1 + len) % len];
    const curr = points[i];
    const next = points[(i + 1) % len];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const r = Math.min(radius, len1 / 2, len2 / 2);

    if (i === 0) {
      const startX = curr.x + (v1x / len1) * r;
      const startY = curr.y + (v1y / len1) * r;
      ctx.moveTo(startX, startY);
    }
    ctx.arcTo(curr.x, curr.y, next.x, next.y, r);
  }
  ctx.closePath();
}

/**
 * Draws a single CardElement onto the Canvas context
 */
function drawSingleElement(
  ctx: CanvasRenderingContext2D,
  el: CardElement,
  canvasWidth: number,
  canvasHeight: number,
  overrideColor?: string,
  overrideOpacity?: number
) {
  if (!el.visible) return;

  ctx.save();
  const effectiveColor = getEffectiveColor(el, overrideColor);
  const alpha = overrideOpacity !== undefined ? overrideOpacity : el.opacity ?? 1;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  const rot = el.rotation || 0;
  if (rot !== 0 && el.type !== 'background') {
    const b = getElementBounds(el, ctx);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (el.type === 'background') {
    const r = el.borderRadius ?? 36;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.width, el.height, r);
    ctx.fillStyle = effectiveColor;
    ctx.fill();

    // Subtle card edge border like physical IC card
    ctx.lineWidth = 3;
    ctx.strokeStyle = el.secondaryFill || 'rgba(0,0,0,0.12)';
    ctx.stroke();
  } else if (el.type === 'color-band') {
    const shapeEl = el as ShapeCardElement;
    const style = shapeEl.bandStyle || 'suica-trapezoid';
    const r = shapeEl.borderRadius ?? 32;
    const slant = shapeEl.slantOffset ?? 196;

    if (style === 'suica-trapezoid' || style === 'suica-trapezoid-with-top') {
      const topW = Math.max(80, el.width - slant);
      const pts = [
        { x: el.x, y: el.y },
        { x: el.x + topW, y: el.y },
        { x: el.x + el.width, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ];
      traceRoundedPolygon(ctx, pts, r);
      ctx.fillStyle = effectiveColor;
      ctx.fill();

      if (style === 'suica-trapezoid-with-top') {
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, canvasWidth - el.x * 2, 54, [r, r, 12, 12]);
        ctx.fillStyle = effectiveColor;
        ctx.fill();
      }
    } else if (style === 'top-band') {
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, el.width, el.height, r);
      ctx.fillStyle = effectiveColor;
      ctx.fill();
    } else if (style === 'diagonal-split') {
      const pts = [
        { x: el.x, y: el.y },
        { x: el.x + el.width, y: el.y },
        { x: el.x + el.width * 0.65, y: el.y + el.height },
        { x: el.x, y: el.y + el.height },
      ];
      traceRoundedPolygon(ctx, pts, r);
      ctx.fillStyle = effectiveColor;
      ctx.fill();
    }
  } else if (el.type === 'logo') {
    drawSuicaLogo(ctx, el as ShapeCardElement, effectiveColor);
  } else if (el.type === 'decoration') {
    drawDecorationElement(ctx, el as ShapeCardElement, effectiveColor);
  } else if (el.type === 'rectangle') {
    const r = el.borderRadius ?? 8;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.width, el.height, r);
    ctx.fillStyle = effectiveColor;
    ctx.fill();
  } else if (el.type === 'text') {
    drawTextElement(ctx, el as TextCardElement, effectiveColor);
  }

  ctx.restore();
}

/**
 * Draws the iconic top-right Suica Logo (railway loop + green capsule + '+' mark)
 */
function drawSuicaLogo(
  ctx: CanvasRenderingContext2D,
  el: ShapeCardElement,
  primaryColor: string
) {
  ctx.save();
  const baseW = 195;
  const baseH = 98;
  const scaleX = el.width / baseW;
  const scaleY = el.height / baseH;

  ctx.translate(el.x, el.y);
  ctx.scale(scaleX, scaleY);

  const trackColor = el.secondaryFill || '#1C1E21';

  // 1. Right green oval / capsule
  ctx.beginPath();
  ctx.roundRect(42, 12, 128, 76, 38);
  ctx.fillStyle = primaryColor;
  ctx.fill();

  // 2. Left circular railway globe
  const cx = 50;
  const cy = 50;
  const outerR = 38;
  const innerR = 26;

  // Outer track circle
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0.32 * Math.PI, 1.68 * Math.PI);
  ctx.lineWidth = 8.5;
  ctx.strokeStyle = trackColor;
  ctx.stroke();

  // Inner circle of the track
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0.25 * Math.PI, 1.75 * Math.PI);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = trackColor;
  ctx.stroke();

  // Railway ties (radial dashes around left arc)
  for (let angleDeg = 65; angleDeg <= 295; angleDeg += 22) {
    const rad = (angleDeg * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * (innerR - 1);
    const y1 = cy + Math.sin(rad) * (innerR - 1);
    const x2 = cx + Math.cos(rad) * (outerR + 1);
    const y2 = cy + Math.sin(rad) * (outerR + 1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }

  // Vertical curved meridian track inside the globe
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10, outerR - 4, 0, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = trackColor;
  ctx.stroke();

  // White sleeper dashes along central meridian
  for (let ty = cy - 26; ty <= cy + 26; ty += 9) {
    if (Math.abs(ty - cy) < 8) continue;
    ctx.beginPath();
    ctx.moveTo(cx - 5, ty);
    ctx.lineTo(cx + 5, ty);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }

  // Center horizontal pill background behind "Suica" inside logo
  ctx.beginPath();
  ctx.roundRect(30, 36, 134, 28, 14);
  ctx.fillStyle = primaryColor;
  ctx.fill();

  // White circle around the 'c' inside the logo
  ctx.beginPath();
  ctx.arc(124, 50, 12.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // "Suica" text inside the logo
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('S', 40, 51);
  ctx.fillText('u', 64, 51);
  ctx.fillText('i', 92, 51);

  // 'c' in primaryColor inside the white circle
  ctx.fillStyle = primaryColor;
  ctx.fillText('c', 117.5, 50.5);

  // 'a' in white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('a', 143, 51);

  // Top-right '+' cross symbol
  const plusX = 179;
  const plusY = 20;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(plusX - 9, plusY);
  ctx.lineTo(plusX + 9, plusY);
  ctx.moveTo(plusX, plusY - 9);
  ctx.lineTo(plusX, plusY + 9);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws the Decoration element (Penguin mascot from reference image, or geometric styles)
 */
function drawDecorationElement(
  ctx: CanvasRenderingContext2D,
  el: ShapeCardElement,
  primaryColor: string
) {
  ctx.save();
  const style = el.decorationStyle || 'penguin-mascot';
  const secondary = el.secondaryFill || '#FFFFFF';

  if (style === 'custom-image' && el.customImageUrl) {
    const img = preloadCardImage(el.customImageUrl);
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const r = el.borderRadius ?? 0;
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, el.width, el.height, r);
        ctx.clip();
      }

      if (el.brightness && el.brightness !== 0) {
        const bFactor = Math.max(0, 100 + el.brightness);
        ctx.filter = `brightness(${bFactor}%)`;
      }

      const fit = el.imageFit || 'contain';
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const boxW = el.width;
      const boxH = el.height;

      if (fit === 'fill') {
        ctx.drawImage(img, el.x, el.y, boxW, boxH);
      } else if (fit === 'cover') {
        if (r === 0) {
          ctx.beginPath();
          ctx.rect(el.x, el.y, boxW, boxH);
          ctx.clip();
        }
        const scale = Math.max(boxW / iw, boxH / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = el.x + (boxW - drawW) / 2;
        const dy = el.y + (boxH - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      } else {
        // 'contain' (default: preserves aspect ratio and centers at penguin position)
        const scale = Math.min(boxW / iw, boxH / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = el.x + (boxW - drawW) / 2;
        const dy = el.y + (boxH - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
      ctx.restore();
      return;
    }
  }

  if (style === 'penguin-mascot' || style === 'penguin-and-wave') {
    const baseW = 220;
    const baseH = 270;
    const scaleX = el.width / baseW;
    const scaleY = el.height / baseH;

    ctx.translate(el.x, el.y);
    ctx.scale(scaleX, scaleY);

    if (style === 'penguin-and-wave') {
      // Subtle concentric transit arcs behind penguin
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.globalAlpha *= 0.16;
      ctx.lineWidth = 3;
      for (let r = 85; r <= 145; r += 20) {
        ctx.beginPath();
        ctx.arc(115, 135, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Left waving flipper (viewer's left, raised happily like in IMG_2830.jpeg)
    ctx.beginPath();
    ctx.moveTo(64, 98);
    ctx.bezierCurveTo(38, 102, 22, 82, 14, 73);
    ctx.bezierCurveTo(8, 68, 4, 75, 10, 88);
    ctx.bezierCurveTo(20, 108, 42, 122, 66, 118);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Feet
    ctx.strokeStyle = primaryColor;
    ctx.fillStyle = primaryColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left foot (viewer's left)
    ctx.beginPath();
    ctx.moveTo(105, 222);
    ctx.lineTo(98, 242);
    ctx.lineTo(84, 232);
    ctx.moveTo(98, 242);
    ctx.lineTo(92, 247);
    ctx.lineWidth = 7.5;
    ctx.stroke();

    // Right foot (viewer's right)
    ctx.beginPath();
    ctx.moveTo(156, 228);
    ctx.lineTo(160, 250);
    ctx.lineTo(142, 253);
    ctx.moveTo(160, 250);
    ctx.lineTo(168, 247);
    ctx.lineWidth = 7.5;
    ctx.stroke();

    // Penguin Torso / Back (tilted oval-pear body matching IMG_2830.jpeg)
    ctx.beginPath();
    ctx.moveTo(68, 66);
    ctx.bezierCurveTo(52, 105, 58, 175, 96, 220);
    ctx.bezierCurveTo(118, 238, 168, 232, 194, 214); // tail tip on right
    ctx.bezierCurveTo(204, 207, 192, 196, 184, 192);
    ctx.bezierCurveTo(182, 146, 152, 95, 120, 64);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Penguin Head
    ctx.beginPath();
    ctx.ellipse(93, 44, 34, 31, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // White Belly Patch
    ctx.beginPath();
    ctx.moveTo(73, 76);
    ctx.bezierCurveTo(60, 118, 70, 182, 105, 222);
    ctx.bezierCurveTo(126, 233, 150, 225, 160, 212);
    ctx.bezierCurveTo(148, 164, 126, 108, 106, 75);
    ctx.bezierCurveTo(96, 72, 82, 72, 73, 76);
    ctx.closePath();
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

    // Right flipper (viewer's right, resting along side with white inner edge)
    ctx.beginPath();
    ctx.moveTo(126, 78);
    ctx.bezierCurveTo(162, 102, 192, 134, 202, 160);
    ctx.bezierCurveTo(185, 148, 152, 122, 124, 102);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // White highlight line on right flipper
    ctx.beginPath();
    ctx.moveTo(132, 94);
    ctx.quadraticCurveTo(168, 118, 195, 152);
    ctx.lineWidth = 4;
    ctx.strokeStyle = secondary;
    ctx.stroke();

    // Eyes (white ring + dark pupil)
    // Left eye
    ctx.beginPath();
    ctx.arc(76, 42, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(76.5, 42, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(107, 41, 6.2, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(106.5, 41, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Beak (white oval with thin center smile line)
    ctx.beginPath();
    ctx.ellipse(91.5, 49.5, 10.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = secondary;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(91.5, 49.5, 6.5, 2.8, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();
  } else if (style === 'geometric-wave') {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const maxR = Math.min(el.width, el.height) * 0.48;
    ctx.strokeStyle = primaryColor;
    for (let i = 0; i < 5; i++) {
      const r = maxR * ((i + 1) / 5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = 6 - i * 0.8;
      ctx.stroke();
    }
  } else if (style === 'minimal-chip') {
    const r = 16;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.width, el.height * 0.65, r);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      el.x + el.width * 0.2,
      el.y + el.height * 0.15,
      el.width * 0.6,
      el.height * 0.35
    );
  }

  ctx.restore();
}

/**
 * Draws a TextElement on the Canvas, supporting multi-line, letterSpacing,
 * alignment, and the iconic Suica hollow-inline 'i' and 'c' style!
 */
function drawTextElement(
  ctx: CanvasRenderingContext2D,
  el: TextCardElement,
  effectiveColor: string
) {
  if (!el.text) return;
  ctx.save();

  const fontSize = el.fontSize || 24;
  const fontWeight = el.fontWeight || 700;
  const fontFamily = el.fontFamily || '"Plus Jakarta Sans", sans-serif';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = effectiveColor;
  ctx.strokeStyle = effectiveColor;

  const lines = el.text.split('\n');
  const lineHeightPx = fontSize * (el.lineHeight || 1.2);
  const spacing = el.letterSpacing ?? 0;

  lines.forEach((line, lineIdx) => {
    const chars = Array.from(line);
    // Calculate total line width with letterSpacing
    const charWidths = chars.map((ch) => ctx.measureText(ch).width);
    const totalWidth =
      charWidths.reduce((acc, w) => acc + w, 0) +
      Math.max(0, chars.length - 1) * spacing;

    let startX = el.x;
    if (el.textAlign === 'center') {
      startX = el.x - totalWidth / 2;
    } else if (el.textAlign === 'right') {
      startX = el.x - totalWidth;
    }

    const currY = el.y + lineIdx * lineHeightPx;
    let cursorX = startX;

    chars.forEach((ch, idx) => {
      const cw = charWidths[idx];
      const isHollowChar =
        el.suicaInlineStyle &&
        (ch === 'i' || ch === 'c' || ch === 'I' || ch === 'C');

      if (isHollowChar) {
        // Draw hollow outlined character like 'i' and 'c' in IMG_2830.jpeg
        ctx.save();
        ctx.lineWidth = Math.max(2.5, fontSize * 0.052);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = effectiveColor;
        ctx.strokeText(ch, cursorX, currY);
        ctx.restore();
      } else {
        ctx.fillText(ch, cursorX, currY);
      }
      cursorX += cw + spacing;
    });
  });

  ctx.restore();
}

/**
 * Computes approximate bounding box for any CardElement (for selection box & hit-testing)
 */
export function getElementBounds(
  el: CardElement,
  ctx?: CanvasRenderingContext2D | null
): { x: number; y: number; width: number; height: number } {
  if (el.type !== 'text') {
    return {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    };
  }

  const textEl = el as TextCardElement;
  const fontSize = textEl.fontSize || 24;
  const lines = (textEl.text || ' ').split('\n');
  const lineHeightPx = fontSize * (textEl.lineHeight || 1.15);
  const spacing = textEl.letterSpacing ?? 0;

  let maxLineW = 0;
  if (ctx) {
    ctx.save();
    ctx.font = `${textEl.fontWeight || 700} ${fontSize}px ${textEl.fontFamily}`;
    for (const line of lines) {
      const chars = Array.from(line);
      const w =
        chars.reduce((acc, ch) => acc + ctx.measureText(ch).width, 0) +
        Math.max(0, chars.length - 1) * spacing;
      if (w > maxLineW) maxLineW = w;
    }
    ctx.restore();
  } else {
    for (const line of lines) {
      const chars = Array.from(line);
      const w =
        chars.length * fontSize * 0.62 +
        Math.max(0, chars.length - 1) * spacing;
      if (w > maxLineW) maxLineW = w;
    }
  }

  const width = Math.max(40, maxLineW);
  const height = Math.max(28, lines.length * lineHeightPx);

  let boxX = textEl.x;
  if (textEl.textAlign === 'center') {
    boxX = textEl.x - width / 2;
  } else if (textEl.textAlign === 'right') {
    boxX = textEl.x - width;
  }

  return {
    x: boxX,
    y: textEl.y,
    width,
    height,
  };
}

export type SelectionHandleType = 'rotate' | 'resize' | null;

/**
 * Inverse-rotates a canvas point (px, py) around center (cx, cy) by -angleDeg
 */
function toLocalCoords(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): { x: number; y: number } {
  if (!angleDeg) return { x: px, y: py };
  const rad = (-angleDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * Checks if pointer (px, py) hits the rotation knob or corner resize handles of the selected element
 */
export function hitTestSelectionHandles(
  selEl: CardElement | null | undefined,
  px: number,
  py: number,
  ctx?: CanvasRenderingContext2D | null
): SelectionHandleType {
  if (!selEl || !selEl.visible || selEl.locked || selEl.type === 'background') {
    return null;
  }

  const b = getElementBounds(selEl, ctx);
  const pad = 6;
  const bx = b.x - pad;
  const by = b.y - pad;
  const bw = b.width + pad * 2;
  const bh = b.height + pad * 2;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  const local = toLocalCoords(px, py, cx, cy, selEl.rotation || 0);

  // 1. Check top rotation handle at (bx + bw / 2, by - 28)
  const rotHandleX = bx + bw / 2;
  const rotHandleY = by - 28;
  if (Math.hypot(local.x - rotHandleX, local.y - rotHandleY) <= 16) {
    return 'rotate';
  }

  // 2. Check 4 corner resize handles (for non-text elements)
  if (selEl.type !== 'text') {
    const corners = [
      { x: bx, y: by },
      { x: bx + bw, y: by },
      { x: bx, y: by + bh },
      { x: bx + bw, y: by + bh },
    ];
    for (const c of corners) {
      if (Math.hypot(local.x - c.x, local.y - c.y) <= 15) {
        return 'resize';
      }
    }
  }

  return null;
}

/**
 * Hit-tests the top-most visible unlocked element at canvas coordinates (cx, cy)
 */
export function hitTestCardElements(
  elements: CardElement[],
  cx: number,
  cy: number,
  ctx?: CanvasRenderingContext2D | null
): CardElement | null {
  // Iterate from top-most layer (end of array) to bottom-most (index 0)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.visible || el.locked) continue;

    if (el.type === 'color-band') {
      const shapeEl = el as ShapeCardElement;
      const style = shapeEl.bandStyle || 'suica-trapezoid';
      if (style === 'suica-trapezoid' || style === 'suica-trapezoid-with-top') {
        if (cy >= el.y && cy <= el.y + el.height && cx >= el.x) {
          const progress = (cy - el.y) / Math.max(1, el.height);
          const slant = shapeEl.slantOffset ?? 196;
          const topW = Math.max(80, el.width - slant);
          const maxRightX = el.x + topW + progress * slant;
          if (cx <= maxRightX) return el;
        }
        if (
          style === 'suica-trapezoid-with-top' &&
          cx >= el.x &&
          cx <= 1012 - el.x &&
          cy >= el.y &&
          cy <= el.y + 54
        ) {
          return el;
        }
        continue;
      }
    }

    const b = getElementBounds(el, ctx);
    const centerX = b.x + b.width / 2;
    const centerY = b.y + b.height / 2;
    const local = toLocalCoords(cx, cy, centerX, centerY, el.rotation || 0);
    const pad = el.type === 'text' ? 8 : 0;
    if (
      local.x >= b.x - pad &&
      local.x <= b.x + b.width + pad &&
      local.y >= b.y - pad &&
      local.y <= b.y + b.height + pad
    ) {
      return el;
    }
  }
  return null;
}

/**
 * Renders the entire card state onto an HTMLCanvasElement
 */
export function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  state: CardProjectState,
  options: RenderOptions = {}
) {
  const scale = options.scale ?? 1;
  const targetW = Math.round(state.canvas.width * scale);
  const targetH = Math.round(state.canvas.height * scale);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.scale(scale, scale);

  // Clip entire card to background rounded rectangle if background is visible
  const bgEl = state.elements.find((e) => e.type === 'background');
  if (bgEl && bgEl.visible) {
    ctx.beginPath();
    ctx.roundRect(
      bgEl.x,
      bgEl.y,
      bgEl.width,
      bgEl.height,
      bgEl.borderRadius ?? 36
    );
    ctx.clip();
  }

  // Draw elements in layer order (0 = bottom, N-1 = top)
  for (const el of state.elements) {
    if (!el.visible) continue;

    // 1. Base render of the element
    drawSingleElement(ctx, el, state.canvas.width, state.canvas.height);

    // 2. Apply any active ScopeColorRules targeting this element (Section 四)
    const matchingRules = (state.scopeRules || []).filter(
      (r) =>
        r.enabled &&
        r.width > 0 &&
        r.height > 0 &&
        (r.targetElementId === 'all' || r.targetElementId === el.id)
    );

    for (const rule of matchingRules) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rule.x, rule.y, rule.width, rule.height);
      ctx.clip();
      drawSingleElement(
        ctx,
        el,
        state.canvas.width,
        state.canvas.height,
        rule.color,
        rule.opacity
      );
      ctx.restore();
    }
  }

  ctx.restore();

  // Overlays (Selection Bounding Box, Active Scope Rectangle, Drag Coordinates HUD)
  // NEVER drawn when exporting PNG (includeOverlays = false)
  if (options.includeOverlays) {
    ctx.save();
    ctx.scale(scale, scale);

    // 1. Active Scope Preview Box
    if (
      options.activeScopePreview &&
      options.activeScopePreview.visible &&
      options.activeScopePreview.width > 0 &&
      options.activeScopePreview.height > 0
    ) {
      const sp = options.activeScopePreview;
      ctx.save();
      ctx.strokeStyle = sp.color || '#00A8A8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(sp.x, sp.y, sp.width, sp.height);
      ctx.fillStyle = sp.color || '#00A8A8';
      ctx.globalAlpha = 0.12;
      ctx.fillRect(sp.x, sp.y, sp.width, sp.height);
      ctx.restore();
    }

    // 1b. Subtle placeholder outline for empty custom-image zones (e.g. top-left-image) when handles are visible
    if (options.selectedElementId) {
      for (const el of state.elements) {
        if (
          el.visible &&
          el.type === 'decoration' &&
          el.decorationStyle === 'custom-image' &&
          !el.customImageUrl
        ) {
          const b = getElementBounds(el, ctx);
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          const rot = el.rotation || 0;
          const isSelected = el.id === options.selectedElementId;

          ctx.save();
          if (rot !== 0) {
            ctx.translate(cx, cy);
            ctx.rotate((rot * Math.PI) / 180);
            ctx.translate(-cx, -cy);
          }

          ctx.fillStyle = isSelected
            ? 'rgba(255, 255, 255, 0.22)'
            : 'rgba(255, 255, 255, 0.14)';
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.width, b.height, el.borderRadius || 12);
          ctx.fill();

          if (!isSelected) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.font = '600 13px "Plus Jakarta Sans", "Noto Sans TC", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('＋ 自訂圖片區', cx, cy);
          ctx.restore();
        }
      }
    }

    // 2. Selected Element Bounding Box (with Rotation Handle & Resize Corners)
    if (options.selectedElementId) {
      const selEl = state.elements.find(
        (e) => e.id === options.selectedElementId
      );
      if (selEl && selEl.visible && selEl.type !== 'background') {
        const b = getElementBounds(selEl, ctx);
        const pad = 6;
        const bx = b.x - pad;
        const by = b.y - pad;
        const bw = b.width + pad * 2;
        const bh = b.height + pad * 2;
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const rot = selEl.rotation || 0;

        ctx.save();
        if (rot !== 0) {
          ctx.translate(cx, cy);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.translate(-cx, -cy);
        }

        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Draw top Rotation Handle stem & knob
        const rotX = bx + bw / 2;
        const rotY = by - 28;
        ctx.beginPath();
        ctx.moveTo(rotX, by);
        ctx.lineTo(rotX, rotY);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rotX, rotY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#10B981';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw 4 corner resize handles
        const corners = [
          { x: bx, y: by },
          { x: bx + bw, y: by },
          { x: bx, y: by + bh },
          { x: bx + bw, y: by + bh },
        ];
        for (const c of corners) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#0284C7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(c.x - 5.5, c.y - 5.5, 11, 11);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 3. Dragging X, Y Coordinate HUD
    if (options.draggingInfo) {
      const { x, y, label } = options.draggingInfo;
      const badgeText = `${label ? label + ' · ' : ''}X: ${Math.round(x)}  Y: ${Math.round(y)}`;
      ctx.save();
      ctx.font = '600 14px "IBM Plex Mono", monospace';
      const textW = ctx.measureText(badgeText).width;
      const boxW = textW + 24;
      const boxH = 32;
      const boxX = Math.min(
        state.canvas.width - boxW - 12,
        Math.max(12, x)
      );
      const boxY = Math.max(12, y - 44);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();

      ctx.fillStyle = '#38BDF8';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, boxX + 12, boxY + boxH / 2);
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Escapes XML special characters for SVG export
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates SVG markup for a single element
 */
function elementToSvgMarkup(
  el: CardElement,
  canvasWidth: number,
  overrideColor?: string,
  overrideOpacity?: number
): string {
  if (!el.visible) return '';
  const color = getEffectiveColor(el, overrideColor);
  const opacity = overrideOpacity !== undefined ? overrideOpacity : el.opacity ?? 1;

  if (el.type === 'background') {
    const r = el.borderRadius ?? 36;
    const stroke = el.secondaryFill || 'rgba(0,0,0,0.12)';
    return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${color}" stroke="${stroke}" stroke-width="3" opacity="${opacity}" />`;
  }

  if (el.type === 'color-band') {
    const shapeEl = el as ShapeCardElement;
    const style = shapeEl.bandStyle || 'suica-trapezoid';
    const r = shapeEl.borderRadius ?? 32;
    const slant = shapeEl.slantOffset ?? 196;

    if (style === 'suica-trapezoid' || style === 'suica-trapezoid-with-top') {
      const topW = Math.max(80, el.width - slant);
      const x0 = el.x;
      const y0 = el.y;
      const x1 = el.x + topW;
      const x2 = el.x + el.width;
      const y1 = el.y + el.height;
      const pathD = [
        `M ${x0 + r} ${y0}`,
        `L ${x1 - r} ${y0}`,
        `Q ${x1} ${y0} ${x1 + r * 0.32} ${y0 + r * 0.95}`,
        `L ${x2 - r * 0.32} ${y1 - r * 0.95}`,
        `Q ${x2} ${y1} ${x2 - r} ${y1}`,
        `L ${x0 + r} ${y1}`,
        `Q ${x0} ${y1} ${x0} ${y1 - r}`,
        `L ${x0} ${y0 + r}`,
        `Q ${x0} ${y0} ${x0 + r} ${y0}`,
        'Z',
      ].join(' ');
      let extra = '';
      if (style === 'suica-trapezoid-with-top') {
        extra = `<rect x="${el.x}" y="${el.y}" width="${canvasWidth - el.x * 2}" height="54" rx="${r}" fill="${color}" />`;
      }
      return `<g opacity="${opacity}"><path d="${pathD}" fill="${color}" />${extra}</g>`;
    }
    return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${color}" opacity="${opacity}" />`;
  }

  if (el.type === 'logo') {
    const scaleX = (el.width / 195).toFixed(3);
    const scaleY = (el.height / 98).toFixed(3);
    const trackColor = el.secondaryFill || '#1C1E21';
    return `<g transform="translate(${el.x}, ${el.y}) scale(${scaleX}, ${scaleY})" opacity="${opacity}">
      <rect x="42" y="12" width="128" height="76" rx="38" fill="${color}" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="${trackColor}" stroke-width="12" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="4 8" />
      <ellipse cx="50" cy="50" rx="10" ry="34" fill="none" stroke="${trackColor}" stroke-width="6" />
      <rect x="30" y="36" width="134" height="28" rx="14" fill="${color}" />
      <circle cx="124" cy="50" r="12.5" fill="#FFFFFF" />
      <text x="40" y="57" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" fill="#FFFFFF">S</text>
      <text x="64" y="57" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" fill="#FFFFFF">u</text>
      <text x="92" y="57" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" fill="#FFFFFF">i</text>
      <text x="117.5" y="57" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" fill="${color}">c</text>
      <text x="143" y="57" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="22" fill="#FFFFFF">a</text>
      <path d="M170 20 H188 M179 11 V29" stroke="${color}" stroke-width="5.5" stroke-linecap="round" />
    </g>`;
  }

  if (el.type === 'decoration') {
    const shapeEl = el as ShapeCardElement;
    const rot = shapeEl.rotation || 0;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rotWrapStart = rot !== 0 ? `<g transform="rotate(${rot} ${cx} ${cy})">` : '';
    const rotWrapEnd = rot !== 0 ? `</g>` : '';

    if (shapeEl.decorationStyle === 'custom-image') {
      if (!shapeEl.customImageUrl) {
        return '';
      }
      const fit = shapeEl.imageFit || 'contain';
      const preserve =
        fit === 'fill'
          ? 'none'
          : fit === 'cover'
          ? 'xMidYMid slice'
          : 'xMidYMid meet';
      const r = shapeEl.borderRadius ?? 0;
      const clipId = `dec-img-clip-${el.id}`;
      const clipDef =
        r > 0
          ? `<clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" /></clipPath>`
          : '';
      const clipAttr = r > 0 ? ` clip-path="url(#${clipId})"` : '';
      return `${rotWrapStart}${clipDef}<image href="${escapeXml(
        shapeEl.customImageUrl
      )}" x="${el.x}" y="${el.y}" width="${el.width}" height="${
        el.height
      }" preserveAspectRatio="${preserve}" opacity="${opacity}"${clipAttr} />${rotWrapEnd}`;
    }
    const secondary = shapeEl.secondaryFill || '#FFFFFF';
    const scaleX = (el.width / 220).toFixed(3);
    const scaleY = (el.height / 270).toFixed(3);
    return `${rotWrapStart}<g transform="translate(${el.x}, ${el.y}) scale(${scaleX}, ${scaleY})" opacity="${opacity}">
      <path d="M64 98 C38 102 22 82 14 73 C8 68 4 75 10 88 C20 108 42 122 66 118 Z" fill="${color}" />
      <path d="M105 222 L98 242 L84 232 M98 242 L92 247 M156 228 L160 250 L142 253 M160 250 L168 247" stroke="${color}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <path d="M68 66 C52 105 58 175 96 220 C118 238 168 232 194 214 C204 207 192 196 184 192 C182 146 152 95 120 64 Z" fill="${color}" />
      <ellipse cx="93" cy="44" rx="34" ry="31" fill="${color}" />
      <path d="M73 76 C60 118 70 182 105 222 C126 233 150 225 160 212 C148 164 126 108 106 75 C96 72 82 72 73 76 Z" fill="${secondary}" stroke="${color}" stroke-width="3.5" />
      <path d="M126 78 C162 102 192 134 202 160 C185 148 152 122 124 102 Z" fill="${color}" />
      <path d="M132 94 Q168 118 195 152" stroke="${secondary}" stroke-width="4" fill="none" />
      <circle cx="76" cy="42" r="6.2" fill="${secondary}" />
      <circle cx="76.5" cy="42" r="3.2" fill="${color}" />
      <circle cx="107" cy="41" r="6.2" fill="${secondary}" />
      <circle cx="106.5" cy="41" r="3.2" fill="${color}" />
      <ellipse cx="91.5" cy="49.5" rx="10.5" ry="6.2" fill="${secondary}" />
      <ellipse cx="91.5" cy="49.5" rx="6.5" ry="2.8" fill="none" stroke="${color}" stroke-width="2" />
    </g>${rotWrapEnd}`;
  }

  if (el.type === 'rectangle') {
    const r = el.borderRadius ?? 8;
    return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${color}" opacity="${opacity}" />`;
  }

  if (el.type === 'text') {
    const textEl = el as TextCardElement;
    const anchor =
      textEl.textAlign === 'center'
        ? 'middle'
        : textEl.textAlign === 'right'
        ? 'end'
        : 'start';
    const fontSize = textEl.fontSize || 24;
    const lines = (textEl.text || '').split('\n');
    const lineHeightPx = fontSize * (textEl.lineHeight || 1.2);
    const cleanFont = textEl.fontFamily.replace(/"/g, "'");

    return lines
      .map((line, idx) => {
        const yPos = textEl.y + fontSize * 0.88 + idx * lineHeightPx;
        return `<text x="${textEl.x}" y="${yPos}" font-family="${cleanFont}" font-size="${fontSize}" font-weight="${textEl.fontWeight}" letter-spacing="${textEl.letterSpacing}px" text-anchor="${anchor}" fill="${color}" opacity="${opacity}">${escapeXml(line)}</text>`;
      })
      .join('\n');
  }

  return '';
}

/**
 * Generates standalone clean SVG string of the card face
 */
export function generateCardSVG(state: CardProjectState): string {
  const { width, height } = state.canvas;
  const bgEl = state.elements.find((e) => e.type === 'background');
  const cardRx = bgEl?.borderRadius ?? 36;

  const defs: string[] = [
    `<clipPath id="card-outer-clip"><rect x="0" y="0" width="${width}" height="${height}" rx="${cardRx}" /></clipPath>`,
  ];

  (state.scopeRules || []).forEach((rule, idx) => {
    if (rule.enabled && rule.width > 0 && rule.height > 0) {
      defs.push(
        `<clipPath id="scope-clip-${idx}"><rect x="${rule.x}" y="${rule.y}" width="${rule.width}" height="${rule.height}" /></clipPath>`
      );
    }
  });

  const bodyParts: string[] = [];

  for (const el of state.elements) {
    if (!el.visible) continue;
    bodyParts.push(elementToSvgMarkup(el, width));

    (state.scopeRules || []).forEach((rule, idx) => {
      if (
        rule.enabled &&
        rule.width > 0 &&
        rule.height > 0 &&
        (rule.targetElementId === 'all' || rule.targetElementId === el.id)
      ) {
        bodyParts.push(
          `<g clip-path="url(#scope-clip-${idx})">${elementToSvgMarkup(
            el,
            width,
            rule.color,
            rule.opacity
          )}</g>`
        );
      }
    });
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <defs>${defs.join('')}</defs>`,
    `  <g clip-path="url(#card-outer-clip)">`,
    `    ${bodyParts.join('\n    ')}`,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}
