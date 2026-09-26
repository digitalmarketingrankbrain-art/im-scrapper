import { useQuery } from "@tanstack/react-query";
import { fetchJobsPage, type JobsListParams } from "@/lib/api/jobs";

export function useJobsPage(params: JobsListParams) {
  return useQuery({
    queryKey: ["jobs-page", params],
    queryFn: () => fetchJobsPage(params),
    refetchInterval: 5000,
  });
}
