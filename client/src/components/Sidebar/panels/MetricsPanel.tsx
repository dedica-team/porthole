import { useState } from 'react';
import { BarChart2, Plus, Pencil, Trash2, Loader2, Check } from 'lucide-react';
import { CloseButton } from '@/components/ui/close-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { QualityMetric } from '@/types/landmark';
import MetricTemplateSelector from '@/components/MetricsView/MetricTemplateSelector';
interface Props {
  onCreateMetric: (name: string, description: string) => void;
  onEditMetric: (metricId: string, name?: string, description?: string) => void;
  onRemoveMetric: (metricId: string) => void;
  loading: boolean;
}
interface EditState { name: string; description: string }
export default function MetricsPanel({ onCreateMetric, onEditMetric, onRemoveMetric, loading }: Props) {
  const currentMap = useMapStore((s) => s.currentMap);
  const storeMetrics = useMapStore((s) => s.metrics);
  const userId = useAuthStore((s) => s.userId);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editState, setEditState]     = useState<EditState>({ name: '', description: '' });
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  if (!currentMap) return null;
  const isCollaborator = !!(userId && currentMap.collaborators.some((c) => c.id === userId));
  const metrics: QualityMetric[] = Object.values(storeMetrics);
  const startEdit = (metric: QualityMetric) => {
    setEditingId(metric.id);
    setEditState({ name: metric.name, description: metric.description });
    setRemoveConfirmId(null);
  };
  const saveEdit = (metricId: string) => {
    if (!editState.name.trim()) return;
    onEditMetric(metricId, editState.name.trim(), editState.description.trim() || undefined);
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);
  const requestRemove = (metricId: string) => {
    setRemoveConfirmId(metricId);
    setEditingId(null);
  };
  const confirmRemove = (metricId: string) => {
    onRemoveMetric(metricId);
    setRemoveConfirmId(null);
  };
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <BarChart2 className="h-4 w-4" />
        <span className="text-sm font-medium uppercase tracking-wider">Quality Metrics</span>
      </div>
      {metrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">No metrics yet. Create one below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {metrics.map((metric) => {
            if (editingId === metric.id) {
              return (
                <div key={metric.id} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                  <Input
                    autoFocus
                    value={editState.name}
                    onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                    className="h-8 text-sm"
                    maxLength={60}
                    placeholder="Metric name"
                  />
                  <Textarea
                    value={editState.description}
                    onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                    className="text-sm min-h-12 resize-none"
                    maxLength={200}
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-sm gap-1"
                      disabled={!editState.name.trim() || loading}
                      onClick={() => saveEdit(metric.id)}
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Save
                    </Button>
                    <CloseButton className="h-7 w-7" onClick={cancelEdit} />
                  </div>
                </div>
              );
            }
            if (removeConfirmId === metric.id) {
              return (
                <div key={metric.id} className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <span className="text-sm text-destructive text-center">Remove «{metric.name}»?</span>
                  <p className="text-sm text-muted-foreground text-center">All landmark values for this metric will be cleared.</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-sm"
                      disabled={loading}
                      onClick={() => confirmRemove(metric.id)}
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, remove'}
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 h-7 text-sm" onClick={() => setRemoveConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={metric.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">{metric.name}</span>
                  {metric.description && (
                    <span className="text-sm text-muted-foreground leading-relaxed">{metric.description}</span>
                  )}
                </div>
                {isCollaborator && (
                  <div className="flex gap-1 shrink-0">
                    <Button className="text-muted-foreground hover:text-foreground transition-colors p-0.5" onClick={() => startEdit(metric)} title="Edit metric">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant={"destructive"} className="text-muted-foreground hover:text-destructive transition-colors p-0.5" onClick={() => requestRemove(metric.id)} title="Remove metric">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Separator className="bg-border" />
      {isCollaborator && (
        <Button
          size="sm"
          variant="default"
          className="w-full gap-2 h-8"
          onClick={() => setShowTemplateSelector(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Metric
        </Button>
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
    </div>
  );
}
