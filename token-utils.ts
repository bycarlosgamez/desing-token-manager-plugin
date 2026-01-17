/**
 * Token Utilities
 * Functions for reading/writing tokens from Figma API
 */

import { DesignTokens, TokenType, Token, TokenValue, TokenReference, TokenMetadata, CollectionVariableDetail } from './token-types';

/**
 * Convert RGBA color to hex string
 */
export function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  if (a < 1) {
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a.toFixed(3)})`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex string to RGBA
 */
export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 6-digit hex
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }

  // Handle 8-digit hex (with alpha)
  if (hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const a = parseInt(hex.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }

  throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * Check if a value is a token reference (alias)
 */
export function isTokenReference(token: Token): token is TokenReference {
  return typeof token === 'object' && 'value' in token && typeof token.value === 'string' && token.value.startsWith('{') && token.value.endsWith('}');
}

/**
 * Resolve a token reference path to the actual value
 * e.g., "{color.brand.primary}" -> "#2E9FB9"
 */
export function resolveTokenReference(ref: string, tokens: DesignTokens): string | number | null {
  // Remove { } brackets
  const path = ref.slice(1, -1);
  const parts = path.split('.');

  let current: any = tokens;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  // If we found a token with a value
  if (current && typeof current === 'object' && 'value' in current && !isTokenReference(current as Token)) {
    return (current as TokenValue).value;
  }

  return null;
}

/**
 * Set a nested value in a token object
 */
export function setNestedTokenValue(tokens: DesignTokens, path: string[], value: Token): void {
  let current: any = tokens;

  // Navigate/create path
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  // Set the final value
  current[path[path.length - 1]] = value;
}

/**
 * Get a nested value from a token object
 */
export function getNestedTokenValue(tokens: DesignTokens, path: string[]): Token | null {
  let current: any = tokens;

  for (const part of path) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current as Token | null;
}

/**
 * Check if a collection has any alias references
 */
export function collectionHasAliases(variables: CollectionVariableDetail[]): boolean {
  return variables.some(v =>
    Object.values(v.valuesByMode).some(val =>
      typeof val.value === 'string' && val.value.startsWith('{')
    )
  );
}

/**
 * Check if a collection has any color variables
 */
export function collectionHasColorVariables(variables: CollectionVariableDetail[]): boolean {
  return variables.some(v => v.type === 'color');
}

/**
 * Check if a collection has any numeric variables
 */
export function collectionHasNumericVariables(variables: CollectionVariableDetail[]): boolean {
  return variables.some(v =>
    v.type === 'number' ||
    v.type === 'spacing' ||
    v.type === 'borderRadius'
  );
}

/**
 * Format a color value based on the selected format
 */
export function formatColor(value: string, format: string): string {
  if (!value) return value;
  // If value matches typical alias pattern (e.g. {color.blue}), skip formatting
  if (value.startsWith('{')) return value;

  // Attempt to parse if not already normalized or if specific handling needed
  let r = 0, g = 0, b = 0, a = 1;
  let parsed = false;

  // Simple Hex parse (if hex to hex, we might just return, but if hex to rgb...)
  if (value.startsWith('#')) {
    try {
      const rgba = hexToRgba(value);
      r = rgba.r; g = rgba.g; b = rgba.b; a = rgba.a;
      parsed = true;
    } catch (e) { /* ignore */ }
  } else if (value.startsWith('rgb')) {
    const match = value.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      r = parseFloat(match[0]) / 255;
      g = parseFloat(match[1]) / 255;
      b = parseFloat(match[2]) / 255;
      if (match[3]) a = parseFloat(match[3]);
      parsed = true;
    }
  }

  if (!parsed) return value; // Return as-is if parsing failed

  const R = (n: number) => Math.round(n);
  const F = (n: number) => parseFloat(n.toFixed(3));

  switch (format) {
    case 'hex':
      return rgbaToHex(r, g, b, 1);
    case 'rgb':
      return `rgb(${R(r * 255)}, ${R(g * 255)}, ${R(b * 255)})`;
    case 'rgba':
      return `rgba(${R(r * 255)}, ${R(g * 255)}, ${R(b * 255)}, ${F(a)})`;
    case 'hsl':
    case 'hsla': {
      const { h, s, l } = rgbToHsl(r, g, b);
      if (format === 'hsl') return `hsl(${R(h)}, ${R(s * 100)}%, ${R(l * 100)}%)`;
      return `hsla(${R(h)}, ${R(s * 100)}%, ${R(l * 100)}%, ${F(a)})`;
    }
    case 'oklch':
      return rgbaToOklch(r, g, b, a);
    default:
      return value;
  }
}

export function formatUnit(value: number, unit: string, baseFontSize: number = 16): string {
  if (isNaN(value)) return String(value);

  switch (unit) {
    case 'px': return `${value}px`;
    case 'curr': return `${value}`;
    case 'rem': return `${parseFloat((value / baseFontSize).toFixed(4))}rem`;
    case 'em': return `${parseFloat((value / baseFontSize).toFixed(4))}em`;
    default: return `${value}${unit}`;
  }
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}

/**
 * Convert RGBA to OKLCH color space
 * @param r Red (0-1)
 * @param g Green (0-1)  
 * @param b Blue (0-1)
 * @param a Alpha (0-1)
 * @returns CSS oklch() string
 */
function rgbaToOklch(r: number, g: number, b: number, a: number): string {
  try {
    // Step 1: sRGB to Linear RGB
    const toLinear = (c: number): number => {
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const rLin = toLinear(r);
    const gLin = toLinear(g);
    const bLin = toLinear(b);

    // Step 2: Linear RGB to XYZ (D65 illuminant)
    const x = 0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin;
    const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin;
    const z = 0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin;

    // Step 3: XYZ to OKLab
    const l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
    const m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
    const s_ = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

    const l_cubeRoot = Math.cbrt(l_);
    const m_cubeRoot = Math.cbrt(m_);
    const s_cubeRoot = Math.cbrt(s_);

    const L = 0.2104542553 * l_cubeRoot + 0.7936177850 * m_cubeRoot - 0.0040720468 * s_cubeRoot;
    const A = 1.9779984951 * l_cubeRoot - 2.4285922050 * m_cubeRoot + 0.4505937099 * s_cubeRoot;
    const B = 0.0259040371 * l_cubeRoot + 0.7827717662 * m_cubeRoot - 0.8086757660 * s_cubeRoot;

    // Step 4: OKLab to OKLCH
    const C = Math.sqrt(A * A + B * B);
    let H = Math.atan2(B, A) * 180 / Math.PI;
    if (H < 0) H += 360;

    // Format values
    const lightness = (L * 100).toFixed(2);
    const chroma = C.toFixed(4);
    const hue = H.toFixed(2);

    // Return with or without alpha
    if (a < 1) {
      return `oklch(${lightness}% ${chroma} ${hue} / ${a.toFixed(3)})`;
    }
    return `oklch(${lightness}% ${chroma} ${hue})`;

  } catch (err) {
    // Fallback to rgba on error
    console.warn('OKLCH conversion failed, falling back to rgba:', err);
    const R = (n: number) => Math.round(n);
    const F = (n: number) => parseFloat(n.toFixed(3));
    return `rgba(${R(r * 255)}, ${R(g * 255)}, ${R(b * 255)}, ${F(a)})`;
  }
}
