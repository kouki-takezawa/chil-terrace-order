"use client";

import { useState } from "react";
import { PhoneFrame, TabletFrame } from "./DeviceFrame";

export function DemoView({ tableNumbers, operationMode }: { tableNumbers: number[]; operationMode: "table" | "number" }) {
  const [selectedTable, setSelectedTable] = useState(tableNumbers[0] ?? 1);
  const [phoneKey, setPhoneKey] = useState(0);

  function changeTable(n: number) {
    setSelectedTable(n);
    setPhoneKey((k) => k + 1); // iframeを確実に作り直して新しい卓のページを読み込む
  }

  return (
    <div className="flex flex-col items-center gap-10 px-6 py-10 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex flex-col items-center gap-4">
        {operationMode === "table" && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted">卓番号を選んで読み取りをシミュレート：</label>
            <select
              value={selectedTable}
              onChange={(e) => changeTable(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            >
              {tableNumbers.map((n) => (
                <option key={n} value={n}>
                  卓{n}
                </option>
              ))}
            </select>
          </div>
        )}
        <PhoneFrame key={phoneKey} src={operationMode === "table" ? `/order/${selectedTable}` : "/order"} label="客のスマホ画面" />
      </div>

      <TabletFrame src="/staff/login" label="店舗スタッフ用タブレット画面" />
    </div>
  );
}
