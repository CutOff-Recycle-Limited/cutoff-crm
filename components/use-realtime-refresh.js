"use client";

import { useEffect } from "react";

export function useRealtimeRefresh(channelName, tables, onChange) {
  useEffect(() => {
    if (typeof onChange !== "function") return undefined;

    const refreshIntervalMs = 30000;
    const interval = window.setInterval(() => onChange(), refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [channelName, tables, onChange]);
}
