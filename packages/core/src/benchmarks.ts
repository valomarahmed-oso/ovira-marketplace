/** How this seller compares to the sellers they actually compete with. */

import { get } from "./http.js";

const NS = "ovira_marketplace.api.benchmarks";

export type BenchmarkMetric = "orders" | "gross" | "aov" | "trust_score" | "return_rate";

export type Comparison = {
  metric: BenchmarkMetric | string;
  mine: number;
  peer_median: number | null;
  /** 0–100. Where this seller sits among their peers on this metric. */
  percentile: number | null;
  /** False for return rate — the one metric where lower is the good direction. */
  higher_is_better: boolean;
  /**
   * The server's own summary word. Computed there so a client cannot get the
   * direction backwards on the metrics where low is good — which is exactly
   * the mistake that turns a warning into praise.
   */
  standing: "ahead" | "typical" | "behind" | "unknown";
};

export type VendorMetrics = { orders: number; units: number; gross: number; aov: number };

/**
 * Either a comparison, or an honest refusal.
 *
 * The server returns `available: false` when there are too few peers rather
 * than a fabricated median: a benchmark against two stores is worse than no
 * benchmark, because it looks like information.
 */
export type Benchmarks =
  | {
      available: true;
      from_date: string;
      to_date: string;
      peer_count: number;
      currency?: string;
      mine: VendorMetrics;
      comparisons: Comparison[];
    }
  | {
      available: false;
      reason: string;
      peer_count: number;
      min_peers: number;
      mine: VendorMetrics;
      from_date: string;
      to_date: string;
    };

export async function myBenchmarks(days = 30): Promise<Benchmarks | null> {
  return get<Benchmarks>(`${NS}.my_benchmarks`, { days });
}
