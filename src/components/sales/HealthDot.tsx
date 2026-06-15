import { cn } from "@/lib/utils";
import type { Health } from "@/lib/sales/types";

const COLOR: Record<Health, string> = {
  green: "bg-brand ring-brand-tint",
  amber: "bg-warn ring-warn-tint",
  red: "bg-danger ring-danger-tint",
};

const TITLE: Record<Health, string> = {
  green: "Healthy",
  amber: "Needs a look",
  red: "At risk",
};

export function HealthDot({
  health,
  className,
}: {
  health: Health;
  className?: string;
}) {
  return (
    <span
      title={TITLE[health]}
      className={cn(
        "inline-block size-2 rounded-full ring-2",
        COLOR[health],
        className,
      )}
    />
  );
}
