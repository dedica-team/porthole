import {useEffect} from 'react';
import {Plus, ExternalLink} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {UserAvatar} from '@/components/ui/user-avatar';
import {StatusBadge, choreStateToStatus} from '@/components/ui/status-badge';
import {useMapStore, useAuthStore} from '@/store/mapStore';
import {fetchChoreLists} from '@/api/mapApi';
import type {ChoreList, ChoreEntryState} from '@/types/chores';
import {CHORE_ENTRY_STATES, CHORE_ENTRY_STATE_LABEL} from '@/types/chores';
import {useState} from 'react';
import CreateChoreListDialog from './CreateChoreListDialog';
import ChoreListDetail from './ChoreListDetail';

export default function ChoreListsView() {
    const currentMap = useMapStore((s) => s.currentMap);
    const choreLists = useMapStore((s) => s.choreLists);
    const setChoreLists = useMapStore((s) => s.setChoreLists);
    const choreListsFetched = useMapStore((s) => s.choreListsFetched);
    const setChoreListsFetched = useMapStore((s) => s.setChoreListsFetched);
    const choreListsLoading = useMapStore((s) => s.choreListsLoading);
    const setChoreListsLoading = useMapStore((s) => s.setChoreListsLoading);
    const choreListsError = useMapStore((s) => s.choreListsError);
    const setChoreListsError = useMapStore((s) => s.setChoreListsError);
    const activeChoreListId = useMapStore((s) => s.activeChoreListId);
    const setActiveChoreListId = useMapStore((s) => s.setActiveChoreListId);
    const userId = useAuthStore((s) => s.userId);

    const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        if (!currentMap || choreListsFetched) return;
        setChoreListsLoading(true);
        fetchChoreLists(currentMap.id)
            .then((lists: ChoreList[]) => {
                setChoreLists(lists);
                setChoreListsFetched(true);
            })
            .catch((err: unknown) => setChoreListsError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setChoreListsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMap?.id, choreListsFetched]);

    if (!currentMap) return null;

    const activeList = activeChoreListId ? choreLists.find((l) => l.id === activeChoreListId) : null;
    if (activeList) {
        return (
            <ChoreListDetail
                choreList={activeList}
                onUpdated={(lists) => setChoreLists(lists)}
                onDeleted={() => {
                    setChoreLists(choreLists.filter((l) => l.id !== activeList.id));
                    setActiveChoreListId(null);
                }}
            />
        );
    }

    const sorted = [...choreLists].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.title.localeCompare(b.title);
    });

    const countsByState = (list: ChoreList): Record<ChoreEntryState, number> => {
        const counts = {NONE: 0, ONGOING: 0, BLOCKED: 0, DONE: 0};
        for (const e of Object.values(list.entries)) counts[e.state]++;
        return counts;
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 shrink-0">
                <h2 className="text-lg font-semibold text-foreground">Chore Lists</h2>
                {isCollaborator && (
                    <Button size="sm" variant="default" className="h-7 text-sm gap-1.5"
                            onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5"/>
                        New List
                    </Button>
                )}
            </div>

            {choreListsError && (
                <p className="px-6 py-2 text-sm text-destructive shrink-0">{choreListsError}</p>
            )}

            {/* Empty / loading states */}
            {choreListsLoading && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            )}
            {!choreListsLoading && sorted.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    No chore lists yet.{isCollaborator ? ' Create one with "+ New List".' : ''}
                </div>
            )}

            {/* Cards */}
            {!choreListsLoading && sorted.length > 0 && (
                <div className="flex-1 overflow-auto px-6 py-3">
                    <div className="grid grid-cols-3 gap-2 items-stretch">
                        {sorted.map((list) => {
                            const counts = countsByState(list);
                            const assigneeIds = [...new Set(
                                Object.values(list.entries).map((e) => e.assigneeId).filter(Boolean) as string[]
                            )];
                            const assignees = assigneeIds
                                .map((id) => currentMap.collaborators.find((c) => c.id === id))
                                .filter(Boolean) as typeof currentMap.collaborators;
                            const hasDetails = CHORE_ENTRY_STATES.some((s) => counts[s] > 0) || assignees.length > 0;

                            return (
                                <Button
                                    variant={"ghost"}
                                    key={list.id}
                                    className={`group h-full w-full !flex-col !items-start !justify-start !whitespace-normal text-left px-4 py-3 transition-colors ${list.completed ? 'opacity-50' : ''}`}
                                    onClick={() => setActiveChoreListId(list.id)}
                                >
                                    {/* Title row + status badges */}
                                    <div className="flex items-start justify-between gap-2 w-full">
                                        <h2 className={`font-medium text-lg ${list.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{list.title}</h2>
                                        {hasDetails && (
                                            <div className="flex flex-wrap justify-end gap-1 shrink-0">
                                                {CHORE_ENTRY_STATES.filter((s) => counts[s] > 0).map((s) => (
                                                    <StatusBadge key={s} status={choreStateToStatus[s]} className="text-xs font-medium">
                                                        {counts[s]} {CHORE_ENTRY_STATE_LABEL[s]}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {list.link && (
                                        <a
                                            href={list.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground hover:text-[hsl(185,100%,54%)] transition-colors truncate"
                                        >
                                            <ExternalLink className="h-3 w-3 shrink-0"/>
                                            <span className="truncate">{list.link}</span>
                                        </a>
                                    )}

                                    {/* Assignees */}
                                    {assignees.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {assignees.map((c) => (
                                                <UserAvatar key={c.id} username={c.username} avatarUrl={c.avatarUrl} />
                                            ))}
                                        </div>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}

            <CreateChoreListDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(lists) => setChoreLists(lists)}
            />
        </div>
    );
}
