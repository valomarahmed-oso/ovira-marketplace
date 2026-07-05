"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/** Records first-touch marketing attribution on the initial client load. */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
