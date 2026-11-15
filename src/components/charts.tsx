'use client';

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';

const GOLD = '#D4AF37';
const GRID = '#292929';
const TEXT = '#A0A0A0';

const axis = { stroke: TEXT, fontSize: 11 };
const tooltipStyle = { backgroundColor: '#181818', border: '1px solid #292929', borderRadius: 8, fontSize: 12 };

function naira(v: number) {
  return '₦' + Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function MonthlyBars({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" {...axis} tickLine={false} />
        <YAxis {...axis} tickLine={false} tickFormatter={naira} width={70} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => naira(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Revenue" fill={GOLD} radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#4a4a4a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, dataKey, name, color = GOLD }: { data: Record<string, unknown>[]; dataKey: string; name: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" {...axis} tickLine={false} />
        <YAxis {...axis} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ['#D4AF37', '#E5C76B', '#8a7420', '#5a4c17', '#B09030', '#3f3f3f', '#6b6b6b', '#2f2f2f'];

export function PipelinePie({ data }: { data: { name: string; value: number }[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <p className="py-16 text-center text-sm text-muted">No deals yet</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {filtered.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#090909" />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
