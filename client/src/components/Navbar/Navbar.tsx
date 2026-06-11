import { useState } from 'react';
import { useNavigate, useLocation, useMatch } from 'react-router-dom';
import { LogOut, Copy, Check, BarChart2, Bell, Bus, Radiation, Download, Trash2, CheckSquare, Trees, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { editMap, setCollaborationMode, acceptJoinRequest, declineJoinRequest, logoutSession, exportMapJson, removeCollaborator } from '@/api/mapApi';
import type { CollaborationMode } from '@/types/session';
import { COLLABORATION_MODE_LABELS } from '@/types/session';
import type { RendererQualityProfile } from '@/components/HexGrid/renderQuality';

const RENDERER_QUALITY_LABELS: Record<RendererQualityProfile, string> = {
  high: 'High',
  balanced: 'Balanced',
  low: 'Low',
};

// ── NavTab ────────────────────────────────────────────────────────────────────
interface NavTab {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  /** When false the tab is hidden. Defaults to true. */
  visible?: boolean;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = useAuthStore((s) => s.username);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.userId);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const tagline = useAuthStore((s) => s.tagline);
  const currentMap = useMapStore((s) => s.currentMap);
  const updateMap = useMapStore((s) => s.updateMap);
  const rendererQualityProfile = useMapStore((s) => s.rendererQualityProfile);
  const setRendererQualityProfile = useMapStore((s) => s.setRendererQualityProfile);
  const isOnMap = location.pathname.startsWith('/session/');

  // ── Active-tab detection via route matching ───────────────────────────────
  // Each tab corresponds to a sub-route; useMatch drives the active highlight.
  const mapId = currentMap?.id;
  const matchMetrics      = useMatch('/session/:id/metrics');
  const matchMatrix       = useMatch('/session/:id/matrix');
  const matchChores       = useMatch('/session/:id/chores');
  const matchGreenkeeping = useMatch('/session/:id/greenkeeping');
  const matchProcesses    = useMatch('/session/:id/processes');
  const matchEditor       = useMatch('/session/:id/editor');
  const matchMapIndex     = useMatch('/session/:id/map');

  // Helper: navigate to a sub-route under the current map.
  const goTo = (sub: string | null) => {
    if (!mapId) return;
    navigate(`/session/${mapId}/${sub ?? 'map'}`);
  };

  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCollaborationMode, setEditCollaborationMode] = useState<CollaborationMode>('OPEN');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinReqLoading, setJoinReqLoading] = useState<string | null>(null);
  const [joinReqError, setJoinReqError] = useState('');
  const [removingCollaboratorId, setRemovingCollaboratorId] = useState<string | null>(null);
  const [removeCollabError, setRemoveCollabError] = useState('');

  const pendingRequests = (currentMap?.joinRequests ?? []);
  const hasPendingRequests = isCollaborator && pendingRequests.length > 0;

  const handleAcceptRequest = async (requestId: string) => {
    if (!currentMap) return;
    setJoinReqLoading(requestId);
    setJoinReqError('');
    try {
      const updated = await acceptJoinRequest(currentMap.id, requestId);
      updateMap(updated);
    } catch (err: unknown) {
      setJoinReqError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setJoinReqLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!currentMap) return;
    setJoinReqLoading(requestId);
    setJoinReqError('');
    try {
      const updated = await declineJoinRequest(currentMap.id, requestId);
      updateMap(updated);
    } catch (err: unknown) {
      setJoinReqError(err instanceof Error ? err.message : 'Failed to decline request');
    } finally {
      setJoinReqLoading(null);
    }
  };

  const handlePopoverOpen = (open: boolean) => {
    if (open && currentMap) {
      setEditName(currentMap.name ?? '');
      setEditDescription(currentMap.description ?? '');
      setEditCollaborationMode(currentMap.collaborationMode ?? 'OPEN');
      setSaveError('');
    }
    setPopoverOpen(open);
  };

  const handleSave = async () => {
    if (!currentMap) return;
    setSaving(true);
    setSaveError('');
    try {
      let updated = await editMap(currentMap.id, editName || undefined, editDescription || undefined);
      if (editCollaborationMode !== (currentMap.collaborationMode ?? 'OPEN')) {
        updated = await setCollaborationMode(currentMap.id, editCollaborationMode);
      }
      updateMap(updated);
      setPopoverOpen(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyId = () => {
    if (!currentMap) return;
    navigator.clipboard.writeText(currentMap.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };


  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!currentMap) return;
    setRemovingCollaboratorId(collaboratorId);
    setRemoveCollabError('');
    try {
      const updated = await removeCollaborator(currentMap.id, collaboratorId);
      updateMap(updated);
    } catch (err: unknown) {
      setRemoveCollabError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      setRemovingCollaboratorId(null);
    }
  };

  const handleExport = async () => {
    if (!currentMap) return;
    try {
      const data = await exportMapJson(currentMap.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${currentMap.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    }
  };

  const handleLogout = async () => {    try {
      await logoutSession();
    } finally {
      logout();
      navigate('/');
    }
  };

  // ── Active-state predicates derived from current route ───────────────────
  const isMetricsActive      = !!matchMetrics;
  const isMatrixActive       = !!matchMatrix;
  const isChoresActive       = !!matchChores;
  const isGreenkeepingActive = !!matchGreenkeeping;
  const isEditorActive       = !!matchEditor;
  const isXRayActive         = !!matchProcesses;
  const isFlightActive       = !!matchMapIndex;

  // The active-tab bottom border class.
  const activeBorderCls = 'border-amber-400';

  const NAV_TABS: NavTab[] = [
    {
      id: 'metrics',
      label: 'Quality Metrics',
      tooltip: 'Manage quality metrics and goals',
      icon: <BarChart2 className="h-3.5 w-3.5" />,
      isActive: isMetricsActive,
      onClick: () => goTo('metrics'),
    },
    {
      id: 'matrix',
      label: 'Bus Matrix',
      tooltip: 'Who knows what',
      icon: <Bus className="h-3.5 w-3.5" />,
      isActive: isMatrixActive,
      onClick: () => goTo('matrix'),
    },
    {
      id: 'chores',
      label: 'Chores',
      tooltip: 'Chore todo lists per landmark',
      icon: <CheckSquare className="h-3.5 w-3.5" />,
      isActive: isChoresActive,
      onClick: () => goTo('chores'),
    },
    {
      id: 'greenkeeping',
      label: 'Greenkeeping',
      tooltip: 'Recurring group stewardship rotations',
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      isActive: isGreenkeepingActive,
      onClick: () => goTo('greenkeeping'),
    },
    {
      id: 'flight',
      label: 'Flight mode',
      tooltip: 'A 10.000ft view',
      icon: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        </svg>
      ),
      isActive: isFlightActive,
      onClick: () => goTo('map'),
    },
    {
      id: 'xray',
      label: 'X-Ray',
      tooltip: 'Processes as sequences of connections',
      icon: <Radiation className="h-3.5 w-3.5" />,
      isActive: isXRayActive,
      onClick: () => goTo(isXRayActive ? 'map' : 'processes'),
    },
    {
      id: 'landscape',
      label: 'Landscape',
      tooltip: 'Landscape editor',
      icon: <Trees className="h-3.5 w-3.5" />,
      isActive: isEditorActive,
      onClick: () => goTo(isEditorActive ? 'map' : 'editor'),
      visible: isCollaborator,
    },
  ];

  return (
    <TooltipProvider>
      <header className="flex items-center h-12 px-4 gap-3 bg-card border-b border-border shrink-0 z-10">
        {/* Logo – icon only */}
        {!isOnMap ? (
          <div
            className="flex items-center select-none shrink-0"
            title={tagline}
          >
            <img
              src="/logo.svg"
              alt="Porthole"
              width={22}
              height={22}
              style={{ filter: 'drop-shadow(0 0 4px hsl(185,100%,54%))' }}
            />
          </div>
        ) : (
          <button
            onClick={() => navigate(isOnMap ? '/lobby' : '/')}
            className="flex items-center select-none transition-all group shrink-0 cursor-pointer"
            style={{ textDecoration: 'none' }}
            title={isOnMap ? 'Back to lobby' : tagline}
          >
            <img
              src="/logo.svg"
              alt="Porthole"
              width={22}
              height={22}
              style={{ filter: 'drop-shadow(0 0 4px hsl(185,100%,54%))' }}
            />
          </button>
        )}

        {/* Static title when not in a session */}
        {!isOnMap && (
          <span className=" tron-logo text-sm" title={tagline}>
            {location.pathname === '/lobby' ? 'Lobby' : 'Porthole'}
          </span>
        )}

        {/* Map session area */}
        {isOnMap && currentMap && (
          <>
            {/* Map name – clicking opens settings popover */}
            <Popover open={popoverOpen} onOpenChange={handlePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="hidden sm:inline tron-logo text-sm truncate max-w-45 hover:opacity-70 transition-opacity text-left cursor-pointer"
                  title="Map settings"
                >
                  {currentMap.name || `#${currentMap.id.slice(0, 8)}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-foreground">Map Settings</h4>
                    <p className="text-xs text-muted-foreground">
                      {isCollaborator ? 'Edit name and description of this map.' : 'Map details (read-only for viewers).'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="map-name" className="text-xs">Name</Label>
                    <Input
                      id="map-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Unnamed Map"
                      className="h-8 text-sm"
                      readOnly={!isCollaborator}
                      disabled={!isCollaborator}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="map-description" className="text-xs">Description</Label>
                    <Textarea
                      id="map-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description…"
                      className="text-sm resize-none"
                      rows={3}
                      readOnly={!isCollaborator}
                      disabled={!isCollaborator}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="map-collaboration-mode" className="text-xs">Collaboration mode</Label>
                    <select
                      id="map-collaboration-mode"
                      value={editCollaborationMode}
                      onChange={(e) => setEditCollaborationMode(e.target.value as CollaborationMode)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!isCollaborator}
                    >
                      {(Object.keys(COLLABORATION_MODE_LABELS) as CollaborationMode[]).map((m) => (
                        <option key={m} value={m}>
                          {COLLABORATION_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Map ID</Label>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 text-xs font-mono bg-muted rounded px-2 py-1.5 text-muted-foreground select-all truncate">
                        {currentMap.id}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={handleCopyId}
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {isCollaborator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-start gap-2 px-2 text-xs"
                      onClick={handleExport}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export session JSON
                    </Button>
                  )}
                  {/* Collaborators */}
                  {currentMap.collaborators.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Collaborators</Label>
                      <div className="flex flex-col gap-1">
                        {currentMap.collaborators.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 shrink-0">
                              {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.username} />}
                              <AvatarFallback className="text-[9px] font-bold text-white bg-secondary">
                                {c.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-foreground truncate flex-1">{c.username}</span>
                            {c.id === userId && (
                              <span className="text-[10px] text-muted-foreground ml-auto">(you)</span>
                            )}
                            {isAdmin && c.id !== userId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                                title={`Remove ${c.username} from session`}
                                disabled={removingCollaboratorId === c.id}
                                onClick={() => handleRemoveCollaborator(c.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {removeCollabError && (
                        <p className="text-xs text-destructive">{removeCollabError}</p>
                      )}
                    </div>
                  )}
                  {saveError && (
                    <p className="text-xs text-destructive">{saveError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPopoverOpen(false)}
                      disabled={saving}
                    >
                      {isCollaborator ? 'Cancel' : 'Close'}
                    </Button>
                    {isCollaborator && (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {/* Join requests badge – only for collaborators when there are pending requests */}
            {hasPendingRequests && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-8 w-8 p-0 text-amber-400 hover:text-amber-300"
                    aria-label={`${pendingRequests.length} pending join request${pendingRequests.length !== 1 ? 's' : ''}`}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                      {pendingRequests.length}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="start">
                  <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-semibold text-foreground">Join Requests</h4>
                    {joinReqError && (
                      <p className="text-xs text-destructive">{joinReqError}</p>
                    )}
                    <div className="flex flex-col gap-2">
                      {pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-6 w-6 shrink-0">
                              {req.avatarUrl && <AvatarImage src={req.avatarUrl} alt={req.username} />}
                              <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground">
                                {req.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-foreground truncate">{req.username}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              disabled={joinReqLoading === req.id}
                              onClick={() => handleAcceptRequest(req.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                              disabled={joinReqLoading === req.id}
                              onClick={() => handleDeclineRequest(req.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* ── Nav tabs ─────────────────────────────────────────────────── */}
            {NAV_TABS.filter((t) => t.visible !== false).map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center gap-1.5 h-12 px-3 text-xs font-medium border-b-3 transition-colors cursor-pointer ${
                      tab.isActive
                        ? `${activeBorderCls} text-amber-400`
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={tab.onClick}
                    aria-current={tab.isActive ? 'page' : undefined}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{tab.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </>
        )}
        <div className="flex-1" />
        {username && (
          <>
            <Separator orientation="vertical" className="h-5 bg-border" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0" aria-label="User menu">
                  <Avatar className="h-7 w-7">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                      {username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-4" align="end">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-semibold text-foreground truncate">{username}</p>
                    <p className="text-xs text-muted-foreground">Signed in</p>
                    {userId && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate select-all mt-0.5" title={userId}>{userId}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="renderer-quality-profile" className="text-xs">Rendering quality</Label>
                    <select
                      id="renderer-quality-profile"
                      value={rendererQualityProfile}
                      onChange={(e) => setRendererQualityProfile(e.target.value as RendererQualityProfile)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {(Object.keys(RENDERER_QUALITY_LABELS) as RendererQualityProfile[]).map((profile) => (
                        <option key={profile} value={profile}>
                          {RENDERER_QUALITY_LABELS[profile]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs justify-start gap-2 px-2"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </header>
    </TooltipProvider>
  );
}
