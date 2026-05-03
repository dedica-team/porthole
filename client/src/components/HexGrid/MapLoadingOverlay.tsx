/**
 * MapLoadingOverlay
 *
 * Shown immediately when a map view mounts, before Three.js has drawn its
 * first frame.  Displays live counts of tiles and landmarks so the user
 * sees meaningful info during the (potentially multi-second) setup phase.
 * Fades out automatically once `ready` becomes true.
 */
import { useEffect, useState } from 'react';
import { Layers, Castle } from 'lucide-react';

interface Props {
  /** Set to true after the first Three.js frame has been drawn. */
  ready: boolean;
  tileCount: number;
  landmarkCount: number;
  /** 'regular' shows terrain label; 'process' shows process label. */
  mode?: 'regular' | 'process';
}

export default function MapLoadingOverlay({ ready, tileCount, landmarkCount, mode = 'regular' }: Props) {
  // Keep the overlay mounted briefly after ready so the CSS fade-out can play.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setVisible(false), 400);
    return () => clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background"
      style={{
        transition: 'opacity 0.35s ease',
        opacity: ready ? 0 : 1,
        pointerEvents: ready ? 'none' : 'all',
      }}
    >
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-14 w-14 rounded-full bg-cyan-500/10 animate-ping" />
        <span className="relative inline-flex h-10 w-10 rounded-full border border-cyan-500/40 bg-cyan-500/5 items-center justify-center">
          <Layers className="h-5 w-5 text-cyan-500/70" />
        </span>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
          {mode === 'process' ? 'Building Process View' : 'Rendering Map'}
        </span>
        {/* Live stats */}
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Layers className="h-3 w-3" />
            <span>{tileCount.toLocaleString()} tiles</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Castle className="h-3 w-3" />
            <span>{landmarkCount.toLocaleString()} landmarks</span>
          </div>
        </div>
      </div>
    </div>
  );
}

