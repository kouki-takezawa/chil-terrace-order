"use client";

import { useEffect, useState } from "react";

interface ShiftEntry {
  id: string;
  memberId: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

interface Member {
  id: string;
  name: string;
}

const START_HOUR = 8;
const END_HOUR = 24;
const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

function timeToOffset(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

function durationHeight(start: string, end: string): number {
  return Math.max(timeToOffset(end) - timeToOffset(start), 22);
}

function todayKeyJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function nowOffsetJST(): number {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours();
  const m = jst.getUTCMinutes();
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

type Modal = { mode: "add"; memberId: string } | { mode: "edit"; shift: ShiftEntry } | null;

export function ShiftDayView({ date, members, shifts: initialShifts }: { date: string; members: Member[]; shifts: ShiftEntry[] }) {
  const [shifts, setShifts] = useState(initialShifts);
  const [modal, setModal] = useState<Modal>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isToday, setIsToday] = useState(false);

  useEffect(() => {
    // hydrationミスマッチを避けるため、「今日か」の判定はマウント後にクライアント時刻で行う
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsToday(date === todayKeyJST());
  }, [date]);

  function openAdd(memberId: string) {
    setModal({ mode: "add", memberId });
    setStartTime("09:00");
    setEndTime("17:00");
    setNote("");
    setError(null);
  }

  function openEdit(shift: ShiftEntry) {
    setModal({ mode: "edit", shift });
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setNote(shift.note ?? "");
    setError(null);
  }

  async function submit() {
    if (!modal || busy) return;
    if (endTime <= startTime) {
      setError("終了時刻は開始時刻より後にしてください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (modal.mode === "add") {
        const res = await fetch("/api/staff/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: modal.memberId, date, startTime, endTime, note: note || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "登録に失敗しました");
        setShifts((prev) => [
          ...prev,
          { id: data.shift.id, memberId: modal.memberId, startTime, endTime, note: note || null },
        ]);
      } else {
        const res = await fetch(`/api/staff/shifts/${modal.shift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime, endTime, note: note || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
        setShifts((prev) => prev.map((s) => (s.id === modal.shift.id ? { ...s, startTime, endTime, note: note || null } : s)));
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!modal || modal.mode !== "edit" || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/shifts/${modal.shift.id}`, { method: "DELETE" });
      if (res.ok) {
        setShifts((prev) => prev.filter((s) => s.id !== modal.shift.id));
        setModal(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (members.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div className="flex" style={{ minWidth: 56 + members.length * 160 }}>
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-surface">
          <div className="h-12 border-b border-border" />
          {HOURS.map((h) => (
            <div key={h} className="border-t border-border px-1 text-right text-[10px] text-muted" style={{ height: HOUR_HEIGHT }}>
              {h}:00
            </div>
          ))}
        </div>

        {members.map((member) => {
          const memberShifts = shifts.filter((s) => s.memberId === member.id);
          return (
            <div key={member.id} className="w-40 shrink-0 border-r border-border last:border-r-0">
              <div className="flex h-12 items-center justify-between border-b border-border px-2">
                <span className="truncate text-xs font-medium text-foreground">{member.name}</span>
                <button
                  onClick={() => openAdd(member.id)}
                  aria-label={`${member.name}の勤務を追加`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground print:hidden"
                >
                  +
                </button>
              </div>
              <div className="relative" style={{ height: HOUR_HEIGHT * (HOURS.length - 1) }}>
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border" style={{ top: i * HOUR_HEIGHT, opacity: 0.5 }} />
                ))}
                {isToday && (
                  <div className="absolute inset-x-0 z-10 border-t-[3px] border-warning" style={{ top: nowOffsetJST() }} />
                )}
                {memberShifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openEdit(s)}
                    className="absolute inset-x-1 overflow-hidden rounded-lg bg-accent px-2 py-1 text-left text-accent-foreground"
                    style={{ top: timeToOffset(s.startTime), height: durationHeight(s.startTime, s.endTime) }}
                  >
                    <p className="truncate text-[11px] font-medium">
                      {s.startTime}–{s.endTime}
                    </p>
                    {s.note && <p className="truncate text-[10px] opacity-80">{s.note}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {modal.mode === "add" ? `${members.find((m) => m.id === modal.memberId)?.name} の勤務を追加` : "勤務予定を編集"}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                />
                <span className="text-muted">〜</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                />
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="メモ（任意）"
                className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
              {error && <p className="rounded-lg border border-warning bg-warning-surface px-2 py-1.5 text-xs font-medium text-warning">{error}</p>}
            </div>
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
