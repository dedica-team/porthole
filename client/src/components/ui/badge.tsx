import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
      status: {
        GOOD: "bg-success/20 text-foreground border-success/50",
        PARTIAL: "bg-warning/20 text-foreground border-warning/50",
        BAD: "bg-destructive/20 text-foreground border-destructive/50",
        NONE: "bg-muted text-muted-foreground border-border",
      }
    },
    defaultVariants: {
      variant: "default",
      status: "NONE",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, status, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, status }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
