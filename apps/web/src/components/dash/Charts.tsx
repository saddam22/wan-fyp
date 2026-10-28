"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { groupDigits } from "@edukhata/contracts";

/** Palette validated with the dataviz validator (light surface): #2563EB, #D97706. */
const SERIES = ["var(--color-chart-1)", "var(--color-chart-2)"];

/**
 * Grouped bar chart, one shared axis (both series are BDT). Hover/focus shows a tooltip;
 * a table view gives non-visual access to the same numbers.
 */
export function BarChart({
  data,
  series,
  height = 220,
  unit = "৳",
}: {
  data: { label: string; values: number[] }[];
  series: string[];
  height?: number;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(...data.flatMap((d) => d.values)) * 1.1 || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max * f) / 1000) * 1000);
  const fmt = (v: number) =>
    `${unit}${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : groupDigits(v)}`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-3 text-xs text-muted">
          {series.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
              {s}
            </li>
          ))}
        </ul>
        <button
          onClick={() => setTable((x) => !x)}
          className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
          aria-pressed={table}
        >
          <Table2 size={14} /> {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 text-left">Month</th>
              {series.map((s) => (
                <th key={s} className="py-1 text-right">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5">{d.label}</td>
                {d.values.map((v, i) => (
                  <td key={i} className="py-1.5 text-right tabular-nums">
                    {unit}
                    {groupDigits(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" style={{ height }}>
          <div className="absolute inset-0 bottom-6 left-12">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute right-0 left-0 border-t border-slate-100"
                style={{ bottom: `${(t / max) * 100}%` }}
              >
                <span className="absolute -top-2 -left-12 w-10 text-right text-[10px] text-muted tabular-nums">
                  {fmt(t)}
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-2">
              {data.map((d, i) => (
                <div
                  key={d.label}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${d.values.map((v, j) => `${series[j]} ${fmt(v)}`).join(", ")}`}
                  className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md outline-none hover:bg-slate-50 focus:bg-slate-50"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {d.values.map((v, j) => (
                    <div
                      key={j}
                      className="w-full max-w-5 rounded-t-[4px]"
                      style={{ height: `${(v / max) * 100}%`, background: SERIES[j] }}
                    />
                  ))}
                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-lg">
                      <p className="font-semibold text-ink">{d.label}</p>
                      {d.values.map((v, j) => (
                        <p key={j} className="flex items-center gap-1.5 text-muted">
                          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[j] }} />
                          {series[j]}:{" "}
                          <span className="font-semibold text-ink tabular-nums">
                            {unit}
                            {groupDigits(v)}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute right-0 bottom-0 left-12 flex gap-2">
            {data.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[11px] text-muted">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Single-series horizontal bars (magnitude by category), direct-labelled. */
export function HBars({
  data,
  color = "var(--color-chart-1)",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[96px_1fr_40px] items-center gap-2 text-xs"
          title={`${d.label}: ${d.value}`}
        >
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-2.5 rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </span>
          <span className="text-right font-semibold text-ink tabular-nums">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}
