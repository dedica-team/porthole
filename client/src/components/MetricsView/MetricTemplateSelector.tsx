import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, AlertTriangle, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchMetricTemplates } from '@/api/mapApi';
import type { MetricTemplate } from '@/types/map';

interface Props {
  open: boolean;
  onSubmit: (name: string, description: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function MetricTemplateSelector({ open, onSubmit, onClose, loading = false }: Props) {
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // form state
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFetchLoading(true);
    setFetchError(null);
    setTemplates([]);
    fetchMetricTemplates()
      .then(setTemplates)
      .catch((err: unknown) =>
        setFetchError(err instanceof Error ? err.message : 'Failed to load templates'),
      )
      .finally(() => setFetchLoading(false));
  }, [open]);

  // Reset form and search when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setName('');
      setDesc('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const fillForm = (templateName: string, templateDesc: string) => {
    setName(templateName);
    setDesc(templateDesc);
    if (typeof formRef.current?.scrollIntoView === 'function') {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const input = formRef.current?.querySelector('input');
    if (input && typeof input.focus === 'function') {
      setTimeout(() => input.focus(), 50);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), desc.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg flex flex-col gap-0 p-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Add Metric</DialogTitle>
          <DialogDescription>
            Select a 12-factor template to pre-fill the form, or enter name and description manually.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-6 pb-6">

            {/* ── Form ── */}
            <div ref={formRef}>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Metric details</span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm"
                  maxLength={60}
                  placeholder="Name (e.g. Availability)"
                />
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="text-sm min-h-[4rem] resize-none"
                  maxLength={200}
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="flex-1 gap-1.5 h-8"
                    disabled={!name.trim() || loading}
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add Metric
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-3" onClick={onClose}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
            </div>

            {/* ── Template list ── */}
            <Separator />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="pl-8 h-8 text-sm"
              />
            </div>

            {fetchLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading templates…</span>
              </div>
            )}

            {fetchError && (
              <div className="flex items-center gap-2 py-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{fetchError}</span>
              </div>
            )}

            {!fetchLoading && !fetchError && filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No templates match.</p>
            )}

            {!fetchLoading && !fetchError && filtered.length > 0 && (
              <div className="flex flex-col gap-1">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => fillForm(t.name, t.description)}
                    className="text-left w-full rounded-md border border-transparent px-3 py-2.5 hover:bg-accent hover:border-border transition-colors group"
                  >
                    <span className="block text-sm font-semibold text-foreground group-hover:text-accent-foreground">
                      {t.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
