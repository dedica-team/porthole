import React, { useState } from 'react';
import { StatusIndicator } from '@/components/ui/status-badge';
import { Check, X, AlertTriangle, HelpCircle, Users, Bus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { StatusBadge, matrixLevelToStatus } from '@/components/ui/status-badge';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import { MATRIX_LEVEL_ORDER, MATRIX_LEVEL_LABEL } from '@/types/matrix';
import type { MatrixLevel } from '@/types/matrix';
import { isDecorative } from '@/types/landmark';
import type { Collaborator } from '@/types/session';
import {GroupFilterPopover, useGroupFilter} from "@/components/ui/GroupFilterPopover.tsx";
import LandmarkInfoPopover from "@/components/LandmarkInfoPopover/LandmarkInfoPopover.tsx";
import { useMapActions } from '@/pages/MapPage/MapActionsContext';
import { Popup } from '@/components/ui/popup';
import GroupsPanel from '@/components/Sidebar/panels/GroupsPanel';
import { PageTitle } from '@/components/ui/PageTitle';


// ── Cell-edit dialog ──────────────────────────────────────────────────────────

interface CellEditState {
  landmarkId: string;
  landmarkName: string;
  collaboratorId: string;
  collaboratorName: string;
  currentLevel: MatrixLevel;
}

interface CellEditDialogProps {
  state: CellEditState | null;
  loading: boolean;
  onSelect: (landmarkId: string, collaboratorId: string, level: MatrixLevel) => void;
  onClose: () => void;
}

function MatrixCellEditDialog({ state, loading, onSelect, onClose }: CellEditDialogProps) {
  return (
    <Dialog open={!!state} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xs flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-sm">
            {state?.collaboratorName}
            {state && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {state.landmarkName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {state && (
          <div className="flex flex-col gap-1 px-5 pb-5">
            {[...MATRIX_LEVEL_ORDER].reverse().map((level) => (
              <button
                key={level}
                disabled={loading}
                className={[
                  'w-full text-left px-3 py-2 rounded text-sm font-medium transition-opacity flex items-center',
                  state.currentLevel === level ? 'ring-1 ring-inset ring-white/30' : 'opacity-60 hover:opacity-100',
                ].join(' ')}
                onClick={() => { onSelect(state.landmarkId, state.collaboratorId, level); onClose(); }}
              >
                <StatusBadge status={matrixLevelToStatus[level]} className="text-sm">
                  {MATRIX_LEVEL_LABEL[level]}
                </StatusBadge>
                {state.currentLevel === level && (
                  <Check className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_LANDMARKS: Record<string, never> = {};

export default function CollaboratorMatrixView() {
  const {
    handleSetMatrixEntry: onSetEntry,
    handleEditLandmark: onEditLandmark,
    handleRemoveLandmark: onRemoveLandmark,
    handleCreateGroup: onCreateGroup,
    handleEditGroup: onEditGroup,
    handleRemoveGroup: onRemoveGroup,
    actionLoading: loading,
    error,
    setError,
  } = useMapActions();
  const onClearError = () => setError('');
  const { currentMap, landmarksMap, collaboratorMatrix } = useMapStore(useShallow((s) => ({
    currentMap: s.currentMap,
    landmarksMap: s.currentMap?.landmarks ?? EMPTY_LANDMARKS,
    collaboratorMatrix: s.collaboratorMatrix,
  })));
  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);
  const [showGroupsDialog, setShowGroupsDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const { hiddenGroups, setHiddenGroups, filterOpen, setFilterOpen, filterBtnRef, filterPopoverRef } =
    useGroupFilter('landmarks.matrix.hiddenGroups');

  if (!currentMap) return null;

  const matrix = collaboratorMatrix;
  const collaborators: Collaborator[] = currentMap.collaborators;
  const groups = currentMap.groups ?? {};

  const landmarks = Object.values(landmarksMap)
    .filter((lm) => !isDecorative(lm.type))
    .sort((a, b) => a.name.localeCompare(b.name));

  const groupedSections = [
    ...Object.values(groups)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ groupId: g.id, label: g.name, color: g.color })),
    { groupId: null, label: 'Ungrouped', color: '#6b7280' },
  ];

  const landmarksByGroup = (groupId: string | null) =>
    landmarks.filter((lm) => (lm.groupId ?? null) === groupId);

  const getLevel = (landmarkId: string, collaboratorId: string): MatrixLevel =>
    (matrix?.entries?.[landmarkId]?.[collaboratorId]?.level) ?? 'NONE';

  const openCell = (
    landmarkId: string, landmarkName: string,
    collaboratorId: string, collaboratorName: string,
  ) => {
    setCellEdit({
      landmarkId, landmarkName,
      collaboratorId, collaboratorName,
      currentLevel: getLevel(landmarkId, collaboratorId),
    });
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageTitle
        icon={<Bus className="h-4 w-4" />}
        title="Bus Matrix"
        actions={<>
          <Button variant="ghost" onClick={() => setShowHelpDialog(true)} title="Help">
            <HelpCircle className="h-3.5 w-3.5" />
            Help
          </Button>
          <Button variant="ghost" onClick={() => setShowGroupsDialog(true)} title="Manage groups">
            <Users className="h-3.5 w-3.5" />
            Groups
          </Button>
        </>}
      />

      <Popup title="How to use the Bus Matrix" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p>The <span className="text-foreground font-medium">Bus Matrix</span> shows how well each collaborator knows each landmark — useful for identifying single points of failure ("bus factor").</p>
          <p>Each row is a <span className="text-foreground font-medium">landmark</span>, each column is a <span className="text-foreground font-medium">collaborator</span>. Click any cell to set the knowledge level.</p>
          <p>Use the funnel icon to filter visible groups.</p>
        </div>
      </Popup>

      <Popup title="Manage Groups" open={showGroupsDialog} onOpenChange={setShowGroupsDialog} className="max-w-sm max-h-[80vh] flex flex-col" contentClassName="overflow-y-auto p-0 flex-1">
        <GroupsPanel
          onCreateGroup={onCreateGroup}
          onEditGroup={onEditGroup}
          onRemoveGroup={onRemoveGroup}
          loading={loading}
        />
      </Popup>

      {/* ── Error alert ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="px-6 pt-3 shrink-0">
          <Alert variant="destructive" className="py-2 pr-2 relative">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-sm pr-6">{error}</AlertDescription>
            {onClearError && (
              <button
                className="absolute top-2 right-2 text-destructive-foreground/70 hover:text-destructive-foreground"
                onClick={onClearError}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Alert>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {landmarks.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No landmarks yet.
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      {landmarks.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <table className="data-display-table w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-30">
                <tr>
                  {/* colour-stripe placeholder */}
                  <th className="w-4 p-0 sticky left-0 z-20 data-sticky-header" />
                  {/* landmark col header + group filter */}
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
                  {collaborators.map((c) => (
                    <th key={c.id} className="text-center px-3 py-2 min-w-28 bg-transparent">
                      <UserAvatar username={c.username} avatarUrl={c.avatarUrl} fullWidth={true} />
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
                          {/* Group colour stripe – only first row, spans group */}
                          {rowIdx === 0 && (
                            <td
                              rowSpan={sectionLandmarks.length}
                              className="w-4 p-0 sticky left-0 z-10 select-none"
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
                                  className="text-sm font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden"
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
                          {/* Landmark name + mini summary squares */}
                          <td
                            className="p-0 sticky z-10 data-sticky-cell"
                            style={{ left: '1rem' }}
                          >
                            <LandmarkInfoPopover
                              landmark={landmark}
                              onEditLandmark={onEditLandmark}
                              onRemoveLandmark={onRemoveLandmark}
                              loading={loading}
                            >
                              <Button variant="ghost" fullWidth={true} title={landmark.name} className="!whitespace-normal flex-col !items-start m-2 py-2">
                                {landmark.name}
                                <span className="flex flex-wrap gap-0.5">
                              {([...collaborators]
                                      .map((c) => ({ c, lvl: getLevel(landmark.id, c.id) }))
                                      .filter(({ lvl }) => lvl !== 'NONE')
                                      .sort((a, b) => MATRIX_LEVEL_ORDER.indexOf(a.lvl) - MATRIX_LEVEL_ORDER.indexOf(b.lvl))
                              ).map(({ c, lvl }) => {
                                const status = matrixLevelToStatus[lvl];
                                return (
                                    <StatusIndicator
                                        key={c.id}
                                        title={`${c.username}: ${MATRIX_LEVEL_LABEL[lvl]}`}
                                        status={status}
                                    />
                                );
                              })}
                            </span>
                              </Button>
                            </LandmarkInfoPopover>
                          </td>
                          {/* One cell per collaborator */}
                          {collaborators.map((c) => {
                            const level = getLevel(landmark.id, c.id);
                            const isNone = level === 'NONE';
                            return (
                              <td
                                key={c.id}
                                className={`px-3 py-2 text-center transition-colors${isCollaborator ? ' cursor-pointer group' : ''}`}
                                onClick={isCollaborator
                                  ? () => openCell(landmark.id, landmark.name, c.id, c.username)
                                  : undefined}
                                title={isCollaborator ? 'Click to set level' : MATRIX_LEVEL_LABEL[level]}
                              >
                                {isNone ? (
                                  <span className="text-sm text-muted-foreground/40">—</span>
                                ) : (
                                  <StatusBadge status={matrixLevelToStatus[level]} className="text-sm font-semibold">
                                    {MATRIX_LEVEL_LABEL[level]}
                                  </StatusBadge>
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

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      <MatrixCellEditDialog
        state={cellEdit}
        loading={loading}
        onSelect={(landmarkId, collaboratorId, level) => onSetEntry(landmarkId, collaboratorId, level)}
        onClose={() => setCellEdit(null)}
      />

      {/* ── Group filter popover ──────────────────────────────────────────────── */}
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
    </div>
  );
}

