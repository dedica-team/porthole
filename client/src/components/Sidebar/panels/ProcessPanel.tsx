import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Loader2, RefreshCw, HelpCircle, Pencil, ChevronDown, ChevronUp, MousePointer2, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useMapStore } from '@/store/mapStore';
import { cn } from '@/lib/utils';
import type { Process, StageConnectionDirection } from '@/types/process';
import {
  createProcess,
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
  const currentMap  = useMapStore((s) => s.currentMap);
  const processes   = useMapStore((s) => s.processes);
  const processesLoading = useMapStore((s) => s.processesLoading);
  const processesError   = useMapStore((s) => s.processesError);
  const activeProcessId  = useMapStore((s) => s.activeProcessId);
  const activeStageId    = useMapStore((s) => s.activeStageId);
  const setProcesses        = useMapStore((s) => s.setProcesses);
  const setProcessesFetched = useMapStore((s) => s.setProcessesFetched);
  const setProcessesLoading = useMapStore((s) => s.setProcessesLoading);
  const setProcessesError   = useMapStore((s) => s.setProcessesError);
  const setActiveProcessId  = useMapStore((s) => s.setActiveProcessId);
  const setActiveStageId    = useMapStore((s) => s.setActiveStageId);
  const pickingConnection   = useMapStore((s) => s.pickingConnection);
  const setPickingConnection = useMapStore((s) => s.setPickingConnection);

  const [newProcessName, setNewProcessName] = useState('');
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [actionError, setActionError] = useState('');

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Stage creation
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  // Confirm-delete state: null = idle, 'process' = process confirm, stageId = stage confirm
  const [confirmDelete, setConfirmDelete] = useState<null | 'process' | string>(null);

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
      .then((data) => { setProcesses(data); setProcessesFetched(true); })
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

  const handleRetry = async () => {
    if (!mapId) return;
    setProcessesLoading(true);
    setProcessesError(null);
    try {
      const data = await fetchProcesses(mapId);
      setProcesses(data);
      setProcessesFetched(true);
    } catch (err: unknown) {
      setProcessesError(err instanceof Error ? err.message : 'Failed to load processes');
    } finally {
      setProcessesLoading(false);
    }
  };

  const handleCreateProcess = async () => {
    if (!newProcessName.trim()) return;
    await withAction(() => createProcess(mapId, newProcessName.trim()));
    setNewProcessName('');
    setCreatingProcess(false);
  };

  const handleOpenProcess = (p: Process) => {
    setActiveProcessId(p.id);
    setActiveStageId(null);
    setActionError('');
    setAddingStage(false);
    setConfirmDelete(null);
  };

  const handleBackToList = () => {
    setActiveProcessId(null);
    setActiveStageId(null);
    setActionError('');
    setAddingStage(false);
    setConfirmDelete(null);
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
    handleBackToList();
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


  // ── View 2: Process Detail ─────────────────────────────────────────────────
  if (activeProcess) {
    return (
      <TooltipProvider>
        <div className="flex flex-col gap-3 p-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
              onClick={handleBackToList}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground truncate flex-1">
              {activeProcess.name}
            </span>
            {/* Edit icon → opens dialog */}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              title="Edit process" onClick={openEditDialog}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {activeProcess.description && (
            <p className="text-xs text-muted-foreground">{activeProcess.description}</p>
          )}

          {actionError && <p className="text-xs text-destructive">{actionError}</p>}

          <Separator />

          {/* Stages */}
          <Label className="text-xs text-muted-foreground">Stages</Label>

          {activeProcess.stages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No stages yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {[...activeProcess.stages].sort((a, b) => a.order - b.order).map((stage, idx, sortedStages) => {
                const isOpen = stage.id === activeStageId;
                const isConfirmingDelete = confirmDelete === stage.id;
                const connections = currentMap?.connections ?? {};
                return (
                  <div key={stage.id} className="flex flex-col rounded-md overflow-hidden border border-border">
                    {/* Stage header row */}
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1.5 transition-colors cursor-pointer select-none',
                        isOpen ? 'bg-sky-950 text-sky-300' : 'bg-muted hover:bg-muted/70 text-foreground',
                      )}
                      onClick={() => !isConfirmingDelete && setActiveStageId(isOpen ? null : stage.id)}>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      <span className="text-xs truncate flex-1">
                        {stage.name ?? `Stage ${idx + 1}`}
                        <span className="opacity-50 ml-1.5 text-[11px]">({stage.connections.length})</span>
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
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" side="right" align="start"
                          onClick={(e) => e.stopPropagation()}>
                          <button
                            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                            onClick={() => openEditStageDialog(stage)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit name
                          </button>
                          <button
                            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(stage.id, 'up')}>
                            <ChevronUp className="h-3.5 w-3.5" /> Move up
                          </button>
                          <button
                            className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-40"
                            disabled={idx === sortedStages.length - 1}
                            onClick={() => handleMoveStage(stage.id, 'down')}>
                            <ChevronDown className="h-3.5 w-3.5" /> Move down
                          </button>
                          <div className="my-1 border-t border-border" />
                          {isConfirmingDelete ? (
                            <div className="flex flex-col gap-1 px-1 pb-1">
                              <span className="text-[11px] text-destructive px-1">Delete stage?</span>
                              <div className="flex gap-1">
                                <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px] flex-1"
                                  onClick={() => handleDeleteStage(stage.id)}>
                                  Delete
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] flex-1"
                                  onClick={() => setConfirmDelete(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-destructive hover:bg-muted transition-colors"
                              onClick={() => setConfirmDelete(stage.id)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Accordion body */}
                    {isOpen && (
                      <div className="flex flex-col gap-1 px-2 py-2 bg-muted/30 border-t border-border">
                        {stage.connections.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">No connections yet.</p>
                        ) : (
                          stage.connections.map((sc) => {
                            const conn = connections[sc.connectionId];
                            if (!conn) return null;
                            const fromLm = currentMap?.landmarks[conn.originId];
                            const toLm   = currentMap?.landmarks[conn.targetId];
                            const dirLabel = sc.direction === 'REVERSE' ? '←' : sc.direction === 'BIDIRECTIONAL' ? '↔' : '→';
                            return (
                              <button
                                key={sc.id}
                                type="button"
                                className="flex items-center gap-2 rounded bg-muted px-2 py-1 w-full text-left hover:bg-muted/70 transition-colors cursor-pointer"
                                onClick={() => openEditScDialog(sc.id, sc.title, sc.direction, sc.connectionId)}
                              >
                                <span className="text-[11px] text-foreground truncate flex-1">
                                  {sc.title ?? conn.name ?? conn.type} · {fromLm?.name ?? '?'} {dirLabel} {toLm?.name ?? '?'}
                                </span>
                                <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                              </button>
                            );
                          })
                        )}
                        {/* Add connection — full-width below existing connections */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'mt-1 h-7 w-full gap-1.5 text-xs justify-center',
                                pickingConnection
                                  ? 'text-sky-400 bg-sky-950 hover:bg-sky-900 hover:text-sky-300'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                              onClick={() => setPickingConnection(!pickingConnection)}>
                              <MousePointer2 className="h-3.5 w-3.5" />
                              {pickingConnection ? 'Exit pick mode' : 'Add Connection'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-55 text-xs">
                            Click a connection line on the map to add or remove it from this stage.
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
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                autoFocus />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddStage}>Add</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                onClick={() => setAddingStage(false)}>✕</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 self-start"
              onClick={() => setAddingStage(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Stage
            </Button>
          )}
        </div>

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
              <Label htmlFor="dlg-stage-name" className="text-xs">Name</Label>
              <Input id="dlg-stage-name" value={editStageName}
                onChange={(e) => setEditStageName(e.target.value)}
                placeholder="Stage name (optional)"
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveStage()} />
            </div>
            <DialogFooter>
              <Button size="sm" className="text-xs"
                onClick={handleSaveStage} disabled={editStageSaving}>
                {editStageSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit StageConnection dialog */}
        <Dialog open={editScDialogOpen} onOpenChange={(open) => { setEditScDialogOpen(open); setEditScConfirmDelete(false); }}>
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

                <div className="flex items-center gap-1.5 text-[11px] text-foreground mt-0.5">
                  <span className="truncate max-w-25">{editScFromName}</span>
                  <span>→</span>
                  <span className="truncate max-w-25">{editScToName}</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{editScConnName}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dlg-sc-title" className="text-xs">Title (optional)</Label>
                <Input id="dlg-sc-title" value={editScTitle}
                  onChange={(e) => setEditScTitle(e.target.value)}
                  placeholder="e.g. Send report"
                  className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dlg-sc-dir" className="text-xs">Direction</Label>
                <select id="dlg-sc-dir" value={editScDirection}
                  onChange={(e) => setEditScDirection(e.target.value as StageConnectionDirection)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="FORWARD">Forward (→)</option>
                  <option value="REVERSE">Reverse (←)</option>
                  <option value="BIDIRECTIONAL">Bidirectional (↔)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              {/* Delete – left-aligned, with inline confirm */}
              <div className="flex items-center gap-1">
                {editScConfirmDelete ? (
                  <>
                    <Button size="sm" variant="destructive" className="text-xs h-7 px-2"
                      onClick={handleDeleteScFromDialog} disabled={editScSaving}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2"
                      onClick={() => setEditScConfirmDelete(false)} disabled={editScSaving}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost"
                    className="text-xs h-7 px-2 text-destructive hover:text-destructive/80 gap-1"
                    onClick={() => setEditScConfirmDelete(true)} disabled={editScSaving}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
              {/* Save – right-aligned */}
              <div className="flex items-center gap-1">
                <Button size="sm" className="text-xs"
                  onClick={handleSaveSc} disabled={editScSaving}>
                  {editScSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit process dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setConfirmDelete(null); }}>
          <DialogContent className="sm:max-w-95">
            <DialogHeader>
              <DialogTitle className="text-sm">Edit Process</DialogTitle>
              <DialogDescription>
                Update the process name and description for the currently selected process.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dlg-proc-name" className="text-xs">Name</Label>
                <Input id="dlg-proc-name" value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProcess()} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dlg-proc-desc" className="text-xs">Description</Label>
                <Textarea id="dlg-proc-desc" value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="text-sm resize-none" rows={3} />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex items-center gap-1">
                {confirmDelete === 'process' ? (
                  <>
                    <Button size="sm" variant="destructive" className="text-xs h-7 px-2"
                      onClick={async () => { setEditDialogOpen(false); setConfirmDelete(null); await handleDeleteProcess(); }} disabled={editSaving}>
                      Confirm delete
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2"
                      onClick={() => setConfirmDelete(null)} disabled={editSaving}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost"
                    className="text-xs h-7 px-2 text-destructive hover:text-destructive/80 gap-1"
                    onClick={() => setConfirmDelete('process')} disabled={editSaving}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
              </div>
              <Button size="sm" className="text-xs"
                onClick={handleSaveProcess} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  // ── View 1: Process List ───────────────────────────────────────────────────
  return (
    <TooltipProvider>
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-foreground">Processes</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="max-w-72 text-xs space-y-1.5 leading-relaxed">
              <p className="font-semibold">Processes</p>
              <p>Processes model ordered sequences of map connections — useful for workflows, routes, or data flows.</p>
              <p><span className="font-medium">Stages</span> are the steps within a process. Each stage can hold one or more connections.</p>
              <p>To add a connection to a stage, open the stage accordion and click <span className="font-medium">Add Connection</span>, then click a connection line on the map. Click it again to remove it.</p>
              <p>Each stage connection can have an optional <span className="font-medium">title</span> and a <span className="font-medium">direction</span> (Forward, Reverse, or Bidirectional) that represents how the connection is traversed in that step.</p>
              <p>Stages can be reordered with the move-up / move-down actions in the stage menu.</p>
            </PopoverContent>
          </Popover>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => setCreatingProcess(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {creatingProcess && (
        <div className="flex gap-1.5">
          <Input value={newProcessName}
            onChange={(e) => setNewProcessName(e.target.value)}
            placeholder="Process name"
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProcess()}
            autoFocus />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateProcess}>Create</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
            onClick={() => { setCreatingProcess(false); setNewProcessName(''); }}>✕</Button>
        </div>
      )}

      {actionError && <p className="text-xs text-destructive">{actionError}</p>}

      {processesLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading processes…
        </div>
      ) : processesError ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-destructive">{processesError}</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 self-start" onClick={handleRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : processes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No processes yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {processes.map((p) => (
            <div key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer transition-colors select-none',
                p.id === activeProcessId
                  ? 'bg-sky-950 border border-sky-800'
                  : 'bg-muted hover:bg-muted/70',
              )}
              onClick={() => handleOpenProcess(p)}>
              <span className={cn(
                'text-xs truncate flex-1',
                p.id === activeProcessId ? 'text-sky-300 font-medium' : 'text-foreground',
              )}>
                {p.name}
              </span>
              {p.stages.length > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {p.stages.length} stage{p.stages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
