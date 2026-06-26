"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { QualityLevel } from "@/types/landmark"
import type { MatrixLevel } from "@/types/matrix"
import type { ChoreEntryState } from "@/types/chores"

export type BadgeStatus = "GOOD" | "WARNING" | "BAD" | "NONE" | "ONGOING"

export const qualityLevelToStatus: Record<QualityLevel, BadgeStatus> = {
  NONE: "NONE",
  OK: "GOOD",
  WARNING: "WARNING",
  ERROR: "BAD",
}

export const matrixLevelToStatus: Record<MatrixLevel, BadgeStatus> = {
  NONE: "NONE",
  LOW: "BAD",
  MEDIUM: "WARNING",
  HIGH: "GOOD",
}

export const choreStateToStatus: Record<ChoreEntryState, BadgeStatus> = {
  NONE: "NONE",
  ONGOING: "ONGOING",
  BLOCKED: "BAD",
  DONE: "GOOD",
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      status: {
        GOOD:    "bg-success/5 text-success border-success/50",
        WARNING: "bg-warning/5 text-warning border-warning/50",
        BAD:     "bg-destructive/5 text-destructive border-destructive/50",
        NONE:    "bg-muted text-muted-foreground border-border",
        ONGOING: "bg-info/5 text-info border-info/50",
      },
    },
    defaultVariants: { status: "NONE" },
  }
)

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: BadgeStatus
  className?: string
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return <div className={cn(badgeVariants({ status }), className)} {...props} />
}

// ── StatusIndicator ──────────────────────────────────────────────────────────

const indicatorVariants = cva(
  "inline-block w-2 h-2 rounded-full shrink-0",
  {
    variants: {
      status: {
        GOOD:    "bg-success",
        WARNING: "bg-warning",
        BAD:     "bg-destructive",
        NONE:    "bg-muted-foreground/40",
        ONGOING: "bg-info",
      },
    },
    defaultVariants: { status: "NONE" },
  }
)

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus
}

export function StatusIndicator({ status, className, ...props }: StatusIndicatorProps) {
  return <span className={cn(indicatorVariants({ status }), className)} {...props} />
}

export default StatusBadge
