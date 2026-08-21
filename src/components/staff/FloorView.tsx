"use client";

import { useEffect, useState } from "react";
import { formatTime, formatYen } from "@/lib/format";

interface FloorEntry {
  table: { id: string; number: number; name: string | null };
  status: "empty" | "active" | "just_closed";
  subtotal: number;
  staffNote: string | null;
  helpRequestedAt: string | null;
  lastOrderAt: string | null;
  canUndoCheckout: boolean;
}

interface SessionHistoryEntry {
  id: string;
  startedAt: string;
  closedAt: string | null;
  total: number;
}

const STATUS_LABEL: Record<FloorEntry["status"], string> = {
  empty: "空席",
  active: "進行中",
  just_closed: "会計済み",
};

export function FloorView({ onChanged }: { onChanged: () => void }) {
  const [floor, setFloor] = useState<FloorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, SessionHistoryEntry[]>>({});

  async function refresh() {
    try {
      const res = await fetch("/api/staff/tables/floor", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setFloor(json.floor ?? []);
    } catch {
      // 次のポーリングに任せる
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, []);

  // 更新後にAPIの結果をもう一度全件取得し直すと体感が遅くなるため、結果が
  // 分かっている変更はローカルの状態にその場で反映する。整合性は次のポーリング
  // （8秒ごと）で保たれる。
  async function undoCheckout(tableNumber: number) {
    setBusyId(`undo-${tableNumber}`);
    try {
      const res = await fetch(`/api/staff/tables/${tableNumber}/undo-checkout`, { method: "POST" });
      if (res.ok) {
        setFloor((prev) =>
          prev.map((e) => (e.table.number === tableNumber ? { ...e, status: "active", canUndoCheckout: false } : e))
        );
        onChanged();
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function resolveHelp(tableNumber: number) {
    setBusyId(`help-${tableNumber}`);
    setFloor((prev) => prev.map((e) => (e.table.number === tableNumber ? { ...e, helpRequestedAt: null } : e)));
    try {
      await fetch(`/api/staff/tables/${tableNumber}/resolve-help`, { method: "POST" });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(tableNumber: number, note: string) {
    setBusyId(`note-${tableNumber}`);
    setFloor((prev) => prev.map((e) => (e.table.number === tableNumber ? { ...e, staffNote: note || null } : e)));
    try {
      await fetch(`/api/staff/tables/${tableNumber}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleHistory(tableId: string, tableNumber: number) {
    if (expanded === tableId) {
      setExpanded(null);
      return;
    }
    setExpanded(tableId);
    if (!history[tableId]) {
      try {
        const res = await fetch(`/api/staff/tables/${tableNumber}/sessions`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setHistory((prev) => ({ ...prev, [tableId]: json.sessions ?? [] }));
        }
      } catch {
        // 開いたままにして、再タップで再取得できるようにする
      }
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">読み込み中…</p>;
  }

  if (floor.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        テーブルが登録されていません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {floor.map((entry) => (
        <TableFloorCard
          key={entry.table.id}
          entry={entry}
          busyId={busyId}
          expanded={expanded === entry.table.id}
          history={history[entry.table.id] ?? []}
          onToggleHistory={() => toggleHistory(entry.table.id, entry.table.number)}
          onUndoCheckout={() => undoCheckout(entry.table.number)}
          onResolveHelp={() => resolveHelp(entry.table.number)}
          onSaveNote={(note) => saveNote(entry.table.number, note)}
        />
      ))}
    </div>
  );
}

function TableFloorCard({
  entry,
  busyId,
  expanded,
  history,
  onToggleHistory,
  onUndoCheckout,
  onResolveHelp,
  onSaveNote,
}: {
  entry: FloorEntry;
  busyId: string | null;
  expanded: boolean;
  history: SessionHistoryEntry[];
  onToggleHistory: () => void;
  onUndoCheckout: () => void;
  onResolveHelp: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { table } = entry;
  const [noteDraft, setNoteDraft] = useState(entry.staffNote ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const noteBusy = busyId === `note-${table.number}`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{table.name ?? `卓${table.number}`}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            entry.status === "active"
              ? "bg-accent text-accent-foreground"
              : entry.status === "just_closed"
                ? "border border-warning text-warning"
                : "border border-border text-muted"
          }`}
        >
          {STATUS_LABEL[entry.status]}
        </span>
      </div>

      {entry.status === "active" && (
        <p className="text-sm text-muted">
          小計 <span className="font-bold text-foreground">{formatYen(entry.subtotal)}</span>
        </p>
      )}
      {entry.lastOrderAt && (
        <p className="mt-0.5 text-xs text-muted">最終注文 {formatTime(new Date(entry.lastOrderAt))}</p>
      )}

      {entry.status === "active" &&
        (editingNote ? (
          <div className="mt-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="アレルギー・記念日など、スタッフ向けのメモ"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => {
                  onSaveNote(noteDraft);
                  setEditingNote(false);
                }}
                disabled={noteBusy}
                className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground disabled:opacity-50"
              >
                保存
              </button>
              <button onClick={() => setEditingNote(false)} className="text-xs text-muted underline underline-offset-4">
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="mt-2 w-full rounded-lg bg-background px-2.5 py-1.5 text-left text-xs text-foreground"
          >
            {entry.staffNote || <span className="text-muted">＋ 卓メモを追加</span>}
          </button>
        ))}

      {entry.helpRequestedAt && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-warning bg-warning-surface px-3 py-1.5 text-xs font-medium text-warning">
          <span>スタッフ呼び出し中</span>
          <button
            onClick={onResolveHelp}
            disabled={busyId === `help-${table.number}`}
            className="underline underline-offset-4 disabled:opacity-50"
          >
            対応済みにする
          </button>
        </div>
      )}

      {entry.canUndoCheckout && (
        <button
          onClick={onUndoCheckout}
          disabled={busyId === `undo-${table.number}`}
          className="mt-3 w-full rounded-full border border-warning py-1.5 text-xs font-medium text-warning disabled:opacity-50"
        >
          会計を取り消す
        </button>
      )}

      <button onClick={onToggleHistory} className="mt-3 text-xs text-muted underline underline-offset-4">
        {expanded ? "本日の履歴を閉じる" : "本日の履歴を見る"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2">
          {history.length === 0 && <p className="text-xs text-muted">本日の記録はまだありません</p>}
          {history.map((s) => (
            <div key={s.id} className="flex justify-between text-xs text-muted">
              <span>
                {formatTime(new Date(s.startedAt))}
                {s.closedAt ? ` 〜 ${formatTime(new Date(s.closedAt))}` : "（進行中）"}
              </span>
              <span className="font-medium text-foreground">{formatYen(s.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
