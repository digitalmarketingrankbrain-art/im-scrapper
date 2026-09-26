import type { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
