import * as React from 'react';
import { CollectionDetail, CollectionVariableDetail } from './token-types';
import { useTokenStore } from './token-store';

interface MappingViewProps {
    collection: CollectionDetail;
}

export const MappingView: React.FC<MappingViewProps> = ({ collection }) => {
    const { state } = useTokenStore();
    const modeId = state.activeModeId === 'ALL' ? collection.modes[0].modeId : state.activeModeId;

    // 1. Separate tokens into Semantic (Aliases) and Primitives (Raw Values)
    const semanticTokens = React.useMemo(() =>
        collection.variables.filter(v => v.isAlias),
        [collection, modeId]);

    const primitiveTokens = React.useMemo(() =>
        collection.variables.filter(v => !v.isAlias),
        [collection, modeId]);

    // 2. Calculate connections
    const ITEM_HEIGHT = 50;
    const HEADER_HEIGHT = 45;

    const connections = React.useMemo(() => {
        return semanticTokens.map((semantic, semIndex) => {
            // Attempt to resolve target by value matching for visualization
            const value = semantic.valuesByMode[modeId];

            // Extract the primitive value we want to find
            // If it's an alias, 'value' in TokenReference is the alias path "{...}"
            // 'resolvedValue' is the final value.
            const semValue = (value as any).resolvedValue || (value as any).value;

            // Find a primitive that has this same resolved value
            const targetPrim = primitiveTokens.find(p => {
                const pVal = p.valuesByMode[modeId];
                const primValue = (pVal as any).value;
                return primValue === semValue;
            });

            if (targetPrim) {
                const primIndex = primitiveTokens.indexOf(targetPrim);
                return {
                    id: semantic.id,
                    startX: 0,
                    startY: semIndex * ITEM_HEIGHT + 24, // Center of card
                    endX: 100, // Normalized %
                    endY: primIndex * ITEM_HEIGHT + 24,
                    color: semantic.type === 'color' ? String(semValue) : '#ccc'
                };
            }
            return null;
        }).filter(Boolean);
    }, [semanticTokens, primitiveTokens, modeId]);

    // Helper to draw bezier
    const getPath = (y1: number, y2: number) => {
        return `M 0 ${y1} C 50 ${y1}, 50 ${y2}, 100 ${y2}`;
    };

    const svgHeight = Math.max(semanticTokens.length, primitiveTokens.length) * ITEM_HEIGHT + 20;

    return (
        <div style={styles.container}>
            <div style={styles.column}>
                <div style={styles.columnHeader}>Semantic Tokens</div>
                <div style={styles.list}>
                    {semanticTokens.map(t => (
                        <div key={t.id} style={{ height: 40, ...styles.tokenCard }}>
                            <div style={styles.tokenName}>{t.name}</div>
                            <div style={styles.tokenType}>{t.type}</div>
                        </div>
                    ))}
                    {semanticTokens.length === 0 && <div style={styles.empty}>No semantic tokens</div>}
                </div>
            </div>

            <div style={styles.centerColumn}>
                <svg style={{ ...styles.svg, height: svgHeight }} viewBox={`0 0 100 ${svgHeight}`} preserveAspectRatio="none">
                    {connections.map((conn, i) => conn && (
                        <path
                            key={i}
                            d={getPath(conn.startY, conn.endY)}
                            fill="none"
                            stroke={conn.color}
                            strokeWidth="2"
                            opacity="0.6"
                        />
                    ))}
                    {connections.length === 0 && (
                        <text x="50" y="50" textAnchor="middle" fill="#ccc" fontSize="10">No direct matches</text>
                    )}
                </svg>
            </div>

            <div style={styles.column}>
                <div style={styles.columnHeader}>Primitives</div>
                <div style={styles.list}>
                    {primitiveTokens.map(t => (
                        <div key={t.id} style={{ height: 40, ...styles.tokenCard }}>
                            <div style={styles.tokenName}>{t.name}</div>
                            <div style={styles.tokenValue}>
                                {String((t.valuesByMode[modeId] as any)?.value)}
                            </div>
                        </div>
                    ))}
                    {primitiveTokens.length === 0 && <div style={styles.empty}>No primitive tokens</div>}
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: '#f8f8f8'
    },
    column: {
        width: '250px',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRight: '1px solid #e5e5e5',
        borderLeft: '1px solid #e5e5e5',
        zIndex: 1
    },
    centerColumn: {
        flex: 1,
        position: 'relative',
        background: '#f0f0f0'
    },
    columnHeader: {
        padding: '12px 16px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        borderBottom: '1px solid #e5e5e5',
        background: '#fafafa'
    },
    list: {
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
    },
    tokenCard: {
        padding: '8px 12px',
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: '4px',
        marginBottom: '8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    tokenName: {
        fontSize: '12px',
        fontWeight: 500,
        color: '#333',
        marginBottom: '4px'
    },
    tokenType: {
        fontSize: '10px',
        color: '#888',
        padding: '2px 4px',
        background: '#f5f5f5',
        borderRadius: '3px',
        display: 'inline-block'
    },
    tokenValue: {
        fontSize: '10px',
        color: '#555',
        fontFamily: 'monospace'
    },
    empty: {
        padding: '20px',
        textAlign: 'center',
        color: '#aaa',
        fontSize: '11px',
        fontStyle: 'italic'
    },
    svg: {
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
    }
};
