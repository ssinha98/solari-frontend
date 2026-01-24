"use client";

import * as React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type AnalyticsHBarItem = {
  /** Label shown on the left (one row per item) */
  label: string;
  /** Value shown as bar length */
  value: number;
};

function CustomToolTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: { label?: string; fill?: string };
  }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-full bg-black text-white px-3 py-1 text-xs flex items-center gap-2 shadow">
      {payload.map((entry) => (
        <div key={entry.payload?.label} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.payload?.fill }}
          />
          <span>{entry.payload?.label ?? entry.name}</span>
          <span className="font-medium">{entry.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

type AnalyticsHBarChartProps = {
  title?: string;
  description?: string;

  /**
   * One row per bar.
   * If you pass 2 items, you’ll get 2 bars stacked vertically (top then below).
   */
  items: AnalyticsHBarItem[];

  /**
   * Optional (used in tooltip label). If omitted, tooltip just shows the value.
   * Example: "Thumbs up %" or "Correct source %"
   */
  valueLabel?: string;

  /**
   * Height/width control:
   * - chartHeightClassName: "h-[200px]" etc.
   * - containerClassName: "w-full md:w-1/2"
   */
  containerClassName?: string;
  chartHeightClassName?: string;

  /** Format numbers in tooltip; defaults to raw value */
  valueFormatter?: (value: number) => string;

  /** If you’re charting percents, set to 100 for consistent scaling */
  maxValue?: number;
};

export function AnalyticsHBarChart({
  title,
  description,
  items,
  valueLabel = "Value",
  containerClassName = "w-full",
  chartHeightClassName = "h-[220px]",
  valueFormatter,
  maxValue,
}: AnalyticsHBarChartProps) {
  const DEFAULT_BAR_COLORS = ["#303AAF", "#2DC2BD"] as const;

  // Convert items -> recharts rows (we keep a stable `fill` per row)
  const data = React.useMemo(
    () =>
      items.map((it, idx) => ({
        label: it.label,
        value: it.value,
        fill: DEFAULT_BAR_COLORS[idx] ?? DEFAULT_BAR_COLORS[0],
      })),
    [items]
  );

  // Minimal chart config (ChartContainer/Tooltip expects one)
  const chartConfig = React.useMemo(() => {
    return {
      value: { label: valueLabel },
    } satisfies ChartConfig;
  }, [valueLabel]);

  const formatter = React.useMemo(() => {
    if (!valueFormatter) return undefined;
    return (value: unknown) => {
      const n = typeof value === "number" ? value : Number(value);
      return valueFormatter(Number.isFinite(n) ? n : 0);
    };
  }, [valueFormatter]);

  return (
    <Card
      className={`bg-black text-white border-white/10 ${containerClassName}`}
    >
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && (
            <CardDescription className="text-white/70">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}

      <CardContent>
        <div className={chartHeightClassName}>
          <ChartContainer config={chartConfig} className="w-full h-full">
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 0 }}
            >
              {/* Left labels (each item becomes a row / a bar) */}
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={90}
              />

              {/* Hidden numeric axis (used for scaling) */}
              <XAxis
                type="number"
                hide
                domain={maxValue != null ? [0, maxValue] : undefined}
              />

              <ChartTooltip cursor={false} content={<CustomToolTip />} />
              {/* Single bar per row; row color controlled via Cell */}
              <Bar dataKey="value" layout="vertical" radius={6}>
                {data.map((row, idx) => (
                  <Cell key={`cell-${idx}`} fill={row.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
