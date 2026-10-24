import React, { useState, useEffect } from 'react';
import { Loader2, CheckSquare, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { Collaborator } from '@/types/session';
import type { CollaboratorMatrix } from '@/types/matrix';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matrix: CollaboratorMatrix | null;
  mapCollaborators: Collaborator[];
  onSave: (name?: string, collaborators?: string[]) => Promise<void>;
}

export default function EditCollaboratorMatrixDialog({
  open,
  onOpenChange,
  matrix,
  mapCollaborators,
  onSave,
}: Props) {
  const [name, setName] = useState(matrix?.name ?? 'Collaborator Matrix');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(matrix?.collaborators ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && matrix) {
      setName(matrix.name || 'Collaborator Matrix');
      setSelectedIds(new Set(matrix.collaborators ?? []));
      setError('');
    }
  }, [open, matrix]);

  const sortedCollaborators = [...mapCollaborators].sort((a, b) =>
    a.username.localeCompare(b.username),
  );

  const toggleAll = () => {
    if (selectedIds.size === sortedCollaborators.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCollaborators.map((c) => c.id)));
    }
  };

  const toggleCollaborator = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), [...selectedIds]);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save matrix');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">Edit Collaborator Matrix</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 flex flex-col gap-4 overflow-y-auto">
            {error && (
              <div className="p-2 text-sm text-destructive bg-destructive/10 rounded">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="matrix-name" className="text-sm font-medium">
                Matrix Name
              </Label>
              <Input
                id="matrix-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Collaborator Matrix"
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Collaborators ({selectedIds.size}/{sortedCollaborators.length})
                </Label>
                {sortedCollaborators.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {selectedIds.size === sortedCollaborators.length ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Deselect all
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" /> Select all
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="border border-border rounded-md divide-y divide-border/60 max-h-56 overflow-y-auto bg-background/50">
                {sortedCollaborators.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No collaborators in this landscape.
                  </div>
                ) : (
                  sortedCollaborators.map((c) => {
                    const isChecked = selectedIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer select-none transition-colors"
                      >
                        <input
                          type="checkbox"
                          aria-label={c.username}
                          checked={isChecked}
                          onChange={() => toggleCollaborator(c.id)}
                          className="rounded border-border text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <UserAvatar username={c.username} avatarUrl={c.avatarUrl} size="sm" />
                          <span className="truncate text-foreground font-medium">{c.username}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Only selected collaborators appear as columns in the matrix. Existing ratings are preserved when a collaborator is deselected.
              </p>
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0 bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !name.trim()}
              className="gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
