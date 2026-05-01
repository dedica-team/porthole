// Collaborator matrix (who knows what)
import type React from 'react';

export type MatrixLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export const MATRIX_LEVEL_ORDER: MatrixLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

export const MATRIX_LEVEL_LABEL: Record<MatrixLevel, string> = {
  NONE:   'n/a',
  LOW:    'Beginner',
  MEDIUM: 'Advanced',
  HIGH:   'Expert',
};

export const MATRIX_LEVEL_BADGE_STYLE: Record<MatrixLevel, React.CSSProperties> = {
  HIGH:   { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
  MEDIUM: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  LOW:    { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
  NONE:   { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
};

export interface CollaboratorMatrixEntry {
  level: MatrixLevel;
}

export interface CollaboratorMatrix {
  name: string;
  entries: Record<string, Record<string, CollaboratorMatrixEntry>>;
}

