import * as React from "react"
import { Badge } from "./badge"
import type { QualityLevel } from "@/types/landmark"
import type { MatrixLevel } from "@/types/matrix"
import type { ChoreEntryState } from "@/types/chores"

/**
 * Canonical badge status used by the Badge component.
 * Domain-specific levels map to one of these four values.
 */
export type BadgeStatus = "GOOD" | "PARTIAL" | "BAD" | "NONE"

// ── Domain → BadgeStatus mapping tables ─────────────────────────────────────

export const qualityLevelToStatus: Record<QualityLevel, BadgeStatus> = {
  NONE: "NONE",
  OK: "GOOD",
  WARNING: "PARTIAL",
  ERROR: "BAD",
}

export const matrixLevelToStatus: Record<MatrixLevel, BadgeStatus> = {
  NONE: "NONE",
  LOW: "BAD",
  MEDIUM: "PARTIAL",
  HIGH: "GOOD",
}

export const choreStateToStatus: Record<ChoreEntryState, BadgeStatus> = {
  NONE: "NONE",
  ONGOING: "PARTIAL",
  BLOCKED: "BAD",
  DONE: "GOOD",
}

// ── StatusBadge component ───────────────────────────────────────────────────

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The resolved badge status (GOOD / PARTIAL / BAD / NONE). */
  status: BadgeStatus
  /** Optional Badge variant override (defaults to using status colours). */
  variant?: "default" | "secondary" | "destructive" | "outline"
  children?: React.ReactNode
  className?: string
}

/**
 * StatusBadge – a thin wrapper around Badge that displays a coloured pill
 * based on a resolved BadgeStatus.  Callers map their domain level to a
 * status using the exported mapping tables (qualityLevelToStatus, etc.).
 *
 * Why a wrapper?  All status-like badges across the app share the same
 * visual language (green / amber / red / muted).  Centralising the variant
 * mapping here ensures consistency and makes future restyling trivial.
 */
export function StatusBadge({ status, variant, children, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      status={status}
      variant={variant}
      className={className}
      {...props}
    >
      {children}
    </Badge>
  )
}

export default StatusBadge