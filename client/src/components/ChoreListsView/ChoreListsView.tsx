import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Plus, ExternalLink, CheckSquare, HelpCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {PageTitle} from '@/components/ui/PageTitle';
import {Popup} from '@/components/ui/popup';
import {UserAvatar} from '@/components/ui/user-avatar';
import {StatusBadge, choreStateToStatus} from '@/components/ui/status-badge';
import {useMapStore, useAuthStore} from '@/store/mapStore';
import {fetchChoreLists} from '@/api/mapApi';
import type {ChoreList, ChoreEntryState} from '@/types/chores';
import {CHORE_ENTRY_STATES, CHORE_ENTRY_STATE_LABEL} from '@/types/chores';
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
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // Sync activeChoreListId ↔ ?list= search param for deep-link support
    useEffect(() => {
        const listParam = searchParams.get('list');
        if (listParam && listParam !== activeChoreListId) {
            setActiveChoreListId(listParam);
        } else if (!listParam && activeChoreListId) {
            setActiveChoreListId(null);
        }
        // Run only on mount to read the initial URL
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeChoreListId) {
            setSearchParams((prev) => { prev.set('list', activeChoreListId); return prev; }, { replace: true });
        } else {
            setSearchParams((prev) => { prev.delete('list'); return prev; }, { replace: true });
        }
    }, [activeChoreListId, setSearchParams]);

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
            <PageTitle
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                title="Chores"
                actions={<>
                    <Button variant="ghost" onClick={() => setShowHelpDialog(true)} title="Help">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Help
                    </Button>
                    {isCollaborator && (
                        <Button variant="default" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            New List
                        </Button>
                    )}
                </>}
            />

            <Popup title="How to use Chore Lists" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
                    <p><span className="text-foreground font-medium">Chore Lists</span> are shared task boards for your map. Each list contains entries that collaborators can track and complete together.</p>
                    <p>Click a <span className="text-foreground font-medium">list card</span> to open it and see its entries. From there you can add, update, or remove entries.</p>
                    <p>Each entry has a <span className="text-foreground font-medium">state</span> — None, Ongoing, Blocked, or Done — and can be assigned to a collaborator.</p>
                    <p>Click <span className="text-foreground font-medium">New List</span> to create a chore list and give it a title, optional link, and description.</p>
                </div>
            </Popup>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
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
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 w-full">
                                        <h2 className={`font-medium text-lg w-full ${list.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{list.title}</h2>
                                        {hasDetails && (
                                            <div className="flex flex-wrap gap-1 sm:justify-end sm:shrink-0">
                                                {CHORE_ENTRY_STATES.filter((s) => counts[s] > 0).map((s) => (
                                                    <StatusBadge key={s} status={choreStateToStatus[s]} className="text-xs font-medium">
                                                        {counts[s]} {CHORE_ENTRY_STATE_LABEL[s]}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {list.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{list.description}</p>
                                    )}

                                    {list.link && (
                                        <a
                                            href={list.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground hover:text-[hsl(185,100%,54%)] transition-colors min-w-0 overflow-hidden"
                                        >
                                            <ExternalLink className="h-3 w-3 shrink-0"/>
                                            <span className="truncate min-w-0">{list.link}</span>
                                        </a>
                                    )}

                                    {/* Assignees */}
                                    {assignees.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {assignees.map((c) => (
                                                <UserAvatar key={c.id} username={c.username} avatarUrl={c.avatarUrl} inline={true}/>
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
