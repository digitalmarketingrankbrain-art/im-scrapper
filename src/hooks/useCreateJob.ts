import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJob } from "@/lib/api/jobs";

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
