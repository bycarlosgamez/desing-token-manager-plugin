import { CollectionVariableDetail } from './token-types';
import { formatColor, formatUnit } from './token-utils';

export interface ExportOptions {
    format: 'css' | 'scss' | 'json' | 'dtcg';
    modeId: string;
    aliasMode: 'resolved' | 'alias';
    colorFormat: string;
    unitFormat: string;
    baseFontSize: number;
    unitPerVariable?: Map<string, string>;
}

export function generateExport(
    variables: CollectionVariableDetail[],
    options: ExportOptions,
    collectionName: string
): string {
    switch (options.format) {
        case 'css': return generateCSS(variables, options);
        case 'scss': return generateSCSS(variables, options);
        case 'json': return generateJSON(variables, options);
        case 'dtcg': return generateDTCG(variables, options, collectionName);
        default: return '// Unknown format';
    }
}

function normalizeDashName(name: string): string {
    return name.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
}

function normalizeDotName(name: string): string {
    return name.toLowerCase().replace(/\//g, '.').replace(/\s+/g, '-');
}

function processValue(v: CollectionVariableDetail, options: ExportOptions): any {
    const modeVal = v.valuesByMode[options.modeId];
    if (!modeVal) return 'null';

    const isResolved = options.aliasMode === 'resolved';

    // Determine raw value to format
    let rawValue: string | number = modeVal.value; // Default to direct/alias

    // If resolved mode, try to use resolvedValue
    if (isResolved && modeVal.resolvedValue !== undefined) {
        rawValue = modeVal.resolvedValue;
    }

    // Handle Alias Transformation when not in Resolved mode
    if (!isResolved && typeof rawValue === 'string' && rawValue.startsWith('{') && rawValue.endsWith('}')) {
        const rawName = rawValue.substring(1, rawValue.length - 1); // remove { and }

        switch (options.format) {
            case 'css':
                return `var(--${normalizeDashName(rawName)})`;
            case 'scss':
                return `$${normalizeDashName(rawName)}`;
            case 'json':
                return `{${normalizeDotName(rawName)}}`; // Non-spec JSON still uses brackets but normalized dots
            case 'dtcg':
                return { $ref: normalizeDotName(rawName) };
            default:
                return rawValue;
        }
    }

    // Formatting based on type (only for primitives)
    if (v.type === 'color') {
        return formatColor(String(rawValue), options.colorFormat);
    }
    if (v.type === 'number' || v.type === 'spacing' || v.type === 'borderRadius' || v.type === 'typography') {
        if (typeof rawValue === 'number' || !isNaN(Number(rawValue))) {
            // Use per-variable unit if available, otherwise use global unit
            const unit = options.unitPerVariable?.get(v.id) || options.unitFormat;
            return formatUnit(Number(rawValue), unit, options.baseFontSize);
        }
    }

    return String(rawValue);
}

function generateCSS(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const lines = [':root {'];
    variables.forEach(v => {
        const val = processValue(v, options);
        const name = normalizeDashName(v.name);
        lines.push(`  --${name}: ${val};`);
    });
    lines.push('}');
    return lines.join('\n');
}

function generateSCSS(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const lines: string[] = [];
    variables.forEach(v => {
        const val = processValue(v, options);
        const name = normalizeDashName(v.name);
        lines.push(`$${name}: ${val};`);
    });
    return lines.join('\n');
}

function generateJSON(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const obj: any = {};
    variables.forEach(v => {
        const name = normalizeDotName(v.name);
        obj[name] = processValue(v, options);
    });
    return JSON.stringify(obj, null, 2);
}

function generateDTCG(variables: CollectionVariableDetail[], options: ExportOptions, collectionName: string): string {
    // W3C format requires nesting
    const root: any = {};

    variables.forEach(v => {
        const val = processValue(v, options);
        // Note: For DTCG nesting, we still use the path split by '/'
        // But the internal $ref (set in processValue) is already dot-normalized
        const path = v.name.split('/');

        let current = root;
        path.forEach((part, index) => {
            // Clean up the key name for DTCG if needed (matches normalizeDotName logic but per-segment)
            const cleanPart = part.toLowerCase().replace(/\s+/g, '-');

            if (!current[cleanPart]) current[cleanPart] = {};

            if (index === path.length - 1) {
                // Leaf
                const leaf: any = {
                    $type: v.type,
                    $description: v.description
                };

                if (val && typeof val === 'object' && val.$ref) {
                    leaf.$value = { $ref: val.$ref }; // Match user requested format: { "$value": { "$ref": "..." } }
                } else {
                    leaf.$value = val;
                }

                current[cleanPart] = leaf;
            } else {
                current = current[cleanPart];
            }
        });
    });

    return JSON.stringify(root, null, 2);
}
