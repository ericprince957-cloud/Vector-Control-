'use client';

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

const GOLD = '#d4af37';
const GRID = '#262626';
const TEXT = '#9a9a9a';
const SERIES = ['#d4af37', '#7dd3fc', '#34d399', '#fbbf24', '#f87171', '#a1a1aa', '#8a7420', '#4b5563'];

const axis = { stroke: TEXT, fontSize: 11 };
const tooltipStyle = { backgroundColor: '#161616', border: '1px solid #343434', borderRadius: 6, fontSize: 12 };
const tooltipLabel = { color: '#ffffff' };

function naira(v: number) {
  return '₦' + Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}
function nairaFull(v: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);
}

function NoData({ text = 'No data yet' }: { text?: string }) {
  return <p className="flex h-full min-h-40 items-center justify-center text-sm text-muted">{text}</p>;
}

export function MonthlyBars({ data, height = 260 }: { data: { month: string; revenue: number; expenses: number }[]; height?: number }) {
  if (!data.some((d) => d.revenue || d.expenses)) return <NoData text="No revenue or expenses recorded in this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" {...axis} tickLine={false} axisLine={false} />
        <YAxis {...axis} tickLine={false} axisLine={false} tickFormatter={naira} width={56} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => nairaFull(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Revenue received" fill={GOLD} radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#52525b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, dataKey, name, height = 220, color = GOLD }: { data: Record<string, unknown>[]; dataKey: string; name: string; height?: number; color?: string }) {
  if (!data.some((d) => Number(d[dataKey]))) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" {...axis} tickLine={false} axisLine={false} />
        <YAxis {...axis} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240 }: { data: { name: string; value: number }[]; height?: number }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="#0a0a0a">
          {filtered.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} itemStyle={{ color: '#fff' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, height = 240, money = false }: { data: { name: string; value: number }[]; height?: number; money?: boolean }) {
  if (!data.some((d) => d.value)) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axis} tickLine={false} axisLine={false} tickFormatter={money ? naira : undefined} allowDecimals={false} />
        <YAxis type="category" dataKey="name" {...axis} tickLine={false} axisLine={false} width={110} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => (money ? nairaFull(v) : v)} />
        <Bar dataKey="value" name={money ? 'Value' : 'Count'} fill={GOLD} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitLine({ data, height = 240 }: { data: { month: string; profit: number }[]; height?: number }) {
  if (!data.some((d) => d.profit)) return <NoData text="No profitability data in this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" {...axis} tickLine={false} axisLine={false} />
        <YAxis {...axis} tickLine={false} axisLine={false} tickFormatter={naira} width={56} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={(v: number) => nairaFull(v)} />
        <Line type="monotone" dataKey="profit" name="Net result" stroke={GOLD} strokeWidth={2} dot={{ r: 2, fill: GOLD }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
