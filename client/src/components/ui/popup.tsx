"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { DialogOverlay, DialogPortal, DialogClose } from "./dialog"
import { CloseButton } from "./close-button"

interface PopupProps {
  title: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Override class on the outer content panel (e.g. max-w-md) */
  className?: string
  /** Override class on the inner body div (e.g. p-0 for edge-to-edge content) */
  contentClassName?: string
}

export function Popup({ title, open, onOpenChange, children, className, contentClassName }: PopupProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 overflow-hidden sm:rounded-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border shrink-0">
            <DialogPrimitive.Title className="text-base font-semibold text-foreground leading-none">
              {title}
            </DialogPrimitive.Title>
            <DialogClose asChild>
              <CloseButton />
            </DialogClose>
          </div>
          <div className={cn("p-4", contentClassName)}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}
