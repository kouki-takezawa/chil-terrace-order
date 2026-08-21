"use client";

import { useState } from "react";

interface ShiftEntry {
  id: string;
  memberId: string;
  memberName: string;
  note: string | null;
}

interface DayData {
  date: string;
  inMonth: boolean;
  shifts: ShiftEntry[];
}

interface Member {
  id: string;
  name: string;
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function ShiftCalendar({ days, members }: { days: DayData[]; members: Member[] }) {
  const [dayShifts, setDayShifts] = useState<Record<string, ShiftEntry[]>>(() => {
    const map: Record<string, ShiftEntry[]> = {};
    for (const d of days) map[d.date] = d.shifts;
    return map;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function openDay(date: string) {
    setSelectedDate(date);
    setMemberId(members[0]?.id ?? "");
    setNote("");
  }

  async function addShift() {
    if (!selectedDate || !memberId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/staff/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date: selectedDate, note: note || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        const member = members.find((m) => m.id === memberId);
        setDayShifts((prev) => {
          const existing = (prev[selectedDate] ?? []).filter((s) => s.memberId !== memberId);
          return {
            ...prev,
            [selectedDate]: [...existing, { id: data.shift.id, memberId, memberName: member?.name ?? "", note: note || null }],
          };
        });
        setNote("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeShift(date: string, id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/shifts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDayShifts((prev) => ({ ...prev, [date]: (prev[date] ?? []).filter((s) => s.id !== id) }));
      }
    } finally {
      setBusy(false);
    }
  }

  const selectedShifts = selectedDate ? (dayShifts[selectedDate] ?? []) : [];

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-xs text-muted sm:gap-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const shifts = dayShifts[day.date] ?? [];
          const dayNumber = Number(day.date.split("-")[2]);
          return (
            <button
              key={day.date}
              onClick={() => openDay(day.date)}
              className={`min-h-20 rounded-xl border border-border p-1.5 text-left sm:min-h-24 sm:p-2 ${
                day.inMonth ? "bg-surface" : "bg-background opacity-40"
              }`}
            >
              <p className="text-xs text-muted">{dayNumber}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {shifts.slice(0, 3).map((s) => (
                  <span key={s.id} className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-foreground">
                    {s.memberName}
                  </span>
                ))}
                {shifts.length > 3 && <span className="text-[10px] text-muted">+{shifts.length - 3}</span>}
              </div>
              {shifts.length > 0 && <p className="mt-1 text-[10px] text-muted">{shifts.length}人出勤</p>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{selectedDate} の勤務予定</h2>
              <button onClick={() => setSelectedDate(null)} className="text-sm text-muted">
                閉じる
              </button>
            </div>

            <div className="mb-4 space-y-2">
              {selectedShifts.length === 0 && <p className="text-sm text-muted">まだ登録がありません</p>}
              {selectedShifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">
                    {s.memberName}
                    {s.note ? `（${s.note}）` : ""}
                  </span>
                  <button
                    onClick={() => removeShift(selectedDate, s.id)}
                    disabled={busy}
                    className="text-xs text-red-600 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-muted">設定＞シフトメンバーからメンバーを追加してください</p>
            ) : (
              <div className="space-y-2 border-t border-border pt-3">
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="時間帯など（任意、例: 11:00-15:00）"
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
                <button
                  onClick={addShift}
                  disabled={busy}
                  className="w-full rounded-full bg-accent py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
                >
                  追加する
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
