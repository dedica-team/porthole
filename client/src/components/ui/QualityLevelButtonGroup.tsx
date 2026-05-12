import type { QualityLevel } from '@/types/landmark';
import { QUALITY_LEVEL_BADGE_STYLE, QUALITY_LEVEL_ORDER } from '@/types/landmark';

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

export default function QualityLevelButtonGroup({ value, onChange, className = '', buttonClassName = '' }: Props) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {QUALITY_LEVEL_ORDER.map((level) => {
        const active = value === level;
        const isNone = level === 'NONE';
        return (
          <button
            key={level}
            type="button"
            className={[
              'rounded border px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer',
              isNone ? 'italic' : '',
              active ? '' : 'opacity-75 hover:opacity-100',
              buttonClassName,
            ].filter(Boolean).join(' ')}
            style={isNone
              ? active
                ? {
                  ...QUALITY_LEVEL_BADGE_STYLE[level],
                  color: 'hsl(var(--muted-foreground))',
                  background: 'rgba(107,114,128,0.08)',
                  border: '1px solid rgba(107,114,128,0.24)',
                }
                : {
                  ...QUALITY_LEVEL_BADGE_STYLE[level],
                  color: 'hsl(var(--muted-foreground))',
                  background: 'transparent',
                  border: '1px solid rgba(107,114,128,0.18)',
                }
              : active
                ? QUALITY_LEVEL_BADGE_STYLE[level]
                : {
                  ...QUALITY_LEVEL_BADGE_STYLE[level],
                  background: 'transparent',
                }}
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

