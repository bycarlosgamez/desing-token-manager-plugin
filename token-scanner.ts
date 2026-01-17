/**
 * Token Scanner
 * Scans Figma document for styles and variables, converts them to tokens
 */

import { DesignTokens, TokenValue, TokenCategory, TokenSet, TokenType, TokenReference, ScannedVariableData, LiteCollection, LiteInternalVariable, CollectionDetail, CollectionVariableDetail } from './token-types';
import { rgbaToHex } from './token-utils';

/**
 * Heuristics for token categorization
 */
const PRIMITIVE_KEYWORDS = ['primitive', 'palette', 'core', 'scale', 'base', 'ref', 'reference'];
const SEMANTIC_KEYWORDS = ['semantic', 'system', 'usage', 'alias', 'light', 'dark', 'mode'];

/**
 * Scan all tokens from Figma document
 * Combines styles and variables
 */
export async function scanAllTokens(): Promise<DesignTokens> {
  const tokens: DesignTokens = {
    primitives: {},
    semantic: {},
    components: {},
    uncategorized: {},
  };

  // Scan color styles
  await scanColorStyles(tokens);

  // Scan color variables (if API available)
  await scanColorVariables(tokens);

  // Clean up empty categories
  if (Object.keys(tokens.primitives!).length === 0) delete tokens.primitives;
  if (Object.keys(tokens.semantic!).length === 0) delete tokens.semantic;
  if (Object.keys(tokens.components!).length === 0) delete tokens.components;
  if (Object.keys(tokens.uncategorized!).length === 0) delete tokens.uncategorized;

  return tokens;
}

/**
 * Scan color styles from Figma
 */
async function scanColorStyles(tokens: DesignTokens): Promise<void> {
  const paintStyles = await figma.getLocalPaintStylesAsync();

  for (const style of paintStyles) {
    if (style.paints.length === 0) continue;

    const paint = style.paints[0];

    // Only process solid colors
    if (paint.type === 'SOLID') {
      const colorValue = rgbaToHex(
        paint.color.r,
        paint.color.g,
        paint.color.b,
        paint.opacity !== undefined ? paint.opacity : 1
      );

      const category = determineCategory(style.name);
      const path = parseStyleName(style.name);

      const token: TokenValue = {
        value: colorValue,
        type: 'color',
        description: style.description || undefined,
        $extensions: {
          'com.figma.style-id': style.id,
          originalPath: path
        },
      };

      // Styles are often semantic in many teams, but if they are named "Blue/500" they are primitive
      // Our determineCategory function handles this.
      addToTokens(tokens, category, path, token);
    }
  }
}

/**
 * Scan color variables from Figma Variables API
 */
async function scanColorVariables(tokens: DesignTokens): Promise<void> {
  if (!figma.variables) return;

  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();

    const collectionMap = new Map<string, string>();
    for (const collection of collections) {
      collectionMap.set(collection.id, collection.name);
    }

    for (const variable of variables) {
      if (variable.resolvedType === 'COLOR') {
        const modeIds = Object.keys(variable.valuesByMode);
        if (modeIds.length === 0) continue;

        const firstModeId = modeIds[0];
        const value = variable.valuesByMode[firstModeId];

        // Skip aliases for now (TODO: Handle VariableAlias to create token references)
        if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
          continue;
        }

        if (typeof value === 'object' && value !== null && 'r' in value) {
          const rgba = value as { r: number; g: number; b: number; a?: number };
          const colorValue = rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);

          const collectionName = collectionMap.get(variable.variableCollectionId || '') || '';
          const nameParts = parseStyleName(variable.name);

          // Use collection name as part of the path if meaningful
          let path = [...nameParts];
          if (collectionName && !['collection', 'variable'].some(s => collectionName.toLowerCase().includes(s))) {
            // Heuristic: Prepend collection name if it's not generic
            // But tokens usually shouldn't have collection names in them if the variable name is unique
            // Let's stick to variable name for structure, but check collection for category
          }

          // Determine category based on Collection Name AND Variable Name
          const category = determineCategory(variable.name, collectionName);

          const token: TokenValue = {
            value: colorValue,
            type: 'color',
            description: variable.description || undefined,
            $extensions: {
              'com.figma.variable-id': variable.id,
              originalPath: path
            },
          };

          addToTokens(tokens, category, path, token);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning variables:', error);
  }
}

/**
 * Determine category (Primitives vs Semantic) based on name
 */
function determineCategory(name: string, collectionName: string = ''): TokenCategory {
  const fullString = `${collectionName}/${name}`.toLowerCase();

  if (PRIMITIVE_KEYWORDS.some(k => fullString.includes(k))) return 'primitives';
  if (SEMANTIC_KEYWORDS.some(k => fullString.includes(k))) return 'semantic';

  // Heuristic: If it has a number at the end (e.g. Blue/500 or Blue 500), it's likely a primitive
  if (/\d{2,3}$/.test(name.trim())) return 'primitives';

  // Heuristic: If it starts with a standard semantic prefix
  if (['text', 'bg', 'background', 'surface', 'border', 'fg', 'foreground'].some(k => name.toLowerCase().startsWith(k))) {
    return 'semantic';
  }

  // Default fallback
  return 'uncategorized';
}

/**
 * Parse style name into token path segments
 */
function parseStyleName(name: string): string[] {
  // Remove common prefixes
  let cleanName = name;
  // Don't strip "color" prefix violently as it might be part of the structure choice
  // cleanName = cleanName.replace(/^(color|spacing|typography|radius)[\/\.\-]?/i, '');

  // Split by common delimiters: / . - _
  // Treat spaces as delimiters if they separate words, but keep them if part of a name? 
  // Simply splitting by non-alphanumeric (except for some) is safer
  const parts = cleanName.split(/[\/\.\-]+/).map(p => p.trim()).filter(p => p.length > 0);

  return parts.map(camelCase);
}

function camelCase(str: string): string {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}

/**
 * Add token to the correct category in DesignTokens
 */
function addToTokens(tokens: DesignTokens, category: TokenCategory, path: string[], token: TokenValue): void {
  // Ensure category exists
  if (!tokens[category]) {
    tokens[category] = {};
  }

  let current: any = tokens[category]; // Root of the category (e.g., tokens.primitives)

  // We want to group by type first? e.g. primitives.color.blue.500
  // Or just follow the name path?
  // Use "color" as first level for colors

  // Implicitly add 'color' if not present in path?
  // If the path is ["blue", "500"] and type is color, we might want primitives.color.blue.500
  // If path already has "color", don't duplicate.

  let effectivePath = [...path];
  if (token.type === 'color' && effectivePath[0] !== 'color') {
    effectivePath.unshift('color');
  }

  // Navigate/create path
  for (let i = 0; i < effectivePath.length - 1; i++) {
    const part = effectivePath[i];

    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  // Set the final value
  const finalPart = effectivePath[effectivePath.length - 1];
  current[finalPart] = token;
}

// ----------------------------------------------------------------------
// NEW FUNCTIONS for Progressive Loading Workflow
// ----------------------------------------------------------------------

/**
 * Step 1: Light scan of all collections and variables
 */
export async function getLiteCollections(): Promise<ScannedVariableData> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  const liteCollections: LiteCollection[] = collections.map(c => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
    variableIds: c.variableIds
  }));

  const liteVariables: LiteInternalVariable[] = variables.map(v => ({
    id: v.id,
    name: v.name,
    resolvedType: v.resolvedType,
    collectionId: v.variableCollectionId
  }));

  return {
    collections: liteCollections,
    variables: liteVariables
  };
}

/**
 * Step 2: Detailed fetch for a specific collection
 */
/**
 * Step 2: Detailed fetch for a specific collection
 */
export async function getCollectionData(collectionId: string): Promise<CollectionDetail> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  if (!collection) throw new Error(`Collection ${collectionId} not found`);

  // Fetch all variables and collections for resolution context
  const allVariables = await figma.variables.getLocalVariablesAsync();
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync();

  // Optimization: Create map of Variables by ID and Collections by ID
  const variableMap = new Map(allVariables.map(v => [v.id, v]));
  const collectionMap = new Map(allCollections.map(c => [c.id, c]));

  const collectionVars = allVariables.filter(v => v.variableCollectionId === collectionId);
  const variablesDetail: CollectionVariableDetail[] = [];

  for (const v of collectionVars) {
    // Map internal types to our schema
    let type: TokenType = 'number'; // default
    if (v.resolvedType === 'COLOR') type = 'color';
    else if (v.resolvedType === 'FLOAT') type = 'number';
    else if (v.resolvedType === 'STRING') type = 'typography'; // Loose mapping

    const valuesByMode: { [modeId: string]: TokenValue | TokenReference } = {};
    let isAlias = false;

    for (const mode of collection.modes) {
      const modeId = mode.modeId;
      const value = v.valuesByMode[modeId];

      // Resolve the final value regardless of whether it's an alias or direct
      const resolvedValue = resolveVariableValue(
        v,
        modeId,
        collection,
        variableMap,
        collectionMap,
        new Set()
      );

      // Check for Alias (Direct)
      if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
        isAlias = true;
        const aliasId = value.id;
        const targetVar = variableMap.get(aliasId);

        valuesByMode[modeId] = {
          value: targetVar ? `{${targetVar.name}}` : `{${aliasId}}`,
          resolvedValue: resolvedValue,
          type: type,
          description: 'Alias'
        } as TokenReference;

      } else {
        // Direct Value (still might need conversion like RGBA -> Hex)
        let displayValue: string | number = '';

        if (v.resolvedType === 'COLOR' && typeof value === 'object' && 'r' in value) {
          const rgba = value as { r: number; g: number; b: number; a?: number };
          displayValue = rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);
        } else {
          displayValue = String(value);
        }

        valuesByMode[modeId] = {
          value: displayValue,
          resolvedValue: resolvedValue, // Should be same as displayValue for direct
          type: type
        } as TokenValue;
      }
    }

    variablesDetail.push({
      id: v.id,
      name: v.name,
      type,
      valuesByMode,
      isAlias
    });
  }

  return {
    collectionId: collection.id,
    name: collection.name,
    modes: collection.modes.map(m => ({ modeId: m.modeId, name: m.name })),
    variables: variablesDetail
  };
}

/**
 * Recursive Alias Resolution Helper
 */
function resolveVariableValue(
  variable: Variable,
  modeId: string,
  collection: VariableCollection,
  variableMap: Map<string, Variable>,
  collectionMap: Map<string, VariableCollection>,
  visited: Set<string>
): string | number | undefined {

  // Prevent cycles
  const refKey = `${variable.id}:${modeId}`;
  if (visited.has(refKey)) {
    return undefined; // Cycle detected
  }
  visited.add(refKey);

  const rawValue = variable.valuesByMode[modeId];

  // 1. If it's a Variable Alias
  if (typeof rawValue === 'object' && rawValue !== null && 'type' in rawValue && rawValue.type === 'VARIABLE_ALIAS') {
    const aliasId = rawValue.id;
    const targetVar = variableMap.get(aliasId);

    if (!targetVar) return undefined; // Broken link

    const targetCollection = collectionMap.get(targetVar.variableCollectionId);
    if (!targetCollection) return undefined;

    // Find corresponding mode in target collection
    // Heuristic: Match by Name first, then fallback to First Mode
    const currentModeName = collection.modes.find(m => m.modeId === modeId)?.name;
    let targetModeId = targetCollection.modes[0].modeId; // Default fallback

    if (currentModeName) {
      const match = targetCollection.modes.find(m => m.name === currentModeName);
      if (match) {
        targetModeId = match.modeId;
      }
    }

    // Recurse
    return resolveVariableValue(targetVar, targetModeId, targetCollection, variableMap, collectionMap, visited);
  }

  // 2. If it's a Color
  if (variable.resolvedType === 'COLOR' && typeof rawValue === 'object' && 'r' in rawValue) {
    const rgba = rawValue as { r: number; g: number; b: number; a?: number };
    return rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);
  }

  // 3. Primitives
  return rawValue as string | number;
}
