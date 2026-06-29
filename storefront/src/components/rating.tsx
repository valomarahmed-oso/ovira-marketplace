import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={cn(i <= Math.round(value) ? "fill-gold text-gold" : "fill-line text-line")}
          />
        ))}
      </span>
      <span className="font-tech text-sm text-ink">{value.toFixed(1)}</span>
      {typeof count === "number" && <span className="text-xs text-ink-400">({count})</span>}
    </span>
  );
}
