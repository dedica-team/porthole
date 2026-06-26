import {useEffect} from 'react';
import type React from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {LayoutDashboard, BarChart2, Bus, CheckSquare, Sprout, ArrowRight} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import {StatusBadge, qualityLevelToStatus, matrixLevelToStatus} from '@/components/ui/status-badge';
import { StatusIndicator } from '@/components/ui/status-badge';
import {QUALITY_LEVEL_SIGN, worstLevel} from '@/types/landmark';
import {MATRIX_LEVEL_LABEL, MATRIX_LEVEL_ORDER} from '@/types/matrix';
import type {MatrixLevel} from '@/types/matrix';
import type {LandmarkMetricEntry} from '@/types/landmark';
import {fetchChoreLists, fetchGreenkeepingRotations, fetchCollaboratorMatrix} from '@/api/mapApi';
import {useMapStore} from '@/store/mapStore';
import type {GreenkeepingRotation} from '@/types/greenkeeping';
import {getActiveGreenkeepingEntry} from '@/types/greenkeeping';

// ── Overview card wrapper ─────────────────────────────────────────────────────

interface OverviewCardProps {
    title: string;
    icon: React.ReactNode;
    linkLabel: string;
    linkTo: string;
    children: React.ReactNode;
}

function OverviewCard({title, icon, linkLabel, linkTo, children}: OverviewCardProps) {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {icon}
                    {title}
                </div>
                <button
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    onClick={() => navigate(linkTo)}
                >
                    {linkLabel}
                    <ArrowRight className="h-3 w-3"/>
                </button>
            </div>
            <div className="flex-1 overflow-auto max-h-56 p-4">
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
              <StatusBadge status={qualityLevelToStatus[worst]} className="text-sm font-mono">
                {QUALITY_LEVEL_SIGN[worst]}
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

    const collaborators = [...currentMap.collaborators].sort((a, b) => a.username.localeCompare(b.username));
    const landmarks = Object.values(currentMap.landmarks).sort((a, b) => a.name.localeCompare(b.name));

    if (collaborators.length === 0) return <p className="text-sm text-muted-foreground">No collaborators.</p>;
    if (landmarks.length === 0) return <p className="text-sm text-muted-foreground">No landmarks.</p>;
    if (!collaboratorMatrix) return <p className="text-sm text-muted-foreground">Loading…</p>;

    return (
        <div className="flex flex-col gap-1">
            {landmarks.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                    <span className="text-sm text-foreground truncate max-w-32 shrink-0">{l.name}</span>
                    <div className="flex items-center gap-0.5">
                        {[...collaborators]
                            .map((c) => ({
                                c,
                                level: ((collaboratorMatrix.entries?.[l.id]?.[c.id]?.level ?? 'NONE') as MatrixLevel)
                            }))
                            .filter(({level}) => level !== 'NONE')
                            .sort((a, b) => MATRIX_LEVEL_ORDER.indexOf(b.level) - MATRIX_LEVEL_ORDER.indexOf(a.level))
                            .map(({c, level}) => {
                                const status = matrixLevelToStatus[level];
                                return (
                                    <StatusIndicator
                                        key={c.id}
                                        status={status}
                                        title={`${c.username}: ${MATRIX_LEVEL_LABEL[level]}`}
                                    />
                                );
                            })}
                    </div>
                </div>
            ))}
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
                const done = entries.filter((e) => e.state === 'DONE').length;
                const total = entries.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                    <div key={list.id} className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-sm">
                            <span className="text-foreground truncate max-w-40">{list.title}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">{done}/{total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-success transition-all"
                                style={{width: `${pct}%`}}
                            />
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
        <div className="flex flex-row flex-wrap gap-4">
            {[...rotations].sort((a, b) => a.name.localeCompare(b.name)).map((r: GreenkeepingRotation) => {
                const active = getActiveGreenkeepingEntry(r);
                const keeper = active ? (collaboratorsById[active.collaboratorId] ?? null) : null;
                const keeperName = keeper?.username ?? (active ? active.collaboratorId : null);
                return (
                    <UserAvatar
                        key={r.id}
                        username={keeperName ?? '—'}
                        avatarUrl={keeper?.avatarUrl}
                        subtitle={r.name}
                        className="min-w-14"
                        title={keeperName ?? 'none'}
                    />
                );
            })}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionOverviewView() {
    const {id: sessionId = ''} = useParams<{ id: string }>();

    return (
        <div data-testid="view-overview" className="flex flex-col h-full bg-background overflow-auto">
            {/* Header */}
            <div className="flex items-center gap-2 px-6 py-4 shrink-0">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground"/>
                <h2 className="text-sm font-semibold text-foreground">Session Overview</h2>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-6">
                <OverviewCard
                    title="Quality Metrics"
                    icon={<BarChart2 className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="View full metrics"
                    linkTo={`/session/${sessionId}/metrics`}
                >
                    <QualityMetricsSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Bus Matrix"
                    icon={<Bus className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="View full matrix"
                    linkTo={`/session/${sessionId}/matrix`}
                >
                    <BusMatrixSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Chore Progress"
                    icon={<CheckSquare className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="View all chores"
                    linkTo={`/session/${sessionId}/chores`}
                >
                    <ChoreProgressSummary sessionId={sessionId}/>
                </OverviewCard>

                <OverviewCard
                    title="Greenkeepers"
                    icon={<Sprout className="h-3.5 w-3.5 text-muted-foreground"/>}
                    linkLabel="View rotations"
                    linkTo={`/session/${sessionId}/greenkeeping`}
                >
                    <GreenkeepingRotationsSummary sessionId={sessionId}/>
                </OverviewCard>
            </div>
        </div>
    );
}
