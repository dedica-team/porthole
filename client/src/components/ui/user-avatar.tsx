import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const SIZES = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-10 h-10",
} as const

type Size = keyof typeof SIZES

interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  username: string
  avatarUrl?: string
  /** Show name (and optional subtitle) horizontally inline instead of below */
  inline?: boolean
  /** Highlight as active (cyan border + ring) */
  active?: boolean
  size?: Size
  /** Stretch to fill the parent container width */
  fullWidth?: boolean
}

export function UserAvatar({
  username,
  avatarUrl,
  inline = false,
  active = false,
  size = "md",
  fullWidth = false,
  className,
  ...props
}: UserAvatarProps) {
  const initials = username.slice(0, 2).toUpperCase()

  const avatarEl = (
    <Avatar
      className={cn(
        SIZES[size],
        "border shrink-0",
        active
          ? "border-primary ring-2 ring-primary/20"
          : "border-border",
      )}
    >
      {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
      <AvatarFallback
        className={cn(
          "text-sm font-semibold",
          active
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )

  if (inline) {
    return (
      <div className={cn("flex items-center gap-1.5 min-w-0", className)} {...props}>
        {avatarEl}
        <span className="truncate text-sm text-foreground">{username}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", fullWidth && "w-full", className)} {...props}>
      {avatarEl}
      <span className={cn("text-sm text-center truncate w-full", active ? "font-medium text-foreground" : "text-foreground")}>
        {username}
      </span>
    </div>
  )
}
