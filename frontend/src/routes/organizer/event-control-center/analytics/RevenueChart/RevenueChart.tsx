import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import type { RevenuePoint, StandRevenueSeries } from '@/api/eventControlCenter';
import { formatMoney } from '@/types/product';
import {
  REVENUE_CHART_HEIGHT,
  REVENUE_CHART_MIN_WIDTH,
  REVENUE_GRANULARITY_OPTIONS,
  addMinutes,
  createAreaPath,
  createRevenueChartModel,
  createSmoothRevenuePath,
  findNearestRevenuePointIndex,
  formatAxisMoney,
  formatChartTime,
  formatGranularityLabel,
  formatIntervalLabel,
  getRevenueTooltipLayout,
  type RevenueChartModel,
  type RevenueGranularityMinutes,
  type RevenueIntervalPoint,
  type StandRevenueBreakdown,
} from './revenueChartModel';

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
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(REVENUE_CHART_MIN_WIDTH);
  const [chartViewportWidth, setChartViewportWidth] = useState(REVENUE_CHART_MIN_WIDTH);
  const [granularityMinutes, setGranularityMinutes] = useState<RevenueGranularityMinutes>(
    REVENUE_GRANULARITY_OPTIONS[0]!.minutes,
  );
  const [tooltipLayout, setTooltipLayout] = useState<CSSProperties | null>(null);
  const model = useMemo(
    () =>
      createRevenueChartModel(
        points,
        standRevenue,
        standNameById,
        eventStartAt,
        granularityMinutes,
        chartWidth,
      ),
    [chartWidth, eventStartAt, granularityMinutes, points, standNameById, standRevenue],
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hasPoints = points.length > 0;
  const activeIndex = hoveredIndex;
  const activeCoordinates = activeIndex === null ? null : model.coordinates[activeIndex];
  const activePoint = activeIndex === null ? null : model.points[activeIndex];
  const linePath = useMemo(
    () => createSmoothRevenuePath(model.lineCoordinates),
    [model.lineCoordinates],
  );
  const areaPath = useMemo(
    () => createAreaPath(linePath, model.lineCoordinates, model.baselineY),
    [linePath, model.baselineY, model.lineCoordinates],
  );

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateChartWidth = () => {
      const nextViewportWidth = Math.round(container.clientWidth);
      setChartViewportWidth(nextViewportWidth);
      setChartWidth(Math.max(REVENUE_CHART_MIN_WIDTH, nextViewportWidth));
    };

    updateChartWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nextViewportWidth = Math.round(entry.contentRect.width);
      setChartViewportWidth(nextViewportWidth);
      setChartWidth(Math.max(REVENUE_CHART_MIN_WIDTH, nextViewportWidth));
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!hasPoints) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * model.chartWidth;
    const nearestIndex = findNearestRevenuePointIndex(model.coordinates, pointerX);
    const coordinates = model.coordinates[nearestIndex];
    setHoveredIndex(nearestIndex);
    setTooltipLayout(
      coordinates
        ? getRevenueTooltipLayout(
            coordinates,
            chartContainerRef.current,
            chartSvgRef.current,
            model.chartWidth,
            chartViewportWidth,
          )
        : null,
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="px-4 pt-4">
        <RevenueGranularityControl
          selectedMinutes={granularityMinutes}
          onSelect={(minutes) => {
            setGranularityMinutes(minutes);
            setHoveredIndex(null);
            setTooltipLayout(null);
          }}
        />
      </div>

      <div className="relative bg-background pt-3" ref={chartContainerRef}>
        <svg
          aria-label={`Event revenue by ${formatGranularityLabel(granularityMinutes)} interval`}
          className="block h-[22rem] w-full touch-none"
          ref={chartSvgRef}
          role="img"
          viewBox={`0 0 ${model.chartWidth} ${REVENUE_CHART_HEIGHT}`}
          onPointerLeave={() => {
            setHoveredIndex(null);
            setTooltipLayout(null);
          }}
          onPointerMove={handlePointerMove}
        >
          <RevenueChartDefinitions />
          <RevenueChartSurface model={model} />
          {hasPoints ? (
            <>
              <path d={areaPath} fill="url(#eventRevenueArea)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
                style={{
                  filter:
                    'drop-shadow(0 10px 18px color-mix(in srgb, var(--color-accent) 22%, transparent))',
                }}
              />
              <path
                d={linePath}
                fill="none"
                opacity="0.22"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {model.coordinates.map((point, index) => (
                <circle
                  className="transition-all duration-150 ease-out"
                  cx={point.x}
                  cy={point.y}
                  fill={index === activeIndex ? 'var(--color-accent)' : 'var(--color-surface)'}
                  key={`${model.points[index]!.intervalStartMinutes}-${model.points[index]!.intervalEndMinutes}`}
                  r={index === activeIndex ? '6' : '4'}
                  stroke="var(--color-accent)"
                  strokeWidth={index === activeIndex ? '2.5' : '2'}
                />
              ))}
              {activeCoordinates ? (
                <g>
                  <line
                    stroke="var(--color-border)"
                    strokeDasharray="4 6"
                    strokeOpacity="0.86"
                    x1={activeCoordinates.x}
                    x2={activeCoordinates.x}
                    y1={model.plot.top}
                    y2={model.baselineY}
                  />
                  <circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    fill="var(--color-accent)"
                    fillOpacity="0.12"
                    r="13"
                  />
                  <circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    fill="var(--color-surface)"
                    r="7"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                  />
                </g>
              ) : null}
            </>
          ) : (
            <RevenueEmptyState model={model} />
          )}
          <RevenueXAxis model={model} />
        </svg>
        {tooltipLayout && activePoint ? (
          <RevenueTooltip point={activePoint} style={tooltipLayout} />
        ) : null}
      </div>

      <div className="border-t border-border bg-surface/70 p-4">
        {hasPoints ? (
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

function RevenueGranularityControl({
  onSelect,
  selectedMinutes,
}: {
  onSelect: (minutes: RevenueGranularityMinutes) => void;
  selectedMinutes: RevenueGranularityMinutes;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold text-text">Time granularity</span>
      <div
        aria-label="Revenue chart time granularity"
        className="inline-grid grid-cols-3 rounded-lg border border-border bg-surface-muted p-1"
        role="group"
      >
        {REVENUE_GRANULARITY_OPTIONS.map((option) => (
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

function RevenueTooltip({ point, style }: { point: RevenueIntervalPoint; style: CSSProperties }) {
  const averageOrderValueCents =
    point.orderCount > 0 ? Math.round(point.revenueCents / point.orderCount) : 0;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10 w-56 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-background p-3 text-sm shadow-lg transition-transform"
      style={style}
    >
      <p className="text-xs font-medium tabular-nums text-text-muted">
        {formatIntervalLabel(point.intervalStartAt, point.intervalEndAt)}
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">Revenue</span>
          <span className="font-semibold tabular-nums text-text">
            EUR {formatMoney(point.revenueCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">Orders</span>
          <span className="font-semibold tabular-nums text-text">{point.orderCount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">AOV</span>
          <span className="font-semibold tabular-nums text-text">
            EUR {formatMoney(averageOrderValueCents)}
          </span>
        </div>
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

function RevenueChartDefinitions() {
  return (
    <defs>
      <linearGradient id="eventRevenueArea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
  );
}

function RevenueChartSurface({ model }: { model: RevenueChartModel }) {
  return (
    <>
      {model.yTicks.map((tick) => {
        const y = model.yForRevenue(tick);

        return (
          <g key={tick}>
            <text
              fill="var(--color-text-muted)"
              fontSize="8"
              fontWeight="600"
              textAnchor="end"
              x={model.plot.left - 10}
              y={y + 3}
            >
              {formatAxisMoney(tick)}
            </text>
            <line
              stroke="var(--color-border)"
              strokeDasharray={tick === 0 ? '0' : '4 7'}
              strokeOpacity={tick === 0 ? '0.9' : '0.62'}
              strokeWidth={tick === 0 ? '1.5' : '1'}
              x1={model.plot.left}
              x2={model.plot.left + model.plot.width}
              y1={y}
              y2={y}
            />
          </g>
        );
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((position) => {
        const x = model.plot.left + position * model.plot.width;

        return (
          <line
            key={position}
            stroke="var(--color-border)"
            strokeOpacity="0.28"
            x1={x}
            x2={x}
            y1={model.plot.top}
            y2={model.baselineY}
          />
        );
      })}
    </>
  );
}

function RevenueXAxis({ model }: { model: RevenueChartModel }) {
  return (
    <>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        x={model.plot.left}
        y={model.baselineY + 38}
      >
        {formatChartTime(model.eventStartAt)}
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        textAnchor="middle"
        x={model.plot.left + model.plot.width / 2}
        y={model.baselineY + 38}
      >
        {formatChartTime(addMinutes(model.eventStartAt, model.maxMinutes / 2))}
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        textAnchor="end"
        x={model.plot.left + model.plot.width}
        y={model.baselineY + 38}
      >
        {formatChartTime(addMinutes(model.eventStartAt, model.maxMinutes))}
      </text>
    </>
  );
}

function RevenueEmptyState({ model }: { model: RevenueChartModel }) {
  return (
    <g>
      <path
        d={`M ${model.plot.left} ${model.baselineY} C ${
          model.plot.left + model.plot.width * 0.25
        } ${model.baselineY - 6}, ${model.plot.left + model.plot.width * 0.55} ${
          model.baselineY - 6
        }, ${model.plot.left + model.plot.width} ${model.baselineY}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeDasharray="5 7"
        strokeLinecap="round"
        strokeOpacity="0.38"
        strokeWidth="2.5"
      />
      <circle
        cx={model.plot.left + model.plot.width / 2}
        cy={model.baselineY - 5}
        fill="var(--color-surface)"
        r="5"
        stroke="var(--color-accent)"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <text
        fill="var(--color-text)"
        fontSize="16"
        fontWeight="800"
        textAnchor="middle"
        x={model.chartWidth / 2}
        y="132"
      >
        Awaiting first paid order
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="12"
        fontWeight="500"
        textAnchor="middle"
        x={model.chartWidth / 2}
        y="154"
      >
        Revenue will draw in from left to right
      </text>
    </g>
  );
}
