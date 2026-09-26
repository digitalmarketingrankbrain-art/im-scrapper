import { parseJsonOrThrow } from "@/lib/api/jobs";
import type { DashboardStats } from "@/types/dashboard";

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/stats");
  return (await parseJsonOrThrow(res)) as DashboardStats;
}
