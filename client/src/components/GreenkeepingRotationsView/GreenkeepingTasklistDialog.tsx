import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock, Download, History, ListChecks, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GreenkeepingChecklist, GreenkeepingChecklistItem, GreenkeepingRotation, GreenkeepingTaskItem } from '@/types/greenkeeping';
import {
  discardGreenkeepingChecklist,
  finishGreenkeepingChecklist,
  startGreenkeepingChecklist,
  updateGreenkeepingChecklist,
} from '@/api/mapApi';
import { useAuthStore, useMapStore } from '@/store/mapStore';
import { createTasklistExportData, saveTasklistAsJson } from './tasklistExportUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rotation: GreenkeepingRotation;
  inline?: boolean;
  headerAction?: ReactNode;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function GreenkeepingTasklistDialog({
  open,
  onOpenChange,
  rotation: initialRotation,
  inline = false,
  headerAction,
}: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const greenkeepingRotations = useMapStore((s) => s.greenkeepingRotations);
  const setGreenkeepingRotations = useMapStore((s) => s.setGreenkeepingRotations);
  const userId = useAuthStore((s) => s.userId);

  // Always bind to the latest rotation state from store if available
  const rotation = greenkeepingRotations.find((r) => r.id === initialRotation.id) ?? initialRotation;
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // New checklist creation state
  const [newTitle, setNewTitle] = useState(getTodayDateString());

  // Active checklist local state for editing
  const [checklistTitle, setChecklistTitle] = useState('');
  const [items, setItems] = useState<GreenkeepingChecklistItem[]>([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [busy, setBusy] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // Sync active checklist from rotation
  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmFinish(false);
    setConfirmDiscard(false);
    setSavedSuccess(false);

    if (rotation.currentChecklist) {
      setChecklistTitle(rotation.currentChecklist.title);
      setItems(rotation.currentChecklist.items.map((i) => ({ ...i })));
      setActiveTab('active');
    } else {
      setNewTitle(getTodayDateString());
      setChecklistTitle('');
      setItems([]);
    }

    if (rotation.completedChecklists && rotation.completedChecklists.length > 0) {
      setSelectedHistoryId(rotation.completedChecklists[rotation.completedChecklists.length - 1].id);
    } else {
      setSelectedHistoryId(null);
    }
  }, [open, rotation.id, rotation.currentChecklist, rotation.completedChecklists]);

  const handleStartChecklist = async () => {
    if (!currentMap) return;
    setError('');
    setBusy(true);
    try {
      const updated = await startGreenkeepingChecklist(currentMap.id, rotation.id, newTitle.trim() || undefined);
      setGreenkeepingRotations(greenkeepingRotations.map((r) => (r.id === updated.id ? updated : r)));
      if (updated.currentChecklist) {
        setChecklistTitle(updated.currentChecklist.title);
        setItems(updated.currentChecklist.items.map((i) => ({ ...i })));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checklist.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveActiveChecklist = async (itemsToSave = items, titleToSave = checklistTitle) => {
    if (!currentMap || !rotation.currentChecklist) return;
    setError('');
    setBusy(true);
    try {
      const updated = await updateGreenkeepingChecklist(currentMap.id, rotation.id, {
        title: titleToSave.trim() || undefined,
        items: itemsToSave.map((it) => ({
          id: it.id,
          title: it.title.trim(),
          done: it.done,
          note: it.note?.trim() || null,
        })),
      });
      setGreenkeepingRotations(greenkeepingRotations.map((r) => (r.id === updated.id ? updated : r)));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save checklist.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishChecklist = async () => {
    if (!currentMap || !rotation.currentChecklist) return;
    setError('');
    setBusy(true);
    try {
      const updated = await finishGreenkeepingChecklist(currentMap.id, rotation.id);
      setGreenkeepingRotations(greenkeepingRotations.map((r) => (r.id === updated.id ? updated : r)));
      setConfirmFinish(false);
      setActiveTab('history');
      if (updated.completedChecklists && updated.completedChecklists.length > 0) {
        setSelectedHistoryId(updated.completedChecklists[updated.completedChecklists.length - 1].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to finish checklist.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardChecklist = async () => {
    if (!currentMap || !rotation.currentChecklist) return;
    setError('');
    setBusy(true);
    try {
      const updated = await discardGreenkeepingChecklist(currentMap.id, rotation.id);
      setGreenkeepingRotations(greenkeepingRotations.map((r) => (r.id === updated.id ? updated : r)));
      setConfirmDiscard(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to discard checklist.');
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = (index: number) => {
    const updated = items.map((task, i) => (i === index ? { ...task, done: !task.done } : task));
    setItems(updated);
  };

  const updateItem = (index: number, field: 'title' | 'note', value: string) => {
    const updated = items.map((task, i) => (i === index ? { ...task, [field]: value } : task));
    setItems(updated);
  };

  const addItem = () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}`;
    setItems([...items, { id, title: '', done: false, note: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleExportJson = async (checklistToExport?: GreenkeepingChecklist | null) => {
    setError('');
    const exportTitle = checklistToExport ? checklistToExport.title : checklistTitle;
    const exportTasks: GreenkeepingTaskItem[] = checklistToExport
      ? checklistToExport.items.map((i) => ({ id: i.id, done: i.done, title: i.title, note: i.note ?? '' }))
      : items.map((i) => ({ id: i.id, done: i.done, title: i.title, note: i.note ?? '' }));

    try {
      const exportData = createTasklistExportData(rotation, exportTitle, exportTasks);
      await saveTasklistAsJson(exportData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export JSON.');
    }
  };

  const completedChecklists = rotation.completedChecklists ?? [];
  const selectedHistory = completedChecklists.find((c) => c.id === selectedHistoryId) ?? completedChecklists[completedChecklists.length - 1];

  const collaboratorMap = currentMap ? Object.fromEntries(currentMap.collaborators.map((c) => [c.id, c.username])) : {};

  const content = (
    <>
        <DialogHeader className="shrink-0 pb-1">
          {!inline && (
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base font-semibold truncate">
                {rotation.name} – Checklist
              </DialogTitle>
              {headerAction}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 mt-2 border-b border-border pb-1">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'active' ? 'default' : 'ghost'}
              className="h-7 text-xs gap-1.5"
              onClick={() => setActiveTab('active')}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Active Checklist
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              className="h-7 text-xs gap-1.5"
              onClick={() => setActiveTab('history')}
            >
              <History className="h-3.5 w-3.5" />
              History ({completedChecklists.length})
            </Button>
          </div>
        </DialogHeader>

        {/* Tab Content */}
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
          {activeTab === 'active' ? (
            rotation.currentChecklist ? (
              // ── Active In-Progress Checklist ───────────────────────────────
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">Checklist Title</Label>
                    <span className="text-xs text-muted-foreground">
                      {items.filter((t) => t.done).length} / {items.length} tasks completed
                    </span>
                  </div>
                  <Input
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    placeholder="Checklist title (e.g. 2026-10-21)…"
                    className="h-8 text-sm"
                    disabled={!isCollaborator}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Label className="text-xs font-medium text-muted-foreground">Checklist Items</Label>
                  {isCollaborator && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={addItem}
                    >
                      <Plus className="h-3 w-3" />
                      Add task
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-2">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center text-xs text-muted-foreground gap-2">
                      <p>No tasks configured in this checklist.</p>
                      {isCollaborator && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={addItem}
                        >
                          <Plus className="h-3 w-3" /> Add first task
                        </Button>
                      )}
                    </div>
                  ) : (
                    items.map((task, index) => (
                      <div
                        key={task.id}
                        className={`flex items-start gap-2 rounded border p-2.5 transition-colors ${
                          task.done ? 'bg-secondary/40 border-border/60' : 'border-border bg-card'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleDone(index)}
                          aria-label={`Mark task ${index + 1} done`}
                          disabled={!isCollaborator}
                          className="h-4 w-4 mt-2 rounded border-input accent-[hsl(var(--primary))] cursor-pointer shrink-0"
                        />
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <Input
                            value={task.title}
                            onChange={(e) => updateItem(index, 'title', e.target.value)}
                            placeholder="Task title…"
                            disabled={!isCollaborator}
                            className={`h-8 text-sm w-full ${
                              task.done ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          />
                          <Input
                            value={task.note ?? ''}
                            onChange={(e) => updateItem(index, 'note', e.target.value)}
                            placeholder="Optional note / execution log…"
                            disabled={!isCollaborator}
                            className="h-7 text-xs w-full text-muted-foreground"
                          />
                        </div>
                        {isCollaborator && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeItem(index)}
                            title="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Confirm Finish Prompt */}
                {confirmFinish && (
                  <div className="flex flex-col gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      Finish and lock checklist?
                    </div>
                    <p className="text-muted-foreground">
                      This checklist will be marked complete, recorded with timestamp and author, and moved to permanent history as read-only.
                    </p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setConfirmFinish(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs bg-amber-500 text-black hover:bg-amber-400 gap-1"
                        onClick={handleFinishChecklist}
                        disabled={busy}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Confirm Finish
                      </Button>
                    </div>
                  </div>
                )}

                {/* Confirm Discard Prompt */}
                {confirmDiscard && (
                  <div className="flex flex-col gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                    <p className="font-medium">Discard active in-progress checklist? All active task state will be deleted.</p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setConfirmDiscard(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleDiscardChecklist}
                        disabled={busy}
                      >
                        Confirm Discard
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // ── No Active Checklist -> Start Form ───────────────────────────
              <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                <div className="rounded-full bg-secondary/80 p-3">
                  <ListChecks className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <p className="text-sm font-medium text-foreground">No active checklist in progress</p>
                  <p className="text-xs text-muted-foreground">
                    Start today's checklist from the rotation template to collaborate and record duty notes.
                  </p>
                </div>

                {isCollaborator ? (
                  <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
                    <div className="flex flex-col gap-1 text-left">
                      <Label className="text-xs text-muted-foreground">Checklist Title</Label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. 2026-10-21"
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleStartChecklist}
                      disabled={busy}
                      className="gap-1.5 h-8 text-xs mt-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Start Checklist
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Only collaborators can start a checklist.</p>
                )}
              </div>
            )
          ) : (
            // ── History View ────────────────────────────────────────────────
            <div className="flex flex-col gap-3">
              {completedChecklists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground/60" />
                  <p>No completed checklists in history yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Selector for completed checklists */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground shrink-0">Select Record:</Label>
                    <select
                      value={selectedHistory?.id ?? ''}
                      onChange={(e) => setSelectedHistoryId(e.target.value)}
                      aria-label="Select completed checklist record"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {completedChecklists.map((c, idx) => (
                        <option key={c.id} value={c.id}>
                          {c.title} — {c.finishedAt ? new Date(c.finishedAt).toLocaleDateString() : `Checklist #${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHistory && (
                    <div className="flex flex-col gap-2 rounded border border-border bg-card/60 p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border pb-2">
                        <div className="font-semibold text-sm text-foreground">{selectedHistory.title}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                          {selectedHistory.finishedAt && (
                            <span>
                              Finished: {new Date(selectedHistory.finishedAt).toLocaleString()}
                            </span>
                          )}
                          {selectedHistory.finishedBy && (
                            <span className="text-foreground font-medium">
                              by {collaboratorMap[selectedHistory.finishedBy] ?? 'Collaborator'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        {selectedHistory.items.map((item, idx) => (
                          <div
                            key={item.id ?? idx}
                            className={`flex flex-col gap-1 rounded border p-2 text-xs ${
                              item.done ? 'bg-secondary/30 border-border/60' : 'border-border bg-background'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.done}
                                disabled={true}
                                aria-label={`Task ${idx + 1} done status`}
                                className="h-3.5 w-3.5 rounded border-input cursor-not-allowed opacity-80"
                              />
                              <span className={`flex-1 font-medium ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {item.title}
                              </span>
                            </div>
                            {item.note && (
                              <p className="text-muted-foreground text-[11px] ml-5.5 italic">
                                Note: {item.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleExportJson(selectedHistory)}
                        >
                          <Download className="h-3 w-3" />
                          Export as JSON
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2 border-t border-border">

          {activeTab === 'active' && rotation.currentChecklist && isCollaborator && (
            <div className="flex items-center gap-2">
              {!confirmDiscard && !confirmFinish && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDiscard(true)}
                  disabled={busy}
                >
                  Discard
                </Button>
              )}
              {!confirmFinish && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleSaveActiveChecklist()}
                  disabled={busy}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Saved
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              )}
              {!confirmFinish && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setConfirmFinish(true)}
                  disabled={busy}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finish Checklist
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
    </>
  );

  if (inline) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground flex-1">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
            {rotation.name} – Checklist
          </div>
          {headerAction}
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {content}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] flex flex-col gap-3 p-4 sm:p-6 overflow-hidden" aria-describedby={undefined}>
        {content}
      </DialogContent>
    </Dialog>
  );
}
