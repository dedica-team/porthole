import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  BarChart2, Plus, Loader2, Check, X, AlertTriangle, Users, HelpCircle, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popup } from '@/components/ui/popup';
import QualityLevelButtonGroup from '@/components/ui/QualityLevelButtonGroup';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type {LandmarkGroup} from "@/types/landmark";
import type { QualityLevel, QualityMetric, LandmarkType, Landmark } from '@/types/landmark';
import { QUALITY_LEVEL_LABEL, QUALITY_LEVEL_SIGN, worstLevel, isDecorative, defaultValueForLevel, ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS } from '@/types/landmark';
import { StatusBadge, StatusIndicator, qualityLevelToStatus } from '@/components/ui/status-badge';

import MetricTemplateSelector from './MetricTemplateSelector';
import GroupsPanel from '@/components/Sidebar/panels/GroupsPanel';
import CreateLandmarkDialog from './CreateLandmarkDialog';
import LandmarkInfoPopover from '@/components/LandmarkInfoPopover/LandmarkInfoPopover';
import {
  useGroupFilter,
} from '@/components/ui/GroupFilterPopover';
import { useMapActions } from '@/pages/MapPage/MapActionsContext';

interface BadgeRow { key: string; url: string; error: string; }

interface CellEditState {
  landmarkId: string;
  metricId: string;
  metricName: string;
  landmarkName: string;
  value: string;
  description: string;
  level: QualityLevel;
  link: string;
  linkText: string;
  linkError: string;
  badges: BadgeRow[];
}


function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

// Stable empty-object fallbacks – must live outside the component so their
// reference never changes between renders, preventing useShallow from seeing
// a "new" value on every call and causing an infinite snapshot loop.
const EMPTY_LANDMARKS: Record<string, never> = {};

// ── Metric definition edit/delete dialog ─────────────────────────────────────

interface MetricDefEditDialogProps {
  metric: QualityMetric | null;
  loading: boolean;
  onSave: (metricId: string, name: string, description: string, link?: string, clearLink?: boolean) => void;
  onDelete: (metricId: string) => void;
  onClose: () => void;
}

function MetricDefinitionEditDialog({ metric, loading, onSave, onDelete, onClose }: MetricDefEditDialogProps) {
  const [name, setName] = useState(metric?.name ?? '');
  const [desc, setDesc] = useState(metric?.description ?? '');
  const [link, setLink] = useState(metric?.link ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);


  const handleClose = () => { setConfirmDelete(false); onClose(); };
  const handleSave = () => {
    if (!name.trim()) return;
    const newLink = link.trim() || undefined;
    const clearLink = !newLink && !!metric?.link;
    onSave(metric!.id, name.trim(), desc.trim(), newLink, clearLink);
  };

  return (
    <Popup title="Edit Metric" open={!!metric} onOpenChange={(v) => { if (!v) handleClose(); }} className="max-w-sm">
      {metric && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          className="flex flex-col gap-3"
        >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
              maxLength={60}
              placeholder="Name"
            />
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="text-sm min-h-20 resize-none"
              maxLength={200}
              placeholder="Description (optional)"
            />
            {metric.link && (
              <a
                href={metric.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary truncate hover:underline"
              >
                {metric.link}
              </a>
            )}
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="h-8 text-sm"
              maxLength={2000}
              placeholder="Link URL (optional)"
              type="url"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" fullWidth={true} disabled={!name.trim() || loading}>Save</Button>
            </div>

            {/* Delete section */}
            <div className="border-t border-border pt-3 mt-1">
              {!confirmDelete ? (
                <Button
                  variant="destructive" fullWidth={true}
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove metric…
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-destructive">Remove «{metric.name}»? This clears all landmark values.</span>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="flat" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button type="button" size="sm" variant="destructive" disabled={loading} onClick={() => onDelete(metric.id)}>
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
        </form>
      )}
    </Popup>
  );
}

// ── Cell edit dialog ──────────────────────────────────────────────────────────

interface CellEditDialogProps {
  state: CellEditState | null;
  hasExistingEntry: boolean;
  loading: boolean;
  onChange: (s: CellEditState) => void;
  onSave: (e: React.FormEvent) => void;
  onClear: () => void;
  onClose: () => void;
}

function MetricCellEditDialog({ state, hasExistingEntry, loading, onChange, onSave, onClear, onClose }: CellEditDialogProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClose = () => { setConfirmClear(false); onClose(); };
  const title = state ? `${state.metricName} — ${state.landmarkName}` : '';
  return (
    <Popup title={title} open={!!state} onOpenChange={(v) => { if (!v) handleClose(); }} className="max-w-sm">
      {state && (
        <form onSubmit={onSave} className="flex flex-col gap-3">
            <Input
              autoFocus
              value={state.value}
              onChange={(e) => onChange({ ...state, value: e.target.value })}
              className="h-8 text-sm"
              maxLength={60}
              placeholder={state.level !== 'NONE' ? `Leave empty to use "${QUALITY_LEVEL_SIGN[state.level]}"` : 'Value (e.g. 99.9 %)'}
            />
            <Textarea
              value={state.description}
              onChange={(e) => onChange({ ...state, description: e.target.value })}
              className="text-sm min-h-12 resize-none"
              maxLength={2000}
              placeholder="Description (optional)"
            />
            <QualityLevelButtonGroup
              value={state.level}
              onChange={(level) => onChange({ ...state, level })}
              buttonClassName="h-7 min-w-12"
            />
            <div className="flex flex-col gap-0.5">
              <Input
                value={state.link}
                onChange={(e) => onChange({ ...state, link: e.target.value, linkError: '' })}
                className={`h-8 text-sm${state.linkError ? ' border-destructive' : ''}`}
                placeholder="Link (optional, https://…)"
                type="url"
              />
              {state.linkError && (
                <span className="text-sm text-destructive px-1">{state.linkError}</span>
              )}
            </div>
            <Input
              value={state.linkText}
              onChange={(e) => onChange({ ...state, linkText: e.target.value })}
              className="h-8 text-sm"
              maxLength={60}
              placeholder="Link text (optional)"
            />

            {/* Badges */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm text-muted-foreground uppercase tracking-wider">Badges</h2>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...state, badges: [...state.badges, { key: '', url: '', error: '' }] })}>+ Add</Button>
              </div>
              {state.badges.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex gap-1.5">
                    <Input
                      value={row.key}
                      onChange={(e) => {
                        const b = state.badges.map((r, i) => i === idx ? { ...r, key: e.target.value, error: '' } : r);
                        onChange({ ...state, badges: b });
                      }}
                      className="h-7 text-sm w-24 shrink-0"
                      placeholder="Label"
                    />
                    <Input
                      value={row.url}
                      onChange={(e) => {
                        const b = state.badges.map((r, i) => i === idx ? { ...r, url: e.target.value, error: '' } : r);
                        onChange({ ...state, badges: b });
                      }}
                      className={`h-7 text-sm flex-1${row.error ? ' border-destructive' : ''}`}
                      placeholder="Badge URL (https://…)"
                      type="url"
                    />
                    <Button
                      variant="flat"
                      onClick={() => onChange({ ...state, badges: state.badges.filter((_, i) => i !== idx) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {row.error && <span className="text-sm text-destructive px-1">{row.error}</span>}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit" fullWidth={true}
                disabled={(state.level === 'NONE' && !state.value.trim() && !state.link.trim() && state.badges.length === 0) || loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>

            </div>

            {/* Clear section */}
            {hasExistingEntry && (
              <div className="border-t border-border pt-3 mt-1">
                {!confirmClear ? (
                  <Button
                    variant="destructive" fullWidth={true} onClick={() => setConfirmClear(true)}
                  >
                    Clear value…
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-destructive">Clear this entry?</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-sm"
                        disabled={loading}
                        onClick={() => { onClear(); handleClose(); }}
                      >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, clear'}
                      </Button>
                      <Button type="button" size="sm" variant="flat" className="h-7 px-3 text-sm" onClick={() => setConfirmClear(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </form>
      )}
    </Popup>
  );
}

// ── Landmark edit dialog ──────────────────────────────────────────────────────

interface LandmarkEditDialogProps {
  landmark: Landmark | null;
  groups: Record<string, LandmarkGroup>;
  loading: boolean;
  onSave: (landmarkId: string, name: string, type: LandmarkType, description: string, link: string, groupId: string | null) => void;
  onRemove: (landmarkId: string) => void;
  onClose: () => void;
}

function LandmarkEditDialog({ landmark, groups, loading, onSave, onRemove, onClose }: LandmarkEditDialogProps) {
  const [name, setName] = useState(landmark?.name ?? '');
  const [type, setType] = useState<LandmarkType>(landmark?.type ?? 'KEEP');
  const [description, setDescription] = useState(landmark?.description ?? '');
  const [link, setLink] = useState(landmark?.link ?? '');
  const [linkError, setLinkError] = useState('');
  const [groupId, setGroupId] = useState<string>(landmark?.groupId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!landmark || !name.trim()) return;
    if (link.trim() && !isValidUrl(link.trim())) {
      setLinkError('Must be a valid http/https URL');
      return;
    }
    onSave(landmark.id, name.trim(), type, description.trim(), link.trim(), groupId || null);
  };

  const sortedGroups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Popup title="Edit Landmark" open={!!landmark} onOpenChange={(v) => { if (!v) handleClose(); }} className="max-w-sm">
      {landmark && (
        <div>
            {!confirmDelete ? (
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm"
                  maxLength={60}
                  placeholder="Name"
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as LandmarkType)}
                  className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground"
                >
                  {ALL_LANDMARK_TYPES.map((t) => (
                    <option key={t} value={t}>{LANDMARK_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground"
                >
                  <option value="">— No group —</option>
                  {sortedGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm min-h-16 resize-none"
                  maxLength={200}
                  placeholder="Description (optional)"
                />
                <div className="flex flex-col gap-0.5">
                  <Input
                    value={link}
                    onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
                    className={`h-8 text-sm${linkError ? ' border-destructive' : ''}`}
                    placeholder="Link (optional, https://…)"
                    type="url"
                  />
                  {linkError && <span className="text-sm text-destructive px-1">{linkError}</span>}
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    <Button type="submit" fullWidth={true} disabled={!name.trim() || loading}>
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                  <Button
                    type="button"
                    fullWidth={true}
                    variant="destructive"
                    className="w-full gap-2 h-8 text-sm"
                    disabled={loading}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex flex-col gap-1 text-center">
                  <span className="text-sm font-medium text-destructive">Remove «{landmark.name}»?</span>
                  <span className="text-sm text-muted-foreground">This action cannot be undone.</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={loading}
                    onClick={() => onRemove(landmark.id)}
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    className="flex-1 h-8 text-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}
    </Popup>
  );
}

export default function MetricsView() {
  const {
    handleCreateMetric: onCreateMetric,
    handleCreateUnpositionedLandmark: onCreateUnpositionedLandmark,
    handleEditMetric: onEditMetric,
    handleRemoveMetric: onRemoveMetric,
    handleSetLandmarkMetric: onSetLandmarkMetric,
    handleClearLandmarkMetric: onClearLandmarkMetric,
    handleEditLandmarkGroup: onEditLandmarkGroup,
    handleEditLandmark: onEditLandmark,
    handleCreateGroup: onCreateGroup,
    handleEditGroup: onEditGroup,
    handleRemoveGroup: onRemoveGroup,
    handleRemoveLandmark: onRemoveLandmark,
    actionLoading: loading,
    error,
    setError,
  } = useMapActions();
  const onClearError = () => setError('');
  const { currentMap, metricsMap, landmarksMap } = useMapStore(useShallow((s) => ({
    currentMap:   s.currentMap,
    metricsMap:   s.metrics,
    landmarksMap: s.currentMap?.landmarks ?? EMPTY_LANDMARKS,
  })));
  const userId = useAuthStore((s) => s.userId);
  const isCollaborator = !!(currentMap && userId && currentMap.collaborators.some((c) => c.id === userId));

  // ── metric definition CRUD ────────────────────────────────────────────────
  const [editingMetricDef, setEditingMetricDef] = useState<QualityMetric | null>(null);

  // ── landmark editing ──────────────────────────────────────────────────────
  const [editingLandmark, setEditingLandmark] = useState<Landmark | null>(null);

  // ── template selector ────────────────────────────────────────────────────
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCreateLandmarkDialog, setShowCreateLandmarkDialog] = useState(false);

  // ── groups dialog ────────────────────────────────────────────────────────
  const [showGroupsDialog, setShowGroupsDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // ── cell editing ──────────────────────────────────────────────────────────
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);

  // ── group picker ──────────────────────────────────────────────────────────
  const [groupPickerLandmarkId, setGroupPickerLandmarkId] = useState<string | null>(null);
  const [groupPickerPos, setGroupPickerPos] = useState<{ top: number; left: number } | null>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // ── group filter ──────────────────────────────────────────────────────────
  const { hiddenGroups, setHiddenGroups, filterOpen, setFilterOpen } =
    useGroupFilter('landmarks.metrics.hiddenGroups');
  const { hiddenGroups: hiddenMetrics, setHiddenGroups: setHiddenMetrics } =
    useGroupFilter('landmarks.metrics.hiddenMetrics');

  useEffect(() => {
    if (!groupPickerLandmarkId) return;
    const handleClick = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setGroupPickerLandmarkId(null);
        setGroupPickerPos(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [groupPickerLandmarkId]);


  if (!currentMap) return null;

  const metrics   = Object.values(metricsMap).sort((a, b) => a.name.localeCompare(b.name));
  const visibleMetrics = metrics.filter((metric) => !hiddenMetrics.has(metric.id));
  const visibleMetricIds = new Set(visibleMetrics.map((metric) => metric.id));
  const landmarks = Object.values(landmarksMap)
    .filter((lm) => !isDecorative(lm.type))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups    = currentMap.groups ?? {};
  const totalHiddenFilters = hiddenGroups.size + hiddenMetrics.size;

  // Build ordered sections: one per group (sorted by name), then ungrouped
  const groupedSections: Array<{ groupId: string | null; label: string; color: string }> = [
    ...Object.values(groups)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ groupId: g.id, label: g.name, color: g.color })),
    { groupId: null, label: 'Ungrouped', color: '#6b7280' },
  ];

  // landmarks per section
  const landmarksByGroup = (groupId: string | null) =>
    landmarks.filter((lm) => (lm.groupId ?? null) === groupId);

  // ── metric definition handlers ────────────────────────────────────────────

  const openMetricDef = (m: QualityMetric) => setEditingMetricDef(m);

  // ── cell handlers ─────────────────────────────────────────────────────────
  const openCellEdit = (landmarkId: string, metricId: string) => {
    const entry = (landmarksMap[landmarkId]?.metrics ?? {})[metricId];
    const metric = metricsMap[metricId];
    const landmark = landmarksMap[landmarkId];
    setCellEdit({
      landmarkId,
      metricId,
      metricName: metric?.name ?? metricId,
      landmarkName: landmark?.name ?? landmarkId,
      value: entry?.value ?? '',
      description: entry?.description ?? '',
      level: entry?.level ?? 'NONE',
      link:  entry?.link  ?? '',
      linkText: entry?.linkText ?? '',
      linkError: '',
      badges: entry?.badges
        ? Object.entries(entry.badges).map(([key, url]) => ({ key, url, error: '' }))
        : [],
    });
  };

  const saveCellEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellEdit) return;
    const trimmedValue = cellEdit.value.trim();

    let badgeRowError = false;
    const validatedRows = cellEdit.badges.map((row) => {
      if (!row.key.trim()) return { ...row, error: 'Key must not be blank' };
      if (!row.url.trim() || !isValidUrl(row.url.trim())) return { ...row, error: 'Must be a valid http/https URL' };
      return { ...row, error: '' };
    });
    if (validatedRows.some((r) => r.error)) {
      setCellEdit({ ...cellEdit, badges: validatedRows });
      badgeRowError = true;
    }
    if (badgeRowError) return;

    const badgesMap: Record<string, string> = {};
    for (const row of validatedRows) badgesMap[row.key.trim()] = row.url.trim();
    const hasBadges = Object.keys(badgesMap).length > 0;
    const trimmedLink = cellEdit.link.trim();
    const trimmedLinkText = cellEdit.linkText.trim();

    if (cellEdit.level === 'NONE' && !trimmedValue && !trimmedLink && !hasBadges) return;
    if (trimmedLink && !isValidUrl(trimmedLink)) {
      setCellEdit({ ...cellEdit, linkError: 'Must be a valid http/https URL' });
      return;
    }

    const resolvedValue = trimmedValue || defaultValueForLevel(cellEdit.level);

    const trimmedDescription = cellEdit.description.trim();
    onSetLandmarkMetric(
      cellEdit.landmarkId,
      cellEdit.metricId,
      resolvedValue,
      cellEdit.level,
      trimmedLink || undefined,
      trimmedLink ? (trimmedLinkText || undefined) : undefined,
      hasBadges ? badgesMap : undefined,
      trimmedDescription || undefined,
    );
    setCellEdit(null);
  };

  // ── render helpers ────────────────────────────────────────────────────────

  const worstForLandmark = (landmarkId: string): QualityLevel =>
    worstLevel(
      Object.entries(landmarksMap[landmarkId]?.metrics ?? {})
        .filter(([metricId]) => visibleMetricIds.has(metricId))
        .map(([, entry]) => entry),
    );

  const cardBtnCls = 'flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer shrink-0';

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Groups dialog ───────────────────────────────────────────────────── */}
      <Popup title="Manage Groups" open={showGroupsDialog} onOpenChange={setShowGroupsDialog} className="max-w-sm max-h-[80vh] flex flex-col" contentClassName="overflow-y-auto p-0 flex-1">
        <GroupsPanel
          onCreateGroup={onCreateGroup}
          onEditGroup={onEditGroup}
          onRemoveGroup={onRemoveGroup}
          loading={loading}
        />
      </Popup>

      <Popup title="How to use Metrics" open={showHelpDialog} onOpenChange={setShowHelpDialog} className="max-w-sm">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
          <p><span className="text-foreground font-medium">Metrics</span> are quality dimensions you define (e.g. "Test Coverage", "Uptime"). Click <span className="text-foreground font-medium">Add Metric</span> to create one from a template or from scratch.</p>
          <p><span className="text-foreground font-medium">Landmarks</span> are the things being measured. Create unpositioned ones here with <span className="text-foreground font-medium">Create Landmark</span>, or place them directly on the map.</p>
          <p>Click any <span className="text-foreground font-medium">cell</span> in the table to set a quality level (✓ Good, ~ Partial, ✗ Bad) plus an optional value, link, or badge images.</p>
          <p>Click a <span className="text-foreground font-medium">metric name</span> to edit or remove it.</p>
          <p>Click a <span className="text-foreground font-medium">landmark name</span> to edit its name, type, group, description, or link.</p>
          <p>Use <span className="text-foreground font-medium">Groups</span> to organise landmarks into colour-coded sections. The funnel icon filters visible groups.</p>
        </div>
      </Popup>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col rounded-lg bg-card overflow-hidden mx-3 sm:mx-6 my-3">

        {/* Card header */}
        <div className="flex items-stretch border-b border-border shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground flex-1">
            <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            Quality Metrics
          </div>
          <button className={cardBtnCls} onClick={() => setShowHelpDialog(true)} title="Help">
            <HelpCircle className="h-3.5 w-3.5" /> Help
          </button>
          <button className={cardBtnCls} onClick={() => setShowGroupsDialog(true)}>
            <Users className="h-3.5 w-3.5" /> Groups
          </button>
          {isCollaborator && (
            <>
              <button className={cardBtnCls} onClick={() => setShowCreateLandmarkDialog(true)} title="Create a new landmark without position">
                <Plus className="h-3.5 w-3.5" /> Landmark
              </button>
              <button className={cardBtnCls} onClick={() => setShowTemplateSelector(true)} title="Add metric">
                <Plus className="h-3.5 w-3.5" /> Metric
              </button>
            </>
          )}
        </div>

        {/* ── Error alert ──────────────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 shrink-0">
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

        {metrics.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <BarChart2 className="h-8 w-8 opacity-20" />
            <span>No metrics defined yet.</span>
            {isCollaborator && (
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setShowTemplateSelector(true)}
              >
                + Add your first metric
              </button>
            )}
          </div>
        )}

      {/* ── Metric definition edit dialog ───────────────────────────────────── */}
      <MetricDefinitionEditDialog
        key={editingMetricDef?.id}
        metric={editingMetricDef}
        loading={loading}
        onSave={(id, name, description, link, clearLink) => {
          onEditMetric(id, name, description || undefined, link, clearLink);
          setEditingMetricDef(null);
        }}
        onDelete={(id) => {
          onRemoveMetric(id);
          setEditingMetricDef(null);
        }}
        onClose={() => setEditingMetricDef(null)}
      />

      {/* ── Cell edit dialog ────────────────────────────────────────────────── */}
      <MetricCellEditDialog
        state={cellEdit}
        hasExistingEntry={!!(cellEdit && (landmarksMap[cellEdit.landmarkId]?.metrics ?? {})[cellEdit.metricId])}
        loading={loading}
        onChange={setCellEdit}
        onSave={saveCellEdit}
        onClear={() => { if (cellEdit) onClearLandmarkMetric(cellEdit.landmarkId, cellEdit.metricId); }}
        onClose={() => setCellEdit(null)}
      />

      {/* ── Landmark edit dialog ────────────────────────────────────────────── */}
      <LandmarkEditDialog
        key={editingLandmark?.id}
        landmark={editingLandmark}
        groups={groups}
        loading={loading}
        onSave={(landmarkId, name, type, description, link, newGroupId) => {
          const lm = landmarksMap[landmarkId];
          const clearLink = !link && !!(lm?.link);
          const prevGroupId = lm?.groupId ?? null;
          const groupChanged = newGroupId !== prevGroupId;
          const clearGroup = groupChanged && newGroupId === null;
          onEditLandmark(
            landmarkId,
            name,
            type,
            description || undefined,
            groupChanged && newGroupId ? newGroupId : undefined,
            clearGroup,
            link || undefined,
            clearLink,
          );
          setEditingLandmark(null);
        }}
        onRemove={(landmarkId) => {
          onRemoveLandmark(landmarkId);
          setEditingLandmark(null);
        }}
        onClose={() => setEditingLandmark(null)}
      />

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {metrics.length > 0 && (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <table className="data-display-table w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="p-0 sticky left-0 z-20 data-sticky-header" />
                  <th className="text-left p-0 sticky z-20 data-sticky-header"
                    style={{ left: '1rem' }}>
                    <Button
                      size="sm"
                      variant="flat" fullWidth={true}
                      className={`h-7 gap-1.5 text-sm p-0 no-underline cursor-pointer${totalHiddenFilters > 0 ? ' text-primary' : ' text-muted-foreground hover:text-foreground'}`}
                      title={totalHiddenFilters > 0 ? 'Filters active — click to change' : 'Filter table'}
                      onClick={() => setFilterOpen((v) => !v)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                      </svg>
                      {totalHiddenFilters > 0 ? `${totalHiddenFilters} hidden` : 'Filter'}
                    </Button></th>
                  {visibleMetrics.map((m) => (
                    <th key={m.id} className="metrics-metric-header-cell text-left px-3 py-2 font-medium bg-transparent align-bottom">
                      {isCollaborator ? (
                        <Button variant="ghost" fullWidth={true} title={m.description || undefined}
                          onClick={() => openMetricDef(m)}
                        >
                          {m.name}
                        </Button>
                      ) : (
                        <span className="metrics-metric-trigger text-sm font-medium text-muted-foreground normal-case" title={m.description || undefined}>
                          {m.name}
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
                      {sectionLandmarks.map((landmark, rowIdx) => {
                        const lmWorst = worstForLandmark(landmark.id);
                        return (
                          <tr key={landmark.id} className={`metrics-row${rowIdx === 0 ? ' metrics-row-group-start' : ''}`}>
                            {/* Colour stripe – only on first row, spans all rows in group */}
                            {rowIdx === 0 && (
                              <td
                                rowSpan={sectionLandmarks.length}
                                className="group-stripe metrics-group-stripe w-4 p-0 sticky left-0 z-30 select-none"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${color} 40%, black)`,
                                  minWidth: '1rem',
                                  width: '1rem',
                                }}
                              >
                                <div
                                  className="flex items-center justify-center"
                                  style={{ height: `${sectionLandmarks.length * 2.25}rem`, minHeight: '2rem' }}
                                >
                                  <span
                                    className="metrics-group-label text-sm font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden"
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
                            {/* Landmark name + overall badge */}
                            <td className="metrics-landmark-cell p-0 sticky z-20 data-sticky-cell" style={{ left: '1rem' }}>
                              <div className=" px-1 sm:px-2 py-2 overflow-hidden">
                                  {(() => {
                                    const nameEl =
                                      <Button
                                        variant="ghost" size="sm"
                                        fullWidth={true}
                                        title={landmark.description}
                                        className="overflow-hidden"
                                      >
                                        <StatusIndicator status={qualityLevelToStatus[lmWorst]} /><span className="truncate">{landmark.name}</span>
                                      </Button>

                                    return (
                                      <LandmarkInfoPopover
                                        landmark={landmark}
                                        onEditLandmark={onEditLandmark}
                                        onRemoveLandmark={onRemoveLandmark}
                                        loading={loading}
                                      >
                                        {nameEl}
                                      </LandmarkInfoPopover>
                                    );
                                  })()}
                              </div>
                            </td>
                            {/* One cell per metric */}
                            {visibleMetrics.map((m) => {
                              const entry = (landmark.metrics ?? {})[m.id];

                              return (
                                <td key={m.id}
                                  data-level={entry?.level ?? 'NONE'}
                                  className={`metrics-metric-cell px-3 py-2  overflow-hidden transition-colors group${isCollaborator ? ' cursor-pointer' : ''}`}
                                  onClick={isCollaborator ? () => openCellEdit(landmark.id, m.id) : undefined}
                                  title={entry ? `${QUALITY_LEVEL_LABEL[entry.level]}${entry.value ? `: ${entry.value}` : ''}` : (isCollaborator ? 'Click to set value' : undefined)}
                                >
                                  {entry ? (
                                    <div className="metrics-cell-content flex min-w-0 flex-col gap-1.5">
                                      {entry.level !== 'NONE' && (
                                        <div className="flex min-w-0 items-center gap-1.5">
                                          <StatusBadge status={qualityLevelToStatus[entry.level]}>
                                            {entry.value ?? QUALITY_LEVEL_SIGN[entry.level]}
                                          </StatusBadge>
                                        </div>
                                      )}
                                      {entry.level === 'NONE' && entry.value && (
                                        <div className="flex min-w-0 items-center gap-1.5">
                                          <StatusBadge status="NONE" title={entry.value} className="italic rounded">
                                            {entry.value}
                                          </StatusBadge>
                                        </div>
                                      )}
                                      {entry.description && (
                                        <span className="text-xs text-muted-foreground leading-snug">{entry.description}</span>
                                      )}
                                      {entry.link && (
                                        <a
                                          href={entry.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="metrics-cell-link block w-full truncate text-sm text-link hover:text-link-hover underline underline-offset-2"
                                          onClick={(e) => e.stopPropagation()}
                                          title={entry.link}
                                        >
                                          {entry.linkText || entry.link}
                                        </a>
                                      )}
                                      {entry.badges && Object.entries(entry.badges).length > 0 && (
                                        <div className="flex flex-col gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                          {Object.entries(entry.badges).map(([key, url]) => (
                                            <div key={key} className="flex items-center gap-1.5 min-w-0">
                                              <img src={url} alt={key} title={key} className="h-4 max-w-32 object-contain" />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                      <span className="data-empty text-sm italic transition-colors group-hover:text-muted-foreground">
                                      not set
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>{/* end card */}

      <MetricTemplateSelector
        open={showTemplateSelector}
        onSubmit={(name, description) => {
          onCreateMetric(name, description);
          setShowTemplateSelector(false);
        }}
        onClose={() => setShowTemplateSelector(false)}
        loading={loading}
      />

      {/* ── Filter dialog ─────────────────────────────────────────────────────── */}
      <Popup
        title={
          totalHiddenFilters > 0
            ? <span className="flex items-center gap-3">Filter table <Button size="sm" variant="link" className="text-sm p-0 h-auto text-primary" onClick={() => { setHiddenGroups(new Set()); setHiddenMetrics(new Set()); }}>Show all</Button></span>
            : 'Filter table'
        }
        open={filterOpen}
        onOpenChange={setFilterOpen}
        className="max-w-sm"
        contentClassName="p-0"
      >
        <div className="flex flex-col gap-1 py-1">
          <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold px-3 pt-1 pb-0.5">Show groups</p>
          {groupedSections.filter((section) => landmarksByGroup(section.groupId).length > 0).map(({ groupId, label, color }) => {
            const visible = !hiddenGroups.has(groupId);
            return (
              <button
                key={groupId ?? 'ungrouped'}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => setHiddenGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
                  return next;
                })}
              >
                <StatusIndicator status="NONE" style={{ backgroundColor: color }} className="border border-white/20" />
                <span className={`flex-1 truncate${visible ? '' : ' line-through text-muted-foreground'}`}>{label}</span>
                {visible && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
          <div className="border-t border-border/70 mx-3 my-1" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground font-semibold px-3 pb-0.5">Show metrics</p>
          {metrics.map((metric) => {
            const visible = !hiddenMetrics.has(metric.id);
            return (
              <button
                key={metric.id}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => setHiddenMetrics((prev) => {
                  const next = new Set(prev);
                  if (next.has(metric.id)) next.delete(metric.id); else next.add(metric.id);
                  return next;
                })}
              >
                <StatusIndicator status="NONE" className="border border-white/20 bg-primary" />
                <span className={`flex-1 truncate${visible ? '' : ' line-through text-muted-foreground'}`}>{metric.name}</span>
                {visible && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </Popup>

      {/* ── Group picker portal ─────────────────────────────────────────────── */}
      {groupPickerLandmarkId && groupPickerPos && ReactDOM.createPortal(
        <div
          ref={groupPickerRef}
          className="fixed z-9999 bg-popover border border-border rounded-md shadow-lg py-1 min-w-40"
          style={{ top: groupPickerPos.top, left: groupPickerPos.left }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              onEditLandmarkGroup(groupPickerLandmarkId, null);
              setGroupPickerLandmarkId(null);
              setGroupPickerPos(null);
            }}
          >
            <StatusIndicator status="NONE" />
            <span className="text-muted-foreground">No group</span>
            {!landmarksMap[groupPickerLandmarkId]?.groupId && <Check className="h-3 w-3 ml-auto text-primary" />}
          </button>
          {Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
            <button
              key={g.id}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                onEditLandmarkGroup(groupPickerLandmarkId, g.id);
                setGroupPickerLandmarkId(null);
                setGroupPickerPos(null);
              }}
            >
              <StatusIndicator status="NONE" style={{ backgroundColor: g.color }} className="border border-white/20" />
              <span className="truncate">{g.name}</span>
              {landmarksMap[groupPickerLandmarkId]?.groupId === g.id && <Check className="h-3 w-3 ml-auto text-primary" />}
            </button>
          ))}
        </div>,
        document.body,
      )}

      <CreateLandmarkDialog
        open={showCreateLandmarkDialog}
        loading={loading}
        groups={groups}
        onSubmit={(name, type, description, groupId, link) => {
          onCreateUnpositionedLandmark(name, type, description, groupId, link);
        }}
        onClose={() => setShowCreateLandmarkDialog(false)}
      />
    </div>
  );
}

