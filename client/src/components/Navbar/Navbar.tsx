import React, { useState, useEffect, useContext, useMemo } from 'react';
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
  Search,
  X,
  Radiation,
  CheckSquare,
  Trees,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { acceptJoinRequest, changeUsername, declineJoinRequest, logoutSession } from '@/api/mapApi';
import type { RendererQualityProfile } from '@/components/HexGrid/renderQuality';
import LandmarkInfoPopover from '@/components/LandmarkInfoPopover/LandmarkInfoPopover';
import { MapActionsContext } from '@/pages/MapPage/MapActionsContext';
import type { Landmark } from '@/types/landmark';
import { isDecorative } from '@/types/landmark';

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

interface UserAccountSectionProps {
  username: string;
  avatarUrl?: string | null;
  rendererQualityProfile: RendererQualityProfile;
  setRendererQualityProfile: (profile: RendererQualityProfile) => void;
  onLogout: () => void;
  userId?: string | null;
  setUsername: (name: string) => void;
  updateCollaboratorUsername?: (id: string, name: string) => void;
  idPrefix?: string;
  showAvatarHeader?: boolean;
}

function UserAccountSection({
  username,
  avatarUrl,
  rendererQualityProfile,
  setRendererQualityProfile,
  onLogout,
  userId,
  setUsername,
  updateCollaboratorUsername,
  idPrefix = 'user-menu',
  showAvatarHeader = false,
}: UserAccountSectionProps) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const startEditUsername = () => {
    setUsernameInput(username);
    setUsernameError('');
    setEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed || trimmed === username) {
      setEditingUsername(false);
      return;
    }
    setUsernameLoading(true);
    setUsernameError('');
    try {
      const result = await changeUsername(trimmed);
      setUsername(result.username);
      if (userId && updateCollaboratorUsername) {
        updateCollaboratorUsername(userId, result.username);
      }
      setEditingUsername(false);
    } catch (err: unknown) {
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username');
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {editingUsername ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveUsername();
                  if (e.key === 'Escape') setEditingUsername(false);
                }}
                disabled={usernameLoading}
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-success hover:text-success/80"
                disabled={usernameLoading}
                onClick={handleSaveUsername}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                disabled={usernameLoading}
                onClick={() => setEditingUsername(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {showAvatarHeader && (
                <Avatar className="h-7 w-7 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                  <AvatarFallback className="text-sm bg-secondary text-secondary-foreground">
                    {username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{username}</p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={startEditUsername}
              aria-label="Edit username"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-renderer-quality`} className="text-sm">Rendering quality</Label>
        <select
          id={`${idPrefix}-renderer-quality`}
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
      <Button variant="ghost" size="sm" className="h-8 text-sm justify-start gap-2 px-2" onClick={onLogout}>
        <LogOut className="h-3.5 w-3.5" />
        Logout
      </Button>
    </div>
  );
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
  const matchGreenkeeping = useMatch({ path: '/session/:id/greenkeeping', end: false });
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
  const mapActions = useContext(MapActionsContext);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const landmarks = Object.values(currentMap?.landmarks ?? {});
  const [joinReqLoading, setJoinReqLoading] = useState<string | null>(null);
  const [joinReqError, setJoinReqError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const groups = currentMap?.groups ?? {};
  const filteredLandmarks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return landmarks.filter((l) => !isDecorative(l.type) && l.name.toLowerCase().includes(q));
  }, [landmarks, searchQuery]);

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

  const handleLogout = async () => {
    try {
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
  const activeBorderCls = 'border-primary';

  const sessionTitle = currentMap?.name || (currentMap?.id ? `#${currentMap.id.slice(0, 8)}` : 'Overview');

  const NAV_TABS: NavTab[] = [
    {
      id: 'overview',
      label: sessionTitle,
      tooltip: currentMap?.name ? `${currentMap.name} (Overview)` : 'Session overview dashboard',
      icon: <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />,
      isActive: isOverviewActive,
      onClick: () => { if (mapId) navigate(`/session/${mapId}`); },
    },
    {
      id: 'metrics',
      label: 'Quality Metrics',
      tooltip: 'Manage quality metrics and goals',
      icon: <BarChart2 className="h-3.5 w-3.5 shrink-0" />,
      isActive: isMetricsActive,
      onClick: () => goTo('metrics'),
    },
    {
      id: 'matrix',
      label: 'Bus Matrix',
      tooltip: 'Who knows what',
      icon: <Bus className="h-3.5 w-3.5 shrink-0" />,
      isActive: isMatrixActive,
      onClick: () => goTo('matrix'),
    },
    {
      id: 'chores',
      label: 'Chores',
      tooltip: 'Chore todo lists per element',
      icon: <CheckSquare className="h-3.5 w-3.5 shrink-0" />,
      isActive: isChoresActive,
      onClick: () => goTo('chores'),
    },
    {
      id: 'greenkeeping',
      label: 'Greenkeeping',
      tooltip: 'Recurring group stewardship rotations',
      icon: <Sprout className="h-3.5 w-3.5 shrink-0" />,
      isActive: isGreenkeepingActive,
      onClick: () => goTo('greenkeeping'),
    },
    {
      id: 'flight',
      label: 'Flight mode',
      tooltip: 'A 10.000ft view',
      icon: (
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      icon: <Radiation className="h-3.5 w-3.5 shrink-0" />,
      isActive: isXRayActive,
      onClick: () => goTo(isXRayActive ? 'map' : 'processes'),
    },
    {
      id: 'landscape',
      label: 'Landscape',
      tooltip: 'Landscape editor',
      icon: <Trees className="h-3.5 w-3.5 shrink-0" />,
      isActive: isEditorActive,
      onClick: () => goTo(isEditorActive ? 'map' : 'editor'),
      visible: isCollaborator,
    },
  ];

  const visibleTabs = NAV_TABS.filter((t) => t.visible !== false);

  const searchPopoverContent = (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredLandmarks[0]) {
              setSelectedLandmark(filteredLandmarks[0]);
              setSearchOpen(false);
              setSearchQuery('');
            } else if (e.key === 'Escape') {
              setSearchOpen(false);
            }
          }}
          type="search"
          placeholder="Search…"
          className="h-9 pl-8 pr-3 w-full rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
        />
      </div>
      {searchQuery.trim() && (
        <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-card">
          {filteredLandmarks.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">No landmarks found</div>
          ) : (
            filteredLandmarks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setSelectedLandmark(l);
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="w-full flex flex-col px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors border-b last:border-b-0 border-border"
              >
                <span className="text-sm font-medium truncate">{l.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {l.groupId && groups[l.groupId] ? groups[l.groupId].name : l.type.replace(/_/g, ' ')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
      <div className="relative shrink-0 z-40">
        <header className="flex items-center h-12 px-2 sm:px-4 gap-1 sm:gap-3 bg-card border-border mx-3 sm:mx-6 mt-2 rounded-lg">
          {/* Logo / Lobby */}
          {!isOnMap ? (
            <div className="flex items-center gap-1.5 select-none shrink-0" title={tagline}>
              <img src="/logo.svg" alt="Porthole" width={22} height={22} style={{ filter: 'drop-shadow(0 0 4px hsl(var(--holo-indigo)))' }} />
              <span className="tron-logo text-sm">
                {location.pathname === '/lobby' ? 'Lobby' : 'Porthole'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/lobby')}
              className="flex items-center gap-1.5 select-none transition-all group shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              style={{ textDecoration: 'none' }}
              title="Back to lobby"
              aria-label="Back to lobby"
            >
              <img src="/logo.svg" alt="Porthole" width={22} height={22} style={{ filter: 'drop-shadow(0 0 4px hsl(var(--holo-indigo)))' }} />
              <span className="text-sm font-medium hidden 2xl:inline">Lobby</span>
            </button>
          )}

          {/* Map session area */}
          {isOnMap && currentMap && (
            <>
              {/* Join requests */}
              {hasPendingRequests && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="relative inline-flex items-center gap-1.5 h-12 px-2 2xl:px-2.5 text-sm font-medium text-warning hover:text-warning/80 shrink-0 cursor-pointer"
                      aria-label={`${pendingRequests.length} pending join request${pendingRequests.length !== 1 ? 's' : ''}`}
                      title={`${pendingRequests.length} pending join request${pendingRequests.length !== 1 ? 's' : ''}`}
                    >
                      <Bell className="h-4 w-4 shrink-0" />
                      <span className="hidden 2xl:inline">Requests</span>
                      <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-warning text-xs font-bold text-white">
                        {pendingRequests.length}
                      </span>
                    </button>
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

              {/* Desktop: all tabs */}
              <div className="hidden sm:flex items-center">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    title={tab.tooltip}
                    aria-label={tab.label}
                    className={`inline-flex items-center gap-1.5 h-12 px-2.5 2xl:px-3 text-sm font-medium border-b-3 transition-colors cursor-pointer shrink-0 ${
                      tab.isActive
                        ? `${activeBorderCls} text-primary`
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={tab.onClick}
                    aria-current={tab.isActive ? 'page' : undefined}
                  >
                    {tab.icon}
                    {tab.id === 'overview' ? (
                      <span className="hidden 2xl:inline max-w-32 sm:max-w-48 overflow-x-auto whitespace-nowrap scrollbar-none select-none">
                        {tab.label}
                      </span>
                    ) : (
                      <span className="hidden 2xl:inline">{tab.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex-1" />

          {/* Search button with popup */}
          {isOnMap && currentMap && (
            <Popover open={searchOpen} onOpenChange={(open) => {
              setSearchOpen(open);
              if (!open) setSearchQuery('');
            }}>
              <PopoverTrigger asChild>
                <button
                  className="hidden sm:inline-flex items-center gap-1.5 h-12 px-2.5 2xl:px-3 text-sm font-medium border-b-3 border-transparent text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  aria-label="Search"
                  title="Search"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden 2xl:inline">Search</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="end">
                {searchPopoverContent}
              </PopoverContent>
            </Popover>
          )}

          {/* User menu button */}
          {username && (
            <div className={`${isOnMap && currentMap ? 'hidden sm:flex' : 'flex'} items-center shrink-0`}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1.5 h-12 px-2.5 2xl:px-3 text-sm font-medium border-b-3 border-transparent text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    aria-label="User menu"
                    title={username}
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                      <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground font-semibold">
                        {username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`${isOnMap && currentMap ? 'hidden 2xl:inline' : 'inline'} max-w-28 sm:max-w-36 truncate`}>{username}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-4" align="end">
                  <UserAccountSection
                    username={username}
                    avatarUrl={avatarUrl}
                    rendererQualityProfile={rendererQualityProfile}
                    setRendererQualityProfile={setRendererQualityProfile}
                    onLogout={handleLogout}
                    userId={userId}
                    setUsername={setUsername}
                    updateCollaboratorUsername={updateCollaboratorUsername}
                    idPrefix="desktop"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Mobile hamburger – only in a session */}
          {isOnMap && currentMap && (
            <button
              className="sm:hidden flex items-center gap-1.5 h-8 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer shrink-0"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-4 w-4 shrink-0" /> : <Menu className="h-4 w-4 shrink-0" />}
              <span className="text-sm font-medium">Menu</span>
            </button>
          )}
        </header>

        {/* Landmark info popover (triggered by landmark search) */}
        {selectedLandmark && mapActions && (
          <LandmarkInfoPopover
            key={selectedLandmark.id}
            landmark={selectedLandmark}
            open={true}
            onOpenChange={(o) => { if (!o) setSelectedLandmark(null); }}
            onEditLandmark={mapActions.handleEditLandmark}
            onRemoveLandmark={mapActions.handleRemoveLandmark}
            onEditConnection={mapActions.handleEditConnection}
            onRemoveConnection={mapActions.handleRemoveConnection}
            loading={mapActions.actionLoading}
          />
        )}

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && isOnMap && currentMap && (
          <>
            <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-xs sm:hidden" onClick={() => setMobileMenuOpen(false)} />
            <nav className="absolute top-full left-3 right-3 sm:hidden mt-2 bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden max-h-[calc(100vh-4.5rem)] overflow-y-auto">
              {/* Search field in mobile menu */}
              <div className="p-3 border-b border-border flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredLandmarks[0]) {
                        setSelectedLandmark(filteredLandmarks[0]);
                        setMobileMenuOpen(false);
                        setSearchQuery('');
                      }
                    }}
                    type="search"
                    placeholder="Search…"
                    className="h-9 pl-8 pr-3 w-full rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
                  />
                </div>
                {searchQuery.trim() && (
                  <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-card">
                    {filteredLandmarks.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">No landmarks found</div>
                    ) : (
                      filteredLandmarks.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLandmark(l);
                            setMobileMenuOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full flex flex-col px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors border-b last:border-b-0 border-border"
                        >
                          <span className="text-sm font-medium truncate">{l.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {l.groupId && groups[l.groupId] ? groups[l.groupId].name : l.type.replace(/_/g, ' ')}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Navigation tabs */}
              <div className="flex flex-col py-1">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium border-l-3 transition-colors cursor-pointer ${
                      tab.isActive
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30'
                    }`}
                    onClick={() => { tab.onClick(); setMobileMenuOpen(false); }}
                    aria-current={tab.isActive ? 'page' : undefined}
                  >
                    {tab.icon}
                    {tab.id === 'overview' ? (
                      <span className="max-w-[16rem] overflow-x-auto whitespace-nowrap scrollbar-none">
                        {tab.label}
                      </span>
                    ) : (
                      <span>{tab.label}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Integrated user account section in mobile hamburger */}
              {username && (
                <div className="border-t border-border p-3.5 bg-muted/20">
                  <UserAccountSection
                    username={username}
                    avatarUrl={avatarUrl}
                    rendererQualityProfile={rendererQualityProfile}
                    setRendererQualityProfile={setRendererQualityProfile}
                    onLogout={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    userId={userId}
                    setUsername={setUsername}
                    updateCollaboratorUsername={updateCollaboratorUsername}
                    idPrefix="mobile"
                    showAvatarHeader={true}
                  />
                </div>
              )}
            </nav>
          </>
        )}
      </div>
  );
}
