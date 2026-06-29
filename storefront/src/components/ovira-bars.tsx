import { cn } from "@/lib/utils";

export function OviraBars({
  className,
  animated,
  tone = "blue",
}: {
  className?: string;
  animated?: boolean;
  tone?: "blue" | "white";
}) {
  const color = tone === "white" ? "bg-white" : "bg-blue";
  const base = cn("block h-[3px] rounded-full origin-right transition-all duration-300", color);
  return (
    <span className={cn("inline-flex flex-col gap-[3px]", className)} aria-hidden="true">
      <span className={cn(base, "w-4")} />
      <span className={cn(base, animated ? "w-2 group-hover:w-4" : "w-3")} />
      <span className={cn(base, animated ? "w-3 group-hover:w-4" : "w-4")} />
    </span>
  );
}
