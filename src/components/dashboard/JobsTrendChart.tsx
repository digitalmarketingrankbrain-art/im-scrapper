"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { JobsTrendPoint } from "@/types/dashboard";

const ACCENT = "#0d9488";

function formatDateLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-slate-500 dark:text-slate-400">{formatDateLabel(label)}</p>
      <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-50">{payload[0].value} jobs</p>
    </div>
  );
}

export function JobsTrendChart({ data }: { data: JobsTrendPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11 }}
            className="fill-slate-400 dark:fill-slate-500"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            className="fill-slate-400 dark:fill-slate-500"
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={ChartTooltip} />
          <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
