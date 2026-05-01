import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  BarChart2, Plus, Loader2, Check, X, ExternalLink, AlertTriangle, Users, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type {LandmarkGroup} from "@/types/landmark";
import type { QualityLevel, QualityMetric, LandmarkType, Landmark } from '@/types/landmark';
import { QUALITY_LEVEL_BADGE_STYLE, QUALITY_LEVEL_LABEL, QUALITY_LEVEL_ORDER, QUALITY_LEVEL_SIGN, worstLevel, isDecorative, defaultValueForLevel, ALL_LANDMARK_TYPES, LANDMARK_TYPE_LABELS } from '@/types/landmark';
import MetricTemplateSelector from './MetricTemplateSelector';
import GroupsPanel from '@/components/Sidebar/panels/GroupsPanel';
import CreateLandmarkDialog from './CreateLandmarkDialog';
import LandmarkInfoPopover from '@/components/LandmarkInfoPopover/LandmarkInfoPopover';
import {
  useGroupFilter,
  GroupFilterPopover,
} from '@/components/ui/GroupFilterPopover';

interface Props {
  onCreateMetric: (name: string, description: string) => void;
  onCreateUnpositionedLandmark: (name: string, type: LandmarkType, description?: string, groupId?: string, link?: string) => void;
  onEditMetric: (metricId: string, name?: string, description?: string) => void;
  onRemoveMetric: (metricId: string) => void;
  onSetLandmarkMetric: (landmarkId: string, metricId: string, value: string | undefined, level: QualityLevel, link?: string, badges?: Record<string, string>) => void;
  onClearLandmarkMetric: (landmarkId: string, metricId: string) => void;
  onEditLandmarkGroup: (landmarkId: string, groupId: string | null) => void;
  onEditLandmark: (landmarkId: string, name?: string, type?: LandmarkType, description?: string, groupId?: string, clearGroup?: boolean, link?: string, clearLink?: boolean) => void;
  onCreateGroup: (name: string, color: string, description?: string, link?: string) => void;
  onEditGroup: (groupId: string, name?: string, color?: string, description?: string, clearDescription?: boolean, link?: string, clearLink?: boolean) => void;
  onRemoveGroup: (groupId: string) => void;
  loading: boolean;
  error?: string;
  onClearError?: () => void;
}

interface BadgeRow { key: string; url: string; error: string; }

interface CellEditState {
  landmarkId: string;
  metricId: string;
  metricName: string;
  landmarkName: string;
  value: string;
  level: QualityLevel;
  link: string;
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
  onSave: (metricId: string, name: string, description: string) => void;
  onDelete: (metricId: string) => void;
  onClose: () => void;
}

function MetricDefinitionEditDialog({ metric, loading, onSave, onDelete, onClose }: MetricDefEditDialogProps) {
  const [name, setName] = useState(metric?.name ?? '');
  const [desc, setDesc] = useState(metric?.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);


  const handleClose = () => { setConfirmDelete(false); onClose(); };

  return (
    <Dialog open={!!metric} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-sm">Edit Metric</DialogTitle>
        </DialogHeader>
        {metric && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(metric.id, name.trim(), desc.trim()); }}
            className="flex flex-col gap-3 px-6 pb-6"
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
              className="text-sm min-h-16 resize-none"
              maxLength={200}
              placeholder="Description (optional)"
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1 gap-1.5 h-8" disabled={!name.trim() || loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={handleClose}>
                Cancel
              </Button>
            </div>

            {/* Delete section */}
            <div className="border-t border-border pt-3 mt-1">
              {!confirmDelete ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove metric…
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-red-400">Remove «{metric.name}»? This clears all landmark values.</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 h-7 text-xs bg-black text-red-500 hover:bg-neutral-900 border border-red-900/60"
                      disabled={loading}
                      onClick={() => onDelete(metric.id)}
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
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
  return (
    <Dialog open={!!state} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-sm">
            {state?.metricName}
            {state && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                — {state.landmarkName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {state && (
          <form onSubmit={onSave} className="flex flex-col gap-3 px-6 pb-6">
            <Input
              autoFocus
              value={state.value}
              onChange={(e) => onChange({ ...state, value: e.target.value })}
              className="h-8 text-sm"
              maxLength={60}
              placeholder={state.level !== 'NONE' ? `Leave empty to use "${QUALITY_LEVEL_SIGN[state.level]}"` : 'Value (e.g. 99.9 %)'}
            />
            <select
              value={state.level}
              onChange={(e) => onChange({ ...state, level: e.target.value as QualityLevel })}
              className="h-8 text-sm rounded border border-input bg-background px-2 text-foreground"
            >
              {QUALITY_LEVEL_ORDER.map((l) => (
                <option key={l} value={l}>
                  {l !== 'NONE' ? `${QUALITY_LEVEL_SIGN[l]}  ` : ''}{QUALITY_LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-0.5">
              <Input
                value={state.link}
                onChange={(e) => onChange({ ...state, link: e.target.value, linkError: '' })}
                className={`h-8 text-sm${state.linkError ? ' border-red-500' : ''}`}
                placeholder="Link (optional, https://…)"
                type="url"
              />
              {state.linkError && (
                <span className="text-[10px] text-red-400 px-1">{state.linkError}</span>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Badges</span>
              {state.badges.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex gap-1.5">
                    <Input
                      value={row.key}
                      onChange={(e) => {
                        const b = state.badges.map((r, i) => i === idx ? { ...r, key: e.target.value, error: '' } : r);
                        onChange({ ...state, badges: b });
                      }}
                      className="h-7 text-xs w-24 shrink-0"
                      placeholder="Label"
                    />
                    <Input
                      value={row.url}
                      onChange={(e) => {
                        const b = state.badges.map((r, i) => i === idx ? { ...r, url: e.target.value, error: '' } : r);
                        onChange({ ...state, badges: b });
                      }}
                      className={`h-7 text-xs flex-1${row.error ? ' border-red-500' : ''}`}
                      placeholder="Badge URL (https://…)"
                      type="url"
                    />
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-red-400 shrink-0 px-0.5"
                      onClick={() => onChange({ ...state, badges: state.badges.filter((_, i) => i !== idx) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {row.error && <span className="text-[10px] text-red-400 px-1">{row.error}</span>}
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground text-left"
                onClick={() => onChange({ ...state, badges: [...state.badges, { key: '', url: '', error: '' }] })}
              >
                + Add badge
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                size="sm"
                className="flex-1 gap-1.5 h-8"
                disabled={(state.level === 'NONE' && !state.value.trim() && state.badges.length === 0) || loading}
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={handleClose}>
                Cancel
              </Button>
            </div>

            {/* Clear section */}
            {hasExistingEntry && (
              <div className="border-t border-border pt-3 mt-1">
                {!confirmClear ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear value…
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] text-red-400">Clear this entry?</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 h-7 text-xs bg-black text-red-500 hover:bg-neutral-900 border border-red-900/60"
                        disabled={loading}
                        onClick={() => { onClear(); handleClose(); }}
                      >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, clear'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setConfirmClear(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Landmark edit dialog ──────────────────────────────────────────────────────

interface LandmarkEditDialogProps {
  landmark: Landmark | null;
  groups: Record<string, LandmarkGroup>;
  loading: boolean;
  onSave: (landmarkId: string, name: string, type: LandmarkType, description: string, link: string, groupId: string | null) => void;
  onClose: () => void;
}

function LandmarkEditDialog({ landmark, groups, loading, onSave, onClose }: LandmarkEditDialogProps) {
  const [name, setName] = useState(landmark?.name ?? '');
  const [type, setType] = useState<LandmarkType>(landmark?.type ?? 'KEEP');
  const [description, setDescription] = useState(landmark?.description ?? '');
  const [link, setLink] = useState(landmark?.link ?? '');
  const [linkError, setLinkError] = useState('');
  const [groupId, setGroupId] = useState<string>(landmark?.groupId ?? '');

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
    <Dialog open={!!landmark} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-sm">Edit Landmark</DialogTitle>
        </DialogHeader>
        {landmark && (
          <form onSubmit={handleSave} className="flex flex-col gap-3 px-6 pb-6">
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
                className={`h-8 text-sm${linkError ? ' border-red-500' : ''}`}
                placeholder="Link (optional, https://…)"
                type="url"
              />
              {linkError && <span className="text-[10px] text-red-400 px-1">{linkError}</span>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1 gap-1.5 h-8" disabled={!name.trim() || loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MetricsView({
  onCreateMetric,
  onCreateUnpositionedLandmark,
  onEditMetric,
  onRemoveMetric,
  onSetLandmarkMetric,
  onClearLandmarkMetric,
  onEditLandmarkGroup,
  onEditLandmark,
  onCreateGroup,
  onEditGroup,
  onRemoveGroup,
  loading,
  error,
  onClearError,
}: Props) {
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

  // ── cell editing ──────────────────────────────────────────────────────────
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);

  // ── group picker ──────────────────────────────────────────────────────────
  const [groupPickerLandmarkId, setGroupPickerLandmarkId] = useState<string | null>(null);
  const [groupPickerPos, setGroupPickerPos] = useState<{ top: number; left: number } | null>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  // ── group filter ──────────────────────────────────────────────────────────
  const { hiddenGroups, setHiddenGroups, filterOpen, setFilterOpen, filterBtnRef, filterPopoverRef } =
    useGroupFilter('landmarks.metrics.hiddenGroups');

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
  const landmarks = Object.values(landmarksMap)
    .filter((lm) => !isDecorative(lm.type))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups    = currentMap.groups ?? {};

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
      level: entry?.level ?? 'NONE',
      link:  entry?.link  ?? '',
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

    if (cellEdit.level === 'NONE' && !trimmedValue && !hasBadges) return;
    if (cellEdit.link.trim() && !isValidUrl(cellEdit.link.trim())) {
      setCellEdit({ ...cellEdit, linkError: 'Must be a valid http/https URL' });
      return;
    }

    const resolvedValue = trimmedValue || defaultValueForLevel(cellEdit.level);

    onSetLandmarkMetric(
      cellEdit.landmarkId,
      cellEdit.metricId,
      resolvedValue,
      cellEdit.level,
      cellEdit.link.trim() || undefined,
      hasBadges ? badgesMap : undefined,
    );
    setCellEdit(null);
  };

  // ── render helpers ────────────────────────────────────────────────────────

  const worstForLandmark = (landmarkId: string): QualityLevel =>
    worstLevel(Object.values(landmarksMap[landmarkId]?.metrics ?? {}));

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 shrink-0">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 group" title="Help">
              <h2 className="text-sm font-semibold text-foreground group-hover:opacity-70 transition-opacity">Quality Metrics</h2>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 text-xs" align="start">
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-foreground">How to use Metrics</h4>
              <div className="flex flex-col gap-2 text-muted-foreground leading-relaxed">
                <p><span className="text-foreground font-medium">Metrics</span> are quality dimensions you define (e.g. "Test Coverage", "Uptime"). Click <span className="text-foreground font-medium">Add Metric</span> to create one from a template or from scratch.</p>
                <p><span className="text-foreground font-medium">Landmarks</span> are the things being measured. Create unpositioned ones here with <span className="text-foreground font-medium">Create Landmark</span>, or place them directly on the map.</p>
                <p>Click any <span className="text-foreground font-medium">cell</span> in the table to set a quality level (✓ Good, ~ Partial, ✗ Bad) plus an optional value, link, or badge images.</p>
                <p>Click a <span className="text-foreground font-medium">metric name</span> to edit or remove it.</p>
                <p>Click a <span className="text-foreground font-medium">landmark name</span> to edit its name, type, group, description, or link.</p>
                <p>Use <span className="text-foreground font-medium">Groups</span> to organise landmarks into colour-coded sections. The funnel icon filters visible groups.</p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowGroupsDialog(true)}
            title="Manage groups"
          >
            <Users className="h-3.5 w-3.5" />
            Groups
          </Button>
          {isCollaborator && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowCreateLandmarkDialog(true)}
                title="Create a new landmark without position"
              >
                <Plus className="h-3.5 w-3.5" /> Landmark
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowTemplateSelector(true)}
                title="Add metric"
              >
                <Plus className="h-3.5 w-3.5" /> Metric
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Groups dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showGroupsDialog} onOpenChange={(v) => { if (!v) setShowGroupsDialog(false); }}>
        <DialogContent className="max-w-sm flex flex-col gap-0 p-0 overflow-hidden max-h-[80vh]" aria-describedby={undefined}>
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="text-sm">Manage Groups</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <GroupsPanel
              onCreateGroup={onCreateGroup}
              onEditGroup={onEditGroup}
              onRemoveGroup={onRemoveGroup}
              loading={loading}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Error alert ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="px-6 pt-3 shrink-0">
          <Alert variant="destructive" className="py-2 pr-2 relative">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="text-[11px] pr-6">{error}</AlertDescription>
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

      {metrics.length === 0 && landmarks.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No metrics defined yet. Add one below.
        </div>
      )}

      {/* ── Metric definition edit dialog ───────────────────────────────────── */}
      <MetricDefinitionEditDialog
        key={editingMetricDef?.id}
        metric={editingMetricDef}
        loading={loading}
        onSave={(id, name, description) => {
          onEditMetric(id, name, description || undefined);
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
        onClose={() => setEditingLandmark(null)}
      />

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {(metrics.length > 0 || landmarks.length > 0) && (
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-4 p-0 sticky left-0 z-20" style={{ background: 'hsl(var(--card))' }} />
                  <th className="text-left px-4 py-2 font-medium w-48 min-w-48 sticky z-20"
                    style={{ left: '1rem', background: 'hsl(var(--card))' }}>
                    <Button
                      ref={filterBtnRef}
                      size="sm"
                      variant="outline"
                      className={`h-7 gap-1.5 text-xs${hiddenGroups.size > 0 ? ' border-primary text-primary' : ''}`}
                      title={hiddenGroups.size > 0 ? 'Groups filtered — click to change' : 'Filter groups'}
                      onClick={() => setFilterOpen((v) => !v)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                      </svg>
                      {hiddenGroups.size > 0 ? `${hiddenGroups.size} hidden` : 'Filter'}
                    </Button>
                  </th>
                  {metrics.map((m) => (
                    <th key={m.id} className="text-left px-3 py-2 font-medium min-w-40 bg-transparent">
                      {isCollaborator ? (
                        <button
                          className="text-sm font-semibold hover:opacity-70 transition-opacity text-left"
                          style={{ color: 'hsl(185,100%,54%)' }}
                          title={m.description || undefined}
                          onClick={() => openMetricDef(m)}
                        >
                          {m.name}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: 'hsl(185,100%,54%)' }} title={m.description || undefined}>
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
                          <tr key={landmark.id}>
                            {/* Colour stripe – only on first row, spans all rows in group */}
                            {rowIdx === 0 && (
                              <td
                                rowSpan={sectionLandmarks.length}
                                className="group-stripe w-4 p-0 sticky left-0 z-30 select-none"
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
                                    className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden"
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
                            <td className="px-4 py-2 sticky z-20" style={{ left: '1rem', background: 'hsl(var(--card))' }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Overall badge */}
                                <div className="shrink-0">
                                  {lmWorst !== 'NONE' ? (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block font-mono"
                                      style={QUALITY_LEVEL_BADGE_STYLE[lmWorst]}
                                    >
                                      {QUALITY_LEVEL_SIGN[lmWorst]}
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block font-mono"
                                      style={QUALITY_LEVEL_BADGE_STYLE['NONE']}
                                    >
                                      —
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {/* Landmark name – opens info popover */}
                                  {(() => {
                                    const group = landmark.groupId ? groups[landmark.groupId] : null;
                                    const nameTitle = [landmark.name, landmark.description, landmark.link].filter(Boolean).join(' – ');
                                    const nameEl = isCollaborator ? (
                                      <button
                                        className="text-sm font-semibold text-foreground truncate text-left max-w-44 cursor-pointer hover:opacity-70 transition-opacity"
                                        title={`In group ${group?.name ?? 'n/a'} – click for details`}
                                      >
                                        {landmark.name}
                                      </button>
                                    ) : (
                                      <span className="text-sm font-semibold text-foreground truncate max-w-44" title={nameTitle}>
                                        {landmark.name}
                                      </span>
                                    );
                                    return (
                                      <LandmarkInfoPopover
                                        landmark={landmark}
                                        onEditLandmark={onEditLandmark}
                                        loading={loading}
                                      >
                                        {nameEl}
                                      </LandmarkInfoPopover>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                            {/* One cell per metric */}
                            {metrics.map((m) => {
                              const entry = (landmark.metrics ?? {})[m.id];

                              return (
                                <td key={m.id}
                                  className={`px-3 py-2 transition-colors group${isCollaborator ? ' cursor-pointer' : ''}`}
                                  onClick={isCollaborator ? () => openCellEdit(landmark.id, m.id) : undefined}
                                  title={entry ? `${QUALITY_LEVEL_LABEL[entry.level]}${entry.value ? `: ${entry.value}` : ''}` : (isCollaborator ? 'Click to set value' : undefined)}
                                >
                                  {entry ? (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {entry.level !== 'NONE' && (
                                        <span
                                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block w-fit font-mono"
                                          style={QUALITY_LEVEL_BADGE_STYLE[entry.level]}
                                        >
                                          {entry.value ?? QUALITY_LEVEL_SIGN[entry.level]}
                                        </span>
                                      )}
                                      {entry.badges && Object.entries(entry.badges).map(([key, url]) => (
                                        <div key={key} className="flex items-center gap-1 min-w-0"
                                          onClick={(e) => e.stopPropagation()}>
                                          <span className="text-[9px] text-muted-foreground shrink-0">{key}</span>
                                          <img src={url} alt={key} title={key} className="h-4 max-w-24 object-contain" />
                                        </div>
                                      ))}
                                      {entry.link && (
                                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                          <a href={entry.link} target="_blank" rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-blue-400"
                                            onClick={(e) => e.stopPropagation()} title={entry.link}>
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/30 text-[10px] italic group-hover:text-muted-foreground/60 transition-colors">
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

      <MetricTemplateSelector
        open={showTemplateSelector}
        onSubmit={(name, description) => {
          onCreateMetric(name, description);
          setShowTemplateSelector(false);
        }}
        onClose={() => setShowTemplateSelector(false)}
        loading={loading}
      />

      {/* ── Group filter popover ─────────────────────────────────────────────── */}
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

      {/* ── Group picker portal ─────────────────────────────────────────────── */}
      {groupPickerLandmarkId && groupPickerPos && ReactDOM.createPortal(
        <div
          ref={groupPickerRef}
          className="fixed z-9999 bg-popover border border-border rounded-md shadow-lg py-1 min-w-40"
          style={{ top: groupPickerPos.top, left: groupPickerPos.left }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-accent transition-colors flex items-center gap-2"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              onEditLandmarkGroup(groupPickerLandmarkId, null);
              setGroupPickerLandmarkId(null);
              setGroupPickerPos(null);
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground">No group</span>
            {!landmarksMap[groupPickerLandmarkId]?.groupId && <Check className="h-3 w-3 ml-auto text-primary" />}
          </button>
          {Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
            <button
              key={g.id}
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-accent transition-colors flex items-center gap-2"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                onEditLandmarkGroup(groupPickerLandmarkId, g.id);
                setGroupPickerLandmarkId(null);
                setGroupPickerPos(null);
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0 border border-white/20"
                style={{ backgroundColor: g.color }} />
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

