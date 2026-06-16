// shadcn/ui-style Select, built on @radix-ui/react-select, themed for the app's
// dark palette. Non-native: fully custom popover, keyboard-accessible.
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "../../lib/cn.ts";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-60">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ink outline-none transition-colors",
      "hover:border-faint focus:border-accent data-[placeholder]:text-faint",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronIcon />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-50 max-h-72 min-w-[--radix-select-trigger-width] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl",
        position === "popper" && "data-[side=bottom]:translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-0">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-sm text-muted outline-none",
      "data-[highlighted]:bg-elevated data-[highlighted]:text-ink data-[state=checked]:text-ink",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex items-center text-accent">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
