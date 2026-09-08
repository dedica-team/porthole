import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useMatch } from 'react-router-dom';
import {
  LogOut,
  LayoutDashboard,
  BarChart2,
  Bell,
  Bus,
  Check,
  Menu,
  Pencil,
  X,
  Radiation,
  CheckSquare,
  Trees,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { acceptJoinRequest, changeUsername, declineJoinRequest, logoutSession } from '@/api/mapApi';
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
  const matchOverview     = useMatch({ path: '/session/:id', end: true });

  // Helper: navigate to a sub-route under the current map.
  const goTo = (sub: string | null) => {
    if (!mapId) return;
    navigate(`/session/${mapId}/${sub ?? 'map'}`);
  };

  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));
  const setUsername = useAuthStore((s) => s.setUsername);
  const updateCollaboratorUsername = useMapStore((s) => s.updateCollaboratorUsername);
  const [joinReqLoading, setJoinReqLoading] = useState<string | null>(null);
  const [joinReqError, setJoinReqError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const startEditUsername = () => {
    setUsernameInput(username ?? '');
    setUsernameError('');
    setEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed === username) { setEditingUsername(false); return; }
    setUsernameLoading(true);
    setUsernameError('');
    try {
      const result = await changeUsername(trimmed);
      setUsername(result.username);
      if (userId) updateCollaboratorUsername(userId, result.username);
      setEditingUsername(false);
    } catch (err: unknown) {
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setUsernameLoading(false);
    }
  };

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

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
  const isOverviewActive     = !!matchOverview;

  // The active-tab bottom border class.
  const activeBorderCls = 'border-warning';

  const NAV_TABS: NavTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      tooltip: 'Session overview dashboard',
      icon: <LayoutDashboard className="h-3.5 w-3.5" />,
      isActive: isOverviewActive,
      onClick: () => { if (mapId) navigate(`/session/${mapId}`); },
    },
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
      icon: <Sprout className="h-3.5 w-3.5"/>,
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

  const visibleTabs = NAV_TABS.filter((t) => t.visible !== false);

  return (
    <TooltipProvider>
      <div className="relative shrink-0 z-40">
        <header className="flex items-center h-12 px-2 sm:px-4 gap-1 sm:gap-3 bg-card border-b border-border overflow-x-auto">
          {/* Logo */}
          {!isOnMap ? (
            <div className="flex items-center select-none shrink-0" title={tagline}>
              <img src="/logo.svg" alt="Porthole" width={22} height={22} style={{ filter: 'drop-shadow(0 0 4px hsl(var(--holo-indigo)))' }} />
            </div>
          ) : (
            <button
              onClick={() => navigate('/lobby')}
              className="flex items-center select-none transition-all group shrink-0 cursor-pointer"
              style={{ textDecoration: 'none' }}
              title="Back to lobby"
            >
              <img src="/logo.svg" alt="Porthole" width={22} height={22} style={{ filter: 'drop-shadow(0 0 4px hsl(var(--holo-indigo)))' }} />
            </button>
          )}

          {/* Static title when not in a session */}
          {!isOnMap && (
            <span className="tron-logo text-sm" title={tagline}>
              {location.pathname === '/lobby' ? 'Lobby' : 'Porthole'}
            </span>
          )}

          {/* Map session area */}
          {isOnMap && currentMap && (
            <>
              {/* Join requests badge */}
              {hasPendingRequests && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative h-8 w-8 p-0 text-warning hover:text-warning/80 shrink-0"
                      aria-label={`${pendingRequests.length} pending join request${pendingRequests.length !== 1 ? 's' : ''}`}
                    >
                      <Bell className="h-4 w-4" />
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-sm font-bold text-white">
                        {pendingRequests.length}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="start">
                    <div className="flex flex-col gap-3">
                      <h4 className="text-sm font-semibold text-foreground">Join Requests</h4>
                      {joinReqError && <p className="text-sm text-destructive">{joinReqError}</p>}
                      <div className="flex flex-col gap-2">
                        {pendingRequests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                            <UserAvatar inline size="sm" username={req.username} avatarUrl={req.avatarUrl} className="min-w-0 flex-1" />
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-sm text-success hover:text-success/80 hover:bg-success/10" disabled={joinReqLoading === req.id} onClick={() => handleAcceptRequest(req.id)}>Accept</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-sm text-destructive hover:text-destructive/80 hover:bg-destructive/10" disabled={joinReqLoading === req.id} onClick={() => handleDeclineRequest(req.id)}>Decline</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Mobile: session name */}
              <span className="sm:hidden text-sm font-medium text-foreground truncate">
                {currentMap.name}
              </span>

              {/* Desktop: all tabs */}
              <div className="hidden sm:flex items-center">
                {visibleTabs.map((tab) => (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        className={`inline-flex items-center gap-1.5 h-12 px-3 text-sm font-medium border-b-3 transition-colors cursor-pointer shrink-0 ${
                          tab.isActive
                            ? `${activeBorderCls} text-warning`
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={tab.onClick}
                        aria-current={tab.isActive ? 'page' : undefined}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-sm">{tab.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </>
          )}

          <div className="flex-1" />

          {/* Mobile hamburger – only in a session */}
          {isOnMap && currentMap && (
            <button
              className="sm:hidden flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer shrink-0"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}

          {username && (
            <>
              <Separator orientation="vertical" className="h-5 bg-border" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0 shrink-0" aria-label="User menu">
                    <Avatar className="h-7 w-7">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                      <AvatarFallback className="text-sm bg-secondary text-secondary-foreground">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-4" align="end">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      {editingUsername ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={usernameInput}
                              onChange={(e) => setUsernameInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                              disabled={usernameLoading}
                              className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-success hover:text-success/80" disabled={usernameLoading} onClick={handleSaveUsername}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={usernameLoading} onClick={() => setEditingUsername(false)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold text-foreground truncate flex-1">{username}</p>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={startEditUsername} aria-label="Edit username">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Signed in</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="renderer-quality-profile" className="text-sm">Rendering quality</Label>
                      <select
                        id="renderer-quality-profile"
                        value={rendererQualityProfile}
                        onChange={(e) => setRendererQualityProfile(e.target.value as RendererQualityProfile)}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {(Object.keys(RENDERER_QUALITY_LABELS) as RendererQualityProfile[]).map((profile) => (
                          <option key={profile} value={profile}>{RENDERER_QUALITY_LABELS[profile]}</option>
                        ))}
                      </select>
                    </div>
                    <Separator />
                    <Button variant="ghost" size="sm" className="h-8 text-sm justify-start gap-2 px-2" onClick={handleLogout}>
                      <LogOut className="h-3.5 w-3.5" />
                      Logout
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </header>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && isOnMap && currentMap && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
            <nav className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50 flex flex-col">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm border-l-3 transition-colors cursor-pointer ${
                    tab.isActive
                      ? 'border-warning text-warning bg-warning/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30'
                  }`}
                  onClick={() => { tab.onClick(); setMobileMenuOpen(false); }}
                  aria-current={tab.isActive ? 'page' : undefined}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
