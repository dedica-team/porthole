// Collaborator matrix (who knows what)

export type MatrixLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export const MATRIX_LEVEL_ORDER: MatrixLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

export const MATRIX_LEVEL_LABEL: Record<MatrixLevel, string> = {
  NONE:   'n/a',
  LOW:    'Beginner',
  MEDIUM: 'Advanced',
  HIGH:   'Expert',
};

export interface CollaboratorMatrixEntry {
  level: MatrixLevel;
}

export interface CollaboratorMatrix {
  name: string;
  collaborators: string[];
  entries: Record<string, Record<string, CollaboratorMatrixEntry>>;
}

