import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Workflow,
  Plus,
  Trash2,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Radiation,
  ChevronUp,
  ChevronDown,
  Pencil,
  Save,
  RotateCcw,
  X,
  Search,
  Layers,
  MapPin,
  MoreHorizontal,
} from 'lucide-react';
import {
  createProcess,
  fetchProcesses,
  removeProcess,
  saveProcess,
  editConnection,
  removeConnection,
} from '@/api/mapApi';
import { useMapStore } from '@/store/mapStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popup } from '@/components/ui/popup';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import CreateConnectionDialog from '@/components/CreateConnectionDialog';
import type { Process, ProcessStage, StageConnection, StageConnectionDirection } from '@/types/process';
import { ALL_CONNECTION_TYPES, CONNECTION_TYPE_LABELS, type Connection, type ConnectionType } from '@/types/connection';
import type { Landmark } from '@/types/landmark';
import type { SessionState } from '@/types/session';
import ProcessGraph, { type ProcessGraphSelection } from './ProcessGraph';

type Action = (request: () => Promise<Process[]>) => Promise<Process[] | null>;

const cardBtnCls =
  'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

function ConflictAlert({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="text-xs text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded p-2 flex items-center justify-between gap-2">
      <span>This process was updated remotely while you were editing. Your unsaved draft is preserved.</span>
      <button type="button" onClick={reset} className="underline text-amber-300 hover:text-amber-200 cursor-pointer shrink-0 font-medium">
        Discard draft and load latest
      </button>
    </div>
  );
}

function EditProcessModal({
  open,
  onOpenChange,
  name,
  description,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  onSave: (name: string, description: string) => void;
}) {
  const [modalName, setModalName] = useState(name);
  const [modalDesc, setModalDesc] = useState(description);

  useEffect(() => {
    if (open) {
      setModalName(name);
      setModalDesc(description);
    }
  }, [open, name, description]);

  return (
    <Popup title="Edit process details" open={open} onOpenChange={onOpenChange} className="max-w-md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!modalName.trim()) return;
          onSave(modalName.trim(), modalDesc);
          onOpenChange(false);
        }}
        className="flex flex-col gap-3"
      >
        <label className="block text-xs font-medium text-foreground">
          Name
          <Input
            className="h-8 text-sm mt-1"
            required
            value={modalName}
            onChange={(e) => setModalName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-foreground">
          Description
          <Textarea
            className="text-sm mt-1 resize-none"
            rows={3}
            value={modalDesc}
            onChange={(e) => setModalDesc(e.target.value)}
            placeholder="Process description…"
          />
        </label>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" type="button" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs" disabled={!modalName.trim()}>
            Apply details
          </Button>
        </div>
      </form>
    </Popup>
  );
}

function BatchAddConnectionsModal({
  open,
  onOpenChange,
  stageName,
  mapConnections,
  landmarks,
  existingIds,
  onAdd,
  onCreateOnTheFly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  mapConnections: Record<string, Connection>;
  landmarks: Record<string, Landmark>;
  existingIds: Set<string>;
  onAdd: (connectionIds: string[]) => void;
  onCreateOnTheFly?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(new Set());
    }
  }, [open]);

  const allConnections = useMemo(() => Object.values(mapConnections ?? {}), [mapConnections]);

  const filteredConnections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allConnections;
    return allConnections.filter((c) => {
      const orig = landmarks[c.originId]?.name ?? c.originId;
      const dest = landmarks[c.targetId]?.name ?? c.targetId;
      const name = c.name ?? '';
      const type = c.type ?? '';
      return (
        orig.toLowerCase().includes(q) ||
        dest.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [allConnections, search, landmarks]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filteredConnections.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  return (
    <Popup
      title={`Add connections to ${stageName}`}
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Select multiple map connections to batch-assign to this stage in one click.
        </p>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search by landmark name, connection name, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            {filteredConnections.length} connection{filteredConnections.length === 1 ? '' : 's'} available
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-primary hover:underline cursor-pointer"
            >
              Select all
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={clearSelection}
              className="hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-border border border-border rounded bg-background/50">
          {filteredConnections.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {allConnections.length === 0 ? 'No connections on map.' : 'No matching connections.'}
            </div>
          ) : (
            filteredConnections.map((conn) => {
              const orig = landmarks[conn.originId]?.name ?? conn.originId;
              const dest = landmarks[conn.targetId]?.name ?? conn.targetId;
              const isAlreadyInStage = existingIds.has(conn.id);
              const isChecked = selected.has(conn.id);

              return (
                <label
                  key={conn.id}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer select-none ${
                    isAlreadyInStage
                      ? 'opacity-60 bg-muted/20'
                      : isChecked
                      ? 'bg-primary/10'
                      : 'hover:bg-secondary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isAlreadyInStage}
                    onChange={() => toggleOne(conn.id)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {orig} → {dest}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {conn.name ? `${conn.name} (${conn.type})` : conn.type}
                    </div>
                  </div>
                  {isAlreadyInStage && (
                    <span className="text-[10px] text-muted-foreground uppercase font-mono px-1.5 py-0.5 rounded bg-muted/40">
                      Added
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {selected.size} selected
            </span>
            {onCreateOnTheFly && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="h-8 text-xs text-primary"
                onClick={() => {
                  onOpenChange(false);
                  onCreateOnTheFly();
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create new connection
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={selected.size === 0}
              onClick={() => {
                onAdd(Array.from(selected));
                onOpenChange(false);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add selected ({selected.size})
            </Button>
          </div>
        </div>
      </div>
    </Popup>
  );
}

function EditConnectionModal({
  open,
  onOpenChange,
  connection,
  originName,
  targetName,
  onSave,
  loading = false,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection | null;
  originName: string;
  targetName: string;
  onSave: (type: ConnectionType, name?: string, description?: string) => Promise<void>;
  loading?: boolean;
  busy?: boolean;
}) {
  const isLoading = loading || busy;
  const [type, setType] = useState<ConnectionType>('PIPE');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open && connection) {
      setType(connection.type ?? 'PIPE');
      setName(connection.name ?? '');
      setDescription(connection.description ?? '');
    }
  }, [open, connection]);

  if (!connection) return null;

  return (
    <Popup title="Edit Connection" open={open} onOpenChange={onOpenChange} className="max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(type, name.trim() || undefined, description.trim() || undefined);
        }}
        className="flex flex-col gap-3"
      >
        <div className="text-xs text-muted-foreground font-mono">
          {originName} → {targetName}
        </div>

        <label className="block text-xs font-medium text-foreground">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ConnectionType)}
            className="w-full mt-1 h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
          >
            {ALL_CONNECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONNECTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-foreground">
          Name
          <Input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs mt-1"
            placeholder="Connection name (optional)"
          />
        </label>

        <label className="block text-xs font-medium text-foreground">
          Description
          <Textarea
            value={description}
            maxLength={280}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs mt-1 min-h-16 resize-none"
            placeholder="Connection description (optional)"
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={isLoading}>
            Save
          </Button>
        </div>
      </form>
    </Popup>
  );
}

function DeleteConnectionConfirmModal({
  open,
  onOpenChange,
  connection,
  originName,
  targetName,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection | null;
  originName: string;
  targetName: string;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}) {
  if (!connection) return null;

  const title = connection.name
    ? `Delete «${connection.name}» (${originName} → ${targetName})?`
    : `Delete connection (${originName} → ${targetName})?`;

  return (
    <Popup title={title} open={open} onOpenChange={onOpenChange} className="max-w-sm">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          This will permanently delete the connection from the map and all process stages. This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            disabled={loading}
            onClick={onConfirm}
          >
            Yes, delete connection
          </Button>
        </div>
      </div>
    </Popup>
  );
}

function DeleteStageConfirmModal({
  open,
  onOpenChange,
  stageName,
  stageIndex,
  connectionCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName?: string;
  stageIndex: number;
  connectionCount: number;
  onConfirm: () => void;
}) {
  const title = stageName
    ? `Delete «${stageName}» (Stage ${stageIndex + 1})?`
    : `Delete Stage ${stageIndex + 1}?`;

  return (
    <Popup title={title} open={open} onOpenChange={onOpenChange} className="max-w-sm">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {connectionCount > 0
            ? `This will remove the stage and its ${connectionCount} connection assignment${
                connectionCount === 1 ? '' : 's'
              } from the process. Map connections will not be deleted.`
            : 'This will remove the stage from the process.'}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Yes, delete stage
          </Button>
        </div>
      </div>
    </Popup>
  );
}

function CompactConnectionRow({
  connection,
  label,
  isSelected,
  onToggleDirection,
  onUpdateTitle,
  onRemove,
  onEditConnection,
  onDeleteConnection,
}: {
  connection: StageConnection;
  label: string;
  isSelected: boolean;
  onToggleDirection: () => void;
  onUpdateTitle: (title: string) => void;
  onRemove: () => void;
  onEditConnection: () => void;
  onDeleteConnection: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dirLabels: Record<StageConnectionDirection, { text: string; symbol: string; title: string }> = {
    FORWARD: { text: 'Forward', symbol: '→', title: 'Flow: Forward (Click to switch to Reverse)' },
    REVERSE: { text: 'Reverse', symbol: '←', title: 'Flow: Reverse (Click to switch to Bidirectional)' },
    BIDIRECTIONAL: { text: 'Bidirectional', symbol: '⇄', title: 'Flow: Bidirectional (Click to switch to Forward)' },
  };

  const curDir = dirLabels[connection.direction] ?? dirLabels.FORWARD;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs border transition-colors ${
        isSelected
          ? 'bg-primary/15 border-primary/50 text-foreground ring-1 ring-primary/40'
          : 'bg-background/60 border-border/80 text-foreground hover:border-border'
      }`}
    >
      <div
        className="flex-1 min-w-0 font-medium truncate cursor-pointer hover:text-primary hover:underline"
        title={`Click to edit connection: ${label}`}
        aria-label={`Edit connection ${label}`}
        role="button"
        tabIndex={0}
        onClick={onEditConnection}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEditConnection();
          }
        }}
      >
        {label}
      </div>

      {/* Inline direction cycle button */}
      <button
        type="button"
        onClick={onToggleDirection}
        title={curDir.title}
        aria-label={`Toggle direction for ${label}, currently ${curDir.text}`}
        className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/80 hover:bg-secondary text-primary border border-border text-[11px] font-mono cursor-pointer transition-colors shrink-0"
      >
        <span className="font-bold">{curDir.symbol}</span>
        <span className="hidden sm:inline">{curDir.text}</span>
      </button>

      {/* Inline title field */}
      <Input
        value={connection.title ?? ''}
        onChange={(e) => onUpdateTitle(e.target.value)}
        placeholder="Title (optional)"
        aria-label={`Title for connection ${label}`}
        className="h-7 text-xs w-28 sm:w-44 bg-background/80"
      />

      {/* Actions menu popover */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Connection options"
            aria-label={`Options for connection ${label}`}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" side="bottom" align="end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
            onClick={() => {
              setMenuOpen(false);
              onRemove();
            }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Remove from stage</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
            onClick={() => {
              setMenuOpen(false);
              onEditConnection();
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Edit connection</span>
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
            onClick={() => {
              setMenuOpen(false);
              onDeleteConnection();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            <span>Delete connection</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StageSection({
  stage,
  index,
  totalStages,
  mapConnections,
  landmarks,
  selection,
  onMove,
  onUpdateName,
  onDelete,
  onToggleConnectionDirection,
  onUpdateConnectionTitle,
  onRemoveConnection,
  onAddConnections,
  onEditConnection,
  onDeleteConnection,
  onCreateOnTheFly,
}: {
  stage: ProcessStage;
  index: number;
  totalStages: number;
  mapConnections: Record<string, Connection>;
  landmarks: Record<string, Landmark>;
  selection: ProcessGraphSelection | null;
  onMove: (offset: number) => void;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onToggleConnectionDirection: (stageConnectionId: string) => void;
  onUpdateConnectionTitle: (stageConnectionId: string, title: string) => void;
  onRemoveConnection: (stageConnectionId: string) => void;
  onAddConnections: (connectionIds: string[]) => void;
  onEditConnection: (connectionId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onCreateOnTheFly?: (stageId: string) => void;
}) {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [quickSelect, setQuickSelect] = useState('');

  const connLabel = (connectionId: string) => {
    const connection = mapConnections?.[connectionId];
    if (!connection) return `Missing connection (${connectionId})`;
    const orig = landmarks?.[connection.originId]?.name ?? connection.originId;
    const dest = landmarks?.[connection.targetId]?.name ?? connection.targetId;
    return `${orig} → ${dest}${connection.name ? ` (${connection.name})` : ''}`;
  };

  const existingIds = useMemo(() => new Set(stage.connections.map((c) => c.connectionId)), [stage.connections]);

  const quickOptions = useMemo(() => {
    return Object.values(mapConnections ?? {});
  }, [mapConnections]);

  return (
    <section className="rounded-md border border-border bg-secondary/30 p-3.5 space-y-3">
      <BatchAddConnectionsModal
        open={showBatchModal}
        onOpenChange={setShowBatchModal}
        stageName={stage.name || `Stage ${index + 1}`}
        mapConnections={mapConnections}
        landmarks={landmarks}
        existingIds={existingIds}
        onAdd={onAddConnections}
        onCreateOnTheFly={() => onCreateOnTheFly?.(stage.id)}
      />

      {/* Stage Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/20 text-primary text-xs font-bold shrink-0">
            {index + 1}
          </span>
          <Input
            value={stage.name ?? ''}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder={`Stage ${index + 1} name`}
            aria-label={`Stage ${index + 1} name`}
            className="h-7 text-xs font-semibold max-w-xs bg-background/60"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Move stage up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            type="button"
            disabled={index === totalStages - 1}
            onClick={() => onMove(1)}
            title="Move stage down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-2 text-xs"
            type="button"
            onClick={onDelete}
            title="Delete this stage"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Connections List */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground uppercase font-mono tracking-wider">
          <span>Connections ({stage.connections.length})</span>
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="text-primary hover:underline text-[11px] font-sans font-medium flex items-center gap-1 cursor-pointer"
          >
            <Layers className="h-3 w-3" /> Batch add
          </button>
        </div>

        {stage.connections.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-1">No connections in this stage.</p>
        ) : (
          <div className="space-y-1.5">
            {stage.connections.map((c) => {
              const isSelected =
                selection?.type === 'connection' &&
                selection.stageId === stage.id &&
                selection.stageConnectionId === c.id;

              return (
                <CompactConnectionRow
                  key={c.id}
                  connection={c}
                  label={connLabel(c.connectionId)}
                  isSelected={isSelected}
                  onToggleDirection={() => onToggleConnectionDirection(c.id)}
                  onUpdateTitle={(title) => onUpdateConnectionTitle(c.id, title)}
                  onRemove={() => onRemoveConnection(c.id)}
                  onEditConnection={() => onEditConnection(c.connectionId)}
                  onDeleteConnection={() => onDeleteConnection(c.connectionId)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Add Connection Bar */}
      <div className="pt-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-50 flex items-center gap-1.5">
          <select
            className="w-full rounded-md border border-input bg-background px-2.5 h-7 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            value={quickSelect}
            aria-label="Existing connection"
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__CREATE_ON_THE_FLY__') {
                onCreateOnTheFly?.(stage.id);
                setQuickSelect('');
              } else if (val) {
                onAddConnections([val]);
                setQuickSelect('');
              }
            }}
          >
            <option value="">+ Add connection…</option>
            <option value="__CREATE_ON_THE_FLY__">+ Create connection on the fly…</option>
            {quickOptions.map((c) => (
              <option key={c.id} value={c.id} disabled={existingIds.has(c.id)}>
                {connLabel(c.id)} {existingIds.has(c.id) ? '(Already added)' : ''}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="h-7 text-xs px-2.5"
          onClick={() => setShowBatchModal(true)}
        >
          <Layers className="h-3 w-3 mr-1" /> Batch picker
        </Button>
      </div>
    </section>
  );
}

export default function ProcessDesignView() {
  const { id = '', processId } = useParams<{ id: string; processId?: string }>();
  const navigate = useNavigate();
  const map = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const processes = useMapStore((s) => s.processes);
  const fetched = useMapStore((s) => s.processesFetched);
  const setProcesses = useMapStore((s) => s.setProcesses);
  const setFetched = useMapStore((s) => s.setProcessesFetched);

  const [loading, setLoading] = useState(!fetched);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  // Process list creation inputs
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessDesc, setNewProcessDesc] = useState('');

  // Selected process draft state
  const [draftProcess, setDraftProcess] = useState<Process | null>(null);
  const [baselineString, setBaselineString] = useState<string>('');
  const [selection, setSelection] = useState<ProcessGraphSelection | null>(null);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [extraCanvasLandmarkIds, setExtraCanvasLandmarkIds] = useState<string[]>([]);
  const [activeTargetStageId, setActiveTargetStageId] = useState<string>('');
  const [elementSearch, setElementSearch] = useState('');
  const [showElementsList, setShowElementsList] = useState(true);
  const [canvasNotice, setCanvasNotice] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [deletingConnId, setDeletingConnId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [connActionBusy, setConnActionBusy] = useState(false);
  const [createConnModal, setCreateConnModal] = useState<{
    open: boolean;
    sourceId: string | null;
    targetId: string | null;
    stageId?: string;
  }>({ open: false, sourceId: null, targetId: null });
  const createConnRef = useRef<{ sourceId: string | null; targetId: string | null }>({
    sourceId: null,
    targetId: null,
  });

  const base = `/session/${encodeURIComponent(id)}/process-design`;
  const remoteProcess = useMemo(() => processes.find((p) => p.id === processId), [processes, processId]);

  // Synchronize draft with remote when not dirty or when switching process
  useEffect(() => {
    if (remoteProcess) {
      const serialized = JSON.stringify(remoteProcess);
      const isDirty = draftProcess !== null && JSON.stringify(draftProcess) !== baselineString;
      if (!isDirty || baselineString === '' || draftProcess?.id !== remoteProcess.id) {
        setBaselineString(serialized);
        setDraftProcess(JSON.parse(serialized) as Process);
      }
    } else {
      setDraftProcess(null);
      setBaselineString('');
    }
  }, [remoteProcess]);

  const isDirty = useMemo(() => {
    if (!draftProcess || !baselineString) return false;
    return JSON.stringify(draftProcess) !== baselineString;
  }, [draftProcess, baselineString]);

  const isConflict = useMemo(() => {
    if (!isDirty || !remoteProcess) return false;
    return JSON.stringify(remoteProcess) !== baselineString;
  }, [isDirty, remoteProcess, baselineString]);

  useEffect(() => {
    if (!id || fetched) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    fetchProcesses(id)
      .then((data) => {
        if (active && !useMapStore.getState().processesFetched) {
          setProcesses(data);
          setFetched(true);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load processes');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, fetched, retry, setProcesses, setFetched]);

  const action: Action = async (request) => {
    setBusy(true);
    setError('');
    try {
      const result = await request();
      setProcesses(result);
      setFetched(true);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProcess = async () => {
    if (!draftProcess || !id) return;
    const sortedStages = [...draftProcess.stages]
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({
        id: s.id.startsWith('stage-') ? undefined : s.id,
        name: s.name?.trim() || undefined,
        order: idx,
        connections: s.connections.map((c) => ({
          id: c.id.startsWith('conn-') ? undefined : c.id,
          connectionId: c.connectionId,
          title: c.title?.trim() || undefined,
          direction: c.direction,
        })),
      }));

    const result = await action(() =>
      saveProcess(id, draftProcess.id, {
        name: draftProcess.name.trim(),
        description: draftProcess.description || undefined,
        stages: sortedStages,
      })
    );

    if (result) {
      const updated = result.find((p) => p.id === draftProcess.id);
      if (updated) {
        setBaselineString(JSON.stringify(updated));
        setDraftProcess(JSON.parse(JSON.stringify(updated)) as Process);
      }
    }
  };

  const handleDiscard = () => {
    if (remoteProcess) {
      setBaselineString(JSON.stringify(remoteProcess));
      setDraftProcess(JSON.parse(JSON.stringify(remoteProcess)) as Process);
    }
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to save changes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (isDirty && !busy) {
          e.preventDefault();
          void handleSaveProcess();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, busy, draftProcess, id]);

  // Stage draft operations
  const handleMoveStage = (index: number, offset: number) => {
    if (!draftProcess) return;
    const stages = [...draftProcess.stages].sort((a, b) => a.order - b.order);
    const target = index + offset;
    if (target < 0 || target >= stages.length) return;
    const [moved] = stages.splice(index, 1);
    stages.splice(target, 0, moved);
    const updated = stages.map((s, idx) => ({ ...s, order: idx }));
    setDraftProcess({ ...draftProcess, stages: updated });
  };

  const handleUpdateStageName = (stageId: string, name: string) => {
    if (!draftProcess) return;
    setDraftProcess({
      ...draftProcess,
      stages: draftProcess.stages.map((s) => (s.id === stageId ? { ...s, name } : s)),
    });
  };

  const handleDeleteStage = (stageId: string) => {
    if (!draftProcess) return;
    const remaining = draftProcess.stages
      .filter((s) => s.id !== stageId)
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx }));
    setDraftProcess({ ...draftProcess, stages: remaining });
    if (activeTargetStageId === stageId) {
      setActiveTargetStageId('');
    }
    if (selection && selection.type === 'connection' && selection.stageId === stageId) {
      setSelection(null);
    }
  };

  const handleAddStage = (name: string) => {
    if (!draftProcess) return;
    const newStage: ProcessStage = {
      id: 'stage-' + Math.random().toString(36).slice(2, 9),
      name: name.trim() || undefined,
      order: draftProcess.stages.length,
      connections: [],
    };
    setDraftProcess({ ...draftProcess, stages: [...draftProcess.stages, newStage] });
  };

  // Connection draft operations
  const handleAddConnectionsToStage = (stageId: string, connectionIds: string[]) => {
    if (!draftProcess) return;
    setDraftProcess({
      ...draftProcess,
      stages: draftProcess.stages.map((s) => {
        if (s.id !== stageId) return s;
        const existing = new Set(s.connections.map((c) => c.connectionId));
        const added: StageConnection[] = connectionIds
          .filter((cid) => !existing.has(cid))
          .map((cid) => ({
            id: 'conn-' + Math.random().toString(36).slice(2, 9),
            connectionId: cid,
            direction: 'FORWARD',
          }));
        return { ...s, connections: [...s.connections, ...added] };
      }),
    });
  };

  const handleToggleConnectionDirection = (stageId: string, stageConnId: string) => {
    if (!draftProcess) return;
    const nextDir: Record<StageConnectionDirection, StageConnectionDirection> = {
      FORWARD: 'REVERSE',
      REVERSE: 'BIDIRECTIONAL',
      BIDIRECTIONAL: 'FORWARD',
    };
    setDraftProcess({
      ...draftProcess,
      stages: draftProcess.stages.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          connections: s.connections.map((c) =>
            c.id === stageConnId ? { ...c, direction: nextDir[c.direction] || 'FORWARD' } : c
          ),
        };
      }),
    });
  };

  const handleUpdateConnectionTitle = (stageId: string, stageConnId: string, title: string) => {
    if (!draftProcess) return;
    setDraftProcess({
      ...draftProcess,
      stages: draftProcess.stages.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          connections: s.connections.map((c) =>
            c.id === stageConnId ? { ...c, title: title || undefined } : c
          ),
        };
      }),
    });
  };

  const handleRemoveConnection = (stageId: string, stageConnId: string) => {
    if (!draftProcess) return;
    setDraftProcess({
      ...draftProcess,
      stages: draftProcess.stages.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          connections: s.connections.filter((c) => c.id !== stageConnId),
        };
      }),
    });
  };

  const handleSaveConnectionEdit = async (
    type: ConnectionType,
    name?: string,
    description?: string
  ) => {
    if (!editingConnId || !id) return;
    try {
      setConnActionBusy(true);
      const updatedMap = await editConnection(
        id,
        editingConnId,
        type,
        name,
        description,
        !name,
        !description
      );
      updateMap(updatedMap);
      setEditingConnId(null);
      setCanvasNotice({
        type: 'info',
        message: 'Connection updated.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update connection';
      setCanvasNotice({
        type: 'error',
        message: msg,
      });
    } finally {
      setConnActionBusy(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!deletingConnId || !id) return;
    const targetConnId = deletingConnId;
    try {
      setConnActionBusy(true);
      const updatedMap = await removeConnection(id, targetConnId);
      updateMap(updatedMap);
      setDeletingConnId(null);
      setDraftProcess((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          stages: prev.stages.map((s) => ({
            ...s,
            connections: s.connections.filter((c) => c.connectionId !== targetConnId),
          })),
        };
      });
      setCanvasNotice({
        type: 'info',
        message: 'Connection deleted from map and process stages.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete connection';
      setCanvasNotice({
        type: 'error',
        message: msg,
      });
    } finally {
      setConnActionBusy(false);
    }
  };

  const allMapLandmarks = useMemo(() => Object.values(map?.landmarks ?? {}), [map?.landmarks]);

  const processLandmarkIds = useMemo(() => {
    const ids = new Set<string>();
    if (draftProcess) {
      for (const s of draftProcess.stages) {
        for (const sc of s.connections) {
          const conn = map?.connections[sc.connectionId];
          if (conn) {
            ids.add(conn.originId);
            ids.add(conn.targetId);
          }
        }
      }
    }
    return ids;
  }, [draftProcess, map?.connections]);

  const canvasLandmarkIdSet = useMemo(() => {
    const set = new Set(processLandmarkIds);
    for (const id of extraCanvasLandmarkIds) {
      set.add(id);
    }
    return set;
  }, [processLandmarkIds, extraCanvasLandmarkIds]);

  const filteredElements = useMemo(() => {
    const q = elementSearch.trim().toLowerCase();
    if (!q) return allMapLandmarks;
    return allMapLandmarks.filter(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        (lm.type && lm.type.toLowerCase().includes(q))
    );
  }, [allMapLandmarks, elementSearch]);

  const handleConnectNodes = (sourceId: string, targetId: string) => {
    if (!draftProcess) return;
    const allMapConns = Object.values(map?.connections ?? {});
    const sourceLmName = map?.landmarks[sourceId]?.name ?? sourceId;
    const targetLmName = map?.landmarks[targetId]?.name ?? targetId;

    let foundConn = allMapConns.find((c) => c.originId === sourceId && c.targetId === targetId);
    let direction: StageConnectionDirection = 'FORWARD';

    if (!foundConn) {
      foundConn = allMapConns.find((c) => c.originId === targetId && c.targetId === sourceId);
      if (foundConn) {
        direction = 'REVERSE';
      }
    }

    if (!foundConn) {
      createConnRef.current = { sourceId, targetId };
      setCreateConnModal({
        open: true,
        sourceId,
        targetId,
        stageId: activeTargetStageId || draftProcess.stages[0]?.id,
      });
      return;
    }

    // Determine target stage
    let currentStages = [...draftProcess.stages].sort((a, b) => a.order - b.order);
    let targetStage = currentStages.find((s) => s.id === activeTargetStageId);

    if (currentStages.length === 0) {
      const newStage: ProcessStage = {
        id: 'stage-' + Math.random().toString(36).slice(2, 9),
        name: 'Stage 1',
        order: 0,
        connections: [],
      };
      currentStages.push(newStage);
      targetStage = newStage;
      setActiveTargetStageId(newStage.id);
    } else if (!targetStage) {
      targetStage = currentStages[0];
    }

    const alreadyInStage = targetStage.connections.some((c) => c.connectionId === foundConn!.id);
    if (alreadyInStage) {
      setCanvasNotice({
        type: 'info',
        message: `Connection "${foundConn.name || sourceLmName + ' → ' + targetLmName}" is already in ${targetStage.name || 'Stage ' + (targetStage.order + 1)}.`,
      });
      return;
    }

    const newConn: StageConnection = {
      id: 'conn-' + Math.random().toString(36).slice(2, 9),
      connectionId: foundConn.id,
      direction,
    };

    const updatedStages = currentStages.map((s) =>
      s.id === targetStage!.id ? { ...s, connections: [...s.connections, newConn] } : s
    );

    setDraftProcess({ ...draftProcess, stages: updatedStages });
    setCanvasNotice({
      type: 'info',
      message: `Connected "${sourceLmName}" → "${targetLmName}" in ${targetStage.name || 'Stage ' + (targetStage.order + 1)}.`,
    });
  };

  const handleOpenCreateConnectionDialog = (stageId?: string) => {
    createConnRef.current = { sourceId: null, targetId: null };
    setCreateConnModal({
      open: true,
      sourceId: null,
      targetId: null,
      stageId: stageId || activeTargetStageId || draftProcess?.stages[0]?.id,
    });
  };

  const handleConnectionCreated = (updatedMap: SessionState, targetStageId?: string) => {
    updateMap(updatedMap);
    const sourceId = createConnRef.current.sourceId;
    const targetId = createConnRef.current.targetId;
    createConnRef.current = { sourceId: null, targetId: null };
    setCreateConnModal({ open: false, sourceId: null, targetId: null });

    if (!draftProcess) return;

    let createdConn: Connection | undefined;
    if (sourceId && targetId) {
      createdConn = Object.values(updatedMap.connections ?? {}).find(
        (c) =>
          (c.originId === sourceId && c.targetId === targetId) ||
          (c.originId === targetId && c.targetId === sourceId)
      );
    }
    if (!createdConn) {
      const oldConnIds = new Set(Object.keys(map?.connections ?? {}));
      createdConn = Object.values(updatedMap.connections ?? {}).find((c) => !oldConnIds.has(c.id));
    }

    if (!createdConn) return;

    if (targetStageId === '__NONE__') {
      setCanvasNotice({
        type: 'info',
        message: 'Connection created on map.',
      });
      return;
    }

    const direction: StageConnectionDirection =
      sourceId && createdConn.originId === sourceId
        ? 'FORWARD'
        : sourceId && createdConn.targetId === sourceId
        ? 'REVERSE'
        : 'FORWARD';

    const sourceLmName = updatedMap.landmarks[createdConn.originId]?.name ?? createdConn.originId;
    const targetLmName = updatedMap.landmarks[createdConn.targetId]?.name ?? createdConn.targetId;

    let curStages = [...draftProcess.stages].sort((a, b) => a.order - b.order);
    let resolvedStage: ProcessStage | undefined;
    if (targetStageId === '__NEW_STAGE__' || curStages.length === 0) {
      resolvedStage = {
        id: 'stage-' + Math.random().toString(36).slice(2, 9),
        name: `Stage ${curStages.length + 1}`,
        order: curStages.length,
        connections: [],
      };
    } else if (targetStageId) {
      resolvedStage = curStages.find((s) => s.id === targetStageId);
    }
    if (!resolvedStage) {
      resolvedStage = curStages.find((s) => s.id === activeTargetStageId) || curStages[0];
    }
    const targetStageName = resolvedStage?.name || (resolvedStage ? `Stage ${resolvedStage.order + 1}` : 'Stage 1');

    setDraftProcess((prev) => {
      if (!prev) return prev;
      let stages = [...prev.stages].sort((a, b) => a.order - b.order);
      let tStage: ProcessStage | undefined;

      if (targetStageId === '__NEW_STAGE__' || stages.length === 0) {
        const newStage: ProcessStage = resolvedStage ?? {
          id: 'stage-' + Math.random().toString(36).slice(2, 9),
          name: `Stage ${stages.length + 1}`,
          order: stages.length,
          connections: [],
        };
        stages.push(newStage);
        tStage = newStage;
        setActiveTargetStageId(newStage.id);
      } else if (targetStageId) {
        tStage = stages.find((s) => s.id === targetStageId);
      }

      if (!tStage) {
        tStage = stages.find((s) => s.id === activeTargetStageId) || stages[0];
      }

      if (!tStage) return prev;

      const alreadyInStage = tStage.connections.some((c) => c.connectionId === createdConn!.id);
      if (alreadyInStage) return prev;

      const newConn: StageConnection = {
        id: 'conn-' + Math.random().toString(36).slice(2, 9),
        connectionId: createdConn!.id,
        direction,
      };

      const updatedStages = stages.map((s) =>
        s.id === tStage!.id ? { ...s, connections: [...s.connections, newConn] } : s
      );

      return { ...prev, stages: updatedStages };
    });

    setCanvasNotice({
      type: 'info',
      message: `Created connection and linked "${sourceLmName}" → "${targetLmName}" in ${targetStageName}.`,
    });
  };

  const handleAddElementToCanvas = (landmarkId: string) => {
    if (!extraCanvasLandmarkIds.includes(landmarkId)) {
      setExtraCanvasLandmarkIds((prev) => [...prev, landmarkId]);
    }
    const lmName = map?.landmarks[landmarkId]?.name ?? landmarkId;
    setCanvasNotice({
      type: 'info',
      message: `Added "${lmName}" to canvas. Drag its ● handle to connect it to other landmarks.`,
    });
  };

  const handleDropLandmark = (landmarkId: string) => {
    handleAddElementToCanvas(landmarkId);
  };

  if (loading && !fetched) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Loading processes…
      </div>
    );
  }

  if (!fetched) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div role="alert" className="flex flex-col items-center gap-3 text-center max-w-sm">
          <p className="text-sm text-destructive">{error || 'Unable to load processes.'}</p>
          <Button size="sm" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stages = draftProcess ? [...draftProcess.stages].sort((a, b) => a.order - b.order) : [];

  const deletingStage = deletingStageId ? draftProcess?.stages.find((s) => s.id === deletingStageId) ?? null : null;
  const deletingStageIndex =
    deletingStage && draftProcess
      ? Math.max(0, [...draftProcess.stages].sort((a, b) => a.order - b.order).findIndex((s) => s.id === deletingStage.id))
      : 0;

  const editingConn = editingConnId ? (map?.connections ?? {})[editingConnId] ?? null : null;
  const editingOriginName = editingConn ? (map?.landmarks[editingConn.originId]?.name ?? editingConn.originId) : '';
  const editingTargetName = editingConn ? (map?.landmarks[editingConn.targetId]?.name ?? editingConn.targetId) : '';

  const deletingConn = deletingConnId ? (map?.connections ?? {})[deletingConnId] ?? null : null;
  const deletingOriginName = deletingConn ? (map?.landmarks[deletingConn.originId]?.name ?? deletingConn.originId) : '';
  const deletingTargetName = deletingConn ? (map?.landmarks[deletingConn.targetId]?.name ?? deletingConn.targetId) : '';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <Popup title="How to use Process Design" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-md">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            <span className="text-foreground font-medium">Process Design</span> allows you to model ordered workflows across map landmarks without altering map coordinates or terrain.
          </p>
          <p>
            Each process consists of ordered <span className="text-foreground font-medium">stages</span>. You can batch-add connections, cycle directions with one click, and edit titles directly in the draft.
          </p>
          <p>
            The <span className="text-foreground font-medium">Process Graph</span> updates in real-time as you modify your draft. Click <span className="text-foreground font-medium">Save changes</span> (or press Ctrl+S) to commit your updates.
          </p>
        </div>
      </Popup>

      {draftProcess && (
        <EditProcessModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          name={draftProcess.name}
          description={draftProcess.description ?? ''}
          onSave={(name, description) => {
            setDraftProcess({ ...draftProcess, name, description });
          }}
        />
      )}

      <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3 border border-border shrink-0">
        {/* Card Header */}
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-md font-semibold text-foreground flex-1 min-w-0">
            <Workflow className="h-4 w-4 text-primary shrink-0" />
            {processId ? (
              <div className="flex items-center gap-2 truncate">
                <Link to={base} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                  Processes
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="truncate">{draftProcess?.name ?? remoteProcess?.name ?? 'Process'}</span>
              </div>
            ) : (
              <span>Process Design</span>
            )}
          </div>

          {processId && isDirty && (
            <div className="flex items-center gap-2 px-3 border-l border-border bg-primary/10">
              <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" /> Unsaved changes
              </span>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleSaveProcess}
                disabled={busy}
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
            </div>
          )}

          {processId && (
            <Link to={base} className={cardBtnCls} title="Back to all processes">
              <ArrowLeft className="h-3.5 w-3.5" /> All processes
            </Link>
          )}
          <Link to={`/session/${encodeURIComponent(id)}/processes`} className={cardBtnCls} title="Open X-Ray Map View">
            <Radiation className="h-3.5 w-3.5" /> X-Ray
          </Link>
          <button type="button" className={cardBtnCls} onClick={() => setShowHelpDialog(true)}>
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </button>
        </div>

        {/* Content */}
        {error && (
          <div role="alert" className="p-3 text-xs text-destructive bg-destructive/10 border-b border-destructive/20">
            {error}
          </div>
        )}

        <fieldset disabled={busy} className="space-y-0 min-w-0">
          {!processId ? (
            <div>
              {processes.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Workflow className="h-8 w-8 text-muted-foreground/40 mb-1" />
                  <p className="text-sm font-medium text-foreground">No processes yet.</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Create a process below to start designing stages and connecting your map elements.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {processes.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors">
                      <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                        <Link to={`${base}/${encodeURIComponent(p.id)}`} className="text-sm font-semibold text-primary hover:underline truncate">
                          {p.name}
                        </Link>
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>
                            {p.stages.length} {p.stages.length === 1 ? 'stage' : 'stages'}
                          </span>
                          <span>·</span>
                          <span>
                            {p.stages.reduce((acc, s) => acc + s.connections.length, 0)} connections
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => navigate(`${base}/${encodeURIComponent(p.id)}`)}>
                          Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 px-2.5 text-xs"
                          onClick={async () => {
                            if (window.confirm('Delete this process?')) {
                              await action(() => removeProcess(id, p.id));
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-secondary/15 border-t border-border">
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-primary" /> Create process
                </h2>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const before = new Set(useMapStore.getState().processes.map((p) => p.id));
                    const result = await action(() => createProcess(id, newProcessName.trim(), newProcessDesc || undefined));
                    if (!result) return;
                    const added = result.filter((p) => !before.has(p.id));
                    setNewProcessName('');
                    setNewProcessDesc('');
                    if (added.length === 1) navigate(`${base}/${encodeURIComponent(added[0].id)}`);
                    else setError('Process created, but its identity is ambiguous. Select it from the list.');
                  }}
                  className="flex flex-col gap-3 max-w-md"
                >
                  <label className="block text-xs font-medium text-foreground">
                    Name
                    <Input
                      required
                      value={newProcessName}
                      onChange={(e) => setNewProcessName(e.target.value)}
                      placeholder="e.g. Ingestion Pipeline"
                      className="h-8 text-sm mt-1"
                    />
                  </label>
                  <label className="block text-xs font-medium text-foreground">
                    Description
                    <Textarea
                      value={newProcessDesc}
                      onChange={(e) => setNewProcessDesc(e.target.value)}
                      placeholder="Optional process description…"
                      rows={2}
                      className="text-sm mt-1 resize-none"
                    />
                  </label>
                  <Button size="sm" className="h-8 self-start" disabled={!newProcessName.trim()}>
                    Create process
                  </Button>
                </form>
              </div>
            </div>
          ) : !draftProcess ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Process not found. It may have been deleted.{' '}
              <Link to={base} className="text-primary hover:underline ml-1">
                Back to all processes
              </Link>
            </div>
          ) : (
            <div>
              {/* Conflict banner */}
              {isConflict && (
                <div className="p-3 border-b border-amber-800/40">
                  <ConflictAlert reset={handleDiscard} />
                </div>
              )}

              {/* Process Info Overview Banner */}
              <div className="p-4 border-b border-border bg-secondary/15 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground truncate">{draftProcess.name}</h2>
                  {draftProcess.description ? (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{draftProcess.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No description provided.</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2.5 text-xs shrink-0"
                  onClick={() => setShowEditModal(true)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit details
                </Button>
              </div>

              {/* Process Graph & Elements Palette */}
              <div className="p-4 border-b border-border bg-secondary/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Process graph</h2>
                    <p className="text-xs text-muted-foreground">
                      Abstract diagram representing all stages and connections. Drag handles to connect nodes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {stages.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border rounded px-2 py-1">
                        <span className="font-medium text-foreground">Target stage:</span>
                        <select
                          aria-label="Target stage for canvas connections"
                          value={activeTargetStageId || (stages[0]?.id ?? '')}
                          onChange={(e) => setActiveTargetStageId(e.target.value)}
                          className="bg-transparent text-xs text-primary font-medium focus:outline-none cursor-pointer"
                        >
                          {stages.map((s, idx) => (
                            <option key={s.id} value={s.id} className="bg-card text-foreground">
                              {s.name || `Stage ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setShowElementsList((v) => !v)}
                    >
                      <Layers className="h-3.5 w-3.5 mr-1" />
                      {showElementsList ? 'Hide elements list' : 'Show elements list'} ({allMapLandmarks.length})
                    </Button>
                  </div>
                </div>

                {/* Canvas Feedback / Notice Banner */}
                {canvasNotice && (
                  <div
                    role="alert"
                    className={`text-xs rounded p-2.5 flex items-center justify-between gap-2 border ${
                      canvasNotice.type === 'error'
                        ? 'text-red-400 bg-red-950/40 border-red-800/40'
                        : 'text-cyan-300 bg-cyan-950/40 border-cyan-800/40'
                    }`}
                  >
                    <span>{canvasNotice.message}</span>
                    <button
                      type="button"
                      onClick={() => setCanvasNotice(null)}
                      aria-label="Dismiss message"
                      className="hover:opacity-80 cursor-pointer shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                  {/* Elements List Panel */}
                  {showElementsList && (
                    <div className="w-full lg:w-64 shrink-0 rounded border border-border bg-card/60 p-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> Map Elements
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {allMapLandmarks.length}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
                        <Input
                          className="h-7 pl-7 text-xs"
                          placeholder="Filter elements…"
                          value={elementSearch}
                          onChange={(e) => setElementSearch(e.target.value)}
                        />
                      </div>

                      <div className="max-h-60 overflow-y-auto divide-y divide-border/40 border border-border/60 rounded bg-background/40">
                        {filteredElements.length === 0 ? (
                          <p className="p-3 text-center text-xs text-muted-foreground">
                            {allMapLandmarks.length === 0 ? 'No landmarks on map.' : 'No matching elements.'}
                          </p>
                        ) : (
                          filteredElements.map((lm) => {
                            const onCanvas = canvasLandmarkIdSet.has(lm.id);
                            const lmGroup = lm.groupId ? (map?.groups ?? {})[lm.groupId] : undefined;
                            return (
                              <div
                                key={lm.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', lm.id);
                                  e.dataTransfer.setData('application/json', lm.id);
                                }}
                                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs transition-colors select-none ${
                                  onCanvas ? 'bg-secondary/20' : 'hover:bg-secondary/40'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <div className="truncate">
                                    <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                                      <span className="truncate">{lm.name}</span>

                                    </div>
                                    {lmGroup && (
                                        <span
                                            className="text-[9px] px-1 py-0.2 rounded font-mono truncate border shrink-0"
                                            style={{
                                              color: lmGroup.color,
                                              borderColor: `${lmGroup.color}60`,
                                              backgroundColor: `${lmGroup.color}15`,
                                            }}
                                        >
                                          {lmGroup.name}
                                        </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-1">
                                  {onCanvas ? (
                                    <span className="text-[10px] text-primary/80 font-mono px-1.5 py-0.5 rounded bg-primary/10">
                                      On canvas
                                    </span>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      type="button"
                                      aria-label={`Add ${lm.name} to canvas`}
                                      className="h-6 px-1.5 text-[11px] text-primary "
                                      onClick={() => handleAddElementToCanvas(lm.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-0.5" /> Add
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Drag an element into the canvas or click <span className="text-foreground font-medium">+ Add</span> to position it.
                      </p>
                    </div>
                  )}

                  {/* Process Graph Canvas */}
                  <div className="flex-1 min-w-0">
                    <ProcessGraph
                      process={draftProcess}
                      landmarks={allMapLandmarks}
                      connections={Object.values(map?.connections ?? {})}
                      groups={map?.groups ?? {}}
                      extraLandmarkIds={Array.from(canvasLandmarkIdSet)}
                      selection={selection}
                      onSelect={setSelection}
                      onConnectNodes={handleConnectNodes}
                      onDropLandmark={handleDropLandmark}
                      onEditConnection={(connId) => setEditingConnId(connId)}
                    />
                  </div>
                </div>
              </div>

              {/* Stages */}
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Stages</h2>
                  <span className="text-xs text-muted-foreground">
                    {stages.length} {stages.length === 1 ? 'stage' : 'stages'}
                  </span>
                </div>

                {stages.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No stages yet. Add a stage below to begin.</p>
                )}

                <div className="space-y-4">
                  {stages.map((stage, index) => (
                    <StageSection
                      key={stage.id}
                      stage={stage}
                      index={index}
                      totalStages={stages.length}
                      mapConnections={map?.connections ?? {}}
                      landmarks={map?.landmarks ?? {}}
                      selection={selection}
                      onMove={(offset) => handleMoveStage(index, offset)}
                      onUpdateName={(name) => handleUpdateStageName(stage.id, name)}
                      onDelete={() => setDeletingStageId(stage.id)}
                      onToggleConnectionDirection={(connId) => handleToggleConnectionDirection(stage.id, connId)}
                      onUpdateConnectionTitle={(connId, title) => handleUpdateConnectionTitle(stage.id, connId, title)}
                      onRemoveConnection={(connId) => handleRemoveConnection(stage.id, connId)}
                      onAddConnections={(connIds) => handleAddConnectionsToStage(stage.id, connIds)}
                      onEditConnection={(connId) => setEditingConnId(connId)}
                      onDeleteConnection={(connId) => setDeletingConnId(connId)}
                      onCreateOnTheFly={handleOpenCreateConnectionDialog}
                    />
                  ))}
                </div>

                {/* Add Stage Input */}
                <div className="p-3.5 rounded-md border border-border bg-secondary/20 max-w-md">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Add stage</h3>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddStage(newStageName);
                      setNewStageName('');
                    }}
                    className="flex items-end gap-2"
                  >
                    <label className="flex-1 block text-xs font-medium text-foreground">
                      New stage name
                      <Input
                        className="h-8 text-sm mt-1"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        placeholder="e.g. Verification"
                      />
                    </label>
                    <Button size="sm" className="h-8">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add stage
                    </Button>
                  </form>
                </div>
              </div>

              {/* Bottom Card Actions: Save Changes / Discard / Edit Details & Delete Process */}
              <div className="p-4 border-t border-border bg-secondary/15 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    disabled={!isDirty || busy}
                    onClick={handleSaveProcess}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" /> Save changes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs border border-border"
                    disabled={!isDirty || busy}
                    onClick={handleDiscard}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Discard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowEditModal(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit process details
                  </Button>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={async () => {
                    if (window.confirm('Delete this process?') && (await action(() => removeProcess(id, draftProcess.id)))) {
                      navigate(base);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete process
                </Button>
              </div>
            </div>
          )}
        </fieldset>
      </div>

      <CreateConnectionDialog
        open={createConnModal.open}
        onClose={() => setCreateConnModal({ open: false, sourceId: null, targetId: null })}
        mapId={id}
        landmarks={allMapLandmarks}
        existingConnections={Object.values(map?.connections ?? {})}
        defaultOrigin={createConnModal.sourceId ? map?.landmarks[createConnModal.sourceId] ?? null : null}
        defaultTarget={createConnModal.targetId ? map?.landmarks[createConnModal.targetId] ?? null : null}
        stages={stages}
        defaultStageId={createConnModal.stageId || activeTargetStageId || stages[0]?.id}
        onCreated={handleConnectionCreated}
      />

      <EditConnectionModal
        open={Boolean(editingConnId)}
        onOpenChange={(open) => {
          if (!open) setEditingConnId(null);
        }}
        connection={editingConn}
        originName={editingOriginName}
        targetName={editingTargetName}
        onSave={handleSaveConnectionEdit}
        loading={connActionBusy}
      />

      <DeleteConnectionConfirmModal
        open={Boolean(deletingConnId)}
        onOpenChange={(open) => {
          if (!open) setDeletingConnId(null);
        }}
        connection={deletingConn}
        originName={deletingOriginName}
        targetName={deletingTargetName}
        onConfirm={handleDeleteConnection}
        loading={connActionBusy}
      />

      <DeleteStageConfirmModal
        open={Boolean(deletingStageId && deletingStage)}
        onOpenChange={(open) => {
          if (!open) setDeletingStageId(null);
        }}
        stageName={deletingStage?.name}
        stageIndex={deletingStageIndex}
        connectionCount={deletingStage?.connections.length ?? 0}
        onConfirm={() => {
          if (deletingStageId) {
            handleDeleteStage(deletingStageId);
            setDeletingStageId(null);
          }
        }}
      />
    </div>
  );
}
