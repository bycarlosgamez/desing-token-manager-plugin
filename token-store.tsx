import * as React from 'react';
import { CollectionDetail, TokenEditState, NormalizationOptions, LiteCollection } from './token-types';

// ----------------------------------------------------------------------
// STATE & TYPES
// ----------------------------------------------------------------------

export interface TokenState {
    // Global Selection
    activeCollectionId: string | null;
    activeModeId: string | 'ALL';

    // Data
    allCollections: LiteCollection[];
    collection: CollectionDetail | null;
    localEdits: Record<string, TokenEditState>; // Keyed by variableId

    // Preferences
    showAliases: boolean;
    baseFontSize: number;
}

export type TokenAction =
    | { type: 'SET_ALL_COLLECTIONS'; payload: LiteCollection[] }
    | { type: 'SET_COLLECTION'; payload: CollectionDetail }
    | { type: 'SET_MODE'; payload: string }
    | { type: 'UPDATE_TOKEN_VALUE'; payload: { id: string; value: string | number } }
    | { type: 'SET_LOCAL_EDIT'; payload: { variableId: string; modeId: string; value: string } }
    | { type: 'UPDATE_TOKEN_NORMALIZATION'; payload: { id: string; normalization: NormalizationOptions } }
    | { type: 'TOGGLE_ALIASES'; payload: boolean }
    | { type: 'RESET'; };

const initialState: TokenState = {
    activeCollectionId: null,
    activeModeId: 'ALL',
    allCollections: [],
    collection: null,
    localEdits: {},
    showAliases: true,
    baseFontSize: 16
};

// ----------------------------------------------------------------------
// REDUCER
// ----------------------------------------------------------------------

function tokenReducer(state: TokenState, action: TokenAction): TokenState {
    switch (action.type) {
        case 'SET_ALL_COLLECTIONS':
            return {
                ...initialState, // Reset when reloading all collections
                allCollections: action.payload
            };

        case 'SET_COLLECTION':
            return {
                ...initialState, // Reset selection state / local edits
                allCollections: state.allCollections, // Preserve the list of collections
                showAliases: state.showAliases, // Preserve view preferences
                baseFontSize: state.baseFontSize,
                activeCollectionId: action.payload.collectionId,
                collection: action.payload,
                // Auto-select mode
                activeModeId: action.payload.modes.length === 1 ? action.payload.modes[0].modeId : 'ALL'
            };

        case 'SET_MODE':
            return { ...state, activeModeId: action.payload };

        case 'SET_LOCAL_EDIT': {
            const { variableId, modeId, value } = action.payload;
            const key = `${variableId}:${modeId}`;
            return {
                ...state,
                localEdits: {
                    ...state.localEdits,
                    [key]: {
                        originalValue: '', // We should ideally get this from state but for now empty is fine as we key by ID
                        value,
                        isDirty: true
                    }
                }
            };
        }
        case 'UPDATE_TOKEN_VALUE': {
            const { id, value } = action.payload;
            const currentEdit = state.localEdits[id] || {};
            return {
                ...state,
                localEdits: {
                    ...state.localEdits,
                    [id]: { ...currentEdit, value } as TokenEditState
                }
            };
        }

        case 'UPDATE_TOKEN_NORMALIZATION': {
            const { id, normalization } = action.payload;
            const currentEdit = state.localEdits[id] || {};
            return {
                ...state,
                localEdits: {
                    ...state.localEdits,
                    [id]: { ...currentEdit, normalization } as TokenEditState
                }
            };
        }

        case 'TOGGLE_ALIASES':
            return { ...state, showAliases: action.payload };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

// ----------------------------------------------------------------------
// CONTEXT
// ----------------------------------------------------------------------

export const TokenContext = React.createContext<{
    state: TokenState;
    dispatch: React.Dispatch<TokenAction>;
}>({ state: initialState, dispatch: () => null });

export const TokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = React.useReducer(tokenReducer, initialState);

    return (
        <TokenContext.Provider value={{ state, dispatch }}>
            {children}
        </TokenContext.Provider>
    );
};

export const useTokenStore = () => React.useContext(TokenContext);
