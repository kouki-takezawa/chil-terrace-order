"use client";

import { useState } from "react";

interface ReservationEntry {
  id: string;
  customerName: string;
  phone: string | null;
  partySize: number;
  time: string;
  tableId: string | null;
  note: string | null;
  status: string;
}

interface TableColumn {
  id: string;
  number: number;
  name: string | null;
}

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 40;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const DAY_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
// 予約は終了時刻を持たないため、タイムライン上は固定の高さ（60分相当）で表示する。
const BLOCK_MINUTES = 60;

const STATUS_LABEL: Record<string, string> = {
  confirmed: "予約済み",
  seated: "来店済み",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};
const STATUS_OPTIONS = ["confirmed", "seated", "cancelled", "no_show"];
const UNASSIGNED_COLUMN_ID = "__unassigned__";

function timeToOffset(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

function blockHeight(time: string): number {
  const top = timeToOffset(time);
  const bottom = Math.min(top + (BLOCK_MINUTES / 60) * HOUR_HEIGHT, DAY_HEIGHT);
  return Math.max(bottom - top, 22);
}

function todayKeyJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function nowOffsetJST(): number {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return (jst.getUTCHours() - START_HOUR) * HOUR_HEIGHT + (jst.getUTCMinutes() / 60) * HOUR_HEIGHT;
}

type Modal = { mode: "add"; tableId: string | null } | { mode: "edit"; reservation: ReservationEntry } | null;

export function ReservationDayView({
  date,
  tables,
  useTables,
  reservations: initialReservations,
}: {
  date: string;
  tables: TableColumn[];
  useTables: boolean;
  reservations: ReservationEntry[];
}) {
  const [reservations, setReservations] = useState(initialReservations);
  const [modal, setModal] = useState<Modal>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState("18:00");
  const [tableId, setTableId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isToday = date === todayKeyJST();

  const columns: { id: string; label: string }[] = useTables
    ? [...tables.map((t) => ({ id: t.id, label: t.name ?? `卓${t.number}` })), { id: UNASSIGNED_COLUMN_ID, label: "卓未定" }]
    : [{ id: UNASSIGNED_COLUMN_ID, label: "本日の予約" }];

  function openAdd(columnId: string) {
    setModal({ mode: "add", tableId: columnId === UNASSIGNED_COLUMN_ID ? null : columnId });
    setCustomerName("");
    setPhone("");
    setPartySize(2);
    setTime("18:00");
    setTableId(columnId === UNASSIGNED_COLUMN_ID ? "" : columnId);
    setNote("");
    setError(null);
  }

  function openEdit(r: ReservationEntry) {
    setModal({ mode: "edit", reservation: r });
    setCustomerName(r.customerName);
    setPhone(r.phone ?? "");
    setPartySize(r.partySize);
    setTime(r.time);
    setTableId(r.tableId ?? "");
    setNote(r.note ?? "");
    setError(null);
  }

  async function submit() {
    if (!modal || busy) return;
    if (!customerName.trim()) {
      setError("お名前を入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (modal.mode === "add") {
        const res = await fetch("/api/staff/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName,
            phone: phone || undefined,
            partySize,
            date,
            time,
            tableId: tableId || undefined,
            note: note || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
        setReservations((prev) => [...prev, data.reservation]);
      } else {
        const res = await fetch(`/api/staff/reservations/${modal.reservation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName,
            phone: phone || null,
            partySize,
            time,
            tableId: tableId || null,
            note: note || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
        setReservations((prev) => prev.map((r) => (r.id === modal.reservation.id ? data.reservation : r)));
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: string) {
    if (modal?.mode !== "edit" || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/reservations/${modal.reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setReservations((prev) => prev.map((r) => (r.id === modal.reservation.id ? data.reservation : r)));
        setModal({ mode: "edit", reservation: data.reservation });
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (modal?.mode !== "edit" || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/reservations/${modal.reservation.id}`, { method: "DELETE" });
      if (res.ok) {
        setReservations((prev) => prev.filter((r) => r.id !== modal.reservation.id));
        setModal(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div className="flex" style={{ minWidth: 56 + columns.length * 160 }}>
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-surface">
          <div className="h-14 border-b border-border" />
          {HOURS.map((h) => (
            <div key={h} className="border-t border-border px-1 text-right text-[10px] text-muted" style={{ height: HOUR_HEIGHT }}>
              {h}:00
            </div>
          ))}
        </div>

        {columns.map((column) => {
          const columnReservations = reservations.filter((r) =>
            column.id === UNASSIGNED_COLUMN_ID ? !r.tableId || !useTables : r.tableId === column.id
          );
          return (
            <div key={column.id} className="w-40 shrink-0 border-r border-border last:border-r-0">
              <div className="flex h-14 items-center justify-between border-b border-border px-2">
                <span className="truncate text-xs font-medium text-foreground">{column.label}</span>
                <button
                  onClick={() => openAdd(column.id)}
                  aria-label={`${column.label}に予約を追加`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground"
                >
                  +
                </button>
              </div>
              <div className="relative" style={{ height: DAY_HEIGHT }}>
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border" style={{ top: i * HOUR_HEIGHT, opacity: 0.5 }} />
                ))}
                {isToday && (
                  <div className="absolute inset-x-0 z-10 border-t-[3px] border-warning" style={{ top: nowOffsetJST() }} />
                )}
                {columnReservations.map((r) => {
                  const inactive = r.status === "cancelled" || r.status === "no_show";
                  return (
                    <button
                      key={r.id}
                      onClick={() => openEdit(r)}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left ${
                        inactive
                          ? "border border-border bg-background text-muted line-through"
                          : "bg-accent text-accent-foreground"
                      }`}
                      style={{ top: timeToOffset(r.time), height: blockHeight(r.time) }}
                    >
                      <p className="truncate text-[11px] font-medium">
                        {r.time} {r.customerName}（{r.partySize}名）
                      </p>
                      {r.status === "seated" && <p className="truncate text-[10px] opacity-80">来店済み</p>}
                      {r.note && <p className="truncate text-[10px] opacity-80">{r.note}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-bold text-foreground">{modal.mode === "add" ? "予約を追加" : "予約を編集"}</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                />
                <input
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                />
                <span className="text-xs text-muted">名</span>
              </div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="お名前"
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="電話番号（任意）"
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
              {useTables && (
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">卓未定</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? `卓${t.number}`}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="メモ（アレルギー・記念日など、任意）"
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
              {error && <p className="rounded-lg border border-warning bg-warning-surface px-2 py-1.5 text-xs font-medium text-warning">{error}</p>}
            </div>

            {modal.mode === "edit" && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(status)}
                    disabled={busy}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                      modal.reservation.status === status ? "bg-accent text-accent-foreground" : "border border-border text-muted"
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              {modal.mode === "edit" && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-sm text-warning disabled:opacity-50"
                >
                  削除
                </button>
              )}
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-full border border-border py-2 text-sm font-medium text-foreground"
              >
                キャンセル
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 rounded-full bg-accent py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                {modal.mode === "add" ? "追加する" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
