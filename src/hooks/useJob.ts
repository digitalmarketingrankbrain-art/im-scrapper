import { useQuery } from "@tanstack/react-query";
import { fetchJob } from "@/lib/api/jobs";
import { ACTIVE_JOB_STATUSES } from "@/types/dashboard";

const POLL_INTERVAL_MS = 2000;

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) => (query.state.data && ACTIVE_JOB_STATUSES.has(query.state.data.status) ? POLL_INTERVAL_MS : false),
  });
}
