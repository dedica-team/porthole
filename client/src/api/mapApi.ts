import type { AuthResponse, AuthSession, SessionState, CollaborationMode } from '../types/session';
import type { Terrain } from '../types/hex';
import type { LandmarkType, QualityLevel, MetricTemplate } from '../types/landmark';
import type { ConnectionType } from '../types/connection';
import type { MatrixLevel } from '../types/matrix';
import type { Process, StageConnectionDirection } from '../types/process';
import type { ChoreList, ChoreEntryState } from '../types/chores';
import type {
  GreenkeepingRotation,
  CreateGreenkeepingRotationPayload,
  EditGreenkeepingRotationPayload,
} from '../types/greenkeeping';
const BASE_URL = '/api';

function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, {
    credentials: 'include',
    ...init,
  });
}

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (!body) {
      throw new Error(`HTTP ${res.status}`);
    }
    try {
      const json = JSON.parse(body) as { message?: string };
      throw new Error(json.message ?? body ?? `HTTP ${res.status}`);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== body) throw parseErr;
      throw new Error(body || `HTTP ${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────

interface GitHubStartResponse {
  authorizationUrl: string;
}


export interface AuthFeatures {
  githubEnabled: boolean;
  keycloakEnabled: boolean;
  webAuthnEnabled: boolean;
  tagline?: string;
}

export async function getAuthFeatures(): Promise<AuthFeatures> {
  const res = await fetch(`${BASE_URL}/auth/config`);
  return handleResponse<AuthFeatures>(res);
}

export async function githubStart(): Promise<GitHubStartResponse> {
  const res = await fetch(`${BASE_URL}/auth/github/start`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  return handleResponse<GitHubStartResponse>(res);
}

export async function githubCallback(code: string, state: string): Promise<AuthResponse> {
  const params = new URLSearchParams({ code, state });
  const res = await fetch(`${BASE_URL}/auth/github/callback?${params.toString()}`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  return handleResponse<AuthResponse>(res);
}

/** Initiates Keycloak OIDC login via Spring OAuth2 Client (authorization code flow + PKCE). */
export function keycloakStart(): void {
  window.location.assign('/oauth2/authorization/keycloak');
}


export async function getSession(): Promise<AuthSession> {
  const res = await fetch(`${BASE_URL}/auth/session`);
  return handleResponse<AuthSession>(res);
}

export async function logoutSession(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
}

// ── WebAuthn helpers ─────────────────────────────────────────────────────────

export function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64urlToBuffer(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64.length + (4 - (b64.length % 4)) % 4, '=',
  );
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

interface RegisterStartResponse {
  sessionId: string;
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: string; alg: number }[];
  authenticatorSelection: { userVerification: string; residentKey: string };
  timeout: number;
}

interface AuthStartResponse {
  sessionId: string;
  challenge: string;
  allowCredentials: { type: string; id: string }[];
  userVerification: string;
  timeout: number;
}

export async function webauthnRegisterStart(username: string): Promise<RegisterStartResponse> {
  const res = await fetch(`${BASE_URL}/auth/webauthn/register/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  });
  return handleResponse<RegisterStartResponse>(res);
}

export async function webauthnRegisterFinish(
  sessionId: string,
  cred: PublicKeyCredential,
): Promise<AuthResponse> {
  const response = cred.response as AuthenticatorAttestationResponse;
  const body = {
    sessionId,
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
  const res = await fetch(`${BASE_URL}/auth/webauthn/register/finish`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<AuthResponse>(res);
}

export async function webauthnAuthStart(username?: string): Promise<AuthStartResponse> {
  const res = await fetch(`${BASE_URL}/auth/webauthn/authenticate/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username: username ?? null }),
  });
  return handleResponse<AuthStartResponse>(res);
}

export async function webauthnAuthFinish(
  sessionId: string,
  cred: PublicKeyCredential,
): Promise<AuthResponse> {
  const response = cred.response as AuthenticatorAssertionResponse;
  const body = {
    sessionId,
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
  const res = await fetch(`${BASE_URL}/auth/webauthn/authenticate/finish`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<AuthResponse>(res);
}

// ── Maps ────────────────────────────────────────────────────────────────────

export type MapType = 'LAND' | 'SEA' | 'BLANK';
export type MapSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export async function createMap(mapType: MapType = 'LAND', mapSize: MapSize = 'MEDIUM', collaborationMode?: CollaborationMode): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ mapType, mapSize }),
  });
  let state = await handleResponse<SessionState>(res);
  if (collaborationMode && collaborationMode !== 'OPEN') {
    state = await setCollaborationMode(state.id, collaborationMode);
  }
  return state;
}

export async function listMaps(): Promise<SessionState[]> {
  const res = await fetch(`${BASE_URL}/sessions`, {
    headers: authHeaders(),
  });
  return handleResponse<SessionState[]>(res);
}

export async function getMap(id: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${id}`, {
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function joinMap(id: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${id}/join`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function requestJoin(id: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${id}/join-requests`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function acceptJoinRequest(mapId: string, requestId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/join-requests/${encodeURIComponent(requestId)}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function declineJoinRequest(mapId: string, requestId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/join-requests/${encodeURIComponent(requestId)}/decline`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function editMap(
  id: string,
  name?: string,
  description?: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name: name ?? null, description: description ?? null }),
  });
  return handleResponse<SessionState>(res);
}

export async function setCollaborationMode(id: string, mode: CollaborationMode): Promise<SessionState> {  const res = await fetch(`${BASE_URL}/sessions/${id}/collaboration-mode`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ mode }),
  });
  return handleResponse<SessionState>(res);
}

export async function placeLandmark(
  mapId: string,
  q: number,
  r: number,
  name: string,
  type: LandmarkType = 'KEEP',
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ q, r, name, type }),
  });
  return handleResponse<SessionState>(res);
}

export async function removeLandmark(
  mapId: string,
  landmarkId: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function editLandmark(
  mapId: string,
  landmarkId: string,
  name?: string,
  type?: LandmarkType,
  description?: string,
  groupId?: string,
  clearGroup?: boolean,
  link?: string,
  clearLink?: boolean,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      name: name ?? null,
      type: type ?? null,
      description: description ?? null,
      groupId: groupId ?? null,
      clearGroup: clearGroup ?? false,
      link: link ?? null,
      clearLink: clearLink ?? false,
    }),
  });
  return handleResponse<SessionState>(res);
}

export async function createGroup(mapId: string, name: string, color: string, description?: string, link?: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, color, description: description ?? null, link: link ?? null }),
  });
  return handleResponse<SessionState>(res);
}

export async function editGroup(
  mapId: string,
  groupId: string,
  name?: string,
  color?: string,
  description?: string,
  clearDescription?: boolean,
  link?: string,
  clearLink?: boolean,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      name: name ?? null,
      color: color ?? null,
      description: description ?? null,
      clearDescription: clearDescription ?? false,
      link: link ?? null,
      clearLink: clearLink ?? false,
    }),
  });
  return handleResponse<SessionState>(res);
}

export async function removeGroup(mapId: string, groupId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function createConnection(
  mapId: string,
  fromTowerId: string,
  toTowerId: string,
  type: ConnectionType = 'PIPE',
  name?: string,
  description?: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/connections`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fromTowerId, toTowerId, type, name: name ?? null, description: description ?? null }),
  });
  return handleResponse<SessionState>(res);
}

export async function editConnection(
  mapId: string,
  connectionId: string,
  type?: ConnectionType,
  name?: string,
  description?: string,
  clearName?: boolean,
  clearDescription?: boolean,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/connections/${encodeURIComponent(connectionId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      type: type ?? null,
      name: name ?? null,
      description: description ?? null,
      clearName: clearName ?? false,
      clearDescription: clearDescription ?? false,
    }),
  });
  return handleResponse<SessionState>(res);
}

export async function removeConnection(
  mapId: string,
  connectionId: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function editTile(
  mapId: string,
  q: number,
  r: number,
  elevation?: number,
  terrain?: Terrain,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/tiles/${q}/${r}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ elevation: elevation ?? null, terrain: terrain ?? null }),
  });
  return handleResponse<SessionState>(res);
}

// ── Quality Metrics ──────────────────────────────────────────────────────────

export async function createMetric(mapId: string, name: string, description: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/metrics`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  });
  return handleResponse<SessionState>(res);
}

export async function editMetric(
  mapId: string,
  metricId: string,
  name?: string,
  description?: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/metrics/${encodeURIComponent(metricId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name: name ?? null, description: description ?? null }),
  });
  return handleResponse<SessionState>(res);
}

export async function removeMetric(mapId: string, metricId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/metrics/${encodeURIComponent(metricId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function setLandmarkMetric(
  mapId: string,
  landmarkId: string,
  metricId: string,
  value: string | undefined,
  level: QualityLevel,
  link?: string,
  badges?: Record<string, string>,
): Promise<SessionState> {
  const res = await fetch(
    `${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}/metrics/${encodeURIComponent(metricId)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: value ?? null, level, link: link ?? null, badges: badges ?? {} }),
    },
  );
  return handleResponse<SessionState>(res);
}

export async function clearLandmarkMetric(
  mapId: string,
  landmarkId: string,
  metricId: string,
): Promise<SessionState> {
  const res = await fetch(
    `${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}/metrics/${encodeURIComponent(metricId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  return handleResponse<SessionState>(res);
}

// ── Metric Templates ────────────────────────────────────────────────────────

export async function fetchMetricTemplates(): Promise<MetricTemplate[]> {
  const res = await fetch(`${BASE_URL}/metric-templates`, {
    headers: authHeaders(),
  });
  return handleResponse<MetricTemplate[]>(res);
}

export async function createUnpositionedLandmark(
  mapId: string,
  name: string,
  type: LandmarkType = 'KEEP',
  description?: string,
  groupId?: string,
  link?: string,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks/unpositioned`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      type,
      description: description ?? null,
      groupId: groupId ?? null,
      link: link ?? null,
    }),
  });
  return handleResponse<SessionState>(res);
}

export async function positionLandmark(
  mapId: string,
  landmarkId: string,
  q: number,
  r: number,
): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}/position`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ q, r }),
  });
  return handleResponse<SessionState>(res);
}

// ── Collaborator Matrix ──────────────────────────────────────────────────────

export async function editCollaboratorMatrix(mapId: string, name: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/collaborator-matrix`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return handleResponse<SessionState>(res);
}

export async function setMatrixEntry(
  mapId: string,
  landmarkId: string,
  collaboratorId: string,
  level: MatrixLevel,
): Promise<SessionState> {
  const res = await fetch(
    `${BASE_URL}/sessions/${mapId}/collaborator-matrix/landmarks/${encodeURIComponent(landmarkId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ level }),
    },
  );
  return handleResponse<SessionState>(res);
}

export async function clearMatrixEntry(
  mapId: string,
  landmarkId: string,
  collaboratorId: string,
): Promise<SessionState> {
  const res = await fetch(
    `${BASE_URL}/sessions/${mapId}/collaborator-matrix/landmarks/${encodeURIComponent(landmarkId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  return handleResponse<SessionState>(res);
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function deleteMap(mapId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    try {
      const json = JSON.parse(body) as { message?: string };
      throw new Error(json.message ?? `HTTP ${res.status}`);
    } catch {
      throw new Error(body || `HTTP ${res.status}`);
    }
  }
}

export async function adminJoinMap(mapId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/admin-join`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function exportMapJson(mapId: string): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/export`, {
    headers: authHeaders(),
  });
  return handleResponse<SessionState>(res);
}

export async function changeLandmarkOwner(mapId: string, landmarkId: string, ownerId: string | null): Promise<SessionState> {
  const res = await fetch(`${BASE_URL}/sessions/${mapId}/landmarks/${encodeURIComponent(landmarkId)}/owner`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ ownerId }),
  });
  return handleResponse<SessionState>(res);
}



export async function fetchProcesses(mapId: string): Promise<Process[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes`, {
    headers: authHeaders(),
  });
  return handleResponse<Process[]>(res);
}

export async function createProcess(mapId: string, name: string, description?: string): Promise<Process[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description: description ?? null }),
  });
  return handleResponse<Process[]>(res);
}

export async function editProcess(mapId: string, processId: string, name?: string, description?: string): Promise<Process[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name: name ?? null, description: description ?? null }),
  });
  return handleResponse<Process[]>(res);
}

export async function removeProcess(mapId: string, processId: string): Promise<Process[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<Process[]>(res);
}

export async function createProcessStage(mapId: string, processId: string, name: string | undefined, order: number): Promise<Process[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: name ?? null, order }),
  });
  return handleResponse<Process[]>(res);
}

export async function removeProcessStage(mapId: string, processId: string, stageId: string): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/${encodeURIComponent(stageId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return handleResponse<Process[]>(res);
}

export async function reorderProcessStages(mapId: string, processId: string, stageIds: string[]): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/reorder`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ stageIds }),
    },
  );
  return handleResponse<Process[]>(res);
}

export async function editProcessStage(
  mapId: string,
  processId: string,
  stageId: string,
  patch: { name?: string; clearName?: boolean; order?: number },
): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/${encodeURIComponent(stageId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  return handleResponse<Process[]>(res);
}

export async function addConnectionToStage(
  mapId: string,
  processId: string,
  stageId: string,
  connectionId: string,
  title?: string,
  direction: StageConnectionDirection = 'FORWARD',
): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/${encodeURIComponent(stageId)}/connections`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ connectionId, title: title ?? null, direction }),
    },
  );
  return handleResponse<Process[]>(res);
}

export async function editStageConnection(
  mapId: string,
  processId: string,
  stageId: string,
  stageConnId: string,
  patch: { title?: string; clearTitle?: boolean; direction?: StageConnectionDirection },
): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/${encodeURIComponent(stageId)}/connections/${encodeURIComponent(stageConnId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  return handleResponse<Process[]>(res);
}

export async function removeConnectionFromStage(
  mapId: string,
  processId: string,
  stageId: string,
  stageConnId: string,
): Promise<Process[]> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/processes/${encodeURIComponent(processId)}/stages/${encodeURIComponent(stageId)}/connections/${encodeURIComponent(stageConnId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return handleResponse<Process[]>(res);
}

export async function removeCollaborator(mapId: string, collaboratorId: string): Promise<SessionState> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return handleResponse<SessionState>(res);
}

// ── Metrics (initial load) ───────────────────────────────────────────────────

export async function fetchMetrics(mapId: string): Promise<Record<string, import('../types/landmark').QualityMetric>> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/metrics`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Collaborator Matrix (initial load) ───────────────────────────────────────

export async function fetchCollaboratorMatrix(mapId: string): Promise<import('../types/matrix').CollaboratorMatrix> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/collaborator-matrix`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Chore Lists ──────────────────────────────────────────────────────────────

export async function fetchChoreLists(mapId: string): Promise<ChoreList[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists`, {
    headers: authHeaders(),
  });
  return handleResponse<ChoreList[]>(res);
}

export async function createChoreList(mapId: string, title: string, landmarkIds: string[], link?: string): Promise<ChoreList[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, landmarkIds, link: link ?? null }),
  });
  return handleResponse<ChoreList[]>(res);
}

export async function editChoreList(mapId: string, listId: string, title?: string, landmarkIds?: string[], link?: string): Promise<ChoreList[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title: title ?? null, landmarkIds: landmarkIds ?? null, link: link !== undefined ? link : null, clearLink: link === undefined }),
  });
  return handleResponse<ChoreList[]>(res);
}

export async function toggleChoreListCompleted(mapId: string, listId: string): Promise<ChoreList> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists/${encodeURIComponent(listId)}/complete`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  return handleResponse<ChoreList>(res);
}

export async function deleteChoreList(mapId: string, listId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
}

export async function updateChoreEntry(
  mapId: string,
  listId: string,
  landmarkId: string,
  patch: { state?: ChoreEntryState; assigneeId?: string | null; clearAssignee?: boolean; link?: string | null; clearLink?: boolean; note?: string | null; clearNote?: boolean },
): Promise<ChoreList> {
  const res = await fetch(
    `${BASE_URL}/sessions/${encodeURIComponent(mapId)}/chore-lists/${encodeURIComponent(listId)}/entries/${encodeURIComponent(landmarkId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        state: patch.state ?? null,
        assigneeId: patch.assigneeId ?? null,
        clearAssignee: patch.clearAssignee ?? false,
        link: patch.link ?? null,
        clearLink: patch.clearLink ?? false,
        note: patch.note ?? null,
        clearNote: patch.clearNote ?? false,
      }),
    },
  );
  return handleResponse<ChoreList>(res);
}

// ── Greenkeeping Rotations ───────────────────────────────────────────────────

export async function fetchGreenkeepingRotations(mapId: string): Promise<GreenkeepingRotation[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/greenkeeping-rotations`, {
    headers: authHeaders(),
  });
  return handleResponse<GreenkeepingRotation[]>(res);
}

export async function createGreenkeepingRotation(
  mapId: string,
  payload: CreateGreenkeepingRotationPayload,
): Promise<GreenkeepingRotation[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/greenkeeping-rotations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      ...payload,
      description: payload.description ?? null,
      link: payload.link ?? null,
    }),
  });
  return handleResponse<GreenkeepingRotation[]>(res);
}

export async function editGreenkeepingRotation(
  mapId: string,
  rotationId: string,
  patch: EditGreenkeepingRotationPayload,
): Promise<GreenkeepingRotation[]> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/greenkeeping-rotations/${encodeURIComponent(rotationId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      ...patch,
      description: patch.description ?? null,
      link: patch.link ?? null,
      clearDescription: patch.clearDescription ?? false,
      clearLink: patch.clearLink ?? false,
    }),
  });
  return handleResponse<GreenkeepingRotation[]>(res);
}

export async function deleteGreenkeepingRotation(mapId: string, rotationId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/greenkeeping-rotations/${encodeURIComponent(rotationId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
}

export async function advanceGreenkeepingRotation(mapId: string, rotationId: string): Promise<GreenkeepingRotation> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(mapId)}/greenkeeping-rotations/${encodeURIComponent(rotationId)}/advance`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<GreenkeepingRotation>(res);
}

