import {useState, useEffect} from 'react';
import {Plus, Trash2, Pencil, ChevronDown, ChevronUp, MousePointer2, MoreHorizontal} from 'lucide-react';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Label} from '@/components/ui/label';
import {Separator} from '@/components/ui/separator';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {useMapStore} from '@/store/mapStore';
import {cn} from '@/lib/utils';
import type {Process, StageConnectionDirection} from '@/types/process';
import {
    editProcess,
    removeProcess,
    createProcessStage,
    editProcessStage,
    reorderProcessStages,
    removeProcessStage,
    editStageConnection,
    removeConnectionFromStage,
    fetchProcesses,
} from '@/api/mapApi';

export default function ProcessPanel() {
    const currentMap = useMapStore((s) => s.currentMap);
    const processes = useMapStore((s) => s.processes);
    const activeProcessId = useMapStore((s) => s.activeProcessId);
    const activeStageId = useMapStore((s) => s.activeStageId);
    const setProcesses = useMapStore((s) => s.setProcesses);
    const setProcessesFetched = useMapStore((s) => s.setProcessesFetched);
    const setProcessesLoading = useMapStore((s) => s.setProcessesLoading);
    const setProcessesError = useMapStore((s) => s.setProcessesError);
    const setActiveProcessId = useMapStore((s) => s.setActiveProcessId);
    const setActiveStageId = useMapStore((s) => s.setActiveStageId);
    const pickingConnection = useMapStore((s) => s.pickingConnection);
    const setPickingConnection = useMapStore((s) => s.setPickingConnection);

    const [actionError, setActionError] = useState('');

    // Edit dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Stage creation
    const [newStageName, setNewStageName] = useState('');
    const [addingStage, setAddingStage] = useState(false);

    // Confirm-delete state for process: null = idle, 'process' = confirm
    const [confirmDelete, setConfirmDelete] = useState<null | 'process'>(null);

    // Delete-stage dialog
    const [deleteStageDialogStageId, setDeleteStageDialogStageId] = useState<string | null>(null);

    // Edit-stage dialog
    const [editStageDialogOpen, setEditStageDialogOpen] = useState(false);
    const [editStageName, setEditStageName] = useState('');
    const [editStageId, setEditStageId] = useState<string | null>(null);
    const [editStageSaving, setEditStageSaving] = useState(false);

    // Edit-StageConnection dialog
    const [editScDialogOpen, setEditScDialogOpen] = useState(false);
    const [editScStageConnId, setEditScStageConnId] = useState<string | null>(null);
    const [editScTitle, setEditScTitle] = useState('');
    const [editScDirection, setEditScDirection] = useState<StageConnectionDirection>('FORWARD');
    const [editScSaving, setEditScSaving] = useState(false);
    const [editScConfirmDelete, setEditScConfirmDelete] = useState(false);
    const [editScFromName, setEditScFromName] = useState('');
    const [editScToName, setEditScToName] = useState('');
    const [editScConnName, setEditScConnName] = useState('');

    const processesFetched = useMapStore((s) => s.processesFetched);

    const mapId = currentMap?.id ?? '';
    const activeProcess: Process | undefined = processes.find((p) => p.id === activeProcessId);

    // Fetch processes on mount (or when map changes) if not yet fetched
    useEffect(() => {
        if (!mapId || processesFetched) return;
        setProcessesLoading(true);
        setProcessesError(null);
        fetchProcesses(mapId)
            .then((data) => {
                setProcesses(data);
                setProcessesFetched(true);
            })
            .catch((err: unknown) => setProcessesError(err instanceof Error ? err.message : 'Failed to load processes'))
            .finally(() => setProcessesLoading(false));
    }, [mapId, processesFetched, setProcesses, setProcessesFetched, setProcessesLoading, setProcessesError]);

    const withAction = async (fn: () => Promise<Process[]>) => {
        setActionError('');
        try {
            const updated = await fn();
            setProcesses(updated);
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : 'Action failed');
        }
    };

    const openEditDialog = () => {
        if (!activeProcess) return;
        setEditName(activeProcess.name);
        setEditDesc(activeProcess.description ?? '');
        setEditDialogOpen(true);
    };

    const handleSaveProcess = async () => {
        if (!activeProcessId) return;
        setEditSaving(true);
        await withAction(() => editProcess(mapId, activeProcessId, editName || undefined, editDesc || undefined));
        setEditSaving(false);
        setEditDialogOpen(false);
    };

    const handleDeleteProcess = async () => {
        if (!activeProcessId) return;
        await withAction(() => removeProcess(mapId, activeProcessId));
        setActiveProcessId(null);
    };

    const handleAddStage = async () => {
        if (!activeProcessId) return;
        const maxOrder = activeProcess?.stages.reduce((m, s) => Math.max(m, s.order), -1) ?? -1;
        await withAction(() => createProcessStage(mapId, activeProcessId, newStageName.trim() || undefined, maxOrder + 1));
        setNewStageName('');
        setAddingStage(false);
    };

    const handleDeleteStage = async (stageId: string) => {
        if (!activeProcessId) return;
        await withAction(() => removeProcessStage(mapId, activeProcessId, stageId));
        if (activeStageId === stageId) setActiveStageId(null);
        setConfirmDelete(null);
    };

    const openEditScDialog = (stageConnId: string, title: string | undefined, direction: StageConnectionDirection, connectionId: string) => {
        setEditScStageConnId(stageConnId);
        setEditScTitle(title ?? '');
        setEditScDirection(direction);
        setEditScConfirmDelete(false);
        const conn = currentMap?.connections[connectionId];
        setEditScConnName(conn?.name ?? conn?.type ?? '');
        setEditScFromName(conn ? (currentMap?.landmarks[conn.originId]?.name ?? '?') : '');
        setEditScToName(conn ? (currentMap?.landmarks[conn.targetId]?.name ?? '?') : '');
        setEditScDialogOpen(true);
    };

    const handleSaveSc = async () => {
        if (!activeProcessId || !activeStageId || !editScStageConnId) return;
        setEditScSaving(true);
        const trimmed = editScTitle.trim();
        await withAction(() =>
            editStageConnection(mapId, activeProcessId, activeStageId, editScStageConnId, {
                title: trimmed || undefined,
                clearTitle: trimmed === '',
                direction: editScDirection,
            }),
        );
        setEditScSaving(false);
        setEditScDialogOpen(false);
    };

    const handleDeleteScFromDialog = async () => {
        if (!activeProcessId || !activeStageId || !editScStageConnId) return;
        setEditScSaving(true);
        await withAction(() => removeConnectionFromStage(mapId, activeProcessId, activeStageId, editScStageConnId));
        setEditScSaving(false);
        setEditScDialogOpen(false);
        setEditScConfirmDelete(false);
    };

    const openEditStageDialog = (stage: { id: string; name?: string }) => {
        setEditStageId(stage.id);
        setEditStageName(stage.name ?? '');
        setEditStageDialogOpen(true);
    };

    const handleSaveStage = async () => {
        if (!activeProcessId || !editStageId) return;
        setEditStageSaving(true);
        const trimmed = editStageName.trim();
        await withAction(() =>
            editProcessStage(mapId, activeProcessId, editStageId, {
                name: trimmed || undefined,
                clearName: trimmed === '',
            }),
        );
        setEditStageSaving(false);
        setEditStageDialogOpen(false);
    };

    const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
        if (!activeProcessId || !activeProcess) return;
        const sorted = [...activeProcess.stages].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((s) => s.id === stageId);
        if (idx < 0) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const reordered = [...sorted];
        [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
        await withAction(() => reorderProcessStages(mapId, activeProcessId, reordered.map((s) => s.id)));
    };

    if (!activeProcess) return null;

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-3 p-4">
                {/* Header */}
                <div className="flex items-center gap-2">

                    <Button variant="ghost" fullWidth={true} className={"text-lg"}
                            title="Edit process" onClick={openEditDialog}>
                        {activeProcess.name}
                    </Button>
                </div>

                {activeProcess.description && (
                    <p className="text-sm text-muted-foreground">{activeProcess.description}</p>
                )}

                {actionError && <p className="text-sm text-destructive">{actionError}</p>}

                <Separator/>

                {/* Stages */}
                <Label>Stages</Label>

                {activeProcess.stages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No stages yet.</p>
                ) : (
                    <div className="flex flex-col gap-1">
                        {[...activeProcess.stages].sort((a, b) => a.order - b.order).map((stage, idx, sortedStages) => {
                            const isOpen = stage.id === activeStageId;
                            const connections = currentMap?.connections ?? {};
                            return (
                                <div key={stage.id}
                                     className="flex flex-col rounded-md overflow-hidden border border-border">
                                    {/* Stage header row */}
                                    <div
                                        className={cn(
                                            'flex items-center gap-1.5 px-2 py-1.5 transition-colors cursor-pointer select-none',
                                            isOpen ? 'bg-primary/10 text-primary' : 'bg-muted hover:bg-muted/70 text-foreground',
                                        )}
                                        onClick={() => setActiveStageId(isOpen ? null : stage.id)}>
                                        <ChevronDown
                                            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}/>
                                        <span className="text-sm truncate flex-1">
                      {stage.name ?? `Stage ${idx + 1}`}
                                            <span
                                                className="opacity-50 ml-1.5 text-sm">({stage.connections.length})</span>
                    </span>
                                        {/* Stage actions popover */}
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="h-3.5 w-3.5"/>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-40 p-1" side="right" align="start"
                                                            onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                                                    onClick={() => openEditStageDialog(stage)}>
                                                    <Pencil className="h-3.5 w-3.5"/> Edit name
                                                </button>
                                                <button
                                                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-40"
                                                    disabled={idx === 0}
                                                    onClick={() => handleMoveStage(stage.id, 'up')}>
                                                    <ChevronUp className="h-3.5 w-3.5"/> Move up
                                                </button>
                                                <button
                                                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-40"
                                                    disabled={idx === sortedStages.length - 1}
                                                    onClick={() => handleMoveStage(stage.id, 'down')}>
                                                    <ChevronDown className="h-3.5 w-3.5"/> Move down
                                                </button>
                                                <div className="my-1 border-t border-border"/>
                                                <button
                                                    className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
                                                    onClick={() => setDeleteStageDialogStageId(stage.id)}>
                                                    <Trash2 className="h-3.5 w-3.5"/> Delete
                                                </button>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Accordion body */}
                                    {isOpen && (
                                        <div
                                            className="flex flex-col gap-1 px-2 py-2 bg-muted/30 border-t border-border">
                                            {stage.connections.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No connections yet.</p>
                                            ) : (
                                                stage.connections.map((sc) => {
                                                    const conn = connections[sc.connectionId];
                                                    if (!conn) return null;
                                                    const fromLm = currentMap?.landmarks[conn.originId];
                                                    const toLm = currentMap?.landmarks[conn.targetId];
                                                    const dirLabel = sc.direction === 'REVERSE' ? '←' : sc.direction === 'BIDIRECTIONAL' ? '↔' : '→';
                                                    return (
                                                        <Button
                                                            key={sc.id}
                                                            variant={"ghost"}
                                                            fullWidth={true}
                                                            onClick={() => openEditScDialog(sc.id, sc.title, sc.direction, sc.connectionId)}
                                                        >
                                                            <span className="flex flex-col items-start text-left whitespace-normal break-words ">
                                                                <span className="text-foreground">{sc.title ?? conn.name ?? conn.type}</span>
                                                                <span className="text-sm text-muted-foreground">{fromLm?.name ?? '?'} {dirLabel} {toLm?.name ?? '?'}</span>
                                                            </span>
                                                        </Button>
                                                    );
                                                })
                                            )}
                                            {/* Add connection — full-width below existing connections */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        className={cn(
                                                            'mt-1 h-7 w-full gap-1.5 text-sm justify-center',
                                                            pickingConnection
                                                                ? 'text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary'
                                                                : 'text-muted-foreground hover:text-foreground',
                                                        )}
                                                        onClick={() => setPickingConnection(!pickingConnection)}>
                                                        <MousePointer2 className="h-3.5 w-3.5"/>
                                                        {pickingConnection ? 'Exit pick mode' : 'Add Connection'}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-55 text-sm">
                                                    Click a connection line on the map to add or remove it from this
                                                    stage.
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add stage — below the list */}
                {addingStage ? (
                    <div className="flex gap-1.5">
                        <Input value={newStageName}
                               onChange={(e) => setNewStageName(e.target.value)}
                               placeholder="Stage name (optional)"
                               className="h-7 text-sm flex-1"
                               onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                               autoFocus/>
                        <Button size="sm" className="h-7 px-2 text-sm" onClick={handleAddStage}>Add</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-sm"
                                onClick={() => setAddingStage(false)}>✕</Button>
                    </div>
                ) : (
                    <Button fullWidth={true}
                            onClick={() => setAddingStage(true)}>
                        <Plus className="h-3.5 w-3.5"/> Add Stage
                    </Button>
                )}
            </div>

            {/* Delete stage confirmation dialog */}
            <Dialog open={!!deleteStageDialogStageId} onOpenChange={(open) => {
                if (!open) setDeleteStageDialogStageId(null);
            }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete stage?</DialogTitle>
                        <DialogDescription>This will remove the stage and all its connections from the process. This
                            action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 text-sm"
                            onClick={() => {
                                if (deleteStageDialogStageId) handleDeleteStage(deleteStageDialogStageId);
                                setDeleteStageDialogStageId(null);
                            }}
                        >
                            Delete
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1 text-sm"
                                onClick={() => setDeleteStageDialogStageId(null)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit stage dialog */}
            <Dialog open={editStageDialogOpen} onOpenChange={setEditStageDialogOpen}>
                <DialogContent className="sm:max-w-85">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Edit Stage Name</DialogTitle>
                        <DialogDescription>
                            Update the stage name for the currently selected process stage.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5 py-2">
                        <Label htmlFor="dlg-stage-name" className="text-sm">Name</Label>
                        <Input id="dlg-stage-name" value={editStageName}
                               onChange={(e) => setEditStageName(e.target.value)}
                               placeholder="Stage name (optional)"
                               className="h-8 text-sm"
                               onKeyDown={(e) => e.key === 'Enter' && handleSaveStage()}/>
                    </div>
                    <DialogFooter>
                        <Button size="sm" className="text-sm"
                                onClick={handleSaveStage} disabled={editStageSaving}>
                            {editStageSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit StageConnection dialog */}
            <Dialog open={editScDialogOpen} onOpenChange={(open) => {
                setEditScDialogOpen(open);
                setEditScConfirmDelete(false);
            }}>
                <DialogContent className="sm:max-w-85">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Edit Connection</DialogTitle>
                        <DialogDescription>
                            Update the stage connection title or direction, or remove it from the current stage.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        {/* Connection info – read-only */}
                        <div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2">
                            <div className="flex items-center gap-1.5 text-sm text-foreground mt-0.5">
                                <span className="truncate max-w-25">{editScFromName}</span>
                                <span>→</span>
                                <span className="truncate max-w-25">{editScToName}</span>
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">{editScConnName}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dlg-sc-title" className="text-sm">Title (optional)</Label>
                            <Input id="dlg-sc-title" value={editScTitle}
                                   onChange={(e) => setEditScTitle(e.target.value)}
                                   placeholder="e.g. Send report"
                                   className="h-8 text-sm"/>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dlg-sc-dir" className="text-sm">Direction</Label>
                            <select id="dlg-sc-dir" value={editScDirection}
                                    onChange={(e) => setEditScDirection(e.target.value as StageConnectionDirection)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                <option value="FORWARD">Forward (→)</option>
                                <option value="REVERSE">Reverse (←)</option>
                                <option value="BIDIRECTIONAL">Bidirectional (↔)</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                        <div className="flex items-center gap-1">
                            {editScConfirmDelete ? (
                                <>
                                    <Button size="sm" variant="destructive" className="text-sm h-7 px-2"
                                            onClick={handleDeleteScFromDialog} disabled={editScSaving}>
                                        Confirm delete
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-sm h-7 px-2"
                                            onClick={() => setEditScConfirmDelete(false)} disabled={editScSaving}>
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <Button size="sm" variant="ghost"
                                        className="text-sm h-7 px-2 text-destructive hover:text-destructive/80 gap-1"
                                        onClick={() => setEditScConfirmDelete(true)} disabled={editScSaving}>
                                    <Trash2 className="h-3 w-3"/> Delete
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button size="sm" className="text-sm"
                                    onClick={handleSaveSc} disabled={editScSaving}>
                                {editScSaving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit process dialog */}
            <Dialog open={editDialogOpen} onOpenChange={(open) => {
                setEditDialogOpen(open);
                if (!open) setConfirmDelete(null);
            }}>
                <DialogContent className="sm:max-w-95">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Edit Process</DialogTitle>
                        <DialogDescription>
                            Update the process name and description for the currently selected process.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dlg-proc-name" className="text-sm">Name</Label>
                            <Input id="dlg-proc-name" value={editName}
                                   onChange={(e) => setEditName(e.target.value)}
                                   className="h-8 text-sm"
                                   onKeyDown={(e) => e.key === 'Enter' && handleSaveProcess()}/>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dlg-proc-desc" className="text-sm">Description</Label>
                            <Textarea id="dlg-proc-desc" value={editDesc}
                                      onChange={(e) => setEditDesc(e.target.value)}
                                      className="text-sm resize-none" rows={3}/>
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                        <div className="flex items-center gap-1">
                            {confirmDelete === 'process' ? (
                                <>
                                    <Button size="sm" variant="destructive" className="text-sm h-7 px-2"
                                            onClick={async () => {
                                                setEditDialogOpen(false);
                                                setConfirmDelete(null);
                                                await handleDeleteProcess();
                                            }} disabled={editSaving}>
                                        Confirm delete
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-sm h-7 px-2"
                                            onClick={() => setConfirmDelete(null)} disabled={editSaving}>
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <Button size="sm" variant="ghost"
                                        className="text-sm h-7 px-2 text-destructive hover:text-destructive/80 gap-1"
                                        onClick={() => setConfirmDelete('process')} disabled={editSaving}>
                                    <Trash2 className="h-3 w-3"/> Delete
                                </Button>
                            )}
                        </div>
                        <Button size="sm" className="text-sm"
                                onClick={handleSaveProcess} disabled={editSaving}>
                            {editSaving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
