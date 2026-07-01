// Chore list types

export type ChoreEntryState = 'NONE' | 'ONGOING' | 'BLOCKED' | 'DONE';

export const CHORE_ENTRY_STATE_LABEL: Record<ChoreEntryState, string> = {
  NONE:    'None',
  ONGOING: 'Ongoing',
  BLOCKED: 'Blocked',
  DONE:    'Done',
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

