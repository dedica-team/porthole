import { useState } from 'react';
import { Popup } from '@/components/ui/popup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MapSize } from '@/api/mapApi';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface RegenerateTerrainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: { mapSize?: MapSize; cols?: number; rows?: number }) => Promise<void>;
  loading: boolean;
  error?: string;
}

const MAP_SIZE_OPTIONS: { size: MapSize; label: string; detail: string }[] = [
  { size: 'SMALL',  label: 'Small',  detail: '25 × 25' },
  { size: 'MEDIUM', label: 'Medium', detail: '50 × 50' },
  { size: 'LARGE',  label: 'Large',  detail: '80 × 80' },
];

export function RegenerateTerrainDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  error,
}: RegenerateTerrainDialogProps) {
  const [selectedSize, setSelectedSize] = useState<MapSize | 'CUSTOM'>('MEDIUM');
  const [customCols, setCustomCols] = useState<number>(50);
  const [customRows, setCustomRows] = useState<number>(50);

  const handleRegenerate = async () => {
    if (selectedSize === 'CUSTOM') {
      const cols = Math.min(150, Math.max(10, customCols || 50));
      const rows = Math.min(150, Math.max(10, customRows || 50));
      await onConfirm({ cols, rows });
    } else {
      await onConfirm({ mapSize: selectedSize });
    }
  };

  return (
    <Popup
      title="Regenerate Map Terrain"
      open={open}
      onOpenChange={(v) => { if (!loading) onOpenChange(v); }}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground -mt-1">
          Select map dimensions to regenerate the terrain. Landmarks belonging to the same group will be placed close together on separate islands.
        </p>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Map Dimensions
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {MAP_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.size}
                type="button"
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all',
                  'hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  selectedSize === opt.size
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'border-border text-foreground',
                )}
                onClick={() => setSelectedSize(opt.size)}
                disabled={loading}
              >
                <span className="text-sm">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.detail}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={cn(
              'flex items-center justify-between p-2.5 rounded-lg border transition-all mt-1 cursor-pointer text-left',
              'hover:bg-accent hover:text-accent-foreground',
              selectedSize === 'CUSTOM'
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border text-foreground',
            )}
            onClick={() => setSelectedSize('CUSTOM')}
            disabled={loading}
          >
            <span className="text-sm">Custom Size</span>
            <span className="text-xs text-muted-foreground">Specify columns & rows</span>
          </button>

          {selectedSize === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-3 mt-1.5 p-3 rounded-lg border border-border bg-muted/40">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-cols" className="text-xs">
                  Columns (Width)
                </Label>
                <Input
                  id="custom-cols"
                  type="number"
                  min={10}
                  max={150}
                  value={customCols}
                  onChange={(e) => setCustomCols(parseInt(e.target.value, 10) || 10)}
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-rows" className="text-xs">
                  Rows (Height)
                </Label>
                <Input
                  id="custom-rows"
                  type="number"
                  min={10}
                  max={150}
                  value={customRows}
                  onChange={(e) => setCustomRows(parseInt(e.target.value, 10) || 10)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </div>
      </div>
    </Popup>
  );
}
