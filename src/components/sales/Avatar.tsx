import { cn } from "@/lib/utils";

// Initials chip with a deterministic tone per name. Re-skinned to texasturf
// tokens (brand + ink ramp) — no Evergreen moss/violet/amber palette.
const PALETTE = [
  "bg-brand text-on-brand",
  "bg-brand-strong text-on-brand",
  "bg-ink text-canvas",
  "bg-ink-2 text-canvas",
  "bg-brand-tint text-brand-strong",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-5 text-[9px]",
        size === "md" && "size-7 text-[11px]",
        size === "lg" && "size-10 text-sm",
        PALETTE[hashName(name) % PALETTE.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}
