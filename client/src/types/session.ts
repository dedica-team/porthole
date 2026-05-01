// Session / auth / collaborator types
import type { MapData } from './hex';
import type { Landmark, LandmarkGroup } from './landmark';
import type { Connection } from './connection';

export interface Collaborator {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  requestedAt: string;
}

export type CollaborationMode = 'OPEN' | 'REQUEST' | 'PRIVATE';

export const COLLABORATION_MODE_LABELS: Record<CollaborationMode, string> = {
  OPEN:    'Open – anyone can view and edit',
  REQUEST: 'Request – anyone can view, collaborators can edit',
  PRIVATE: 'Private – collaborators only',
};

export interface SessionState {
  id: string;
  name?: string;
  description?: string;
  collaborationMode?: CollaborationMode;
  map: MapData;
  collaborators: Collaborator[];
  joinRequests?: JoinRequest[];
  landmarks: Record<string, Landmark>;
  connections: Record<string, Connection>;
  groups: Record<string, LandmarkGroup>;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export interface AuthResponse extends AuthSession {
  token?: string | null;
}

