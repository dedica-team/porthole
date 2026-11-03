import { useState, useEffect } from 'react';
import { CheckSquare, Square, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMapStore } from '@/store/mapStore';
import { isDecorative } from '@/types/landmark';
import type { ChoreList } from '@/types/chores';
import { editChoreList, toggleChoreListCompleted, deleteChoreList } from '@/api/mapApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choreList: ChoreList | null;
  readOnly?: boolean;
  onSaved: (lists: ChoreList[]) => void;
  onToggleCompleted: (updated: ChoreList) => void;
  onDeleted: (listId: string) => void;
}

export default function EditChoreListDialog({ open, onOpenChange, choreList, readOnly = false, onSaved, onToggleCompleted, onDeleted }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const [title, setTitle] = useState(choreList?.title ?? '');
  const [link, setLink] = useState(choreList?.link ?? '');
  const [description, setDescription] = useState(choreList?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(Object.keys(choreList?.entries ?? {})));
  const [completed, setCompleted] = useState(choreList?.completed ?? false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && choreList) {
      setTitle(choreList.title);
      setLink(choreList.link ?? '');
      setDescription(choreList.description ?? '');
      setSelected(new Set(Object.keys(choreList.entries)));
      setCompleted(choreList.completed);
      setConfirmDelete(false);
      setError('');
    }
  }, [open, choreList]);

  const landmarks = Object.values(currentMap?.landmarks ?? {})
    .filter((l) => !isDecorative(l.type))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleAll = () => {
    if (selected.size === landmarks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(landmarks.map((l) => l.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!currentMap || !choreList || !title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const trimmedDesc = description.trim();
      const lists = await editChoreList(currentMap.id, choreList.id, title.trim(), [...selected], link.trim() || undefined, trimmedDesc || (choreList.description ? null : undefined));
      onSaved(lists);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCompleted = async () => {
    if (!currentMap || !choreList) return;
    setToggling(true);
    setError('');
    try {
      const updated = await toggleChoreListCompleted(currentMap.id, choreList.id);
      onToggleCompleted(updated);
      setCompleted(updated.completed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!currentMap || !choreList) return;
    setDeleting(true);
    setError('');
    try {
      await deleteChoreList(currentMap.id, choreList.id);
      onDeleted(choreList.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving && !deleting) onOpenChange(v); }}>
      <DialogContent className="w-96 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">{readOnly ? 'Chore List' : 'Edit Chore List'}</DialogTitle>
        </DialogHeader>
        {choreList && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-chore-title" className="text-sm">Title</Label>
            <Input
              id="edit-chore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              readOnly={readOnly}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-chore-link" className="text-sm">Link <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="edit-chore-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              readOnly={readOnly}
              placeholder="https://…"
              className="h-8 text-sm"
              type="url"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-chore-description" className="text-sm">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="edit-chore-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              placeholder={readOnly ? 'No description' : 'What needs to be checked or done…'}
              className="text-sm resize-none"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Elements</Label>
              {!readOnly && (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  onClick={toggleAll}
                >
                  {selected.size === landmarks.length ? 'Clear' : 'Select all'}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto rounded-md border border-input bg-background p-2">
              {landmarks.map((l) => (
                <label key={l.id} className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm${readOnly ? '' : ' cursor-pointer hover:bg-muted'}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    disabled={readOnly}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="truncate text-foreground">{l.name}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Complete / Reopen – collaborators only */}
          {!readOnly && (
            <div className="border-t border-border pt-3 mt-1">
              <Button
                fullWidth={true}
                variant="flat"
                className={completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}
                disabled={toggling}
                onClick={handleToggleCompleted}
              >
                {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : completed ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {completed ? 'Reopen list' : 'Mark list complete'}
              </Button>
            </div>
          )}

          {/* Delete section – collaborators only */}
          {!readOnly && (
            <div className="border-t border-border pt-3">
              {!confirmDelete ? (
                <Button
                  variant="destructive" fullWidth={true}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete list…
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-destructive">Delete «{choreList.title}»? This cannot be undone.</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-sm"
                      disabled={deleting}
                      onClick={handleDelete}
                    >
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, delete'}
                    </Button>
                    <Button type="button" size="sm" variant="flat" className="h-7 px-3 text-sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
        <DialogFooter className="pt-2">
          {readOnly ? (
            <Button variant="flat" size="sm" className="h-8 text-sm" onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="flat" size="sm" className="h-8 text-sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" className="h-8 text-sm" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



