import { useQuery } from "@tanstack/react-query";
import { fetchRecentJobs } from "@/lib/api/jobs";
import { ACTIVE_JOB_STATUSES } from "@/types/dashboard";

export function useRecentJobs() {
  return useQuery({
    queryKey: ["jobs"],
    refetchInterval: (query) => (query.state.data?.some((j) => ACTIVE_JOB_STATUSES.has(j.status)) ? 2000 : false),
    queryFn: fetchRecentJobs,
  });
}
