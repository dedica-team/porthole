import React, { useEffect, useState } from 'react';
import { Plus, CheckSquare, HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popup } from '@/components/ui/popup';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { fetchChoreLists } from '@/api/mapApi';
import type { ChoreList } from '@/types/chores';
import { isDecorative } from '@/types/landmark';
import { useShallow } from 'zustand/react/shallow';
import { useGroupFilter, GroupFilterPopover } from '@/components/ui/GroupFilterPopover';
import LandmarkInfoPopover from '@/components/LandmarkInfoPopover/LandmarkInfoPopover';
import { useMapActions } from '@/pages/MapPage/MapActionsContext';
import CreateChoreListDialog from './CreateChoreListDialog';
import EditChoreListDialog from './EditChoreListDialog';
import ChoreEntryRow from './ChoreEntryRow';

// Stable empty-object fallback so useShallow doesn't see a "new" value each render.
const EMPTY_LANDMARKS: Record<string, never> = {};

export default function ChoreListsView() {
    const {
        handleEditLandmark: onEditLandmark,
        handleRemoveLandmark: onRemoveLandmark,
        actionLoading: loading,
    } = useMapActions();
    const { currentMap, landmarksMap } = useMapStore(useShallow((s) => ({
        currentMap: s.currentMap,
        landmarksMap: s.currentMap?.landmarks ?? EMPTY_LANDMARKS,
    })));
    const choreLists = useMapStore((s) => s.choreLists);
    const setChoreLists = useMapStore((s) => s.setChoreLists);
    const choreListsFetched = useMapStore((s) => s.choreListsFetched);
    const setChoreListsFetched = useMapStore((s) => s.setChoreListsFetched);
    const choreListsLoading = useMapStore((s) => s.choreListsLoading);
    const setChoreListsLoading = useMapStore((s) => s.setChoreListsLoading);
    const choreListsError = useMapStore((s) => s.choreListsError);
    const setChoreListsError = useMapStore((s) => s.setChoreListsError);
    const userId = useAuthStore((s) => s.userId);

    const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));
    const [createOpen, setCreateOpen] = useState(false);
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [editingList, setEditingList] = useState<ChoreList | null>(null);
    const { hiddenGroups, setHiddenGroups, filterOpen, setFilterOpen, filterBtnRef, filterPopoverRef } =
        useGroupFilter('landmarks.chores.hiddenGroups');

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

    const sortedLists = [...choreLists].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.title.localeCompare(b.title);
    });

    const landmarks = Object.values(landmarksMap)
        .filter((lm) => !isDecorative(lm.type))
        .sort((a, b) => a.name.localeCompare(b.name));
    const groups = currentMap.groups ?? {};

    // Build ordered sections: one per group (sorted by name), then ungrouped
    const groupedSections: Array<{ groupId: string | null; label: string; color: string }> = [
        ...Object.values(groups)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((g) => ({ groupId: g.id, label: g.name, color: g.color })),
        { groupId: null, label: 'Ungrouped', color: '#6b7280' },
    ];

    const landmarksByGroup = (groupId: string | null) =>
        landmarks.filter((lm) => (lm.groupId ?? null) === groupId);

    const handleEntryUpdated = (updated: ChoreList) =>
        setChoreLists(choreLists.map((l) => (l.id === updated.id ? updated : l)));

    const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

    return (
        <div className="flex flex-col h-full overflow-y-auto">

            <Popup title="How to use Chore Lists" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
                    <p>Each <span className="text-foreground font-medium">column</span> is a chore list; each <span className="text-foreground font-medium">row</span> is an element. Cells only appear for elements that belong to that list.</p>
                    <p>Click a <span className="text-foreground font-medium">cell</span> to update its state (None, Ongoing, Blocked, Done) and assignee.</p>
                    <p>Click a <span className="text-foreground font-medium">column header</span> to rename the list, change its elements, mark it complete, or delete it.</p>
                    <p>Click <span className="text-foreground font-medium">New List</span> to create a chore list and give it a title, optional link, and description.</p>
                    <p>Click a <span className="text-foreground font-medium">element name</span> to edit it.</p>
                </div>
            </Popup>

            {/* ── Main card ───────────────────────────────────────────────────── */}
            <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">

                {/* Card header */}
                <div className="flex items-stretch border-b border-border shrink-0">
                    <div className="flex items-center gap-2 px-4 py-2.5 text-md font-semibold text-foreground flex-1">
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        Chores
                    </div>
                    <button className={cardBtnCls} onClick={() => setShowHelpDialog(true)}>
                        <HelpCircle className="h-3.5 w-3.5" /> Help
                    </button>
                    {isCollaborator && (
                        <button className={cardBtnCls} onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" /> New List
                        </button>
                    )}
                </div>

                {choreListsError && (
                    <p className="px-4 py-2 text-sm text-destructive shrink-0">{choreListsError}</p>
                )}

                {/* Empty / loading states */}
                {choreListsLoading && (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
                )}
                {!choreListsLoading && sortedLists.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                        <CheckSquare className="h-8 w-8 opacity-20" />
                        <span>No chore lists yet.</span>
                        {isCollaborator && (
                            <button className="text-sm text-primary hover:underline" onClick={() => setCreateOpen(true)}>
                                + Add your first list
                            </button>
                        )}
                    </div>
                )}

                {/* Table: landmarks as rows, chore lists as columns */}
                {!choreListsLoading && sortedLists.length > 0 && (
                <div className="overflow-x-auto">
                    <div className="min-w-max">
                        <table className="data-display-table w-full text-sm border-separate border-spacing-0">
                            <thead className="sticky top-0 z-30">
                                <tr>
                                    <th className="w-4 p-0 sticky left-0 z-20 data-sticky-header" />
                                    <th className="text-left p-0 sticky z-20 data-sticky-header" style={{ left: '1rem' }}>
                                        <div className="w-28 sm:w-44 px-2 sm:px-4 py-2 font-medium overflow-hidden">
                                            <Button
                                                ref={filterBtnRef}
                                                fullWidth={true}
                                                variant="flat"
                                                className={`h-7 gap-1.5 text-sm${hiddenGroups.size > 0 ? ' border-primary text-primary' : ''}`}
                                                title={hiddenGroups.size > 0 ? 'Groups filtered — click to change' : 'Filter groups'}
                                                onClick={() => setFilterOpen((v) => !v)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                                                </svg>
                                                {hiddenGroups.size > 0 ? `${hiddenGroups.size} hidden` : 'Filter'}
                                            </Button>
                                        </div>
                                    </th>
                                    {sortedLists.map((list) => (
                                        <th key={list.id} className="text-left px-3 py-2 min-w-56 font-medium bg-transparent align-bottom">
                                            {isCollaborator ? (
                                                <Button variant="ghost" fullWidth={true} title={list.description || undefined}
                                                    onClick={() => setEditingList(list)}
                                                >
                                                    <span className={list.completed ? 'line-through text-muted-foreground' : ''}>{list.title}</span>
                                                    {list.link && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
                                                </Button>
                                            ) : (
                                                <span
                                                    className={`text-sm font-medium normal-case${list.completed ? ' line-through text-muted-foreground' : ' text-muted-foreground'}`}
                                                    title={list.description || undefined}
                                                >
                                                    {list.title}
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {groupedSections.map(({ groupId, label, color }) => {
                                    if (hiddenGroups.has(groupId)) return null;
                                    const sectionLandmarks = landmarksByGroup(groupId);
                                    if (sectionLandmarks.length === 0) return null;
                                    return (
                                        <React.Fragment key={groupId ?? 'ungrouped'}>
                                            {sectionLandmarks.map((landmark, rowIdx) => (
                                                <tr key={landmark.id}>
                                                    {rowIdx === 0 && (
                                                        <td
                                                            rowSpan={sectionLandmarks.length}
                                                            className="group-stripe w-4 p-0 sticky left-0 z-10 select-none"
                                                            style={{
                                                                backgroundColor: `color-mix(in srgb, ${color} 40%, black)`,
                                                                minWidth: '1rem',
                                                                width: '1rem',
                                                            }}
                                                            title={label}
                                                        >
                                                            <div
                                                                className="flex items-center justify-center"
                                                                style={{ height: `${sectionLandmarks.length * 2.25}rem`, minHeight: '2rem' }}
                                                            >
                                                                <span
                                                                    className="text-md font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden"
                                                                    style={{
                                                                        writingMode: 'vertical-rl',
                                                                        transform: 'rotate(180deg)',
                                                                        color: `color-mix(in srgb, ${color} 25%, #fff)`,
                                                                        maxHeight: '8rem',
                                                                        textOverflow: 'ellipsis',
                                                                    }}
                                                                >
                                                                    {label}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="p-2 sticky z-10 data-sticky-cell" style={{ left: '1rem' }}>
                                                        <LandmarkInfoPopover
                                                            landmark={landmark}
                                                            onEditLandmark={onEditLandmark}
                                                            onRemoveLandmark={onRemoveLandmark}
                                                            loading={loading}
                                                        >
                                                            <Button variant="ghost" fullWidth={true} title={landmark.description} className="h-full w-full overflow-hidden justify-start px-3 py-2 text-md">
                                                                <span className="truncate">{landmark.name}</span>
                                                            </Button>
                                                        </LandmarkInfoPopover>
                                                    </td>
                                                    {sortedLists.map((list) => {
                                                        const entry = list.entries[landmark.id];
                                                        return (
                                                            <td key={list.id} className="p-0">
                                                                {entry ? (
                                                                    <ChoreEntryRow
                                                                        mapId={currentMap.id}
                                                                        listId={list.id}
                                                                        entry={entry}
                                                                        landmark={landmark}
                                                                        collaborators={currentMap.collaborators}
                                                                        isCollaborator={isCollaborator}
                                                                        onUpdated={handleEntryUpdated}
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center justify-start px-3 py-2">
                                                                        <span className="text-sm text-muted-foreground/40">—</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}

            </div>{/* end card */}

            <GroupFilterPopover
                open={filterOpen}
                btnRef={filterBtnRef}
                popoverRef={filterPopoverRef}
                sections={groupedSections.filter((s) => landmarksByGroup(s.groupId).length > 0)}
                hiddenGroups={hiddenGroups}
                onToggle={(groupId) => setHiddenGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
                    return next;
                })}
                onShowAll={() => setHiddenGroups(new Set())}
            />

            <CreateChoreListDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(lists) => setChoreLists(lists)}
            />

            <EditChoreListDialog
                key={editingList?.id}
                open={!!editingList}
                onOpenChange={(v) => { if (!v) setEditingList(null); }}
                choreList={editingList}
                onSaved={(lists) => setChoreLists(lists)}
                onToggleCompleted={(updated) => setChoreLists(choreLists.map((l) => (l.id === updated.id ? updated : l)))}
                onDeleted={(listId) => { setChoreLists(choreLists.filter((l) => l.id !== listId)); setEditingList(null); }}
            />
        </div>
    );
}




