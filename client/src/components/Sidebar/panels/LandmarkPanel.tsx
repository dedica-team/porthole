import { useState } from 'react';
import { Castle, Link, Loader2, Trash2, ExternalLink, X, Move, MoreHorizontal, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { LandmarkType, QualityLevel } from '@/types/landmark';
import type { ConnectionType } from '@/types/connection';
import type { MatrixLevel } from '@/types/matrix';
import { CHORE_ENTRY_STATE_LABEL, CHORE_ENTRY_STATE_BADGE_STYLE } from '@/types/chores';
import { ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS, QUALITY_LEVEL_COLOR, QUALITY_LEVEL_LABEL, QUALITY_LEVEL_ORDER, QUALITY_LEVEL_SIGN, worstLevel, isDecorative, defaultValueForLevel } from '@/types/landmark';
import { ALL_CONNECTION_TYPES, CONNECTION_TYPE_LABELS } from '@/types/connection';
import { MATRIX_LEVEL_LABEL, MATRIX_LEVEL_BADGE_STYLE } from '@/types/matrix';
import { changeLandmarkOwner } from '@/api/mapApi';
interface Props {
  onStartConnection: (type: ConnectionType, name?: string, description?: string) => void;
  onRemoveLandmark: () => void;
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
  onEditConnection: (
    connectionId: string,
    type?: ConnectionType,
    name?: string,
    description?: string,
    clearName?: boolean,
    clearDescription?: boolean,
  ) => void;
  onRemoveConnection: (connectionId: string) => void;
  onSetLandmarkMetric: (landmarkId: string, metricId: string, value: string | undefined, level: QualityLevel, link?: string, linkText?: string, badges?: Record<string, string>) => void;
  onClearLandmarkMetric: (landmarkId: string, metricId: string) => void;
  loading: boolean;
}
export default function LandmarkPanel({ onStartConnection, onRemoveLandmark, onEditLandmark, onEditConnection, onRemoveConnection, onSetLandmarkMetric, onClearLandmarkMetric, loading }: Props) {
  const selectedLandmark = useMapStore((s) => s.selectedLandmark);
  const currentMap = useMapStore((s) => s.currentMap);
  const storeMetrics = useMapStore((s) => s.metrics);
  const collaboratorMatrix = useMapStore((s) => s.collaboratorMatrix);
  const choreLists = useMapStore((s) => s.choreLists);
  const updateMap = useMapStore((s) => s.updateMap);
  const userId = useAuthStore((s) => s.userId);
  const setRelocatingLandmark = useMapStore((s) => s.setRelocatingLandmark);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LandmarkType>('KEEP');
  const [editDescription, setEditDescription] = useState('');
  const [editGroupId, setEditGroupId] = useState<string>('');
  const [editLink, setEditLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConnForm, setShowConnForm] = useState(false);
  const [connType, setConnType] = useState<ConnectionType>('PIPE');
  const [connName, setConnName] = useState('');
  const [connDescription, setConnDescription] = useState('');
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [connEditDialogOpen, setConnEditDialogOpen] = useState(false);
  const [editConnType, setEditConnType] = useState<ConnectionType>('PIPE');
  const [editConnName, setEditConnName] = useState('');
  const [editConnDescription, setEditConnDescription] = useState('');
  const [confirmDeleteConnId, setConfirmDeleteConnId] = useState<string | null>(null);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [metricValue, setMetricValue] = useState('');
  const [metricLevel, setMetricLevel] = useState<QualityLevel>('NONE');
  const [metricLink, setMetricLink] = useState('');
  const [metricLinkText, setMetricLinkText] = useState('');
  const [metricLinkError, setMetricLinkError] = useState('');
  const [metricBadges, setMetricBadges] = useState<{ key: string; url: string; error: string }[]>([]);
  const [confirmClearMetricId, setConfirmClearMetricId] = useState<string | null>(null);
  const [ownerChanging, setOwnerChanging] = useState(false);
  const [ownerChangeError, setOwnerChangeError] = useState('');
  if (!selectedLandmark || !currentMap) return null;
  const isOwner = selectedLandmark.ownerId === userId;
  const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));
  const owner = currentMap.collaborators.find((c) => c.id === selectedLandmark.ownerId);
  const groups = Object.values(currentMap.groups ?? {});
  const connections = Object.values(currentMap.connections ?? {}).filter(
    (c) => c.originId === selectedLandmark.id || c.targetId === selectedLandmark.id,
  );
  const allMetrics = Object.values(storeMetrics);
  const landmarkMetricEntries = selectedLandmark.metrics ?? {};
  const lmWorstLevel = worstLevel(Object.values(landmarkMetricEntries));
  const matrixEntriesForLandmark: { collaborator: (typeof currentMap.collaborators)[0]; level: MatrixLevel }[] =
    collaboratorMatrix
      ? currentMap.collaborators
          .map((c) => ({
            collaborator: c,
            level: (collaboratorMatrix.entries[selectedLandmark.id]?.[c.id]?.level ?? 'NONE') as MatrixLevel,
          }))
          .filter((e) => e.level !== 'NONE')
      : [];
  const isValidUrl = (value: string): boolean => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
    catch { return false; }
  };
  const startEdit = () => {
    setEditName(selectedLandmark.name);
    setEditType(selectedLandmark.type);
    setEditDescription(selectedLandmark.description ?? '');
    setEditGroupId(selectedLandmark.groupId ?? '');
    setEditLink(selectedLandmark.link ?? '');
    setLinkError('');
    setConfirmDelete(false);
    setEditDialogOpen(true);
  };
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!isDecorative(editType) && !trimmed) return;
    const trimmedLink = editLink.trim();
    if (trimmedLink && !isValidUrl(trimmedLink)) { setLinkError('Must be a valid http/https URL'); return; }
    setEditDialogOpen(false);
    onEditLandmark(selectedLandmark.id, trimmed, editType, editDescription.trim() || undefined, editGroupId || undefined,
      editGroupId === '' && !!selectedLandmark.groupId, trimmedLink || undefined, trimmedLink === '' && !!selectedLandmark.link);
  };
  const startConnEdit = (connId: string) => {
    const c = (currentMap.connections ?? {})[connId];
    if (!c) return;
    setEditingConnId(connId);
    setEditConnType(c.type ?? 'PIPE');
    setEditConnName(c.name ?? '');
    setEditConnDescription(c.description ?? '');
    setConfirmDeleteConnId(null);
    setConnEditDialogOpen(true);
  };
  const handleSaveConnEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnId) return;
    const prevConn = (currentMap.connections ?? {})[editingConnId];
    const trimmedName = editConnName.trim();
    const trimmedDesc = editConnDescription.trim();
    onEditConnection(editingConnId, editConnType, trimmedName || undefined, trimmedDesc || undefined,
      !trimmedName && !!prevConn?.name, !trimmedDesc && !!prevConn?.description);
    setConnEditDialogOpen(false);
    setEditingConnId(null);
  };
  const startMetricEdit = (metricId: string) => {
    const entry = landmarkMetricEntries[metricId];
    setEditingMetricId(metricId);
    setMetricValue(entry?.value ?? '');
    setMetricLevel(entry?.level ?? 'NONE');
    setMetricLink(entry?.link ?? '');
    setMetricLinkText(entry?.linkText ?? '');
    setMetricLinkError('');
    setMetricBadges(entry?.badges ? Object.entries(entry.badges).map(([key, url]) => ({ key, url, error: '' })) : []);
    setConfirmClearMetricId(null);
  };
  const handleSaveMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetricId) return;
    const trimmedValue = metricValue.trim();
    const validatedRows = metricBadges.map((row) => {
      if (!row.key.trim()) return { ...row, error: 'Key must not be blank' };
      if (!row.url.trim() || !isValidUrl(row.url.trim())) return { ...row, error: 'Must be a valid http/https URL' };
      return { ...row, error: '' };
    });
    if (validatedRows.some((r) => r.error)) { setMetricBadges(validatedRows); return; }
    const badgesMap: Record<string, string> = {};
    for (const row of validatedRows) badgesMap[row.key.trim()] = row.url.trim();
    const hasBadges = Object.keys(badgesMap).length > 0;
    const trimmedLink = metricLink.trim();
    const trimmedLinkText = metricLinkText.trim();
    if (metricLevel === 'NONE' && !trimmedValue && !trimmedLink && !hasBadges) return;
    if (trimmedLink && !isValidUrl(trimmedLink)) { setMetricLinkError('Must be a valid http/https URL'); return; }
    onSetLandmarkMetric(selectedLandmark.id, editingMetricId, trimmedValue || defaultValueForLevel(metricLevel),
      metricLevel, trimmedLink || undefined, trimmedLink ? (trimmedLinkText || undefined) : undefined, hasBadges ? badgesMap : undefined);
    setEditingMetricId(null);
  };
  return (
    <>
      {/* ── Landmark Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setConfirmDelete(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Landmark</DialogTitle>
            <DialogDescription>
              Update the selected landmark details, or remove the landmark from the map.
            </DialogDescription>
          </DialogHeader>
          {!confirmDelete ? (
            <form id="edit-landmark-form" onSubmit={handleSaveEdit} className="flex flex-col gap-2 min-w-0">
              <Input autoFocus value={editName} maxLength={40} onChange={(e) => setEditName(e.target.value)} className="h-8 text-xs" placeholder={isDecorative(editType) ? 'Name (optional)' : 'Name'} />
              <select value={editType} onChange={(e) => setEditType(e.target.value as LandmarkType)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground">
                {ALL_LANDMARK_TYPES.map((t) => <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>)}
              </select>
              <Textarea value={editDescription} maxLength={280} onChange={(e) => setEditDescription(e.target.value)} className="text-xs min-h-16 resize-none" placeholder="Description (optional)" />
              <select value={editGroupId} onChange={(e) => setEditGroupId(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground">
                <option value="">— No group —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div className="flex flex-col gap-0.5">
                <Input value={editLink} onChange={(e) => { setEditLink(e.target.value); setLinkError(''); }} className={`h-8 text-xs${linkError ? ' border-red-500' : ''}`} placeholder="Link (optional, https://…)" type="url" />
                {linkError && <span className="text-[10px] text-red-400 px-1">{linkError}</span>}
              </div>
              <div className="flex items-center gap-1.5 px-1 min-w-0">
                <span className="text-[10px] text-muted-foreground shrink-0">ID (not editable):</span>
                <span className="text-[10px] font-mono text-muted-foreground truncate" title={selectedLandmark.id}>{selectedLandmark.id}</span>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-red-900/60 bg-black p-3">
              <span className="text-sm text-red-400 text-center">Remove «{selectedLandmark.name}»?</span>
              <span className="text-xs text-muted-foreground text-center">This action cannot be undone.</span>
              <div className="flex gap-2 mt-1">
                <Button size="sm" className="flex-1 h-8 text-xs bg-black text-red-500 hover:bg-neutral-900 hover:text-red-400 border border-red-900/60" disabled={loading}
                  onClick={() => { setEditDialogOpen(false); setConfirmDelete(false); onRemoveLandmark(); }}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {!confirmDelete && (
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <div className="flex gap-2">
                <Button type="submit" form="edit-landmark-form" size="sm" className="flex-1 h-8 text-xs" disabled={(!isDecorative(editType) && !editName.trim()) || loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              </div>
              <Button type="button" size="sm" className="w-full gap-2 h-8 text-xs bg-black text-red-500 hover:bg-neutral-900 hover:text-red-400 border border-neutral-800" disabled={loading} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />Remove Landmark
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Connection Edit Dialog ───────────────────────────────────────── */}
      <Dialog open={connEditDialogOpen} onOpenChange={(open) => { setConnEditDialogOpen(open); if (!open) { setEditingConnId(null); setConfirmDeleteConnId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Connection</DialogTitle>
            <DialogDescription>
              Update the selected connection details, or remove the connection from the map.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const conn = editingConnId ? (currentMap.connections ?? {})[editingConnId] : null;
            const otherId = conn ? (conn.originId === selectedLandmark.id ? conn.targetId : conn.originId) : null;
            const otherLandmark = otherId ? (currentMap.landmarks ?? {})[otherId] : null;
            if (!conn) return null;
            if (confirmDeleteConnId === editingConnId) {
              return (
                <div className="flex flex-col gap-2 rounded-md border border-red-900/60 bg-black p-3">
                  <span className="text-sm text-red-400 text-center">Remove this connection?</span>
                  <span className="text-xs text-muted-foreground text-center">This action cannot be undone.</span>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" className="flex-1 h-8 text-xs bg-black text-red-500 hover:bg-neutral-900 hover:text-red-400 border border-red-900/60" disabled={loading}
                      onClick={() => { setConnEditDialogOpen(false); setConfirmDeleteConnId(null); setEditingConnId(null); onRemoveConnection(conn.id); }}>
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={() => setConfirmDeleteConnId(null)}>Cancel</Button>
                  </div>
                </div>
              );
            }
            return (
              <form id="edit-conn-form" onSubmit={handleSaveConnEdit} className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground">→ {otherLandmark?.name ?? otherId}</span>
                <select value={editConnType} onChange={(e) => setEditConnType(e.target.value as ConnectionType)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground">
                  {ALL_CONNECTION_TYPES.map((t) => <option key={t} value={t}>{CONNECTION_TYPE_LABELS[t]}</option>)}
                </select>
                <Input autoFocus value={editConnName} maxLength={40} onChange={(e) => setEditConnName(e.target.value)} className="h-8 text-xs" placeholder="Name (optional)" />
                <Textarea value={editConnDescription} maxLength={280} onChange={(e) => setEditConnDescription(e.target.value)} className="text-xs min-h-16 resize-none" placeholder="Description (optional)" />
              </form>
            );
          })()}
          {confirmDeleteConnId !== editingConnId && (
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <div className="flex gap-2">
                <Button type="submit" form="edit-conn-form" size="sm" className="flex-1 h-8 text-xs" disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => { setConnEditDialogOpen(false); setEditingConnId(null); }}>Cancel</Button>
              </div>
              <Button type="button" size="sm" className="w-full gap-2 h-8 text-xs bg-black text-red-500 hover:bg-neutral-900 hover:text-red-400 border border-neutral-800" disabled={loading}
                onClick={() => setConfirmDeleteConnId(editingConnId)}>
                <Trash2 className="h-3.5 w-3.5" />Remove Connection
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-5 min-w-0 relative">
        {isCollaborator && (
          <button className="absolute top-3 right-3 flex items-center justify-center h-6 w-6 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
            title="Edit Landmark" disabled={loading} onClick={startEdit}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Castle className="h-4 w-4" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-foreground uppercase tracking-wider">{selectedLandmark.name.slice(0, 32)}</span>
            <span className="text-[10px] text-muted-foreground">{LANDMARK_TYPE_LABELS[selectedLandmark.type]}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          {selectedLandmark.description && (
            <span className="text-xs text-foreground leading-relaxed">{selectedLandmark.description}</span>
          )}
          {selectedLandmark.link && (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs text-muted-foreground">Link</span>
              <a href={selectedLandmark.link} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 truncate underline underline-offset-2" title={selectedLandmark.link}>
                {selectedLandmark.link}
              </a>
            </div>
          )}
          {selectedLandmark.groupId && (currentMap.groups ?? {})[selectedLandmark.groupId] && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Group</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/20"
                  style={{ backgroundColor: (currentMap.groups ?? {})[selectedLandmark.groupId!]?.color }} />
                <span className="text-xs text-foreground">{(currentMap.groups ?? {})[selectedLandmark.groupId!]?.name}</span>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">ID</span>
            <span className="text-xs font-mono text-muted-foreground truncate" title={selectedLandmark.id}>{selectedLandmark.id.slice(0, 12)}</span>
          </div>
          <div className="flex justify-between items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">Owner</span>
            {isCollaborator && currentMap.collaborators.length > 0 ? (
              <div className="flex flex-col gap-0.5 items-end min-w-0">
                <select
                  value={selectedLandmark.ownerId ?? ''}
                  disabled={ownerChanging || loading}
                  className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground disabled:opacity-50 disabled:cursor-not-allowed max-w-40 truncate"
                  onChange={async (e) => {
                    const newOwnerId = e.target.value || null;
                    if (newOwnerId === (selectedLandmark.ownerId ?? null)) return;
                    setOwnerChanging(true);
                    setOwnerChangeError('');
                    try {
                      const updated = await changeLandmarkOwner(currentMap.id, selectedLandmark.id, newOwnerId);
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
                {ownerChangeError && <span className="text-[10px] text-red-400">{ownerChangeError}</span>}
              </div>
            ) : (
              <span className="text-xs text-foreground truncate">
                {owner?.username ?? 'No owner'}
                {isOwner && <span className="text-muted-foreground"> (you)</span>}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Position</span>
            {isCollaborator && selectedLandmark.coordinate ? (
              <button className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted px-2 py-0.5 transition-colors disabled:opacity-50 cursor-pointer"
                title="Relocate" disabled={loading} onClick={() => setRelocatingLandmark(selectedLandmark.id)}>
                <span className="text-xs font-mono text-foreground">({selectedLandmark.coordinate.q}, {selectedLandmark.coordinate.r})</span>
                <Move className="h-3 w-3 text-muted-foreground" />
              </button>
            ) : (
              <span className="text-xs font-mono text-foreground">
                {selectedLandmark.coordinate ? `(${selectedLandmark.coordinate.q}, ${selectedLandmark.coordinate.r})` : 'No position'}
              </span>
            )}
          </div>
        </div>
        {/* ── Quality Metrics ─────────────────────────────────────────────── */}
        {allMetrics.length > 0 && !isDecorative(selectedLandmark.type) && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">Quality Metrics</span>
                {lmWorstLevel !== 'NONE' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: QUALITY_LEVEL_COLOR[lmWorstLevel], border: `1px solid ${QUALITY_LEVEL_COLOR[lmWorstLevel]}` }}>
                    {QUALITY_LEVEL_LABEL[lmWorstLevel]}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {allMetrics.map((metric) => {
                  const entry = landmarkMetricEntries[metric.id];
                  const level: QualityLevel = entry?.level ?? 'NONE';
                  if (editingMetricId === metric.id) {
                    return (
                      <form key={metric.id} onSubmit={handleSaveMetric} className="flex flex-col gap-1.5 rounded-md border border-border p-2 min-w-0">
                        <span className="text-[10px] font-semibold text-foreground">{metric.name}</span>
                        <Input autoFocus value={metricValue} onChange={(e) => setMetricValue(e.target.value)} className="h-7 text-xs" maxLength={60}
                          placeholder={metricLevel !== 'NONE' ? `Leave empty to use "${QUALITY_LEVEL_SIGN[metricLevel]}"` : 'Value (e.g. 99.9 %)'} />
                        <select value={metricLevel} onChange={(e) => setMetricLevel(e.target.value as QualityLevel)} className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground">
                          {QUALITY_LEVEL_ORDER.map((l) => (
                            <option key={l} value={l}>{l !== 'NONE' ? `${QUALITY_LEVEL_SIGN[l]}  ` : ''}{QUALITY_LEVEL_LABEL[l]}</option>
                          ))}
                        </select>
                        <div className="flex flex-col gap-0.5">
                          <Input value={metricLink} onChange={(e) => { setMetricLink(e.target.value); setMetricLinkError(''); }}
                            className={`h-7 text-xs${metricLinkError ? ' border-red-500' : ''}`} placeholder="Link (optional, https://…)" type="url" />
                          {metricLinkError && <span className="text-[10px] text-red-400 px-1">{metricLinkError}</span>}
                        </div>
                        <Input value={metricLinkText} onChange={(e) => setMetricLinkText(e.target.value)} className="h-7 text-xs" maxLength={60}
                          placeholder="Link text (optional)" />
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-foreground">Badges</span>
                          {metricBadges.map((badge, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input value={badge.key} onChange={(e) => { const n = [...metricBadges]; n[index].key = e.target.value; setMetricBadges(n); }} className="h-7 text-xs flex-1" placeholder="Badge key" />
                              <Input value={badge.url} onChange={(e) => { const n = [...metricBadges]; n[index].url = e.target.value; setMetricBadges(n); }}
                                className={`h-7 text-xs flex-1${badge.error ? ' border-red-500' : ''}`} placeholder="Badge URL (https://…)" type="url" />
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 p-0" onClick={() => setMetricBadges((prev) => prev.filter((_, i) => i !== index))} title="Remove badge">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setMetricBadges((prev) => [...prev, { key: '', url: '', error: '' }])}>
                            + Add Badge
                          </Button>
                        </div>
                        <div className="flex gap-1.5">
                          <Button type="submit" size="sm" className="flex-1 h-7 text-xs" disabled={(metricLevel === 'NONE' && !metricValue.trim() && !metricLink.trim() && metricBadges.length === 0) || loading}>
                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingMetricId(null)}>Cancel</Button>
                        </div>
                      </form>
                    );
                  }
                  if (confirmClearMetricId === metric.id) {
                    return (
                      <div key={metric.id} className="flex flex-col gap-1 rounded-md border border-red-900/60 bg-black p-2">
                        <span className="text-[11px] text-red-400 text-center">Clear «{metric.name}»?</span>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-7 text-xs bg-black text-red-500 hover:bg-neutral-900 hover:text-red-400 border border-red-900/60" disabled={loading}
                            onClick={() => { setConfirmClearMetricId(null); onClearLandmarkMetric(selectedLandmark.id, metric.id); }}>
                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, clear'}
                          </Button>
                          <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => setConfirmClearMetricId(null)}>Cancel</Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={metric.id}
                      className={`flex flex-col gap-1 rounded-md border border-border px-2 py-1.5 transition-colors min-w-0${isCollaborator ? ' cursor-pointer hover:bg-accent/30' : ''}`}
                      onClick={isCollaborator ? () => startMetricEdit(metric.id) : undefined}
                      title={`${metric.name}: ${metric.description}`}
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {level !== 'NONE' ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block shrink-0 font-mono"
                              style={{ color: QUALITY_LEVEL_COLOR[level], border: `1px solid ${QUALITY_LEVEL_COLOR[level]}` }} title={QUALITY_LEVEL_LABEL[level]}>
                              {entry?.value ?? QUALITY_LEVEL_SIGN[level]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 shrink-0">—</span>
                          )}
                          <span className="text-[11px] text-muted-foreground truncate">{metric.name}</span>
                          {!entry && <span className="text-[10px] text-muted-foreground/50 italic">not set</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {entry?.link && (
                            <a href={entry.link} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-blue-400" onClick={(e) => e.stopPropagation()} title={entry.link}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {entry && isCollaborator && (
                            <button className="text-muted-foreground hover:text-red-400 transition-colors" title="Clear metric value"
                              onClick={(e) => { e.stopPropagation(); setConfirmClearMetricId(metric.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {entry?.badges && Object.entries(entry.badges).map(([key, url]) => (
                        <div key={key} className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] text-muted-foreground shrink-0">{key}</span>
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
        {collaboratorMatrix && matrixEntriesForLandmark.length > 0 && !isDecorative(selectedLandmark.type) && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-xs text-foreground">Collaborators</span>
              <div className="flex flex-col gap-1">
                {matrixEntriesForLandmark.map(({ collaborator, level }) => (
                  <div key={collaborator.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-md border border-border min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {collaborator.avatarUrl ? (
                        <img src={collaborator.avatarUrl} alt={collaborator.username} className="h-4 w-4 rounded-full shrink-0 object-cover" />
                      ) : (
                        <span className="h-4 w-4 rounded-full bg-muted shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">
                          {collaborator.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="text-xs text-foreground truncate">{collaborator.username}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={MATRIX_LEVEL_BADGE_STYLE[level]}>
                      {MATRIX_LEVEL_LABEL[level]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {/* ── Chore Lists ──────────────────────────────────────────────────── */}
        {(() => {
          const relevantLists = choreLists.filter((list) => selectedLandmark.id in list.entries);
          if (relevantLists.length === 0) return null;
          return (
            <>
              <Separator className="bg-border" />
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground">Chore Lists</span>
                </div>
                <div className="flex flex-col gap-2">
                  {relevantLists.map((list) => {
                    const entry = list.entries[selectedLandmark.id];
                    const assignee = entry.assigneeId
                      ? currentMap!.collaborators.find((c) => c.id === entry.assigneeId)
                      : null;
                    return (
                      <div key={list.id} className="flex flex-col gap-1 rounded-md border border-border px-2 py-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <span className="text-[11px] font-medium text-foreground truncate">{list.title}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                            style={CHORE_ENTRY_STATE_BADGE_STYLE[entry.state]}>
                            {CHORE_ENTRY_STATE_LABEL[entry.state]}
                          </span>
                        </div>
                        {assignee && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignee.avatarUrl ? (
                              <img src={assignee.avatarUrl} alt={assignee.username} className="h-3.5 w-3.5 rounded-full shrink-0 object-cover" />
                            ) : (
                              <span className="h-3.5 w-3.5 rounded-full bg-muted shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">
                                {assignee.username.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground truncate">{assignee.username}</span>
                          </div>
                        )}
                        {entry.note && (
                          <span className="text-[10px] text-muted-foreground/70 leading-relaxed">{entry.note}</span>
                        )}
                        {entry.link && (
                          <a href={entry.link} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300 truncate underline underline-offset-2"
                            title={entry.link}>{entry.link}</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
        {/* ── Connections ─────────────────────────────────────────────────── */}
        {connections.length > 0 && (
          <>
            <Separator className="bg-border" />
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-xs text-foreground">Connections ({connections.length})</span>
                <div className="flex flex-col gap-1">
                  {connections.map((c) => {
                    const otherId = c.originId === selectedLandmark.id ? c.targetId : c.originId;
                    const otherLandmark = (currentMap.landmarks ?? {})[otherId];
                    return (
                      <div key={c.id} className="flex items-start justify-between gap-1 min-w-0 px-2 py-1.5">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-medium text-foreground truncate">{c.name ?? otherLandmark?.name ?? otherId}</span>
                          {c.description && <span className="text-[10px] text-muted-foreground/70 leading-relaxed">{c.description}</span>}
                          <span className="text-[10px] text-muted-foreground">{CONNECTION_TYPE_LABELS[c.type ?? 'PIPE']} → {otherLandmark?.name ?? otherId}</span>
                        </div>
                        {isCollaborator && (
                          <button className="flex items-center justify-center h-5 w-5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5 cursor-pointer" title="Edit connection"
                            onClick={() => startConnEdit(c.id)}>
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
        {/* ── Create connection ────────────────────────────────────────────── */}
        {isCollaborator && (
          <div className="flex flex-col gap-1.5">
            {!showConnForm ? (
              <Button size="sm" variant="outline" className="w-full gap-2 h-9 py-2" disabled={loading} onClick={() => setShowConnForm(true)}>
                <Link className="h-3.5 w-3.5" />Create Connection
              </Button>
            ) : (
              <>
                <select value={connType} onChange={(e) => setConnType(e.target.value as ConnectionType)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground">
                  {ALL_CONNECTION_TYPES.map((t) => <option key={t} value={t}>{CONNECTION_TYPE_LABELS[t]}</option>)}
                </select>
                <Input value={connName} maxLength={40} onChange={(e) => setConnName(e.target.value)} className="h-8 text-xs" placeholder="Connection name (optional)" />
                <Textarea value={connDescription} maxLength={280} onChange={(e) => setConnDescription(e.target.value)} className="text-xs min-h-12 resize-none" placeholder="Description (optional)" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-2 h-9 py-2" disabled={loading}
                    onClick={() => { onStartConnection(connType, connName.trim() || undefined, connDescription.trim() || undefined); setShowConnForm(false); setConnName(''); setConnDescription(''); }}>
                    <Link className="h-3.5 w-3.5" />Select Target
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 text-xs" onClick={() => { setShowConnForm(false); setConnName(''); setConnDescription(''); }}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
