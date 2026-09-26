import { useQuery } from "@tanstack/react-query";
import { fetchJobResults } from "@/lib/api/jobs";
import { ACTIVE_JOB_STATUSES, type JobStatus } from "@/types/dashboard";

export function useJobResults(jobId: string | null, status: JobStatus | undefined) {
  return useQuery({
    queryKey: ["job", jobId, "results"],
    queryFn: () => fetchJobResults(jobId as string),
    enabled: jobId !== null && status !== undefined && !ACTIVE_JOB_STATUSES.has(status),
  });
}
