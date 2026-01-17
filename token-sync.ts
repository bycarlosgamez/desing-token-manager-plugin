/**
 * Token Sync
 * Syncs tokens back to Figma variables and styles
 */
import { DesignTokens, TokenSet, Token, TokenValue, TokenReference } from './token-types';
import { hexToRgba, resolveTokenReference, isTokenReference } from './token-utils';

interface SyncResult {
    created: number;
    updated: number;
    errors: string[];
}

/**
 * Main sync function
 */
export async function syncTokensToFigma(tokens: DesignTokens): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, errors: [] };

    // 1. Ensure Variable Collections exist
    const primitivesCollection = await getOrCreateCollection('Primitives');
    const semanticCollection = await getOrCreateCollection('Semantic');

    // 2. Sync Primitives first (so aliases work)
    if (tokens.primitives) {
        await syncTokenSet(
            tokens.primitives,
            primitivesCollection,
            [],
            result,
            tokens
        );
    }

    // 3. Sync Semantic tokens
    if (tokens.semantic) {
        await syncTokenSet(
            tokens.semantic,
            semanticCollection,
            [],
            result,
            tokens
        );
    }

    return result;
}

/**
 * Recursive function to sync a set of tokens
 */
async function syncTokenSet(
    tokenSet: TokenSet,
    collection: VariableCollection,
    path: string[],
    result: SyncResult,
    allTokens: DesignTokens
) {
    for (const [key, item] of Object.entries(tokenSet)) {
        const currentPath = [...path, key];

        // Check if it's a token (has value and type)
        if (isToken(item)) {
            try {
                await syncSingleToken(item, collection, currentPath, result, allTokens);
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                result.errors.push(`Failed to sync ${currentPath.join('.')}: ${errorMsg}`);
            }
        } else {
            // It's a nested set
            await syncTokenSet(item as TokenSet, collection, currentPath, result, allTokens);
        }
    }
}

function isToken(item: any): item is Token {
    return typeof item === 'object' && item !== null && 'value' in item && 'type' in item;
}

/**
 * Sync a single token to a Figma variable
 */
async function syncSingleToken(
    token: Token,
    collection: VariableCollection,
    path: string[],
    result: SyncResult,
    allTokens: DesignTokens
) {
    // Only support color for now
    if (token.type !== 'color') return;

    const variableName = path.join('/'); // Figma uses slash naming convention

    // Find existing variable matching ID or Name
    let variable: Variable | undefined;

    // Try finding by stored ID first
    if ('$extensions' in token && token.$extensions?.['com.figma.variable-id']) {
        try {
            variable = await figma.variables.getVariableByIdAsync(token.$extensions['com.figma.variable-id']);
        } catch (e) {
            // Variable might have been deleted
        }
    }

    // Fallback to finding by name in collection
    if (!variable) {
        const variables = await figma.variables.getLocalVariablesAsync(); // This could be optimized
        variable = variables.find(v => v.variableCollectionId === collection.id && v.name === variableName);
    }

    let isNew = false;

    if (!variable) {
        variable = figma.variables.createVariable(variableName, collection.id, 'COLOR');
        isNew = true;
        result.created++;
    } else {
        // Update name if needed
        if (variable.name !== variableName) {
            variable.name = variableName;
        }
        result.updated++;
    }

    // Set description
    if (token.description) {
        variable.description = token.description;
    }

    // Set Value
    const modeId = collection.defaultModeId;

    if (isTokenReference(token)) {
        // It's an alias
        const value = await resolveAliasToVariable(token.value, allTokens);
        if (value) {
            variable.setValueForMode(modeId, value);
        } else {
            // If alias cannot be resolved to a variable, try resolving to raw value
            const rawValue = resolveTokenReference(token.value, allTokens);
            if (rawValue && typeof rawValue === 'string') {
                variable.setValueForMode(modeId, hexToRgba(rawValue));
            } else {
                throw new Error(`Could not resolve alias: ${token.value}`);
            }
        }
    } else {
        // It's a raw value
        if (typeof token.value === 'string') {
            variable.setValueForMode(modeId, hexToRgba(token.value));
        }
    }

    // Store ID back to token for future tracking?
    // Ideally we should update the token object in memory with the new ID
    if (!token.$extensions) token.$extensions = {};
    token.$extensions['com.figma.variable-id'] = variable.id;
}

/**
 * Resolve a path string (e.g., "{primitives.color.blue.500}") to a Figma Variable
 */
async function resolveAliasToVariable(ref: string, tokens: DesignTokens): Promise<VariableAlias | null> {
    const path = ref.slice(1, -1).split('.'); // Remove { } and split

    // Navigate to find the target token
    let current: any = tokens;
    for (const part of path) {
        if (current && current[part]) current = current[part];
        else return null;
    }

    const targetToken = current as Token;
    if (!targetToken || !targetToken.$extensions?.['com.figma.variable-id']) {
        return null;
    }

    // Check if variable exists
    try {
        const variable = await figma.variables.getVariableByIdAsync(targetToken.$extensions['com.figma.variable-id']);
        if (variable) {
            return figma.variables.createVariableAlias(variable);
        }
    } catch (e) { }

    return null;
}

/**
 * Get or create a variable collection
 */
async function getOrCreateCollection(name: string): Promise<VariableCollection> {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const existing = collections.find(c => c.name === name);

    if (existing) return existing;

    return figma.variables.createVariableCollection(name);
}
