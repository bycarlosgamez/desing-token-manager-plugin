import * as React from 'react';
import { CollectionDetail, CollectionVariableDetail, TokenEditState, TokenType, TokenValue } from './token-types';
import { useTokenStore } from './token-store';
import { normalizeColor, normalizeNumber } from './token-utils-normalization';

interface VariableTableProps {
    collection: CollectionDetail;
}

export const VariableTable: React.FC<VariableTableProps> = ({ collection }) => {
    const { state, dispatch } = useTokenStore();
    const modeId = collection.modes[0].modeId; // Default to first mode for editing primitives

    const handleValueChange = (variableId: string, newValue: string) => {
        dispatch({
            type: 'SET_LOCAL_EDIT',
            payload: {
                variableId,
                modeId: modeId,
                value: newValue
            }
        });
    };

    const handleNormalizationChange = (variableId: string, type: 'color' | 'number', value: string) => {
        const editKey = `${variableId}:${modeId}`;
        const currentEdit = state.localEdits[editKey] || {};
        const currentNorm = currentEdit.normalization || {};

        let newNorm = { ...currentNorm };
        if (type === 'color') {
            newNorm.colorFormat = value as any;
        } else if (type === 'number') {
            newNorm.unit = value as any;
        }

        dispatch({
            type: 'UPDATE_TOKEN_NORMALIZATION',
            payload: {
                id: variableId,
                normalization: newNorm
            }
        });
    };

    const getDisplayValue = (v: CollectionVariableDetail) => {
        const editKey = `${v.id}:${modeId}`;
        if (state.localEdits[editKey]) {
            return state.localEdits[editKey].value;
        }
        return v.valuesByMode[modeId]?.value || '';
    };

    return (
        <div style={styles.container}>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Value</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Normalization</th>
                    </tr>
                </thead>
                <tbody>
                    {collection.variables.map(v => {
                        const displayValue = getDisplayValue(v);
                        const editKey = `${v.id}:${modeId}`;
                        const localNorm = state.localEdits[editKey]?.normalization || {};

                        return (
                            <tr key={v.id}>
                                <td style={styles.td}>
                                    <div style={styles.name}>{v.name}</div>
                                    {v.description && <div style={styles.desc}>{v.description}</div>}
                                </td>
                                <td style={styles.td}>
                                    <div style={styles.valueCell}>
                                        {v.type === 'color' && (
                                            <div style={{ ...styles.colorPreview, backgroundColor: String(displayValue) }}></div>
                                        )}
                                        <input
                                            type="text"
                                            value={String(displayValue)}
                                            onChange={(e) => handleValueChange(v.id, e.target.value)}
                                            style={styles.input}
                                        />
                                    </div>
                                </td>
                                <td style={styles.td}>
                                    <span style={styles.badge}>{v.type}</span>
                                </td>
                                <td style={styles.td}>
                                    {v.type === 'color' && (
                                        <select
                                            style={styles.selectSmall}
                                            value={localNorm.colorFormat || 'original'}
                                            onChange={(e) => handleNormalizationChange(v.id, 'color', e.target.value)}
                                        >
                                            <option value="original">Original</option>
                                            <option value="hex">HEX</option>
                                            <option value="rgb">RGB</option>
                                            <option value="hsl">HSL</option>
                                        </select>
                                    )}
                                    {v.type === 'number' && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <select
                                                style={styles.selectSmall}
                                                value={localNorm.unit || 'px'}
                                                onChange={(e) => handleNormalizationChange(v.id, 'number', e.target.value)}
                                            >
                                                <option value="px">px</option>
                                                <option value="rem">rem</option>
                                                <option value="none">unitless</option>
                                            </select>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        flex: 1,
        overflow: 'auto',
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 4,
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '11px',
    },
    th: {
        textAlign: 'left',
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
        color: '#888',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 1
    },
    td: {
        padding: '8px 12px',
        borderBottom: '1px solid #f5f5f5',
        verticalAlign: 'middle',
    },
    name: {
        fontWeight: 500,
        color: '#333'
    },
    desc: {
        fontSize: '10px',
        color: '#999',
        marginTop: 2
    },
    valueCell: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
    },
    colorPreview: {
        width: 16,
        height: 16,
        borderRadius: 3,
        border: '1px solid #eee',
        flexShrink: 0
    },
    input: {
        padding: '4px 8px',
        border: '1px solid #eee',
        borderRadius: 4,
        fontSize: '11px',
        width: '100%',
        fontFamily: 'Menlo, monospace'
    },
    badge: {
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: 4,
        background: '#f0f0f0',
        color: '#666',
        fontSize: '10px',
        textTransform: 'uppercase'
    },
    selectSmall: {
        padding: '2px 4px',
        fontSize: '10px',
        border: '1px solid #ddd',
        borderRadius: 3
    }
};
