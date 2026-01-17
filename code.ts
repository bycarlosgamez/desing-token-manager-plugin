/**
 * Design Tokens Manager - Plugin Code
 * Main plugin logic for scanning, storing, and syncing design tokens
 */

import { scanAllTokens, getLiteCollections, getCollectionData } from './token-scanner';
import { saveTokens, loadTokens, loadMetadata } from './token-storage';
import { DesignTokens, TokenMetadata } from './token-types';
import { syncTokensToFigma } from './token-sync';

/**
 * Initialize the plugin UI
 */
function initPlugin() {
  // Show the UI with appropriate dimensions
  figma.showUI(__html__, {
    width: 600,
    height: 700,
    title: 'Design Tokens Manager',
    themeColors: true,
  });

  // Handle messages from UI
  figma.ui.onmessage = async (msg) => {
    try {
      switch (msg.type) {
        case 'scan-document':
          await handleScanDocument();
          break;

        case 'load-tokens':
          await handleLoadTokens();
          break;

        case 'save-tokens':
          await handleSaveTokens(msg.tokens);
          break;

        case 'export-tokens':
          await handleExportTokens();
          break;

        case 'import-tokens':
          await handleImportTokens(msg.tokens);
          break;

        case 'sync-to-figma':
          await handleSyncToFigma(msg.tokens);
          break;

        // NEW WORKFLOW HANDLERS
        case 'load-variables':
          await handleLoadVariables();
          break;

        case 'get-collection-data':
          await handleGetCollectionData(msg.collectionId);
          break;

        default:
          console.warn('Unknown message type:', msg.type);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      figma.ui.postMessage({
        type: 'error',
        payload: errorMessage,
      });
      console.error('Error handling message:', error);
    }
  };
}

/**
 * Scan document for styles and variables
 */
async function handleScanDocument() {
  try {
    figma.ui.postMessage({
      type: 'scanning-started',
    });

    // Scan all tokens from Figma document
    const tokens = await scanAllTokens();

    // Save scanned tokens
    await saveTokens(tokens);

    // Load metadata
    const metadata = await loadMetadata();

    // Send tokens to UI
    figma.ui.postMessage({
      type: 'tokens-scanned',
      payload: {
        tokens,
        metadata,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error scanning document: ${errorMessage}`,
    });
  }
}

/**
 * Load stored tokens
 */
async function handleLoadTokens() {
  try {
    const tokens = await loadTokens();
    const metadata = await loadMetadata();

    figma.ui.postMessage({
      type: 'tokens-loaded',
      payload: {
        tokens: tokens || {},
        metadata,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error loading tokens: ${errorMessage}`,
    });
  }
}

/**
 * Save tokens to storage
 */
async function handleSaveTokens(tokens: DesignTokens) {
  try {
    await saveTokens(tokens);

    figma.ui.postMessage({
      type: 'tokens-saved',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error saving tokens: ${errorMessage}`,
    });
  }
}

/**
 * Export tokens as JSON
 */
async function handleExportTokens() {
  try {
    const tokens = await loadTokens();
    const metadata = await loadMetadata();

    if (!tokens) {
      figma.ui.postMessage({
        type: 'error',
        payload: 'No tokens found. Please scan the document first.',
      });
      return;
    }

    // Combine tokens with metadata for export
    const exportData = {
      tokens,
      metadata,
      exportDate: new Date().toISOString(),
    };

    figma.ui.postMessage({
      type: 'tokens-exported',
      payload: exportData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error exporting tokens: ${errorMessage}`,
    });
  }
}

/**
 * Import tokens from JSON
 */
async function handleImportTokens(importData: { tokens: DesignTokens; metadata?: TokenMetadata }) {
  try {
    const { tokens, metadata } = importData;

    // Save imported tokens
    await saveTokens(tokens);

    // If metadata provided, save it
    if (metadata) {
      // Update lastSynced timestamp
      const updatedMetadata: TokenMetadata = {
        ...metadata,
        lastSynced: Date.now(),
        figmaFileKey: figma.fileKey || undefined,
      };
      await figma.clientStorage.setAsync('design-tokens-metadata', updatedMetadata);
    }

    figma.ui.postMessage({
      type: 'tokens-imported',
      payload: {
        tokens,
        metadata,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error importing tokens: ${errorMessage}`,
    });
  }
}

/**
 * Sync tokens back to Figma styles
 */
async function handleSyncToFigma(tokens: DesignTokens) {
  try {
    figma.ui.postMessage({
      type: 'syncing-started',
    });

    const result = await syncTokensToFigma(tokens);

    // Also save the tokens after sync because IDs might have been updated
    await saveTokens(tokens);

    figma.ui.postMessage({
      type: 'syncing-completed',
      payload: {
        message: `Sync complete! Created: ${result.created}, Updated: ${result.updated}`,
        errors: result.errors
      },
      // Send back updated tokens
      tokens
    });

    if (result.errors.length > 0) {
      figma.notify(`Sync complete with ${result.errors.length} errors`, { error: true });
      console.warn('Sync errors:', result.errors);
    } else {
      figma.notify(`Sync complete! Created: ${result.created}, Updated: ${result.updated}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error syncing to Figma: ${errorMessage}`,
    });
  }
}

// ----------------------------------------------------------------------
// NEW HANDLERS for Progressive Loading Workflow
// ----------------------------------------------------------------------



async function handleLoadVariables() {
  try {
    const data = await getLiteCollections();
    figma.ui.postMessage({
      type: 'variables-loaded',
      payload: data
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error loading variables: ${errorMessage}`
    });
  }
}

async function handleGetCollectionData(collectionId: string) {
  try {
    const data = await getCollectionData(collectionId);
    figma.ui.postMessage({
      type: 'collection-data-loaded',
      payload: data
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: 'error',
      payload: `Error loading collection data: ${errorMessage}`
    });
  }
}

// Initialize plugin when loaded
initPlugin();
