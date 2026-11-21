import React from 'react';
import type { ReconciliationSummary } from '@/services/metricService';
import { StatusBadge, qualityLevelToStatus } from '@/components/ui/status-badge';
import { QUALITY_LEVEL_LABEL, type QualityLevel } from '@/types/landmark';
import { ExternalLink, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface Props {
  summary: ReconciliationSummary;
  metricName?: string;
}

export const MetricDryRunPreview: React.FC<Props> = ({ summary }) => {
  const { rows, matchedCount, unmatchedCount, multipleMatchesCount } = summary;

  if (rows.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
        No element rows found to evaluate.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* ── Summary Counters ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">Dry-Run Preview:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          <CheckCircle className="h-3 w-3" />
          {matchedCount} Matched
        </span>
        {multipleMatchesCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            <AlertTriangle className="h-3 w-3" />
            {multipleMatchesCount} Multi-match
          </span>
        )}
        {unmatchedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
            <HelpCircle className="h-3 w-3" />
            {unmatchedCount} Unmatched
          </span>
        )}
      </div>

      {/* ── Reconciled Table ────────────────────────────────────────────── */}
      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0">
            <tr>
              <th className="p-2 font-medium">Element</th>
              <th className="p-2 font-medium">Matched Element</th>
              <th className="p-2 font-medium">Value</th>
              <th className="p-2 font-medium">Level</th>
              <th className="p-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, idx) => {
              const level = (row.level as QualityLevel) || 'NONE';
              return (
                <tr
                  key={`${row.element}-${idx}`}
                  className={
                    row.status === 'UNMATCHED'
                      ? 'bg-rose-500/5'
                      : row.status === 'MULTIPLE_MATCHES'
                      ? 'bg-amber-500/5'
                      : 'hover:bg-muted/20'
                  }
                >
                  <td className="p-2 font-mono text-foreground truncate max-w-44" title={row.element}>
                    {row.element}
                  </td>
                  <td className="p-2">
                    {row.matchedLandmarks.length === 0 ? (
                      <span className="text-rose-400 font-medium italic">No match</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {row.matchedLandmarks.map((lm) => (
                          <span key={lm.id} className="text-foreground font-medium truncate max-w-40" title={lm.name}>
                            {lm.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-mono text-foreground">{row.value ?? '—'}</td>
                  <td className="p-2">
                    {level !== 'NONE' ? (
                      <StatusBadge status={qualityLevelToStatus[level]} className="text-[11px] px-1.5 py-0.5">
                        {QUALITY_LEVEL_LABEL[level]}
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground max-w-40 truncate">
                    {row.link ? (
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-link hover:underline"
                        title={row.link}
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        <span>{row.linkText || 'Link'}</span>
                      </a>
                    ) : row.description ? (
                      <span title={row.description}>{row.description}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetricDryRunPreview;
