import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats } from "@/lib/api/stats";

const POLL_INTERVAL_MS = 5000;

export function useDashboardStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: POLL_INTERVAL_MS,
  });
}
