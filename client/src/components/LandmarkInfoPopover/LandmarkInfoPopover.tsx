import { useState } from 'react';
import { Pencil, ExternalLink, Check, Trash2 } from 'lucide-react';
import { Popup } from '@/components/ui/popup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { Landmark, LandmarkType } from '@/types/landmark';
import { ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS, isDecorative } from '@/types/landmark';
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
  loading?: boolean;
  children: React.ReactNode;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

export default function LandmarkInfoPopover({ landmark, onEditLandmark, onRemoveLandmark, loading = false, children }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const userId = useAuthStore((s) => s.userId);

  const [infoOpen, setInfoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // edit form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LandmarkType>('KEEP');
  const [editDescription, setEditDescription] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editLink, setEditLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [ownerChanging, setOwnerChanging] = useState(false);
  const [ownerChangeError, setOwnerChangeError] = useState('');

  if (!currentMap) return <>{children}</>;

  const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));
  const owner = landmark.ownerId ? currentMap.collaborators.find((c) => c.id === landmark.ownerId) : null;
  const group = landmark.groupId ? (currentMap.groups ?? {})[landmark.groupId] : null;
  const groups = Object.values(currentMap.groups ?? {});

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

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <span className="cursor-pointer" onClick={() => setInfoOpen(true)}>
        {children}
      </span>

      {/* ── Info popup ──────────────────────────────────────────────────── */}
      <Popup title={landmark.name} open={infoOpen} onOpenChange={setInfoOpen} className="max-w-xs">
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

          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-muted-foreground">Owner</span>
            <span className="text-foreground truncate">
              {owner ? `${owner.username}${owner.id === userId ? ' (you)' : ''}` : '—'}
            </span>

            {group && (
              <>
                <span className="text-muted-foreground">Group</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-foreground truncate">{group.name}</span>
                </div>
              </>
            )}

            <span className="text-muted-foreground">ID</span>
            <span className="text-muted-foreground font-mono truncate" title={landmark.id}>
              {landmark.id.slice(0, 14)}
            </span>
          </div>

          {isCollaborator && (
            <div className="pt-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-sm" onClick={startEdit}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </Popup>

      {/* ── Edit popup ──────────────────────────────────────────────────── */}
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

          {currentMap && currentMap.collaborators.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground px-0.5">Owner</span>
              <select
                value={landmark.ownerId ?? ''}
                disabled={ownerChanging || loading}
                className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <option key={c.id} value={c.id}>
                    {c.username}{c.id === userId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
              {ownerChangeError && <span className="text-sm text-destructive px-0.5">{ownerChangeError}</span>}
            </div>
          )}

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
    </>
  );
}
