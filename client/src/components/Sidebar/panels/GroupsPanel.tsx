import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Loader2, Check, ExternalLink } from 'lucide-react';
import { CloseButton } from '@/components/ui/close-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { LandmarkGroup } from '@/types/landmark';
interface Props {
  onCreateGroup: (name: string, color: string, description?: string, link?: string) => void;
  onEditGroup: (groupId: string, name?: string, color?: string, description?: string, clearDescription?: boolean, link?: string, clearLink?: boolean) => void;
  onRemoveGroup: (groupId: string) => void;
  loading: boolean;
}

interface EditState {
  name: string;
  color: string;
  description: string;
  link: string;
}

export default function GroupsPanel({ onCreateGroup, onEditGroup, onRemoveGroup, loading }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const userId = useAuthStore((s) => s.userId);
  const [addName, setAddName]               = useState('');
  const [addColor, setAddColor]             = useState('#3b82f6');
  const [addDescription, setAddDescription] = useState('');
  const [addLink, setAddLink]               = useState('');
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editState, setEditState]           = useState<EditState>({ name: '', color: '', description: '', link: '' });
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  if (!currentMap) return null;

  const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));

  const groups    = Object.values(currentMap.groups ?? {});
  const landmarks = Object.values(currentMap.landmarks ?? {});
  const landmarksInGroup = (groupId: string) => landmarks.filter((l) => l.groupId === groupId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    onCreateGroup(
      addName.trim(),
      addColor,
      addDescription.trim() || undefined,
      addLink.trim() || undefined,
    );
    setAddName(''); setAddColor('#3b82f6'); setAddDescription(''); setAddLink('');
  };

  const startEdit = (group: LandmarkGroup) => {
    setEditingId(group.id);
    setEditState({ name: group.name, color: group.color, description: group.description ?? '', link: group.link ?? '' });
    setRemoveConfirmId(null);
  };

  const saveEdit = (group: LandmarkGroup) => {
    if (!editState.name.trim()) return;
    const descChanged     = editState.description.trim() !== (group.description ?? '');
    const linkChanged     = editState.link.trim()        !== (group.link ?? '');
    const clearDesc       = descChanged && editState.description.trim() === '';
    const clearLnk        = linkChanged && editState.link.trim() === '';
    onEditGroup(
      group.id,
      editState.name.trim(),
      editState.color,
      descChanged && !clearDesc ? editState.description.trim() : undefined,
      clearDesc,
      linkChanged && !clearLnk ? editState.link.trim() : undefined,
      clearLnk,
    );
    setEditingId(null);
  };

  const cancelEdit    = () => setEditingId(null);
  const requestRemove = (groupId: string) => { setRemoveConfirmId(groupId); setEditingId(null); };
  const confirmRemove = (groupId: string) => { onRemoveGroup(groupId); setRemoveConfirmId(null); };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className="h-4 w-4" />
        <span className="text-sm font-medium uppercase tracking-wider">Groups</span>
      </div>

      {/* Existing groups */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet. Create one below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const count = landmarksInGroup(group.id).length;

            if (editingId === group.id) {
              return (
                <div key={group.id} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                  <div className="flex gap-1.5">
                    <input
                      type="color"
                      value={editState.color}
                      onChange={(e) => setEditState((s) => ({ ...s, color: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <Input
                      autoFocus
                      value={editState.name}
                      onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      className="h-8 text-sm flex-1"
                      maxLength={40}
                      placeholder="Group name"
                    />
                  </div>
                  <Input
                    value={editState.description}
                    onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="Description (optional)"
                    maxLength={200}
                  />
                  <Input
                    value={editState.link}
                    onChange={(e) => setEditState((s) => ({ ...s, link: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder="https://… (optional)"
                    type="url"
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="flex-1 h-7 text-sm gap-1"
                      disabled={!editState.name.trim() || loading}
                      onClick={() => saveEdit(group)}>
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Save
                    </Button>
                    <CloseButton className="h-7 w-7" onClick={cancelEdit} />
                  </div>
                </div>
              );
            }

            if (removeConfirmId === group.id) {
              return (
                <div key={group.id} className="flex flex-col gap-1.5 rounded-md border border-destructive/40 p-2">
                  <p className="text-sm text-muted-foreground">
                    Remove <strong>{group.name}</strong>?
                    {count > 0 && (
                      <span className="text-warning"> {count} landmark{count > 1 ? 's' : ''} will lose their group.</span>
                    )}
                  </p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="destructive" className="flex-1 h-7 text-sm" disabled={loading}
                      onClick={() => confirmRemove(group.id)}>
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-sm"
                      onClick={() => setRemoveConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={group.id} className="flex flex-col gap-0.5 rounded-md border border-border px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm text-foreground flex-1 truncate">{group.name}</span>
                  {count > 0 && (
                    <span className="text-sm text-muted-foreground shrink-0">{count}</span>
                  )}
                  {group.link && (
                    <a href={group.link} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {isCollaborator && (
                    <>
                      <button className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => startEdit(group)}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => requestRemove(group.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground pl-5 leading-snug">{group.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Separator className="bg-border" />

      {/* Add group form – collaborators only */}
      {isCollaborator && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground uppercase tracking-wider">Add Group</span>
        <div className="flex gap-1.5">
          <input
            type="color"
            value={addColor}
            onChange={(e) => setAddColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
          />
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            className="h-8 text-sm flex-1"
            placeholder="Group name"
            maxLength={40}
          />
        </div>
        <Input
          value={addDescription}
          onChange={(e) => setAddDescription(e.target.value)}
          className="h-8 text-sm"
          placeholder="Description (optional)"
          maxLength={200}
        />
        <Input
          value={addLink}
          onChange={(e) => setAddLink(e.target.value)}
          className="h-8 text-sm"
          placeholder="https://… (optional)"
          type="url"
        />
        <Button type="submit" size="sm" className="h-8 text-sm gap-1.5 w-full" disabled={!addName.trim() || loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add Group
        </Button>
      </form>
      )}
    </div>
  );
}