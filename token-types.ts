/**
 * Token Schema Types
 * Based on W3C Design Tokens Format with opinionated structure
 */

export type TokenType = 'color' | 'spacing' | 'typography' | 'borderRadius' | 'number';

export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export type UnitFormat = 'px' | 'rem' | 'em' | 'none';

export interface NormalizationOptions {
  colorFormat?: ColorFormat;
  unit?: UnitFormat;
  baseFontSize?: number; // for rem conversion, default 16
}

export interface TokenValue {
  value: string | number;
  resolvedValue?: string | number; // Final primitive value after resolving aliases
  normalization?: NormalizationOptions; // User preference for export
  type: TokenType;
  description?: string;
  $extensions?: {
    'com.figma.variable-id'?: string;
    'com.figma.style-id'?: string;
    originalPath?: string[];
  };
}

// Transient state for local edits before export
export interface TokenEditState {
  value: string | number;
  originalValue?: string | number;
  isDirty?: boolean;
  normalization?: NormalizationOptions;
}

/**
 * Reference to another token (alias)
 * Format: "{category.subcategory.token}" or "{primitives.color.blue.500}"
 */
export interface TokenReference {
  value: string;
  resolvedValue?: string | number; // Final primitive value after resolving aliases
  type: TokenType;
  description?: string;
}

export type Token = TokenValue | TokenReference;

export interface TokenSet {
  [key: string]: TokenSet | Token;
}

/**
 * Root token structure
 * Enforces separation between Primitives (raw values) and Semantic (aliases)
 */
export interface DesignTokens {
  /**
   * Raw values, palette, scales (e.g., blue.500, spacing.4)
   * These should mostly be TokenValues
   */
  primitives?: TokenSet;

  /**
   * Semantic design decisions (e.g., primary, background.default)
   * These should mostly be TokenReferences pointing to primitives
   */
  semantic?: TokenSet;

  /**
   * Component-specific tokens (optional)
   */
  components?: TokenSet;

  /**
   * Fallback for uncategorized tokens during migration/scan
   */
  uncategorized?: TokenSet;

  /**
   * Allow other top-level keys for extensibility, but discourage them
   */
  [key: string]: TokenSet | undefined;
}

/**
 * Metadata stored with tokens
 */
export interface TokenMetadata {
  version: string;
  lastSynced: number;
  figmaFileKey?: string;
}

// ----------------------------------------------------------------------
// NEW TYPES for Progressive Loading Workflow
// ----------------------------------------------------------------------

export interface LiteCollection {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  variableIds: string[]; // List of variable IDs in this collection
}

export interface LiteInternalVariable {
  id: string;
  name: string;
  resolvedType: string; // 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  collectionId: string;
}

// Result of "Load Figma Variables" step
export interface ScannedVariableData {
  collections: LiteCollection[];
  variables: LiteInternalVariable[]; // Lightweight list for lookups if needed
}

// Result of "Get Collection Data" step (Detailed)
export interface CollectionDetail {
  collectionId: string;
  name: string;
  modes: { modeId: string; name: string }[];
  variables: CollectionVariableDetail[];
}

export interface CollectionVariableDetail {
  id: string;
  name: string;
  description?: string;
  type: TokenType; // Normalized type
  valuesByMode: { [modeId: string]: TokenValue | TokenReference };
  isAlias: boolean;
}
