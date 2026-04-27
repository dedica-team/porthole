import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, LogIn, Eye, AlertCircle, Mountain, Waves, Layers, X, Trash2 } from 'lucide-react';
import { listMaps, createMap, joinMap, requestJoin, deleteMap, adminJoinMap } from '@/api/mapApi';
import type { MapType, MapSize } from '@/api/mapApi';
import type { CollaborationMode } from '@/types/map';
import { COLLABORATION_MODE_LABELS } from '@/types/map';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import AppShell from '@/components/AppShell/AppShell';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ── tiny inline map-type picker dialog ───────────────────────────────────────

interface MapTypeOption {
  type: MapType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const MAP_TYPE_OPTIONS: MapTypeOption[] = [
  {
    type: 'LAND',
    label: 'Land',
    icon: <Mountain className="h-6 w-6" />,
    description: 'Rolling hills, forests and rocky terrain.',
  },
  {
    type: 'SEA',
    label: 'Sea',
    icon: <Waves className="h-6 w-6" />,
    description: 'Open ocean dotted with small islands of beach, rock, grass and swamp.',
  },
  {
    type: 'BLANK',
    label: 'Blank',
    icon: <Layers className="h-6 w-6" />,
    description: 'A flat grass-only canvas. Paint every tile yourself from scratch.',
  },
];

const MAP_SIZE_OPTIONS: { size: MapSize; label: string; detail: string }[] = [
  { size: 'SMALL',  label: 'Small',  detail: '25 × 25' },
  { size: 'MEDIUM', label: 'Medium', detail: '50 × 50' },
  { size: 'LARGE',  label: 'Large',  detail: '80 × 80' },
];

function NewSessionDialog({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: (type: MapType, size: MapSize, mode: CollaborationMode) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<MapType>('LAND');
  const [size, setSize]         = useState<MapSize>('MEDIUM');
  const [mode, setMode]         = useState<CollaborationMode>('OPEN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col gap-5 bg-card border border-border shadow-2xl w-full max-w-md mx-4 p-6"
        style={{ boxShadow: '0 0 40px rgba(0,240,255,0.15), inset 0 0 0 1px rgba(0,240,255,0.07)', borderColor: 'hsl(185,100%,22%)' }}
      >
        {/* close */}
        <button
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h2 className="text-base font-semibold text-foreground tron-logo">New Session</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Choose a map type and size to initialise</p>
        </div>

        {/* type cards */}
        <div className="grid grid-cols-3 gap-3">
          {MAP_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={[
                'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors focus:outline-none cursor-pointer',
                selected === opt.type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:bg-muted/50',
              ].join(' ')}
            >
              <span className={selected === opt.type ? 'text-primary' : 'text-muted-foreground'}>
                {opt.icon}
              </span>
              <span className="text-xs font-semibold">{opt.label}</span>
              <span className="text-[10px] leading-tight">{opt.description}</span>
            </button>
          ))}
        </div>

        {/* size picker */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">Map size</p>
          <div className="grid grid-cols-3 gap-2">
            {MAP_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.size}
                onClick={() => setSize(opt.size)}
              className={[
                'flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-center transition-colors focus:outline-none cursor-pointer',
                size === opt.size
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:bg-muted/50',
                ].join(' ')}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {/* collaboration mode */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">Collaboration mode</p>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CollaborationMode)}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {(Object.keys(COLLABORATION_MODE_LABELS) as CollaborationMode[]).map((m) => (
              <option key={m} value={m}>
                {COLLABORATION_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(selected, size, mode)} disabled={loading} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Join Request confirmation dialog ─────────────────────────────────────────

function JoinRequestDialog({
  mapName,
  onConfirm,
  onClose,
  loading,
}: {
  mapName: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col gap-4 bg-card border border-border shadow-2xl w-full max-w-sm mx-4 p-6"
        style={{ boxShadow: '0 0 40px rgba(0,240,255,0.15), inset 0 0 0 1px rgba(0,240,255,0.07)', borderColor: 'hsl(185,100%,22%)' }}
      >
        <button
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <h2 className="text-base font-semibold text-foreground">Request to Join</h2>
          <p className="text-xs text-muted-foreground mt-1">
            <strong className="text-foreground">{mapName}</strong> requires approval from a collaborator.
            Send a join request to the map owner?
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={loading} className="gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── LobbyPage ────────────────────────────────────────────────────────────────

export default function LobbyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [joinRequestMap, setJoinRequestMap] = useState<{ id: string; name: string } | null>(null);
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const pollFailCountRef = useRef(0);

  const maps = useMapStore((s) => s.maps);
  const setMaps = useMapStore((s) => s.setMaps);
  const setCurrentMap = useMapStore((s) => s.setCurrentMap);
  const userId = useAuthStore((s) => s.userId);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const [deleteConfirmMapId, setDeleteConfirmMapId] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleDelete = async (mapId: string) => {
    setLoading(true);
    setError('');
    setDeleteConfirmMapId(null);
    try {
      await deleteMap(mapId);
      setMaps(maps.filter((m) => m.id !== mapId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminJoin = async (mapId: string) => {
    setLoading(true);
    setError('');
    try {
      const map = await adminJoinMap(mapId);
      setCurrentMap(map);
      navigate(`/map/${map.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await listMaps();
        if (active) {
          setMaps(list);
          pollFailCountRef.current = 0;
          setPollError(false);
        }
      } catch {
        pollFailCountRef.current += 1;
        if (active && pollFailCountRef.current >= 3) {
          setPollError(true);
        }
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [setMaps]);

  const handleCreate = async (mapType: MapType, mapSize: MapSize, collaborationMode: CollaborationMode) => {
    setLoading(true);
    setError('');
    setShowDialog(false);
    try {
      const map = await createMap(mapType, mapSize, collaborationMode);
      setCurrentMap(map);
      navigate(`/map/${map.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (mapId: string) => {
    setLoading(true);
    setError('');
    try {
      const map = await joinMap(mapId);
      setCurrentMap(map);
      navigate(`/map/${map.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClick = (map: { id: string; name?: string; collaborationMode?: string }) => {
    if (map.collaborationMode === 'REQUEST') {
      setJoinRequestMap({ id: map.id, name: map.name ?? 'Unnamed Map' });
    } else {
      handleJoin(map.id);
    }
  };

  const handleSendJoinRequest = async () => {
    if (!joinRequestMap) return;
    setLoading(true);
    setError('');
    setJoinRequestMap(null);
    try {
      await requestJoin(joinRequestMap.id);
      setRequestSent(joinRequestMap.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send join request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      {showDialog && (
        <NewSessionDialog
          onConfirm={handleCreate}
          onClose={() => setShowDialog(false)}
          loading={loading}
        />
      )}

      {joinRequestMap && (
        <JoinRequestDialog
          mapName={joinRequestMap.name}
          onConfirm={handleSendJoinRequest}
          onClose={() => setJoinRequestMap(null)}
          loading={loading}
        />
      )}

      <div className="flex flex-col h-full max-w-2xl mx-auto px-6 py-6 gap-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground tron-logo">Sessions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect to an active session or initialise a new
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowDialog(true)}
            disabled={loading}
            className="gap-1.5 uppercase tracking-widest text-[10px]"
          >
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </div>

        <Separator className="bg-border" />

        {pollError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Lost connection to server. Session list may be outdated.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
            <img
              src="/logo.svg"
              alt="Porthole logo"
              width={48}
              height={48}
              style={{ filter: 'drop-shadow(0 0 8px hsl(185,100%,54%))' }}
            />
            <p className="tron-logo text-xs">No sessions initialised. Create one to enter the grid.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 w-full">
              {maps.map((map) => (
                <div
                  key={map.id}
                  className="flex items-center justify-between px-4 py-3 bg-card border border-border transition-all"
                  style={{ boxShadow: '0 0 0 transparent', transition: 'box-shadow 0.2s ease, border-color 0.2s ease' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(0,240,255,0.2), inset 0 0 8px rgba(0,240,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'hsl(185,100%,40%)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = '';
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        {map.name ?? 'Unnamed Map'}
                      </span>
                      {map.description && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-55">
                          {map.description}
                        </span>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground opacity-60">
                          #{map.id.slice(0, 8)}
                        </span>
                        <span className="text-muted-foreground opacity-40">·</span>
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {map.collaborators.length} collaborator
                          {map.collaborators.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Admin: delete session */}
                    {isAdmin && (
                      deleteConfirmMapId === map.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-destructive">Delete?</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive/80" disabled={loading} onClick={() => handleDelete(map.id)}>Yes</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDeleteConfirmMapId(null)}>No</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" disabled={loading} title="Delete session" onClick={() => setDeleteConfirmMapId(map.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs text-muted-foreground"
                      disabled={loading}
                      onClick={() => {
                        setCurrentMap(map);
                        navigate(`/map/${map.id}`);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {map.collaborators.some((c) => c.id === userId) ? 'Continue' : 'View'}
                    </Button>
                    {/* Admin join bypasses collaboration mode */}
                    {isAdmin && !map.collaborators.some((c) => c.id === userId) && (
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={loading} onClick={() => handleAdminJoin(map.id)}>
                        <LogIn className="h-3.5 w-3.5" />
                        Join as Collaborator
                      </Button>
                    )}
                    {!isAdmin && !map.collaborators.some((c) => c.id === userId) && (() => {
                      const hasPending =
                        requestSent === map.id ||
                        (userId != null && map.joinRequests?.some((r) => r.userId === userId));
                      if (hasPending) {
                        return (
                          <span className="text-xs text-muted-foreground px-2">Request pending ⏳</span>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          disabled={loading}
                          onClick={() => handleJoinClick(map)}
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          Join as Collaborator
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </AppShell>
  );
}
