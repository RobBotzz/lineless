import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { ComposeOption, ECharts } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

import type { RevenuePoint, StandRevenueSeries } from '@/api/eventControlCenter';
import { formatMoney } from '@/types/product';
import {
  REVENUE_TIME_RANGE_OPTIONS,
  createRevenueChartModel,
  formatAxisMoney,
  formatChartTime,
  formatIntervalLabel,
  formatTimeRangeLabel,
  type RevenueChartModel,
  type RevenueTimeRangeMinutes,
  type StandRevenueBreakdown,
} from './revenueChartModel';

echarts.use([GridComponent, LineChart, SVGRenderer, TooltipComponent]);

type RevenueChartOption = ComposeOption<
  GridComponentOption | LineSeriesOption | TooltipComponentOption
>;

type TooltipParam = {
  dataIndex?: number;
  seriesName?: string;
  value?: number | string | Array<number | string | null>;
};

export function RevenueChart({
  eventStartAt,
  points,
  standNameById,
  standRevenue,
}: {
  eventStartAt: string;
  points: RevenuePoint[];
  standNameById: Map<string, string>;
  standRevenue: StandRevenueSeries[];
}) {
  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);
  const [timeRangeMinutes, setTimeRangeMinutes] = useState<RevenueTimeRangeMinutes>(
    REVENUE_TIME_RANGE_OPTIONS[0]!.minutes,
  );
  const model = useMemo(
    () =>
      createRevenueChartModel(points, standRevenue, standNameById, eventStartAt, timeRangeMinutes),
    [eventStartAt, points, standNameById, standRevenue, timeRangeMinutes],
  );
  const chartOption = useMemo(() => createRevenueChartOption(model), [model]);
  const hasRevenue = model.totalBreakdown.some((entry) => entry.revenueCents > 0);

  useEffect(() => {
    const element = chartElementRef.current;
    if (!element) return;

    const chart = echarts.init(element, undefined, { renderer: 'svg' });
    chartInstanceRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartInstanceRef.current?.setOption(chartOption, { notMerge: true });
  }, [chartOption]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="px-4 pt-4">
        <RevenueTimeRangeControl
          selectedMinutes={timeRangeMinutes}
          onSelect={setTimeRangeMinutes}
        />
      </div>

      <div className="relative bg-background pt-3">
        <div
          aria-label={`Event revenue for the ${formatTimeRangeLabel(timeRangeMinutes)}`}
          className="h-[22rem] w-full"
          ref={chartElementRef}
          role="img"
        />
        {!hasRevenue ? <RevenueEmptyState /> : null}
      </div>

      <div className="border-t border-border bg-surface/70 p-4">
        {hasRevenue ? (
          <RevenueStandMix breakdown={model.totalBreakdown} />
        ) : (
          <p className="text-sm text-text-muted">
            Stand contribution will appear as soon as paid orders arrive.
          </p>
        )}
      </div>
    </div>
  );
}

function createRevenueChartOption(model: RevenueChartModel): RevenueChartOption {
  return {
    animationDuration: 650,
    color: model.standSeries.map((series) => series.color),
    grid: {
      bottom: 42,
      containLabel: true,
      left: 18,
      right: 28,
      top: 24,
    },
    tooltip: {
      appendToBody: true,
      backgroundColor: 'var(--color-surface)',
      borderColor: 'var(--color-border)',
      borderRadius: 6,
      borderWidth: 1,
      className: 'revenue-chart-tooltip',
      confine: true,
      extraCssText: 'box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);',
      formatter: (params: unknown) => formatRevenueTooltip(params, model),
      padding: 0,
      trigger: 'axis',
      triggerOn: 'mousemove|click|mousewheel',
    },
    xAxis: {
      axisLabel: {
        color: 'var(--color-text-muted)',
        fontSize: 11,
        fontWeight: 600,
        hideOverlap: true,
        margin: 14,
      },
      axisLine: {
        lineStyle: {
          color: 'var(--color-border)',
        },
      },
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: model.points.map((point) => formatChartTime(point.intervalStartAt)),
      splitLine: {
        lineStyle: {
          color: 'var(--color-border)',
          opacity: 0.28,
        },
        show: true,
      },
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        color: 'var(--color-text-muted)',
        fontSize: 11,
        fontWeight: 600,
        formatter: (value: number) => formatAxisMoney(value),
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      minInterval: 100,
      splitLine: {
        lineStyle: {
          color: 'var(--color-border)',
          opacity: 0.62,
          type: 'dashed',
        },
      },
      type: 'value',
    },
    series: model.standSeries.map((series) => ({
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { color: hexToRgba(series.color, 0.72), offset: 0 },
          { color: hexToRgba(series.color, 0.14), offset: 1 },
        ]),
      },
      data: series.data,
      emphasis: {
        focus: 'series',
      },
      lineStyle: {
        color: series.color,
        width: 2,
      },
      name: series.standName,
      showSymbol: false,
      smooth: 0.34,
      stack: 'revenue',
      symbol: 'circle',
      symbolSize: 7,
      type: 'line',
    })),
  };
}

function RevenueTimeRangeControl({
  onSelect,
  selectedMinutes,
}: {
  onSelect: (minutes: RevenueTimeRangeMinutes) => void;
  selectedMinutes: RevenueTimeRangeMinutes;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold text-text">Time range</span>
      <div
        aria-label="Revenue chart time range"
        className="inline-grid grid-cols-5 rounded-lg border border-border bg-surface-muted p-1"
        role="group"
      >
        {REVENUE_TIME_RANGE_OPTIONS.map((option) => (
          <button
            aria-pressed={selectedMinutes === option.minutes}
            className={`min-w-16 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              selectedMinutes === option.minutes
                ? 'bg-background text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
            key={option.minutes}
            type="button"
            onClick={() => onSelect(option.minutes)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RevenueStandMix({ breakdown }: { breakdown: StandRevenueBreakdown[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">Booth mix across full event</p>
        <p className="text-xs font-medium text-text-muted">Share of total paid revenue</p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
        {breakdown.map((entry) => (
          <div
            className="h-full"
            key={entry.standId}
            style={{
              backgroundColor: entry.color,
              width: `${Math.min(100, entry.share)}%`,
            }}
          />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {breakdown.map((entry) => (
          <div
            className="rounded-md border border-border bg-background px-3 py-2"
            key={entry.standId}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-text">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate">{entry.standName}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-text-muted">
                {Math.round(entry.share)}%
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-text">
              EUR {formatMoney(entry.revenueCents)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex h-[22rem] items-center justify-center">
      <div className="text-center">
        <svg aria-hidden="true" className="mx-auto mb-4 h-16 w-48" viewBox="0 0 192 64">
          <path
            d="M 8 48 C 42 42, 68 21, 101 30 C 134 39, 150 18, 184 12"
            fill="none"
            stroke="var(--color-accent)"
            strokeDasharray="5 7"
            strokeLinecap="round"
            strokeOpacity="0.38"
            strokeWidth="3"
          />
          <circle
            cx="101"
            cy="30"
            fill="var(--color-surface)"
            r="5"
            stroke="var(--color-accent)"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
        </svg>
        <p className="text-base font-extrabold text-text">Awaiting first paid order</p>
        <p className="mt-1 text-sm font-medium text-text-muted">
          Revenue will draw in from left to right
        </p>
      </div>
    </div>
  );
}

function formatRevenueTooltip(params: unknown, model: RevenueChartModel): string {
  const tooltipParams = normalizeTooltipParams(params);
  const dataIndex = tooltipParams.find((param) => typeof param.dataIndex === 'number')?.dataIndex;
  if (typeof dataIndex !== 'number') return '';

  const point = model.points[dataIndex];
  if (!point) return '';

  const averageOrderValueCents =
    point.orderCount > 0 ? Math.round(point.revenueCents / point.orderCount) : 0;
  const entries = model.standSeries
    .map((series) => ({
      color: series.color,
      revenueCents: series.data[dataIndex] ?? 0,
      standName: series.standName,
    }))
    .filter((entry) => entry.revenueCents > 0)
    .sort((left, right) => right.revenueCents - left.revenueCents);
  const standRows =
    entries.length > 0
      ? entries
          .map(
            (entry) => `
              <div class="mt-1.5 flex justify-between gap-4">
                <span class="flex min-w-0 items-center gap-2 text-text-muted">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${entry.color}"></span>
                  <span class="truncate">${escapeHtml(entry.standName)}</span>
                </span>
                <span class="shrink-0 font-semibold tabular-nums text-text">EUR ${formatMoney(entry.revenueCents)}</span>
              </div>
            `,
          )
          .join('')
      : '<p class="mt-2 text-text-muted">No stand revenue in this interval</p>';

  return `
    <div class="w-64 rounded-md bg-background p-3 text-sm text-text">
      <p class="text-xs font-medium tabular-nums text-text-muted">${formatIntervalLabel(
        point.intervalStartAt,
        point.intervalEndAt,
      )}</p>
      <div class="mt-2 space-y-1.5">
        <div class="flex justify-between gap-3">
          <span class="text-text-muted">Revenue</span>
          <span class="font-semibold tabular-nums text-text">EUR ${formatMoney(point.revenueCents)}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-text-muted">Orders</span>
          <span class="font-semibold tabular-nums text-text">${point.orderCount}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-text-muted">AOV</span>
          <span class="font-semibold tabular-nums text-text">EUR ${formatMoney(averageOrderValueCents)}</span>
        </div>
      </div>
      <div class="mt-3 border-t border-border pt-2">${standRows}</div>
    </div>
  `;
}

function normalizeTooltipParams(params: unknown): TooltipParam[] {
  const rawParams = Array.isArray(params) ? params : [params];

  return rawParams.filter((param): param is TooltipParam => {
    return typeof param === 'object' && param !== null;
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const normalizedHex = hex.replace('#', '');
  const parsed = Number.parseInt(normalizedHex, 16);
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}
