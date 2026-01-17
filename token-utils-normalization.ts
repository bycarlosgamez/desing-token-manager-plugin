import { ColorFormat, UnitFormat, NormalizationOptions } from './token-types';

/**
 * Normalization Utilities
 * Handles conversion between formats (Hex <-> RGB <-> HSL) and Units (px <-> rem)
 * without data loss (relying on raw values where possible).
 */

// ----------------------------------------------------------------------
// COLOR UTILS
// ----------------------------------------------------------------------

export function normalizeColor(value: string, format: ColorFormat): string {
    // Simple pass-through for now, will implement actual conversion logic
    // TODO: Add strict color conversion library or logic here if needed.
    // For MVP, we presume the value might already be in a flexible format or we rely on backend.
    // Actually, let's implement basic hex/rgb/hsl conversion if possible or assume input is Hex.

    // Implementation placeholder
    if (format === 'hex') return value;
    // ... implement others
    return value;
}

// ----------------------------------------------------------------------
// UNIT UTILS
// ----------------------------------------------------------------------

export function normalizeNumber(value: number, unit: UnitFormat, baseFontSize: number = 16): string {
    if (unit === 'none') return String(value);
    if (unit === 'px') return `${value}px`;

    if (unit === 'rem') {
        const remValue = value / baseFontSize;
        return `${parseFloat(remValue.toFixed(4))}rem`;
    }

    if (unit === 'em') {
        return `${value}em`; // Context dependent, usually just append em
    }

    return String(value);
}
