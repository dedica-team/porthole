import { useEffect, useState } from 'react';
import { Bug, Crosshair, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/mapStore';
import { leaveWatchtower } from '@/api/mapApi';

/**
 * Wave / bug counter plus the watchtower exit control.
 * Rendered above the 3D map while a game is running.
 */
export default function GameHUD() {
  const gameState = useMapStore((s) => s.gameState);
  const activeWatchtowerId = useMapStore((s) => s.activeWatchtowerId);
  const setActiveWatchtowerId = useMapStore((s) => s.setActiveWatchtowerId);
  const setGameState = useMapStore((s) => s.setGameState);
  const currentMap = useMapStore((s) => s.currentMap);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (gameState?.phase !== 'INTERMISSION') return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [gameState?.phase]);

  if (!currentMap?.gameEnabled || !gameState || gameState.phase === 'IDLE') return null;

  const bugs = Object.values(gameState.bugs ?? {});
  const underAttack = new Set(bugs.map((b) => b.targetLandmarkId).filter(Boolean)).size;
  const nextWaveMs = gameState.nextWaveAt ? new Date(gameState.nextWaveAt).getTime() : null;
  const secondsToWave = nextWaveMs ? Math.max(0, Math.ceil((nextWaveMs - now) / 1000)) : 0;

  const handleLeave = async () => {
    if (!currentMap || !activeWatchtowerId) return;
    setLeaving(true);
    try {
      setGameState(await leaveWatchtower(currentMap.id, activeWatchtowerId));
      setActiveWatchtowerId(null);
    } catch {
      /* ignore – a broadcast will correct the state */
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="pointer-events-none absolute top-2 right-2 z-30 flex flex-col items-end gap-1.5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-red-500/40 bg-black/70 px-3 py-1.5 text-xs font-mono text-red-100 shadow-lg">
        <span className="flex items-center gap-1">
          <Bug className="h-3.5 w-3.5" /> Wave {gameState.wave}
        </span>
        <span>
          {gameState.phase === 'ACTIVE'
            ? `${bugs.length} bug${bugs.length === 1 ? '' : 's'}`
            : `next wave in ${secondsToWave}s`}
        </span>
        {underAttack > 0 && (
          <span className="flex items-center gap-1 text-amber-300">
            <Shield className="h-3.5 w-3.5" /> {underAttack} under attack
          </span>
        )}
      </div>

      {activeWatchtowerId && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-red-500/40 bg-black/70 px-2 py-1 text-xs font-mono text-red-100">
          <Crosshair className="h-3.5 w-3.5" /> Watchtower
          <Button size="sm" variant="flat" className="h-6 px-2 text-xs" disabled={leaving} onClick={handleLeave}>
            <LogOut className="h-3 w-3" /> Leave
          </Button>
        </div>
      )}
    </div>
  );
}
