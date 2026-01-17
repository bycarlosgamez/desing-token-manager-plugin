/**
 * Token Storage
 * Handles persistence of tokens using figma.clientStorage
 */

import { DesignTokens, TokenMetadata } from './token-types';

const STORAGE_KEY = 'design-tokens';
const METADATA_KEY = 'design-tokens-metadata';

/**
 * Save tokens to clientStorage
 */
export async function saveTokens(tokens: DesignTokens): Promise<void> {
  try {
    await figma.clientStorage.setAsync(STORAGE_KEY, tokens);
    
    // Save metadata
    const metadata: TokenMetadata = {
      version: '1.0.0',
      lastSynced: Date.now(),
      figmaFileKey: figma.fileKey || undefined,
    };
    await figma.clientStorage.setAsync(METADATA_KEY, metadata);
  } catch (error) {
    console.error('Error saving tokens:', error);
    throw new Error(`Failed to save tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load tokens from clientStorage
 */
export async function loadTokens(): Promise<DesignTokens | null> {
  try {
    const tokens = await figma.clientStorage.getAsync(STORAGE_KEY);
    return tokens as DesignTokens | null;
  } catch (error) {
    console.error('Error loading tokens:', error);
    return null;
  }
}

/**
 * Load metadata from clientStorage
 */
export async function loadMetadata(): Promise<TokenMetadata | null> {
  try {
    const metadata = await figma.clientStorage.getAsync(METADATA_KEY);
    return metadata as TokenMetadata | null;
  } catch (error) {
    console.error('Error loading metadata:', error);
    return null;
  }
}

/**
 * Clear all stored tokens
 */
export async function clearTokens(): Promise<void> {
  try {
    await figma.clientStorage.deleteAsync(STORAGE_KEY);
    await figma.clientStorage.deleteAsync(METADATA_KEY);
  } catch (error) {
    console.error('Error clearing tokens:', error);
    throw new Error(`Failed to clear tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}
