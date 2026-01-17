import { CollectionVariableDetail } from './token-types';
import { formatColor, formatUnit } from './token-utils';

export interface ExportOptions {
    format: 'css' | 'scss' | 'json' | 'dtcg';
    modeId: string;
    aliasMode: 'resolved' | 'alias';
    colorFormat: string;
    unitFormat: string;
    baseFontSize: number;
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

function processValue(v: CollectionVariableDetail, options: ExportOptions): string {
    const modeVal = v.valuesByMode[options.modeId];
    if (!modeVal) return 'null';

    const isResolved = options.aliasMode === 'resolved';

    // Determine raw value to format
    let rawValue: string | number = modeVal.value; // Default to direct/alias

    // If resolved mode, try to use resolvedValue
    if (isResolved && modeVal.resolvedValue !== undefined) {
        rawValue = modeVal.resolvedValue;
    }

    // Formatting based on type
    if (v.type === 'color') {
        return formatColor(String(rawValue), options.colorFormat);
    }
    if (v.type === 'number' || v.type === 'spacing' || v.type === 'borderRadius' || v.type === 'typography') {
        if (typeof rawValue === 'number' || !isNaN(Number(rawValue))) {
            return formatUnit(Number(rawValue), options.unitFormat, options.baseFontSize);
        }
    }

    return String(rawValue);
}

function generateCSS(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const lines = [':root {'];
    variables.forEach(v => {
        const val = processValue(v, options);
        // Normalize name: lowercase, replace / with -
        const name = v.name.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
        lines.push(`  --${name}: ${val};`);
    });
    lines.push('}');
    return lines.join('\n');
}

function generateSCSS(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const lines: string[] = [];
    variables.forEach(v => {
        const val = processValue(v, options);
        const name = v.name.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
        lines.push(`$${name}: ${val};`);
    });
    return lines.join('\n');
}

function generateJSON(variables: CollectionVariableDetail[], options: ExportOptions): string {
    const obj: any = {};
    variables.forEach(v => {
        obj[v.name] = processValue(v, options);
    });
    return JSON.stringify(obj, null, 2);
}

function generateDTCG(variables: CollectionVariableDetail[], options: ExportOptions, collectionName: string): string {
    // W3C format requires nesting
    const root: any = {};

    variables.forEach(v => {
        const val = processValue(v, options);
        const path = v.name.split('/'); // Assuming / separator

        let current = root;
        path.forEach((part, index) => {
            if (!current[part]) current[part] = {};

            if (index === path.length - 1) {
                // Leaf
                current[part] = {
                    $value: val,
                    $type: v.type, // Map types if needed
                    $description: v.description
                };
            } else {
                current = current[part];
            }
        });
    });

    return JSON.stringify(root, null, 2);
}
