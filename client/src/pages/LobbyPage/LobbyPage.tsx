import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, LogIn, Eye, AlertCircle, Mountain, Waves, Layers, Trash2 } from 'lucide-react';
import { listMaps, createMap, joinMap, requestJoin, deleteMap, adminJoinMap } from '@/api/mapApi';
import type { MapType, MapSize } from '@/api/mapApi';
import type { CollaborationMode } from '@/types/session';
import { COLLABORATION_MODE_LABELS } from '@/types/session';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { setDefaultSessionId } from '@/utils/sessionCookies';
import AppShell from '@/components/AppShell/AppShell';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popup } from '@/components/ui/popup';
import { UserAvatar } from '@/components/ui/user-avatar';

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
  open,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean;
  onConfirm: (type: MapType, size: MapSize, mode: CollaborationMode) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<MapType>('LAND');
  const [size, setSize]         = useState<MapSize>('MEDIUM');
  const [mode, setMode]         = useState<CollaborationMode>('OPEN');

  return (
    <Popup
      title="New Session"
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground -mt-1">Choose a map type and size to initialise</p>

        {/* type cards */}
        <div className="grid grid-cols-3 gap-2">
          {MAP_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setSelected(opt.type)}
              className={[
                'flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors focus:outline-none cursor-pointer',
                selected === opt.type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:bg-muted/50',
              ].join(' ')}
            >
              <span className={selected === opt.type ? 'text-primary' : 'text-muted-foreground'}>
                {opt.icon}
              </span>
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-xs leading-tight">{opt.description}</span>
            </button>
          ))}
        </div>

        {/* size picker */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Map size</p>
          <div className="grid grid-cols-3 gap-2">
            {MAP_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.size}
                type="button"
                onClick={() => setSize(opt.size)}
                className={[
                  'flex flex-col items-center gap-0.5 rounded-lg border py-2 text-center transition-colors focus:outline-none cursor-pointer',
                  size === opt.size
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-border/70 hover:bg-muted/50',
                ].join(' ')}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {/* collaboration mode */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Collaboration mode</p>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CollaborationMode)}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {(Object.keys(COLLABORATION_MODE_LABELS) as CollaborationMode[]).map((m) => (
              <option key={m} value={m}>
                {COLLABORATION_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(selected, size, mode)} disabled={loading} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      </div>
    </Popup>
  );
}

// ── Join Request confirmation dialog ─────────────────────────────────────────

function JoinRequestDialog({
  open,
  mapName,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean;
  mapName: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Popup
      title="Request to Join"
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      className="max-w-sm"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{mapName}</strong> requires approval from a collaborator.
          Send a join request to the map owner?
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={loading} className="gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            Send Request
          </Button>
        </div>
      </div>
    </Popup>
  );
}

// ── LobbyPage ────────────────────────────────────────────────────────────────

const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

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
      if (userId) setDefaultSessionId(userId, map.id);
      navigate(`/session/${map.id}`);
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
      if (userId) setDefaultSessionId(userId, map.id);
      navigate(`/session/${map.id}`);
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
      if (userId) setDefaultSessionId(userId, map.id);
      navigate(`/session/${map.id}`);
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
      <NewSessionDialog
        open={showDialog}
        onConfirm={handleCreate}
        onClose={() => setShowDialog(false)}
        loading={loading}
      />

      <JoinRequestDialog
        open={!!joinRequestMap}
        mapName={joinRequestMap?.name ?? ''}
        onConfirm={handleSendJoinRequest}
        onClose={() => setJoinRequestMap(null)}
        loading={loading}
      />

      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">
          {/* Card header */}
          <div className="flex items-stretch border-b border-border shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground flex-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Sessions
            </div>
            <button
              className={cardBtnCls}
              onClick={() => setShowDialog(true)}
              disabled={loading}
              title="New Session"
            >
              <Plus className="h-3.5 w-3.5" />
              New Session
            </button>
          </div>

          {pollError && (
            <div className="px-4 py-3 shrink-0">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Lost connection to server. Session list may be outdated.</AlertDescription>
              </Alert>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 shrink-0">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {maps.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
              <img
                src="/logo.svg"
                alt="Porthole logo"
                width={48}
                height={48}
                style={{ filter: 'drop-shadow(0 0 8px hsl(var(--holo-indigo)))' }}
              />
              <p className="tron-logo text-sm">No sessions initialised. Create one to enter the grid.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {maps.map((map) => {
                const isMember = map.collaborators.some((c) => c.id === userId);
                return (
                  <div
                    key={map.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3.5 gap-3 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-base">
                          {map.name ?? 'Unnamed session'}
                        </span>
                      </div>
                      {map.description && (
                        <p className="text-sm text-muted-foreground">{map.description}</p>
                      )}
                      {map.collaborators.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">

                          {map.collaborators.map((c) => (
                            <UserAvatar
                              key={c.id}
                              username={c.username}
                              avatarUrl={c.avatarUrl}
                              title={c.username}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>0 collaborators</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {map.collaborationMode && (
                        <span className="text-xs px-1.5 py-0.5   bg-muted/20">
                          {COLLABORATION_MODE_LABELS[map.collaborationMode] ?? map.collaborationMode}
                        </span>
                      )}
                      <div className="flex flex-col items-stretch gap-2 w-full sm:w-56">

                      {isMember ? (
                        <Button
                          onClick={() => {
                            setCurrentMap(map);
                            if (userId) setDefaultSessionId(userId, map.id);
                            navigate(`/session/${map.id}`);
                          }}
                          disabled={loading}
                          className="gap-1.5 w-full"
                        >
                          <LogIn className="h-4 w-4" />
                          Continue
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5 "
                            disabled={loading}
                            onClick={() => {
                              setCurrentMap(map);
                              if (userId) setDefaultSessionId(userId, map.id);
                              navigate(`/session/${map.id}`);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View as guest
                          </Button>
                          {/* Admin join bypasses collaboration mode */}
                          {isAdmin && (
                            <Button className="gap-1.5" disabled={loading} onClick={() => handleAdminJoin(map.id)}>
                              <LogIn className="h-4 w-4" />
                              Join as collaborator
                            </Button>
                          )}
                          {!isAdmin && (() => {
                            const hasPending =
                              requestSent === map.id ||
                              (userId != null && map.joinRequests?.some((r) => r.userId === userId));
                            if (hasPending) {
                              return <span className="text-sm text-muted-foreground px-2">Request pending ⏳</span>;
                            }
                            return (
                              <Button
                                className="gap-1.5"
                                disabled={loading}
                                onClick={() => handleJoinClick(map)}
                              >
                                <LogIn className="h-4 w-4" />
                                Join as collaborator
                              </Button>
                            );
                          })()}
                          {/* Admin: delete session */}
                          {isAdmin && (deleteConfirmMapId === map.id ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm text-destructive">Delete?</span>
                                    <Button size="sm" variant="destructive" className="h-7 px-2 text-sm" disabled={loading} onClick={() => handleDelete(map.id)}>Yes</Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-sm" onClick={() => setDeleteConfirmMapId(null)}>No</Button>
                                  </div>
                              ) : (
                                  <Button size="sm" variant="destructive" className="gap-1.5" disabled={loading} title="Delete session" onClick={() => setDeleteConfirmMapId(map.id)}>
                                    <Trash2 className="h-3.5 w-3.5" /> Delete session (Admin)
                                  </Button>
                              )
                          )}
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
