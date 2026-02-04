/**
 * StatusBarChart - Vertical bar chart of cases by status in pipeline order
 *
 * Renders a polished bar chart that fills its container, with value labels
 * on top of bars, angled status names below, and faint gridlines.
 *
 * All color references use --theme-* CSS variables so dark mode works correctly.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  type LabelProps,
} from 'recharts';
import type { CaseStatus } from '../../types';

/** Pipeline order — same as CASE_STATUSES on the backend */
const STATUS_ORDER: CaseStatus[] = [
  'Signing Up',
  'Prospective',
  'Pre-Filing',
  'Pleadings',
  'Discovery',
  'Expert Discovery',
  'Pre-trial',
  'Trial',
  'Post-Trial',
  'Appeal',
  'Settl. Pend.',
  'Stayed',
  'Closed',
];

interface StatusBarChartProps {
  data: Record<string, number>;
  colors: Record<string, string>;
}

interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartEntry }[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-bg-elevated border border-border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
        <span className="font-semibold text-text">{entry.name}</span>
      </div>
      <div className="text-text-muted pl-4">
        {entry.value} case{entry.value !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/** Angled tick renderer for X-axis status labels */
function AngledTick(props: Record<string, unknown>) {
  const { x, y, payload, visibleTicksCount } = props as {
    x: number;
    y: number;
    payload: { value: string };
    visibleTicksCount: number;
  };
  if (!payload) return null;
  const angle = visibleTicksCount > 8 ? -45 : -35;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={8}
        textAnchor="end"
        transform={`rotate(${angle})`}
        style={{ fontSize: 10, fontWeight: 500, fill: 'var(--theme-text-muted)' }}
      >
        {payload.value}
      </text>
    </g>
  );
}

/** Render value on top of each bar */
function TopLabel(props: LabelProps) {
  const x = Number(props.x) || 0;
  const y = Number(props.y) || 0;
  const width = Number(props.width) || 0;
  const value = props.value;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      style={{ fontSize: 11, fontWeight: 600, fill: 'var(--theme-text-secondary)' }}
    >
      {value}
    </text>
  );
}

export function StatusBarChart({ data, colors }: StatusBarChartProps) {
  const chartData = useMemo(() => {
    return STATUS_ORDER
      .filter((status) => (data[status] ?? 0) > 0)
      .map((status): ChartEntry => ({
        name: status,
        value: data[status] ?? 0,
        color: colors[status] || '#94a3b8',
      }));
  }, [data, colors]);

  const maxValue = useMemo(() => Math.max(...chartData.map((e) => e.value), 1), [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        No cases to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 8, bottom: 64, left: 8 }}
            barCategoryGap="16%"
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--theme-border)"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="name"
              tick={AngledTick}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, Math.ceil(maxValue * 1.15)]} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'var(--theme-bg-hover)', opacity: 0.4, radius: 4 }}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              animationDuration={500}
              animationEasing="ease-out"
              maxBarSize={48}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} fillOpacity={0.85} />
              ))}
              <LabelList dataKey="value" content={TopLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
