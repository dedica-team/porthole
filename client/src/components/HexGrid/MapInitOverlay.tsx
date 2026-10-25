/**
 * MapInitOverlay
 *
 * Appears synchronously when a map view mounts (before any useEffect or WebGL
 * work), giving the user immediate feedback.  Dismissed via onDismiss() which
 * is called from HexGrid's onFirstRender callback once scene geometry is ready.
 */
import { useState } from 'react';
import { LOADING_COPY } from '@/components/ui/loadingCopy';

interface Props {
  tileCount: number;
  landmarkCount: number;
  onDismiss: (dismiss: () => void) => void;
}

export default function MapInitOverlay({ tileCount, landmarkCount, onDismiss }: Props) {
  const [opacity, setOpacity] = useState(1);
  const [gone, setGone] = useState(false);

  // Hand the dismiss function up to the caller on first render (ref-style).
  useState(() => {
    onDismiss(() => {
      setOpacity(0);
      setTimeout(() => setGone(true), 380);
    });
  });

  if (gone) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background select-none"
      style={{ transition: 'opacity 0.35s ease', opacity, pointerEvents: opacity === 1 ? 'all' : 'none' }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="h-0.5 w-48 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-cyan-500/50 rounded-full animate-pulse w-full" />
        </div>
        <span className="text-sm text-muted-foreground/60 tracking-widest uppercase">{LOADING_COPY.render}</span>
        <div className="flex gap-4 text-sm text-muted-foreground/40">
          <span>{tileCount.toLocaleString()} tiles</span>
          <span>{landmarkCount.toLocaleString()} elements</span>
        </div>
      </div>
    </div>
  );
}

