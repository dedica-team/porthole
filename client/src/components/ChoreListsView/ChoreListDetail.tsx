import React, { useState } from 'react';
import { ChevronLeft, Pencil, CheckSquare, Square, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/mapStore';
import { useAuthStore } from '@/store/mapStore';
import type { ChoreList, ChoreEntry } from '@/types/chores';
import { toggleChoreListCompleted, deleteChoreList } from '@/api/mapApi';
import ChoreEntryRow from './ChoreEntryRow';
import EditChoreListDialog from './EditChoreListDialog';

interface Props {
  choreList: ChoreList;
  onUpdated: (lists: ChoreList[]) => void;
  onDeleted: () => void;
}

export default function ChoreListDetail({ choreList, onUpdated, onDeleted }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const setActiveChoreListId = useMapStore((s) => s.setActiveChoreListId);
  const choreLists = useMapStore((s) => s.choreLists);
  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!currentMap) return null;

  const groups = currentMap.groups ?? {};

  // Build sections: groups sorted by name, then ungrouped
  const groupedSections: Array<{ groupId: string | null; label: string; color: string }> = [
    ...Object.values(groups)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ groupId: g.id, label: g.name, color: g.color })),
    { groupId: null, label: 'Ungrouped', color: '#6b7280' },
  ];

  // Map entries by landmarkId
  const entryByLandmark: Record<string, ChoreEntry> = choreList.entries;

  // Entries per group section, sorted by landmark name
  const entriesByGroup = (groupId: string | null): ChoreEntry[] =>
    Object.values(entryByLandmark)
      .filter((e) => (currentMap.landmarks[e.landmarkId]?.groupId ?? null) === groupId)
      .sort((a, b) => {
        const na = currentMap.landmarks[a.landmarkId]?.name ?? a.landmarkId;
        const nb = currentMap.landmarks[b.landmarkId]?.name ?? b.landmarkId;
        return na.localeCompare(nb);
      });

  const totalEntries = Object.keys(entryByLandmark).length;

  const handleToggleCompleted = async () => {
    setToggling(true); setError('');
    try {
      const updated = await toggleChoreListCompleted(currentMap.id, choreList.id);
      onUpdated(choreLists.map((l) => l.id === updated.id ? updated : l));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    } finally { setToggling(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${choreList.title}"?`)) return;
    setDeleting(true); setError('');
    try {
      await deleteChoreList(currentMap.id, choreList.id);
      onDeleted(); setActiveChoreListId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const handleEntryUpdated = (updated: ChoreList) =>
    onUpdated(choreLists.map((l) => l.id === updated.id ? updated : l));

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setActiveChoreListId(null)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className={`text-sm font-semibold flex-1 truncate ${choreList.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {choreList.title}
        </h2>
        {choreList.link && (
          <a
            href={choreList.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-[hsl(185,100%,54%)] transition-colors"
            title={choreList.link}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {isCollaborator && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit list" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={`h-7 w-7 ${choreList.completed ? 'text-[hsl(185,100%,54%)]' : 'text-muted-foreground hover:text-[hsl(185,100%,54%)]'}`}
              title={choreList.completed ? 'Reopen list' : 'Mark as complete'}
              disabled={toggling} onClick={handleToggleCompleted}
            >
              {choreList.completed ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete list" disabled={deleting} onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {error && <p className="px-6 py-1 text-xs text-destructive shrink-0">{error}</p>}

      {totalEntries === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No entries in this list.
        </div>
      )}

      {totalEntries > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  {/* colour stripe col */}
                  <th className="w-4 p-0 sticky top-0 left-0 z-20 bg-card border-b border-border" />
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground bg-card sticky top-0 z-10 border-b border-border min-w-48">Landmark</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground bg-card sticky top-0 z-10 border-b border-border min-w-28">State</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground bg-card sticky top-0 z-10 border-b border-border min-w-36">Assignee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground bg-card sticky top-0 z-10 border-b border-border min-w-64">Details</th>
                </tr>
              </thead>
              <tbody>
                {groupedSections.map(({ groupId, label, color }) => {
                  const sectionEntries = entriesByGroup(groupId);
                  if (sectionEntries.length === 0) return null;
                  return (
                    <React.Fragment key={groupId ?? 'ungrouped'}>
                      {sectionEntries.map((entry, rowIdx) => (
                        <ChoreEntryRow
                          key={entry.landmarkId}
                          mapId={currentMap.id}
                          listId={choreList.id}
                          entry={entry}
                          landmarkName={currentMap.landmarks[entry.landmarkId]?.name ?? entry.landmarkId}
                          collaborators={currentMap.collaborators}
                          isCollaborator={isCollaborator}
                          onUpdated={handleEntryUpdated}
                          groupStripe={rowIdx === 0 ? { color, label, rowSpan: sectionEntries.length } : undefined}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editOpen && (
        <EditChoreListDialog open={editOpen} onOpenChange={setEditOpen} choreList={choreList} onSaved={onUpdated} />
      )}
    </div>
  );
}
