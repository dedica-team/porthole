import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchGreenkeepingRotations } from '@/api/mapApi';
import { useMapStore } from '@/store/mapStore';
import GreenkeepingTasklistDialog from './GreenkeepingTasklistDialog';

export default function GreenkeepingChecklistView() {
  const { rotationId } = useParams<{ rotationId: string }>();
  const currentMap = useMapStore((s) => s.currentMap);
  const greenkeepingRotations = useMapStore((s) => s.greenkeepingRotations);
  const setGreenkeepingRotations = useMapStore((s) => s.setGreenkeepingRotations);
  const greenkeepingRotationsFetched = useMapStore((s) => s.greenkeepingRotationsFetched);
  const setGreenkeepingRotationsFetched = useMapStore((s) => s.setGreenkeepingRotationsFetched);
  const greenkeepingRotationsLoading = useMapStore((s) => s.greenkeepingRotationsLoading);
  const setGreenkeepingRotationsLoading = useMapStore((s) => s.setGreenkeepingRotationsLoading);
  const greenkeepingRotationsError = useMapStore((s) => s.greenkeepingRotationsError);
  const setGreenkeepingRotationsError = useMapStore((s) => s.setGreenkeepingRotationsError);

  useEffect(() => {
    if (!currentMap || greenkeepingRotationsFetched) return;
    setGreenkeepingRotationsLoading(true);
    fetchGreenkeepingRotations(currentMap.id)
      .then((rotations) => {
        setGreenkeepingRotations(rotations);
        setGreenkeepingRotationsFetched(true);
      })
      .catch((err: unknown) => setGreenkeepingRotationsError(err instanceof Error ? err.message : 'Failed to load rotations.'))
      .finally(() => setGreenkeepingRotationsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap?.id, greenkeepingRotationsFetched]);

  if (!currentMap) return null;

  const rotation = greenkeepingRotations.find((r) => r.id === rotationId);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-3 sm:mx-6 my-3 flex flex-col gap-3">
        {greenkeepingRotationsLoading && !rotation ? (
          <p className="text-sm text-muted-foreground">Loading checklist…</p>
        ) : rotation ? (
          <GreenkeepingTasklistDialog
            open={true}
            onOpenChange={() => { /* route-driven view */ }}
            rotation={rotation}
            inline
            headerAction={
              <Link
                to={`/session/${currentMap.id}/greenkeeping`}
                className="flex items-center gap-1.5 px-3 text-xs text-foreground bg-secondary/70 hover:text-muted-foreground hover:bg-secondary border-l border-border transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Rotations
              </Link>
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {greenkeepingRotationsError ?? 'Rotation not found.'}
          </div>
        )}
      </div>
    </div>
  );
}
