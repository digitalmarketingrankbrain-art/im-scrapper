import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelJob, retryJob } from "@/lib/api/jobs";

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs-page"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job"] });
    },
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs-page"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job"] });
    },
  });
}
