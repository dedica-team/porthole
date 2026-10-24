import {useEffect, useState} from 'react';
import type React from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {BarChart2, Bus, CheckSquare, Sprout, ArrowRight, Users, Info, Cog} from 'lucide-react';
import {Popup} from '@/components/ui/popup';
import {MapSettingsForm} from '@/components/Navbar/MapSettingsForm';
import GroupsPanel from '@/components/Sidebar/panels/GroupsPanel';
import {useMapActions} from './MapActionsContext';
import {UserAvatar} from '@/components/ui/user-avatar';
import {StatusBadge, StatusIndicator, qualityLevelToStatus, matrixLevelToStatus} from '@/components/ui/status-badge';
import {MATRIX_LEVEL_LABEL, MATRIX_LEVEL_ORDER} from '@/types/matrix';
import type {MatrixLevel} from '@/types/matrix';
import {worstLevel} from '@/types/landmark';
import type {LandmarkMetricEntry} from '@/types/landmark';
import {fetchChoreLists, fetchGreenkeepingRotations, fetchCollaboratorMatrix} from '@/api/mapApi';
import {useMapStore, useAuthStore} from '@/store/mapStore';
import type {Collaborator} from '@/types/session';
import type {GreenkeepingRotation} from '@/types/greenkeeping';
import {getActiveGreenkeepingEntry} from '@/types/greenkeeping';

// ── Overview card wrapper ─────────────────────────────────────────────────────

const cardBtnCls = 'flex items-center gap-1 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

interface OverviewCardProps {
    title: string;
    icon: React.ReactNode;
    linkLabel?: string;
    linkTo?: string;
    onAction?: () => void;
    actions?: React.ReactNode;
    contentClassName?: string;
    children: React.ReactNode;
}

function OverviewCard({title, icon, linkLabel, linkTo, onAction, actions, contentClassName, children}: OverviewCardProps) {
    const navigate = useNavigate();
    const handleClick = onAction ?? (linkTo ? () => navigate(linkTo) : undefined);
    return (
        <div className="flex flex-col rounded-lg bg-card overflow-hidden">
            <div className="flex items-stretch border-b border-border shrink-0">
                <div className="flex items-center gap-2 px-4 py-2.5 text-md font-semibold text-foreground flex-1">
                    {icon}
                    {title}
                </div>
                {actions ?? (linkLabel && handleClick && (
                    <button className={cardBtnCls} onClick={handleClick}>
                        {linkLabel}
                        <ArrowRight className="h-3 w-3"/>
                    </button>
                ))}
            </div>
            <div className={`flex-1 overflow-auto p-4 ${contentClassName ?? 'max-h-56'}`}>
                {children}
            </div>
        </div>
    );
}

// ── Quality Metrics summary ───────────────────────────────────────────────────

function QualityMetricsSummary({}: { sessionId: string }) {
    const currentMap = useMapStore((s) => s.currentMap);
    const metrics = useMapStore((s) => s.metrics);

    if (!currentMap) return <p className="text-sm text-muted-foreground">No data.</p>;

    const metricList = Object.values(metrics).sort((a, b) => a.name.localeCompare(b.name));
    if (metricList.length === 0) return <p className="text-sm text-muted-foreground">No metrics defined.</p>;

    const landmarks = Object.values(currentMap.landmarks);

    // For each metric, collect all entries across landmarks and find the worst level.
    const rows = metricList.map((m) => {
        const entries: LandmarkMetricEntry[] = landmarks
            .map((l) => l.metrics?.[m.id])
            .filter((e): e is LandmarkMetricEntry => !!e);
        const worst = worstLevel(entries);
        const filled = entries.filter((e) => e.level !== 'NONE').length;
        return {metric: m, worst, filled, total: landmarks.length};
    });

    return (
        <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
            <tr>
                <th className="text-left pb-1 font-medium text-muted-foreground">Metric</th>
                <th className="text-center pb-1 font-medium text-muted-foreground">Worst</th>
                <th className="text-right pb-1 font-medium text-muted-foreground">Filled</th>
            </tr>
            </thead>
            <tbody>
            {rows.map(({metric, worst, filled, total}) => (
                <tr key={metric.id}>
                    <td className="py-0.5 pr-2 text-foreground truncate max-w-32">{metric.name}</td>
                    <td className="py-0.5 text-center">
                        <StatusBadge status={qualityLevelToStatus[worst]} className="text-center">
                            {worst}
                        </StatusBadge>
                    </td>
                    <td className="py-0.5 text-right text-muted-foreground">{filled}/{total}</td>
                </tr>
            ))}
            </tbody>
        </table>
    );
}

// ── Bus Matrix summary ────────────────────────────────────────────────────────

function BusMatrixSummary({}: { sessionId: string }) {
    const currentMap = useMapStore((s) => s.currentMap);
    const collaboratorMatrix = useMapStore((s) => s.collaboratorMatrix);
    const setCollaboratorMatrix = useMapStore((s) => s.setCollaboratorMatrix);

    useEffect(() => {
        if (!currentMap || collaboratorMatrix) return;
        fetchCollaboratorMatrix(currentMap.id)
            .then((matrix) => setCollaboratorMatrix(matrix))
            .catch(() => { /* silently ignore in overview */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMap?.id, collaboratorMatrix]);

    if (!currentMap) return <p className="text-sm text-muted-foreground">No data.</p>;

    const matrixCollaboratorIds = collaboratorMatrix?.collaborators ?? [];
    const collaborators = matrixCollaboratorIds
        .map((id) => currentMap.collaborators.find((c) => c.id === id))
        .filter((c): c is Collaborator => c != null)
        .sort((a, b) => a.username.localeCompare(b.username));
    const landmarks = Object.values(currentMap.landmarks).sort((a, b) => a.name.localeCompare(b.name));

    if (collaborators.length === 0) return <p className="text-sm text-muted-foreground">No collaborators.</p>;
    if (landmarks.length === 0) return <p className="text-sm text-muted-foreground">No elements.</p>;
    if (!collaboratorMatrix) return <p className="text-sm text-muted-foreground">Loading…</p>;

    const noExpert = landmarks.filter((l) =>
        !collaborators.some(
            (c) => (collaboratorMatrix.entries?.[l.id]?.[c.id]?.level ?? 'NONE') === 'HIGH'
        )
    );

    if (noExpert.length === 0)
        return <div className="text-sm text-muted-foreground">All elements have at least one expert.</div>;

    return (
        <div className="flex flex-col gap-1">
            {noExpert.map((l) => {
                const dots = [...collaborators]
                    .map((c) => ({
                        c,
                        level: (collaboratorMatrix.entries?.[l.id]?.[c.id]?.level ?? 'NONE') as MatrixLevel,
                    }))
                    .filter(({level}) => level !== 'NONE')
                    .sort((a, b) => MATRIX_LEVEL_ORDER.indexOf(b.level) - MATRIX_LEVEL_ORDER.indexOf(a.level));
                return (
                    <div key={l.id} className="flex items-center gap-2">
                        <span className="text-sm text-foreground truncate max-w-32 shrink-0">{l.name}</span>
                        <div className="flex items-center gap-0.5">
                            {dots.map(({c, level}) => (
                                <StatusIndicator
                                    key={c.id}
                                    status={matrixLevelToStatus[level]}
                                    title={`${c.username}: ${MATRIX_LEVEL_LABEL[level]}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Chore Progress summary ────────────────────────────────────────────────────

function ChoreProgressSummary({}: { sessionId: string }) {
    const currentMap = useMapStore((s) => s.currentMap);
    const choreLists = useMapStore((s) => s.choreLists);
    const choreListsFetched = useMapStore((s) => s.choreListsFetched);
    const choreListsLoading = useMapStore((s) => s.choreListsLoading);
    const setChoreLists = useMapStore((s) => s.setChoreLists);
    const setChoreListsFetched = useMapStore((s) => s.setChoreListsFetched);
    const setChoreListsLoading = useMapStore((s) => s.setChoreListsLoading);

    useEffect(() => {
        if (!currentMap || choreListsFetched) return;
        setChoreListsLoading(true);
        fetchChoreLists(currentMap.id)
            .then((lists) => {
                setChoreLists(lists);
                setChoreListsFetched(true);
            })
            .catch(() => { /* silently ignore in overview */
            })
            .finally(() => setChoreListsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMap?.id, choreListsFetched]);

    if (choreListsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (choreLists.length === 0) return <p className="text-sm text-muted-foreground">No chore lists.</p>;

    return (
        <div className="flex flex-col gap-2">
            {[...choreLists].sort((a, b) => a.title.localeCompare(b.title)).map((list) => {
                const entries = Object.values(list.entries);
                const total = entries.length;
                const done = entries.filter((e) => e.state === 'DONE').length;
                const ongoing = entries.filter((e) => e.state === 'ONGOING').length;
                const blocked = entries.filter((e) => e.state === 'BLOCKED').length;
                const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;
                return (
                    <div key={list.id} className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-sm">
                            <span className="text-foreground">{list.title}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">{done}/{total}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-success transition-all" style={{width: `${pct(done)}%`}}/>
                            <div className="h-full bg-info transition-all" style={{width: `${pct(ongoing)}%`}}/>
                            <div className="h-full bg-destructive transition-all" style={{width: `${pct(blocked)}%`}}/>
                            <div className="h-full bg-muted-foreground/20 flex-1"/>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Greenkeepers summary ─────────────────────────────────────────────────────

function GreenkeepingRotationsSummary({}: { sessionId: string }) {
    const currentMap = useMapStore((s) => s.currentMap);
    const rotations = useMapStore((s) => s.greenkeepingRotations);
    const rotationsFetched = useMapStore((s) => s.greenkeepingRotationsFetched);
    const rotationsLoading = useMapStore((s) => s.greenkeepingRotationsLoading);
    const setRotations = useMapStore((s) => s.setGreenkeepingRotations);
    const setRotationsFetched = useMapStore((s) => s.setGreenkeepingRotationsFetched);
    const setRotationsLoading = useMapStore((s) => s.setGreenkeepingRotationsLoading);

    useEffect(() => {
        if (!currentMap || rotationsFetched) return;
        setRotationsLoading(true);
        fetchGreenkeepingRotations(currentMap.id)
            .then((data) => {
                setRotations(data);
                setRotationsFetched(true);
            })
            .catch(() => { /* silently ignore in overview */
            })
            .finally(() => setRotationsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMap?.id, rotationsFetched]);

    if (!currentMap) return <p className="text-sm text-muted-foreground">No data.</p>;
    if (rotationsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (rotations.length === 0)
        return <p className="text-sm text-muted-foreground">No rotations defined.</p>;

    const collaboratorsById = Object.fromEntries(
        currentMap.collaborators.map((c) => [c.id, c])
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...rotations].sort((a, b) => a.name.localeCompare(b.name)).map((r: GreenkeepingRotation) => {
                const active = getActiveGreenkeepingEntry(r);
                const keeper = active ? (collaboratorsById[active.collaboratorId] ?? null) : null;
                const keeperName = keeper?.username ?? (active ? active.collaboratorId : null);
                return (
                    <div key={r.id} className="flex flex-col gap-0.5 text-center w-full">
                        <span className="text-md text-muted-foreground truncate w-full">{r.name}</span>
                        <UserAvatar
                            username={keeperName ?? '—'}
                            avatarUrl={keeper?.avatarUrl}
                            className="min-w-14 py-1"
                            title={keeperName ?? 'none'}
                        />
                    </div>
                );
            })}
        </div>
    );
}

// ── Session info summary ──────────────────────────────────────────────────────

function SessionInfoSummary() {
    const currentMap = useMapStore((s) => s.currentMap);
    const userId = useAuthStore((s) => s.userId);
    if (!currentMap) return null;
    const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));
    const collaborators = [...currentMap.collaborators].sort((a, b) => a.username.localeCompare(b.username));
    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
                {currentMap.description ? (
                    <p className="text-sm text-foreground">{currentMap.description}</p>
                ) : (
                    <p className="text-sm text-muted-foreground italic">No description.</p>
                )}
                <p className="text-xs text-muted-foreground">
                    You are a <span className="font-medium text-foreground">{isCollaborator ? 'collaborator' : 'viewer'}</span>.
                </p>

            </div>
            {collaborators.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:border-l sm:border-border sm:pl-4 shrink-0">
                    {collaborators.map((c) => (
                        <UserAvatar key={c.id} username={c.username} avatarUrl={c.avatarUrl} title={c.username}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionOverviewView() {
    const {id: sessionId = ''} = useParams<{ id: string }>();
    const storeSetSelectedLandmark = useMapStore((s) => s.setSelectedLandmark);
    const storeSetSelectedTile = useMapStore((s) => s.setSelectedTile);
    const storeSetMainView = useMapStore((s) => s.setMainView);
    const [editOpen, setEditOpen] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const {
        handleCreateGroup, handleEditGroup, handleRemoveGroup,
        actionLoading,
    } = useMapActions();

    useEffect(() => {
        storeSetSelectedLandmark(null);
        storeSetSelectedTile(null);
        storeSetMainView('idle');
    }, [storeSetSelectedLandmark, storeSetSelectedTile, storeSetMainView]);

    return (
        <div data-testid="view-overview" className="flex flex-col h-full overflow-auto">

            <Popup title="Manage Groups" open={groupsOpen} onOpenChange={setGroupsOpen} className="max-w-sm max-h-[80vh] flex flex-col" contentClassName="overflow-y-auto p-0 flex-1">
                <GroupsPanel
                    onCreateGroup={handleCreateGroup}
                    onEditGroup={handleEditGroup}
                    onRemoveGroup={handleRemoveGroup}
                    loading={actionLoading}
                />
            </Popup>
            <Popup title="Edit Session" open={editOpen} onOpenChange={setEditOpen} className="max-w-sm overflow-y-auto max-h-[85vh]">
                <MapSettingsForm onClose={() => setEditOpen(false)} />
            </Popup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-3 sm:px-6 pb-6 pt-4">
                <div className="md:col-span-2">
                    <OverviewCard
                        title="Session"
                        icon={<Info className="h-3.5 w-3.5 text-muted-foreground"/>}
                        actions={<>
                            <button className={cardBtnCls} onClick={() => setGroupsOpen(true)}>
                                <Users className="h-3 w-3"/>
                                Groups
                            </button>
                            <button className={cardBtnCls} onClick={() => setEditOpen(true)}>
                                <Cog className="h-3 w-3"/>
                                Settings
                            </button>
                        </>}
                        contentClassName=""
                    >
                        <SessionInfoSummary/>
                    </OverviewCard>
                </div>

                <OverviewCard
                    title="Quality Metrics"
                    icon={<BarChart2 className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="more"
                    linkTo={`/session/${sessionId}/metrics`}
                >
                    <QualityMetricsSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Bus Matrix"
                    icon={<Bus className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="more"
                    linkTo={`/session/${sessionId}/matrix`}
                >
                    <BusMatrixSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Chore Progress"
                    icon={<CheckSquare className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="more"
                    linkTo={`/session/${sessionId}/chores`}
                >
                    <ChoreProgressSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Greenkeepers"
                    icon={<Sprout className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="more"
                    linkTo={`/session/${sessionId}/greenkeeping`}
                >
                    <GreenkeepingRotationsSummary sessionId={sessionId}/>
                </OverviewCard>
            </div>
        </div>
    );
}
