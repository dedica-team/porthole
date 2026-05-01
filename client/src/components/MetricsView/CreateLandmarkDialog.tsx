import { useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LandmarkGroup, LandmarkType } from '@/types/landmark';
import { ALL_LANDMARK_TYPES, isDecorative, LANDMARK_TYPE_LABELS } from '@/types/landmark';
interface Props {
  open: boolean;
  loading: boolean;
  groups: Record<string, LandmarkGroup>;
  onSubmit: (name: string, type: LandmarkType, description?: string, groupId?: string, link?: string) => void;
  onClose: () => void;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function CreateLandmarkDialog({ open, loading, groups, onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LandmarkType>('KEEP');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  const sortedGroups = useMemo(
    () => Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const allowedTypes = useMemo(
    () => ALL_LANDMARK_TYPES.filter((t) => !isDecorative(t)),
    [],
  );

  const reset = () => {
    setName('');
    setType('KEEP');
    setDescription('');
    setGroupId('');
    setLink('');
    setLinkError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isDecorative(type)) return;
    if (link.trim() && !isValidUrl(link.trim())) {
      setLinkError('Must be a valid http/https URL');
      return;
    }
    onSubmit(
      name.trim(),
      type,
      description.trim() || undefined,
      groupId || undefined,
      link.trim() || undefined,
    );
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-sm">Create Landmark</DialogTitle>
          <DialogDescription className="text-xs">
            Create a landmark without a position. You can place it later from the tile sidebar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 pb-6">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
            maxLength={60}
            placeholder="Name"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value as LandmarkType)}
            className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground"
          >
            <option value="">— No group —</option>
            {sortedGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm min-h-[4rem] resize-none"
            maxLength={200}
            placeholder="Description (optional)"
          />

          <div className="flex flex-col gap-0.5">
            <Input
              value={link}
              onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
              className={`h-8 text-sm${linkError ? ' border-red-500' : ''}`}
              placeholder="Link (optional, https://...)"
              type="url"
            />
            {linkError && <span className="text-[10px] text-red-400 px-1">{linkError}</span>}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className="flex-1 gap-1.5 h-8" disabled={!name.trim() || isDecorative(type) || loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Landmark
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={handleClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

