/**
 * LandmarkInfoPopover
 *
 * A popover that wraps any trigger element (typically a landmark name label)
 * and shows a compact info card for that landmark. Collaborators also get an
 * inline edit form reachable via an "Edit" button.
 *
 * Props
 * ─────
 * landmark       – the landmark to display
 * onEditLandmark – called when the user saves edits (same signature as in
 *                  MetricsView / LandmarkPanel)
 * loading        – disables the save button while a request is in flight
 * children       – the trigger element (landmark name / button)
 */

import { useState } from 'react';
import { Pencil, X, ExternalLink, Check, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // edit form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LandmarkType>('KEEP');
  const [editDescription, setEditDescription] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editLink, setEditLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [ownerChanging, setOwnerChanging] = useState(false);
  const [ownerChangeError, setOwnerChangeError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

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
    setEditing(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(false); setConfirmDelete(false); } }}>
      <PopoverTrigger asChild>
        {/* We clone the child as the trigger */}
        <span className="cursor-pointer">{children}</span>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 overflow-hidden"
        align="start"
        side="right"
        sideOffset={6}
      >
        {!editing ? (
          /* ── Info view ─────────────────────────────────────────────────── */
          <div className="flex flex-col gap-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{landmark.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCollaborator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Edit Landmark"
                    onClick={startEdit}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Close"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-1.5 px-4 pb-4 text-xs">
              {landmark.description && (
                <p className="text-foreground/80 leading-relaxed text-[11px]">{landmark.description}</p>
              )}

              {landmark.link && (
                <a
                  href={landmark.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 truncate"
                  title={landmark.link}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{landmark.link}</span>
                </a>
              )}

              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1">
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
            </div>
          </div>
        ) : (
          /* ── Edit form ─────────────────────────────────────────────────── */
          <div className="flex flex-col gap-2.5 p-4">
            {!confirmDelete ? (
              <form onSubmit={handleSave} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">Edit Landmark</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" type="button" onClick={cancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <Input
                  autoFocus
                  value={editName}
                  maxLength={40}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-xs"
                  placeholder={isDecorative(editType) ? 'Name (optional)' : 'Name'}
                />

                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as LandmarkType)}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  {ALL_LANDMARK_TYPES.map((t) => (
                    <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>
                  ))}
                </select>

                <Textarea
                  value={editDescription}
                  maxLength={280}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-xs min-h-14 resize-none"
                  placeholder="Description (optional)"
                />

                {groups.length > 0 && (
                  <select
                    value={editGroupId}
                    onChange={(e) => setEditGroupId(e.target.value)}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
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
                    className={`h-8 text-xs${linkError ? ' border-red-500' : ''}`}
                    placeholder="Link (optional, https://…)"
                    type="url"
                  />
                  {linkError && <span className="text-[10px] text-red-400 px-1">{linkError}</span>}
                </div>

                {/* Owner dropdown */}
                {currentMap && currentMap.collaborators.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground px-0.5">Owner</span>
                    <select
                      value={landmark.ownerId ?? ''}
                      disabled={ownerChanging || loading}
                      className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {ownerChangeError && <span className="text-[10px] text-red-400 px-0.5">{ownerChangeError}</span>}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5"
                      disabled={(!isDecorative(editType) && !editName.trim()) || loading}
                    >
                      {loading ? null : <Check className="h-3 w-3" />}
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full gap-2 h-8 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    disabled={loading}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex flex-col gap-1 text-center">
                  <span className="text-sm font-medium text-red-400">Remove «{landmark.name}»?</span>
                  <span className="text-xs text-muted-foreground">This action cannot be undone.</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    disabled={loading}
                    onClick={() => {
                      onRemoveLandmark(landmark.id);
                      setOpen(false);
                    }}
                  >
                    Yes, remove
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

