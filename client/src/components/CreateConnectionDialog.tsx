import { useState, useMemo, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Landmark } from '@/types/landmark';
import type { Connection, ConnectionType } from '@/types/connection';
import type { SessionState } from '@/types/session';
import { ALL_CONNECTION_TYPES, CONNECTION_TYPE_LABELS } from '@/types/connection';
import { createConnection } from '@/api/mapApi';

export interface StageOption {
  id: string;
  name?: string;
  order: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mapId: string;
  landmarks: Landmark[]; // already filtered to positioned only
  existingConnections: Connection[];
  onCreated: (map: SessionState, targetStageId?: string) => void;
  defaultOrigin?: Landmark | null;
  defaultTarget?: Landmark | null;
  stages?: StageOption[];
  defaultStageId?: string;
}

function LandmarkCombobox({
  label,
  landmarks,
  selected,
  excluded,
  onChange,
}: {
  label: string;
  landmarks: Landmark[];
  selected: Landmark | null;
  excluded?: string;
  onChange: (l: Landmark) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      landmarks.filter(
        (l) =>
          l.id !== excluded &&
          l.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [landmarks, excluded, query],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 px-3 rounded-lg border border-border bg-background text-sm font-normal cursor-pointer"
          >
            <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
              {selected ? selected.name : 'Select element…'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>
            ) : (
              filtered.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left"
                  onClick={() => {
                    onChange(l);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${selected?.id === l.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {l.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function CreateConnectionDialog({
  open,
  onClose,
  mapId,
  landmarks,
  existingConnections,
  onCreated,
  defaultOrigin,
  defaultTarget,
  stages,
  defaultStageId,
}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ConnectionType>('PIPE');
  const [origin, setOrigin] = useState<Landmark | null>(defaultOrigin ?? null);
  const [target, setTarget] = useState<Landmark | null>(defaultTarget ?? null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setOrigin(defaultOrigin ?? null);
      setTarget(defaultTarget ?? null);
      setName('');
      setType('PIPE');
      setError('');
      if (defaultStageId !== undefined) {
        setSelectedStageId(defaultStageId);
      } else if (stages && stages.length > 0) {
        setSelectedStageId(stages[0].id);
      } else if (stages) {
        setSelectedStageId('__NEW_STAGE__');
      } else {
        setSelectedStageId('');
      }
    }
  }, [open, defaultOrigin, defaultTarget, defaultStageId, stages]);

  const reset = () => {
    setName('');
    setType('PIPE');
    setOrigin(defaultOrigin ?? null);
    setTarget(defaultTarget ?? null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!origin || !target) {
      setError('Please select both elements.');
      return;
    }
    if (origin.id === target.id) {
      setError('Start and end elements must differ.');
      return;
    }
    const isDuplicate = existingConnections.some(
      (c) =>
        (c.originId === origin.id && c.targetId === target.id) ||
        (c.originId === target.id && c.targetId === origin.id),
    );
    if (isDuplicate) {
      setError('A connection between these two elements already exists.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updated = await createConnection(mapId, origin.id, target.id, type, name || undefined);
      if (stages !== undefined) {
        onCreated(updated, selectedStageId);
      } else {
        onCreated(updated);
      }
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">New Connection</DialogTitle>
          <DialogDescription>
            Create a new connection by choosing a start element, an end element and an optional title.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conn-name" className="text-sm text-muted-foreground">
              Title <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="conn-name"
              placeholder="e.g. Main pipeline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-lg"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-muted-foreground">Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ConnectionType)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ALL_CONNECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONNECTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Stage (optional if stages supplied) */}
          {stages !== undefined && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-stage" className="text-sm text-muted-foreground">
                Stage
              </Label>
              <select
                id="conn-stage"
                aria-label="Stage"
                value={selectedStageId}
                onChange={(e) => setSelectedStageId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {stages.length === 0 ? (
                  <option value="__NEW_STAGE__">New stage (Stage 1)</option>
                ) : (
                  stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.name} (Stage ${s.order + 1})` : `Stage ${s.order + 1}`}
                    </option>
                  ))
                )}
                {stages.length > 0 && <option value="__NEW_STAGE__">+ New stage</option>}
                <option value="__NONE__">None (do not add to stage)</option>
              </select>
            </div>
          )}

          {/* Start landmark */}
          <LandmarkCombobox
            label="Start element"
            landmarks={landmarks}
            selected={origin}
            excluded={target?.id}
            onChange={setOrigin}
          />

          {/* End landmark */}
          <LandmarkCombobox
            label="End element"
            landmarks={landmarks}
            selected={target}
            excluded={origin?.id}
            onChange={setTarget}
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={loading} className="rounded-lg">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-lg">
            {loading ? 'Creating…' : 'Create Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

