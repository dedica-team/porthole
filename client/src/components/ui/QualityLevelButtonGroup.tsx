import type { QualityLevel } from '@/types/landmark';
import { QUALITY_LEVEL_ORDER } from '@/types/landmark';
import { qualityLevelToStatus, type BadgeStatus } from '@/components/ui/status-badge';

interface Props {
  value: QualityLevel;
  onChange: (level: QualityLevel) => void;
  className?: string;
  buttonClassName?: string;
}

const QUALITY_LEVEL_SHORT_LABEL: Record<QualityLevel, string> = {
  NONE: 'None',
  OK: 'OK',
  WARNING: 'Warn',
  ERROR: 'Error',
};

/**
 * Status-based colour classes mirroring the Badge status variants so that
 * quality-level buttons share the same visual language as StatusBadge.
 */
const STATUS_BUTTON_CLASSES: Record<BadgeStatus, string> = {
  GOOD: 'bg-success/20 text-foreground border-success/50',
  WARNING: 'bg-warning/20 text-foreground border-warning/50',
  BAD: 'bg-destructive/20 text-foreground border-destructive/50',
  NONE: 'bg-muted text-muted-foreground border-border',
  ONGOING: 'bg-info/20 text-foreground border-info/50',
};

const STATUS_BUTTON_INACTIVE_CLASSES: Record<BadgeStatus, string> = {
  GOOD: 'bg-transparent text-foreground/70 border-success/30',
  WARNING: 'bg-transparent text-foreground/70 border-warning/30',
  BAD: 'bg-transparent text-foreground/70 border-destructive/30',
  NONE: 'bg-transparent text-muted-foreground border-border',
  ONGOING: 'bg-transparent text-foreground/70 border-info/30',
};

export default function QualityLevelButtonGroup({ value, onChange, className = '', buttonClassName = '' }: Props) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {QUALITY_LEVEL_ORDER.map((level) => {
        const active = value === level;
        const isNone = level === 'NONE';
        const status = qualityLevelToStatus[level];
        const colorClass = active
          ? STATUS_BUTTON_CLASSES[status]
          : STATUS_BUTTON_INACTIVE_CLASSES[status];
        return (
          <button
            key={level}
            type="button"
            className={[
              'rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors cursor-pointer',
              isNone ? 'italic' : '',
              active ? '' : 'opacity-75 hover:opacity-100',
              colorClass,
              buttonClassName,
            ].filter(Boolean).join(' ')}
            onClick={() => onChange(level)}
            aria-pressed={active}
            aria-label={`Set quality level to ${QUALITY_LEVEL_SHORT_LABEL[level]}`}
            title={QUALITY_LEVEL_SHORT_LABEL[level]}
          >
            {QUALITY_LEVEL_SHORT_LABEL[level]}
          </button>
        );
      })}
    </div>
  );
}