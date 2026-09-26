import { useQuery } from "@tanstack/react-query";
import { fetchRecentJobs } from "@/lib/api/jobs";

export function useRecentJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: fetchRecentJobs,
  });
}
