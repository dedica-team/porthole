import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMapStore } from '@/store/mapStore';
import { isDecorative } from '@/types/landmark';
import { createChoreList } from '@/api/mapApi';
import type {ChoreList} from "@/types/chores.ts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lists: ChoreList[]) => void;
}

export default function CreateChoreListDialog({ open, onOpenChange, onCreated }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const handleCreate = async () => {
    if (!currentMap || !title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const lists = await createChoreList(currentMap.id, title.trim(), [...selected], link.trim() || undefined, description.trim() || undefined);
      onCreated(lists);
      setTitle('');
      setLink('');
      setDescription('');
      setSelected(new Set());
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="w-96 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">New Chore List</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chore-title" className="text-sm">Title</Label>
            <Input
              id="chore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Audit"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chore-link" className="text-sm">Link <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="chore-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              className="h-8 text-sm"
              type="url"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chore-description" className="text-sm">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="chore-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be checked or done…"
              className="text-sm resize-none"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Landmarks</Label>
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={toggleAll}
              >
                {selected.size === landmarks.length ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto rounded-md border border-input bg-background p-2">
              {landmarks.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">No landmarks on this map yet.</p>
              )}
              {landmarks.map((l) => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="truncate text-foreground">{l.name}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="pt-2">
          <Button variant="flat" size="sm" className="h-8 text-sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" className="h-8 text-sm" onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

