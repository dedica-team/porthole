import { cn } from '@/lib/utils';

type LoadingOverlayVariant = 'fill' | 'overlay' | 'fullscreen';

interface LoadingOverlayProps {
  label: string;
  variant?: LoadingOverlayVariant;
  className?: string;
}

const VARIANT_CLASSNAMES: Record<LoadingOverlayVariant, string> = {
  fill: 'w-full h-full',
  overlay: 'absolute inset-0 z-20 pointer-events-none select-none',
  fullscreen: 'w-full h-dvh',
};

export default function LoadingOverlay({
  label,
  variant = 'fill',
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-2 bg-background',
      VARIANT_CLASSNAMES[variant],
      className,
    )}
    >
      <div className="h-0.5 w-48 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-full rounded-full bg-cyan-500/50 animate-pulse" />
      </div>
      <span className="text-sm tracking-widest uppercase text-muted-foreground/40">{label}</span>
    </div>
  );
}

