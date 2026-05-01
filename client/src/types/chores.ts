// Chore todo list types
import type React from 'react';

export type ChoreEntryState = 'NONE' | 'ONGOING' | 'BLOCKED' | 'DONE';

export const CHORE_ENTRY_STATE_LABEL: Record<ChoreEntryState, string> = {
  NONE:    'None',
  ONGOING: 'Ongoing',
  BLOCKED: 'Blocked',
  DONE:    'Done',
};

export const CHORE_ENTRY_STATE_BADGE_STYLE: Record<ChoreEntryState, React.CSSProperties> = {
  NONE:    { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
  ONGOING: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  BLOCKED: { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
  DONE:    { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
};

export const CHORE_ENTRY_STATES: ChoreEntryState[] = ['NONE', 'ONGOING', 'BLOCKED', 'DONE'];

export interface ChoreEntry {
  landmarkId: string;
  state: ChoreEntryState;
  assigneeId?: string;
  link?: string;
  note?: string;
}

export interface ChoreList {
  id: string;
  title: string;
  completed: boolean;
  link?: string;
  entries: Record<string, ChoreEntry>;
}

