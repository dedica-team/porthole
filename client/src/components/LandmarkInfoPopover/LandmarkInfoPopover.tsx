import { useState } from 'react';

import { Pencil, ExternalLink, Check, Trash2, MoreHorizontal, ClipboardList } from 'lucide-react';
import { Popup } from '@/components/ui/popup';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, StatusIndicator, qualityLevelToStatus, matrixLevelToStatus, choreStateToStatus } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { Landmark, LandmarkType, QualityLevel } from '@/types/landmark';
import { ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS, QUALITY_LEVEL_LABEL, QUALITY_LEVEL_SIGN, worstLevel, isDecorative } from '@/types/landmark';
import type { ConnectionType } from '@/types/connection';
import { ALL_CONNECTION_TYPES, CONNECTION_TYPE_LABELS } from '@/types/connection';
import { MATRIX_LEVEL_LABEL } from '@/types/matrix';
import type { MatrixLevel } from '@/types/matrix';
import { CHORE_ENTRY_STATE_LABEL } from '@/types/chores';
import { changeLandmarkOwner } from '@/api/mapApi';

interface Props {
  landmark: Landmark;
  onEditLandmark: (
    landmarkId: string,
    name?: string,
    type?: LandmarkType,
    description?: string,
    groupId?: string,
    clearGroup?: boolean,
    link?: string,
    clearLink?: boolean,
  ) => void;
  onRemoveLandmark: (landmarkId: string) => void;
  onEditConnection?: (
    connectionId: string,
    type?: ConnectionType,
    name?: string,
    description?: string,
    clearName?: boolean,
    clearDescription?: boolean,
  ) => void;
  onRemoveConnection?: (connectionId: string) => void;
  loading?: boolean;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

export default function LandmarkInfoPopover({
  landmark,
  onEditLandmark,
  onRemoveLandmark,
  onEditConnection,
  onRemoveConnection,
  loading = false,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const storeMetrics = useMapStore((s) => s.metrics);
  const collaboratorMatrix = useMapStore((s) => s.collaboratorMatrix);
  const choreLists = useMapStore((s) => s.choreLists);
  const userId = useAuthStore((s) => s.userId);

  const [internalInfoOpen, setInternalInfoOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const infoOpen = isControlled ? controlledOpen : internalInfoOpen;
  const setInfoOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalInfoOpen;

  // ── Landmark edit state ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LandmarkType>('KEEP');
  const [editDescription, setEditDescription] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editLink, setEditLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [ownerChanging, setOwnerChanging] = useState(false);
  const [ownerChangeError, setOwnerChangeError] = useState('');

  // ── Connection edit state ────────────────────────────────────────────────────
  const [connEditOpen, setConnEditOpen] = useState(false);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [editConnType, setEditConnType] = useState<ConnectionType>('PIPE');
  const [editConnName, setEditConnName] = useState('');
  const [editConnDescription, setEditConnDescription] = useState('');
  const [confirmDeleteConnId, setConfirmDeleteConnId] = useState<string | null>(null);

  if (!currentMap) return <>{children}</>;

  const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));
  const owner = landmark.ownerId ? currentMap.collaborators.find((c) => c.id === landmark.ownerId) : null;
  const group = landmark.groupId ? (currentMap.groups ?? {})[landmark.groupId] : null;
  const groups = Object.values(currentMap.groups ?? {});
  const connections = Object.values(currentMap.connections ?? {}).filter(
    (c) => c.originId === landmark.id || c.targetId === landmark.id,
  );
  const allMetrics = Object.values(storeMetrics);
  const landmarkMetricEntries = landmark.metrics ?? {};
  const lmWorstLevel = worstLevel(Object.values(landmarkMetricEntries));
  const matrixEntriesForLandmark: { collaborator: (typeof currentMap.collaborators)[0]; level: MatrixLevel }[] =
    collaboratorMatrix
      ? currentMap.collaborators
          .map((c) => ({
            collaborator: c,
            level: (collaboratorMatrix.entries[landmark.id]?.[c.id]?.level ?? 'NONE') as MatrixLevel,
          }))
          .filter((e) => e.level !== 'NONE')
      : [];
  const relevantChoreLists = choreLists.filter((list) => landmark.id in list.entries);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const startEdit = () => {
    setEditName(landmark.name);
    setEditType(landmark.type);
    setEditDescription(landmark.description ?? '');
    setEditGroupId(landmark.groupId ?? '');
    setEditLink(landmark.link ?? '');
    setLinkError('');
    setOwnerChangeError('');
    setInfoOpen(false);
    setEditOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!isDecorative(editType) && !trimmed) return;
    const trimmedLink = editLink.trim();
    if (trimmedLink && !isValidUrl(trimmedLink)) {
      setLinkError('Must be a valid http/https URL');
      return;
    }
    const prevGroupId = landmark.groupId ?? null;
    const newGroupId = editGroupId || null;
    const groupChanged = newGroupId !== prevGroupId;
    const clearGroup = groupChanged && newGroupId === null;
    onEditLandmark(
      landmark.id,
      trimmed || undefined,
      editType,
      editDescription.trim() || undefined,
      groupChanged && newGroupId ? newGroupId : undefined,
      clearGroup,
      trimmedLink || undefined,
      trimmedLink === '' && !!landmark.link,
    );
    setEditOpen(false);
  };

  const startConnEdit = (connId: string) => {
    const c = (currentMap.connections ?? {})[connId];
    if (!c) return;
    setEditingConnId(connId);
    setEditConnType(c.type ?? 'PIPE');
    setEditConnName(c.name ?? '');
    setEditConnDescription(c.description ?? '');
    setConfirmDeleteConnId(null);
    setConnEditOpen(true);
  };

  const handleSaveConnEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnId || !onEditConnection) return;
    const prevConn = (currentMap.connections ?? {})[editingConnId];
    const trimmedName = editConnName.trim();
    const trimmedDesc = editConnDescription.trim();
    onEditConnection(
      editingConnId,
      editConnType,
      trimmedName || undefined,
      trimmedDesc || undefined,
      !trimmedName && !!prevConn?.name,
      !trimmedDesc && !!prevConn?.description,
    );
    setConnEditOpen(false);
    setEditingConnId(null);
  };

  return (
    <>
      {/* ── Trigger (only rendered in uncontrolled mode) ─────────────────── */}
      {!isControlled && (
        <span className="cursor-pointer" onClick={() => setInfoOpen(true)}>
          {children}
        </span>
      )}

      {/* ── Info popup ──────────────────────────────────────────────────── */}
      <Popup
        title={landmark.name}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        className="max-w-md max-h-[85vh] flex flex-col"
        contentClassName="overflow-y-auto flex-1 flex flex-col gap-4 p-4"
      >
        {/* Basic info */}
        <div className="flex flex-col gap-2 text-sm">
          {landmark.description && (
            <p className="text-foreground/80 leading-relaxed">{landmark.description}</p>
          )}

          {landmark.link && (
            <a
              href={landmark.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-foreground hover:opacity-70 truncate"
              title={landmark.link}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{landmark.link}</span>
            </a>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {group && (
              <>
                <span className="text-muted-foreground">Group</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <StatusIndicator status="NONE" style={{ backgroundColor: group.color }} className="border border-white/20" />
                  <span className="text-foreground truncate">{group.name}</span>
                </div>
              </>
            )}

            <span className="text-muted-foreground">Type</span>
            <span className="text-foreground">{LANDMARK_TYPE_LABELS[landmark.type]}</span>

            <span className="text-muted-foreground">Owner</span>
            {isCollaborator && currentMap.collaborators.length > 0 ? (
              <div className="flex flex-col gap-0.5 min-w-0">
                <select
                  value={landmark.ownerId ?? ''}
                  disabled={ownerChanging || loading}
                  className="h-7 text-sm rounded-md border border-input bg-background px-2 text-foreground disabled:opacity-50 disabled:cursor-not-allowed truncate"
                  onChange={async (e) => {
                    const newOwnerId = e.target.value || null;
                    if (newOwnerId === (landmark.ownerId ?? null)) return;
                    setOwnerChanging(true);
                    setOwnerChangeError('');
                    try {
                      const updated = await changeLandmarkOwner(currentMap.id, landmark.id, newOwnerId);
                      updateMap(updated);
                    } catch (err: unknown) {
                      setOwnerChangeError(err instanceof Error ? err.message : 'Failed to change owner');
                    } finally {
                      setOwnerChanging(false);
                    }
                  }}
                >
                  <option value="">— No owner —</option>
                  {currentMap.collaborators.map((c) => (
                    <option key={c.id} value={c.id}>{c.username}{c.id === userId ? ' (you)' : ''}</option>
                  ))}
                </select>
                {ownerChangeError && <span className="text-sm text-destructive col-span-2">{ownerChangeError}</span>}
              </div>
            ) : (
              <span className="text-foreground truncate">
                {owner ? `${owner.username}${owner.id === userId ? ' (you)' : ''}` : '—'}
              </span>
            )}

            {landmark.coordinate && (
              <>
                <span className="text-muted-foreground">Position</span>
                <span className="text-foreground font-mono">({landmark.coordinate.q}, {landmark.coordinate.r})</span>
              </>
            )}

            <span className="text-muted-foreground">ID</span>
            <span className="text-muted-foreground font-mono truncate" title={landmark.id}>
              {landmark.id.slice(0, 14)}
            </span>
          </div>

          {isCollaborator && (
            <div className="pt-1">
              <Button variant="ghost" fullWidth={true} title="Edit Landmark" onClick={startEdit}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* ── Quality Metrics ──────────────────────────────────────────────── */}
        {allMetrics.length > 0 && !isDecorative(landmark.type) && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Quality Metrics</span>
                {lmWorstLevel !== 'NONE' && (
                  <StatusBadge status={qualityLevelToStatus[lmWorstLevel]} className="text-sm font-semibold">
                    {QUALITY_LEVEL_LABEL[lmWorstLevel]}
                  </StatusBadge>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {allMetrics.map((metric) => {
                  const entry = landmarkMetricEntries[metric.id];
                  const level: QualityLevel = entry?.level ?? 'NONE';
                  return (
                    <div key={metric.id}
                      className="flex flex-col gap-1 rounded-md border border-border px-2 py-1.5 min-w-0"
                      title={`${metric.name}: ${metric.description}`}
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {level !== 'NONE' ? (
                            <StatusBadge status={qualityLevelToStatus[level]} className="text-sm font-semibold font-mono" title={QUALITY_LEVEL_LABEL[level]}>
                              {entry?.value ?? QUALITY_LEVEL_SIGN[level]}
                            </StatusBadge>
                          ) : (
                            <span className="text-sm text-muted-foreground/40 shrink-0">—</span>
                          )}
                          <span className="text-sm text-muted-foreground truncate">{metric.name}</span>
                          {!entry && <span className="text-sm text-muted-foreground/50 italic">not set</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {entry?.link && (
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-link" title={entry.link}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      {entry?.badges && Object.entries(entry.badges).map(([key, url]) => (
                        <div key={key} className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm text-muted-foreground shrink-0">{key}</span>
                          <img src={url} alt={key} title={key} className="h-4 max-w-32 object-contain" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Collaborator Matrix ──────────────────────────────────────────── */}
        {collaboratorMatrix && matrixEntriesForLandmark.length > 0 && !isDecorative(landmark.type) && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-sm text-foreground">Collaborators</span>
              <div className="flex flex-col gap-1">
                {matrixEntriesForLandmark.map(({ collaborator, level }) => (
                  <div key={collaborator.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-md border border-border min-w-0">
                    <UserAvatar inline size="xs" username={collaborator.username} avatarUrl={collaborator.avatarUrl} />
                    <StatusBadge status={matrixLevelToStatus[level]} className="text-sm font-semibold shrink-0">
                      {MATRIX_LEVEL_LABEL[level]}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Chore Lists ──────────────────────────────────────────────────── */}
        {relevantChoreLists.length > 0 && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">Chore Lists</span>
              </div>
              <div className="flex flex-col gap-2">
                {relevantChoreLists.map((list) => {
                  const entry = list.entries[landmark.id];
                  const assignee = entry.assigneeId
                    ? currentMap.collaborators.find((c) => c.id === entry.assigneeId)
                    : null;
                  return (
                    <div key={list.id} className="flex flex-col gap-1 rounded-md border border-border px-2 py-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{list.title}</span>
                        <StatusBadge status={choreStateToStatus[entry.state]} className="text-sm font-semibold shrink-0">
                          {CHORE_ENTRY_STATE_LABEL[entry.state]}
                        </StatusBadge>
                      </div>
                      {assignee && (
                        <UserAvatar inline size="xs" username={assignee.username} avatarUrl={assignee.avatarUrl} />
                      )}
                      {entry.note && (
                        <span className="text-sm text-muted-foreground/70 leading-relaxed">{entry.note}</span>
                      )}
                      {entry.link && (
                        <a href={entry.link} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-link hover:text-link-hover truncate underline underline-offset-2"
                          title={entry.link}>{entry.link}</a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Connections ──────────────────────────────────────────────────── */}
        {connections.length > 0 && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-sm text-foreground">Connections ({connections.length})</span>
              <div className="flex flex-col gap-1">
                {connections.map((c) => {
                  const otherId = c.originId === landmark.id ? c.targetId : c.originId;
                  const otherLandmark = (currentMap.landmarks ?? {})[otherId];
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-1 min-w-0 px-2 py-1.5">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground truncate">{c.name ?? otherLandmark?.name ?? otherId}</span>
                        {c.description && <span className="text-sm text-muted-foreground/70 leading-relaxed">{c.description}</span>}
                        <span className="text-sm text-muted-foreground">{CONNECTION_TYPE_LABELS[c.type ?? 'PIPE']} → {otherLandmark?.name ?? otherId}</span>
                      </div>
                      {isCollaborator && onEditConnection && (
                        <button
                          className="flex items-center justify-center h-5 w-5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5 cursor-pointer"
                          title="Edit connection"
                          onClick={() => startConnEdit(c.id)}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Popup>

      {/* ── Landmark edit popup ──────────────────────────────────────────── */}
      <Popup title="Edit Landmark" open={editOpen} onOpenChange={setEditOpen} className="max-w-md">
        <form onSubmit={handleSave} className="flex flex-col gap-2.5">
          <Input
            autoFocus
            value={editName}
            maxLength={40}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 text-sm"
            placeholder={isDecorative(editType) ? 'Name (optional)' : 'Name'}
          />

          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as LandmarkType)}
            className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground"
          >
            {ALL_LANDMARK_TYPES.map((t) => (
              <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <Textarea
            value={editDescription}
            maxLength={280}
            onChange={(e) => setEditDescription(e.target.value)}
            className="text-sm min-h-14 resize-none"
            placeholder="Description (optional)"
          />

          {groups.length > 0 && (
            <select
              value={editGroupId}
              onChange={(e) => setEditGroupId(e.target.value)}
              className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground"
            >
              <option value="">— No group —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          <div className="flex flex-col gap-0.5">
            <Input
              value={editLink}
              onChange={(e) => { setEditLink(e.target.value); setLinkError(''); }}
              className={`h-8 text-sm${linkError ? ' border-destructive' : ''}`}
              placeholder="Link (optional, https://…)"
              type="url"
            />
            {linkError && <span className="text-sm text-destructive px-1">{linkError}</span>}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="w-full gap-2 h-8 text-sm"
              disabled={loading}
              onClick={() => { setEditOpen(false); setDeleteOpen(true); }}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                className="flex-1 h-8 text-sm gap-1.5"
                disabled={(!isDecorative(editType) && !editName.trim()) || loading}
              >
                {loading ? null : <Check className="h-3 w-3" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="flat" className="h-8 px-3 text-sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </Popup>

      {/* ── Delete confirmation popup ────────────────────────────────────── */}
      <Popup title={`Remove «${landmark.name}»?`} open={deleteOpen} onOpenChange={setDeleteOpen} className="max-w-sm">
        <p className="text-sm text-muted-foreground mb-4">This action cannot be undone.</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 h-8 text-sm"
            disabled={loading}
            onClick={() => { onRemoveLandmark(landmark.id); setDeleteOpen(false); }}
          >
            Yes, remove
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="flex-1 h-8 text-sm"
            onClick={() => { setDeleteOpen(false); setEditOpen(true); }}
          >
            Cancel
          </Button>
        </div>
      </Popup>

      {/* ── Connection edit popup ────────────────────────────────────────── */}
      <Popup
        title="Edit Connection"
        open={connEditOpen}
        onOpenChange={(open) => { setConnEditOpen(open); if (!open) { setEditingConnId(null); setConfirmDeleteConnId(null); } }}
        className="max-w-sm"
      >
        {(() => {
          const conn = editingConnId ? (currentMap.connections ?? {})[editingConnId] : null;
          const otherId = conn ? (conn.originId === landmark.id ? conn.targetId : conn.originId) : null;
          const otherLandmark = otherId ? (currentMap.landmarks ?? {})[otherId] : null;
          if (!conn) return null;
          if (confirmDeleteConnId === editingConnId) {
            return (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground text-center">Remove this connection? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="flex-1 h-8 text-sm" disabled={loading}
                    onClick={() => { setConnEditOpen(false); setConfirmDeleteConnId(null); setEditingConnId(null); onRemoveConnection?.(conn.id); }}>
                    Yes, remove
                  </Button>
                  <Button size="sm" variant="flat" className="flex-1 h-8 text-sm" onClick={() => setConfirmDeleteConnId(null)}>Cancel</Button>
                </div>
              </div>
            );
          }
          return (
            <form onSubmit={handleSaveConnEdit} className="flex flex-col gap-2.5">
              <span className="text-sm text-muted-foreground">→ {otherLandmark?.name ?? otherId}</span>
              <select value={editConnType} onChange={(e) => setEditConnType(e.target.value as ConnectionType)} className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground">
                {ALL_CONNECTION_TYPES.map((t) => <option key={t} value={t}>{CONNECTION_TYPE_LABELS[t]}</option>)}
              </select>
              <Input autoFocus value={editConnName} maxLength={40} onChange={(e) => setEditConnName(e.target.value)} className="h-8 text-sm" placeholder="Name (optional)" />
              <Textarea value={editConnDescription} maxLength={280} onChange={(e) => setEditConnDescription(e.target.value)} className="text-sm min-h-14 resize-none" placeholder="Description (optional)" />
              <div className="flex flex-col gap-2 pt-1">
                <Button type="button" size="sm" variant="destructive" className="w-full gap-2 h-8 text-sm" disabled={loading}
                  onClick={() => setConfirmDeleteConnId(editingConnId)}>
                  <Trash2 className="h-3 w-3" />Remove Connection
                </Button>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="flex-1 h-8 text-sm gap-1.5" disabled={loading}>
                    <Check className="h-3 w-3" />Save
                  </Button>
                  <Button type="button" size="sm" variant="flat" className="h-8 px-3 text-sm" onClick={() => { setConnEditOpen(false); setEditingConnId(null); }}>Cancel</Button>
                </div>
              </div>
            </form>
          );
        })()}
      </Popup>
    </>
  );
}
