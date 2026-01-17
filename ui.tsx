import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { DesignTokens, TokenMetadata, Token, TokenValue, TokenReference, TokenSet, LiteCollection, LiteInternalVariable, CollectionDetail, CollectionVariableDetail, TokenType } from './token-types';
import { TokenProvider, useTokenStore } from './token-store';
import { VariableTable } from './VariableTable';
import { MappingView } from './MappingView';
import { generateExport } from './token-export';
import { formatColor, formatUnit, collectionHasAliases, collectionHasColorVariables, collectionHasNumericVariables } from './token-utils';

console.log('UI Script: Starting execution...');

type AppMode = 'ENTRY' | 'LOADED' | 'SELECTED' | 'EXPORT_READY';
type Technology = 'JSON' | 'CSS' | 'SCSS';
type ActiveTab = 'variables' | 'mapping' | 'output' | 'specs';

interface AppState {
  mode: AppMode;
  loading: boolean;
  error: string | null;
  activeTab: ActiveTab;

  // View Options
  technology: Technology;
}

/**
 * Main App Component Container
 * Switched to Local State for Stability
 */
const AppContainer: React.FC = () => {
  return <App />;
};

/**
 * Inner App Component
 */
const App: React.FC = () => {
  // 1. Explicit Local State
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [collections, setCollections] = React.useState<LiteCollection[]>([]);
  const [variables, setVariables] = React.useState<CollectionVariableDetail[]>([]); // Detailed vars for view
  const [modes, setModes] = React.useState<{ modeId: string; name: string }[]>([]);

  const [activeTab, setActiveTab] = React.useState<ActiveTab>('variables');

  // Log active tab changes
  React.useEffect(() => {
    console.log('Active tab changed to:', activeTab);
  }, [activeTab]);
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<string>(''); // Controlled
  const [selectedModeId, setSelectedModeId] = React.useState<string>('all'); // Controlled
  const [aliasDisplayMode, setAliasDisplayMode] = React.useState<'resolved' | 'alias'>('alias');

  // Formatting & Output State
  const [colorFormat, setColorFormat] = React.useState<string>('hex');
  const [unitFormat, setUnitFormat] = React.useState<string>('px');
  const [outputFormat, setOutputFormat] = React.useState<'css' | 'scss' | 'json' | 'dtcg'>('css');

  // Log output format changes
  React.useEffect(() => {
    console.log('Output format changed to:', outputFormat);
  }, [outputFormat]);

  // Per-variable unit selection (map: variableId -> unit)
  const [unitPerVariable, setUnitPerVariable] = React.useState<Map<string, string>>(new Map());

  // Listen for messages
  React.useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data.pluginMessage;

      switch (type) {
        case 'variables-loaded':
          console.log('Variables loaded:', payload.collections.length, 'collections');
          setCollections(payload.collections);
          setLoading(false);
          break;

        case 'collection-data-loaded':
          console.log('Collection data loaded:', payload.name);
          setModes(payload.modes);
          setVariables(payload.variables);
          setLoading(false);
          break;

        case 'error':
          console.error('Plugin Error:', payload);
          setError(payload);
          setLoading(false);
          break;
      }
    };
  }, []);

  const sendMessage = (msg: any) => {
    parent.postMessage({ pluginMessage: msg }, '*');
  };

  const handleLoadVariables = () => {
    setLoading(true);
    setError(null);
    sendMessage({ type: 'load-variables' });
  };

  const handleRefreshVariables = () => {
    // Reset all state to defaults
    setSelectedCollectionId('');
    setSelectedModeId('all');
    setVariables([]);
    setModes([]);
    setAliasDisplayMode('alias');
    setColorFormat('hex');
    setUnitFormat('px');
    setOutputFormat('css');
    setUnitPerVariable(new Map());
    setActiveTab('variables');

    // Reload variables
    setLoading(true);
    setError(null);
    parent.postMessage({ pluginMessage: { type: 'load-variables' } }, '*');
  };

  const handleSelectCollection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    console.log('Selecting Collection ID:', newId);

    setSelectedCollectionId(newId);
    setVariables([]); // Clear previous variables while loading
    setModes([]);
    setSelectedModeId('all'); // Reset mode
    setLoading(true);

    sendMessage({
      type: 'get-collection-data',
      collectionId: newId
    });
  };

  const handleSelectMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModeId = e.target.value;
    console.log('Selecting Mode ID:', newModeId);
    setSelectedModeId(newModeId);
  };

  // Auto-select single mode when modes load
  React.useEffect(() => {
    if (modes.length === 1) {
      console.log('Auto-selecting single mode:', modes[0].modeId);
      setSelectedModeId(modes[0].modeId);
    } else if (modes.length > 1) {
      // Reset to default when multiple modes
      setSelectedModeId('all');
    }
  }, [modes]);

  // Computed values for progressive disclosure and type detection
  const hasAliases = React.useMemo(() => collectionHasAliases(variables), [variables]);
  const hasColorVariables = React.useMemo(() => collectionHasColorVariables(variables), [variables]);
  const hasNumericVariables = React.useMemo(() => collectionHasNumericVariables(variables), [variables]);
  const showControls = selectedCollectionId && selectedModeId !== 'all';
  const getDisplayValue = (v: CollectionVariableDetail, modeId: string): { text: string, isColor: boolean, colorValue?: string } => {
    const valObj = v.valuesByMode[modeId];
    if (!valObj) return { text: '---', isColor: false };

    const isResolvedMode = aliasDisplayMode === 'resolved';

    let finalText = String(valObj.value);
    let colorHex = '';

    if (isResolvedMode) {
      if (valObj.resolvedValue !== undefined && valObj.resolvedValue !== null) {
        finalText = String(valObj.resolvedValue);
      }
    } else {
      finalText = String(valObj.value);
    }

    // Color handling
    const isColor = v.type === 'color';
    if (isColor) {
      if (valObj.resolvedValue && typeof valObj.resolvedValue === 'string') {
        colorHex = valObj.resolvedValue;
      } else if (!isResolvedMode && typeof valObj.value === 'string' && valObj.value.startsWith('#')) {
        colorHex = valObj.value;
      }

      // Format text
      if (isResolvedMode || (finalText.startsWith('#') || finalText.startsWith('rgb'))) {
        finalText = formatColor(finalText, colorFormat);
      }
    }

    // For numeric variables, keep only the number (unit will be in separate column)
    // No unit formatting applied here anymore

    return { text: finalText, isColor, colorValue: colorHex };
  };

  const displayedVariables = variables.map(v => {
    const targetModeId = selectedModeId === 'all' && modes.length > 0 ? modes[0].modeId : selectedModeId;
    const { text, isColor, colorValue } = targetModeId && targetModeId !== 'all'
      ? getDisplayValue(v, targetModeId)
      : { text: null, isColor: false };

    // If 'all' modes selected, showing '---' is confusing. 
    // Let's just default to first mode or empty if not selected.
    const displayValue = text || '---';
    return { ...v, displayValue, isColor, colorValue };
  });

  return (
    <div style={styles.container}>
      {/* Header / Toolbar */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>Design Tokens Manager</h1>
          {collections.length > 0 && (
            <button
              style={{ ...styles.buttonSecondary, fontSize: '11px', padding: '4px 8px' }}
              onClick={handleRefreshVariables}
              title="Reload variables from Figma"
            >
              ↻ Refresh
            </button>
          )}
        </div>
        {/* Only show tabs after variables are loaded */}
        {collections.length > 0 && (
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, borderBottom: activeTab === 'variables' ? '2px solid #18a0fb' : 'none', fontWeight: activeTab === 'variables' ? 600 : 500 }}
              onClick={() => setActiveTab('variables')}
            >
              Variables
            </button>
            {/* Only show Output tab after collection is selected */}
            {selectedCollectionId && (
              <button
                style={{ ...styles.tab, borderBottom: activeTab === 'output' ? '2px solid #18a0fb' : 'none', fontWeight: activeTab === 'output' ? 600 : 500 }}
                onClick={() => setActiveTab('output')}
              >
                Output
              </button>
            )}
            <button
              style={{ ...styles.tab, borderBottom: activeTab === 'specs' ? '2px solid #18a0fb' : 'none', fontWeight: activeTab === 'specs' ? 600 : 500 }}
              onClick={() => setActiveTab('specs')}
            >
              Spec
            </button>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        {/* 1. LOAD OR SELECT COLLECTION */}
        {collections.length === 0 ? (
          <div style={styles.emptyState}>
            <button style={styles.buttonPrimary} onClick={handleLoadVariables} disabled={loading}>
              {loading ? 'Loading...' : 'Load Figma Variables'}
            </button>
          </div>
        ) : !selectedCollectionId ? (
          <div style={{ padding: 20 }}>
            {collections.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: 32 }}>
                <p>No variable collections found in this file.</p>
                <p style={{ fontSize: '11px', marginTop: 8 }}>Create variable collections in Figma to get started.</p>
              </div>
            ) : (
              <div style={styles.controlGroup}>
                <label style={styles.label}>Collection</label>
                <select
                  style={styles.select}
                  value={selectedCollectionId}
                  onChange={handleSelectCollection}
                >
                  <option value="" disabled>Select a collection...</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeTab === 'variables' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>

                {/* CONTROLS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 6 }}>
                  {/* ROW 1: COLLECTION & MODE */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={styles.controlGroup}>
                      <label style={styles.label}>Collection</label>
                      <select
                        style={styles.select}
                        value={selectedCollectionId}
                        onChange={handleSelectCollection}
                      >
                        <option value="" disabled>Select a collection...</option>
                        {collections.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {modes.length > 0 && (
                      <div style={styles.controlGroup}>
                        <label style={styles.label}>Mode</label>
                        <select
                          style={styles.select}
                          value={selectedModeId}
                          onChange={handleSelectMode}
                        >
                          <option value="all">All Modes (Default)</option>
                          {modes.map(m => (
                            <option key={m.modeId} value={m.modeId}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* ROW 2: FORMATTING (COLOR & UNIT) */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #f5f5f5', paddingTop: 12 }}>
                    <div style={styles.controlGroup}>
                      <label style={styles.label}>Color</label>
                      <select
                        style={{ ...styles.select, opacity: hasColorVariables ? 1 : 0.5 }}
                        value={colorFormat}
                        onChange={(e) => setColorFormat(e.target.value)}
                        disabled={!hasColorVariables}
                      >
                        <option value="hex">Hex</option>
                        <option value="rgb">RGB</option>
                        <option value="rgba">RGBA</option>
                        <option value="hsl">HSL</option>
                        <option value="hsla">HSLA</option>
                        <option value="oklch">OKLCH</option>
                      </select>
                      {!hasColorVariables && (
                        <div style={{ fontSize: '10px', color: '#999', fontStyle: 'italic', marginTop: 4 }}>
                          No color variables in this collection
                        </div>
                      )}
                    </div>

                    <div style={styles.controlGroup}>
                      <label style={styles.label}>Unit</label>
                      <select
                        style={{ ...styles.select, opacity: hasNumericVariables ? 1 : 0.5 }}
                        value={unitFormat}
                        onChange={(e) => {
                          const newUnit = e.target.value;
                          setUnitFormat(newUnit);
                          // Update all numeric variables to the new global unit
                          const newMap = new Map<string, string>();
                          variables.forEach(v => {
                            if (v.type === 'number' || v.type === 'spacing' || v.type === 'borderRadius') {
                              newMap.set(v.id, newUnit);
                            }
                          });
                          setUnitPerVariable(newMap);
                        }}
                        disabled={!hasNumericVariables}
                      >
                        <option value="px">px</option>
                        <option value="rem">rem</option>
                        <option value="em">em</option>
                      </select>
                      {!hasNumericVariables && (
                        <div style={{ fontSize: '10px', color: '#999', fontStyle: 'italic', marginTop: 4 }}>
                          No numeric variables in this collection
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ROW 3: VALUES (ALIAS / RESOLVE) */}
                  {selectedCollectionId && modes.length > 0 && (
                    <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 12 }}>
                      <div style={styles.controlGroup}>
                        <label style={styles.label}>Values</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', height: '32px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="aliasMode"
                                checked={aliasDisplayMode === 'alias'}
                                onChange={() => setAliasDisplayMode('alias')}
                              />
                              Alias
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', cursor: hasAliases ? 'pointer' : 'not-allowed', opacity: hasAliases ? 1 : 0.5 }}>
                              <input
                                type="radio"
                                name="aliasMode"
                                checked={aliasDisplayMode === 'resolved'}
                                onChange={() => setAliasDisplayMode('resolved')}
                                disabled={!hasAliases}
                              />
                              Resolve
                            </label>
                          </div>
                          {!hasAliases && (
                            <div style={{ fontSize: '10px', color: '#999', fontStyle: 'italic' }}>
                              This collection contains no aliases
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABLE */}
                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Loading details...</div>
                ) : (
                  selectedCollectionId ? (
                    <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e5e5', borderRadius: 4 }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Value</th>
                            <th style={styles.th}>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedVariables.map(v => (
                            <tr key={v.id}>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 500 }}>{v.name}</div>
                              </td>
                              <td style={styles.td}>
                                <span style={styles.badge}>{v.type}</span>
                              </td>
                              <td style={styles.td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {v.isColor && v.colorValue && (
                                    <div style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 4,
                                      background: v.colorValue,
                                      border: '1px solid #ddd'
                                    }} />
                                  )}
                                  <code style={{ ...styles.code, color: aliasDisplayMode === 'alias' && v.displayValue.startsWith('{') ? '#f24822' : 'inherit' }}>
                                    {v.displayValue}
                                  </code>
                                </div>
                              </td>
                              <td style={styles.td}>
                                {(v.type === 'number' || v.type === 'spacing' || v.type === 'borderRadius') ? (
                                  <select
                                    style={{ ...styles.select, fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                    value={unitPerVariable.get(v.id) || unitFormat}
                                    onChange={(e) => {
                                      const newMap = new Map(unitPerVariable);
                                      newMap.set(v.id, e.target.value);
                                      setUnitPerVariable(newMap);
                                    }}
                                  >
                                    <option value="px">px</option>
                                    <option value="rem">rem</option>
                                    <option value="em">em</option>
                                    <option value="%">%</option>
                                    <option value="vw">vw</option>
                                    <option value="vh">vh</option>
                                    <option value="vmin">vmin</option>
                                    <option value="vmax">vmax</option>
                                    <option value="ch">ch</option>
                                    <option value="ex">ex</option>
                                    <option value="cm">cm</option>
                                    <option value="mm">mm</option>
                                    <option value="in">in</option>
                                    <option value="pt">pt</option>
                                    <option value="pc">pc</option>
                                  </select>
                                ) : (
                                  <span style={{ color: '#999', fontSize: '10px', fontStyle: 'italic' }}>Only for number types</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {displayedVariables.length === 0 && (
                            <tr>
                              <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                                No variables found in this collection.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                      Select a collection to view variables.
                    </div>
                  )
                )}
              </div>
            )}

            {/* OUTPUT TAB */}
            {activeTab === 'output' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
                {selectedCollectionId && variables.length > 0 ? (
                  <>
                    <div style={styles.controls}>
                      <div style={styles.controlGroup}>
                        <label style={styles.label}>Format</label>
                        <select style={styles.select} value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
                          <option value="css">CSS Variables</option>
                          <option value="scss">SCSS Variables</option>
                          <option value="json">JSON</option>
                          <option value="dtcg">Design Tokens (W3C)</option>
                        </select>
                      </div>
                    </div>
                    {selectedModeId === 'all' && modes.length > 1 && (
                      <div style={{ padding: 8, background: '#f0f9ff', color: '#0369a1', borderRadius: 4, fontSize: '11px' }}>
                        <strong>Note:</strong> Showing values for all modes (using first mode as default)
                      </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={styles.toolbar}>
                        <div style={styles.toolbarTitle}>Output Preview</div>
                        <button
                          style={styles.buttonSecondary}
                          onClick={() => {
                            const exportModes = selectedModeId === 'all'
                              ? modes.map(m => ({ modeId: m.modeId, name: m.name }))
                              : modes.filter(m => m.modeId === selectedModeId).map(m => ({ modeId: m.modeId, name: m.name }));

                            const el = document.createElement('textarea');
                            el.value = generateExport(variables, {
                              format: outputFormat,
                              modes: exportModes,
                              aliasMode: aliasDisplayMode,
                              colorFormat,
                              unitFormat,
                              baseFontSize: 16,
                              unitPerVariable: unitPerVariable
                            }, collections.find(c => c.id === selectedCollectionId)?.name || 'Tokens');
                            document.body.appendChild(el);
                            el.select();
                            document.execCommand('copy');
                            document.body.removeChild(el);
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <textarea
                        readOnly
                        style={styles.codeBlock}
                        value={generateExport(variables, {
                          format: outputFormat,
                          modes: selectedModeId === 'all'
                            ? modes.map(m => ({ modeId: m.modeId, name: m.name }))
                            : modes.filter(m => m.modeId === selectedModeId).map(m => ({ modeId: m.modeId, name: m.name })),
                          aliasMode: aliasDisplayMode,
                          colorFormat,
                          unitFormat,
                          baseFontSize: 16,
                          unitPerVariable: unitPerVariable
                        }, collections.find(c => c.id === selectedCollectionId)?.name || 'Tokens')}
                      />
                    </div>
                    {outputFormat === 'dtcg' && (
                      <div style={{ padding: 12, background: '#e6fffa', color: '#2c7a7b', borderRadius: 6, fontSize: '11px' }}>
                        <strong>Note:</strong> W3C Design Tokens export uses the selected mode and formatting.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: '#666' }}>
                    <p style={{ fontSize: '14px', marginBottom: 8 }}>Select a collection to see output</p>
                    <p style={{ fontSize: '11px', color: '#999' }}>
                      Load variables and choose a collection from the Variables tab.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SPECS TAB */}
            {activeTab === 'specs' && (
              <div style={{ padding: 20, overflow: 'auto' }}>
                <h2>Design Tokens Specification</h2>
                <p>This plugin supports the <a href="https://tr.designtokens.org/format/" target="_blank">W3C Design Tokens Format Module</a>.</p>

                <h3>Key Concepts</h3>
                <ul>
                  <li><strong>$value</strong>: The actual value of the token.</li>
                  <li><strong>$type</strong>: The type of token (color, number, dimension, etc).</li>
                  <li><strong>Nesting</strong>: Tokens are organized in a hierarchy typically derived from their name (e.g. `color/brand/primary`).</li>
                </ul>

                <h3>Aliases</h3>
                <p>References to other tokens are wrapped in curly braces, e.g., <code>{`{color.brand.primary}`}</code>.</p>

                <div style={{ marginTop: 20, padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
                  <code>
                    {`{
  "color": {
    "brand": {
      "$value": "#000000",
      "$type": "color"
    }
  }
}`}
                  </code>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '12px',
    color: '#333',
    background: '#fff',
  },
  header: {
    padding: '16px 16px 0 16px',
    borderBottom: '1px solid #e5e5e5',
    background: '#fff',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '16px',
  },
  tab: {
    padding: '8px 4px',
    background: 'transparent',
    border: 'none',
    fontSize: '12px',
    fontWeight: 500,
    color: '#333',
    cursor: 'pointer',
    outline: 'none',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    background: '#f5f5f5',
  },
  error: {
    padding: '8px 16px',
    background: '#fff5f5',
    color: '#f24822',
    borderBottom: '1px solid #fed7d7',
  },
  emptyState: {
    padding: '32px',
    textAlign: 'center',
    color: '#666',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  buttonPrimary: {
    padding: '6px 12px',
    background: '#18a0fb',
    color: '#fff',
    border: '1px solid transparent',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: '6px 12px',
    background: '#fff',
    color: '#333',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#333',
    marginBottom: 8,
  },
  select: {
    width: '100%',
    padding: '8px',
    borderRadius: 6,
    border: '1px solid #e5e5e5',
    fontSize: '12px',
    fontFamily: 'inherit'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    textAlign: 'left',
    padding: '8px',
    borderBottom: '1px solid #eee',
    color: '#888',
    fontWeight: 600,
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #f5f5f5',
    verticalAlign: 'middle',
  },
  // Tree Styles - Reused for other potential nested views
  groupContainer: {
    marginBottom: '8px',
  },
  groupHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#888',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  groupContent: {
    paddingLeft: '8px',
    borderLeft: '1px solid #e5e5e5',
  },
  tokenItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
  },

  // Code Preview Styles
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#1e1e1e', // Dark header
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  toolbarTitle: {
    color: '#ccc',
    fontSize: '11px',
    fontWeight: 600,
  },
  checkboxLabel: {
    color: '#ccc',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  loadingState: {
    padding: 24,
    textAlign: 'center',
    color: '#666',
  },
  codeBlock: {
    flex: 1,
    padding: '12px',
    margin: 0,
    background: '#1e1e1e', // VS Code-ish background
    color: '#d4d4d4',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: '11px',
    lineHeight: '1.5',
    border: 'none',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    resize: 'none',
    outline: 'none',
    whiteSpace: 'pre',
    overflow: 'auto',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 6px',
    background: '#e0e7ff',
    color: '#4338ca',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  code: {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: '11px',
    background: '#f5f5f5',
    padding: '2px 4px',
    borderRadius: '3px',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '12px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
  },
  controlGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: '120px',
  },
};

// Initialize App
try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<AppContainer />);
  } else {
    document.body.innerHTML = '<div style="color:red;padding:20px;">Error: Root element not found</div>';
  }
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  document.body.innerHTML = `<div style="color:red;padding:20px;">Failed to initialize UI: ${errorMessage}</div>`;
  console.error('Failed to initialize UI:', err);
}
