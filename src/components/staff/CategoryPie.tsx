"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatYen } from "@/lib/format";

const PALETTE = ["#d9552b", "#2563eb", "#16a34a", "#a855f7", "#eab308", "#0891b2", "#dc2626", "#64748b"];

export function CategoryPie({ data }: { data: { name: string; revenue: number }[] }) {
  const pieData = data.filter((d) => d.revenue > 0).map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

  if (pieData.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">データがありません</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="revenue" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {pieData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatYen(Number(value))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
