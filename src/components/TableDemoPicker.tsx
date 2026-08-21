"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TableDemoPicker({ tableNumbers }: { tableNumbers: number[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(tableNumbers[0]);

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
      >
        {tableNumbers.map((n) => (
          <option key={n} value={n}>
            卓{n}
          </option>
        ))}
      </select>
      <button
        onClick={() => router.push(`/order/${selected}`)}
        className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground"
      >
        注文画面を開く
      </button>
    </div>
  );
}
