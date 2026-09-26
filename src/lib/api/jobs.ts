import type { JobResultsView, Paginated, ScrapeJobView } from "@/types/dashboard";

export async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchRecentJobs(): Promise<ScrapeJobView[]> {
  const res = await fetch("/api/jobs");
  return (await parseJsonOrThrow(res)) as ScrapeJobView[];
}

export async function fetchJob(jobId: string): Promise<ScrapeJobView> {
  const res = await fetch(`/api/jobs/${jobId}`);
  return (await parseJsonOrThrow(res)) as ScrapeJobView;
}

export async function fetchJobResults(jobId: string): Promise<JobResultsView> {
  const res = await fetch(`/api/jobs/${jobId}/results`);
  return (await parseJsonOrThrow(res)) as JobResultsView;
}

export async function createJob(sourceUrl: string): Promise<{ jobId: string; status: string }> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceUrl }),
  });
  return (await parseJsonOrThrow(res)) as { jobId: string; status: string };
}

export interface JobsListParams {
  page: number;
  limit?: number;
  status?: string;
  search?: string;
}

export async function fetchJobsPage(params: JobsListParams): Promise<Paginated<ScrapeJobView>> {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit ?? 20) });
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  const res = await fetch(`/api/jobs?${query.toString()}`);
  return (await parseJsonOrThrow(res)) as Paginated<ScrapeJobView>;
}

export async function retryJob(jobId: string): Promise<ScrapeJobView> {
  const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
  return (await parseJsonOrThrow(res)) as ScrapeJobView;
}

export async function cancelJob(jobId: string): Promise<ScrapeJobView> {
  const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
  return (await parseJsonOrThrow(res)) as ScrapeJobView;
}
