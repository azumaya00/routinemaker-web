"use client";

import type { LucideIcon } from "lucide-react";

type ThemedIconProps = {
  icon: LucideIcon;
  className?: string;
  "aria-label"?: string;
};

// iOS Safari で currentColor が反映されないケースを避けるため、stroke に直接 var(--fg) を渡す
export function ThemedIcon({ icon: Icon, className, ...rest }: ThemedIconProps) {
  return (
    <Icon
      className={className}
      color="var(--fg)"
      style={{ stroke: "var(--fg)" }}
      {...rest}
    />
  );
}
