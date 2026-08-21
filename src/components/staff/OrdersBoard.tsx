"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTime, formatYen, ORDER_STATUS_LABEL } from "@/lib/format";
import { FloorView } from "./FloorView";

const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

interface OrderItemDTO {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderDTO {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  dailyNumber: number | null;
  items: OrderItemDTO[];
  total: number;
}

interface TableGroupDTO {
  table: { id: string; number: number; name: string | null; helpRequestedAt: string | null };
  orders: OrderDTO[];
}

type BoardData = { mode: "table"; tables: TableGroupDTO[] } | { mode: "number"; orders: OrderDTO[] };

const STATUS_STEPS: { value: string; tableLabel: string; numberLabel: string }[] = [
  { value: "pending", tableLabel: "受付", numberLabel: "受付" },
  { value: "preparing", tableLabel: "調理中", numberLabel: "調理中" },
  { value: "served", tableLabel: "提供済み", numberLabel: "受渡済み" },
];

export function OrdersBoard({ initialData }: { initialData: BoardData }) {
  const [data, setData] = useState<BoardData>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<TableGroupDTO | null>(null);
  const [view, setView] = useState<"active" | "floor">("active");

  async function refresh() {
    try {
      const res = await fetch("/api/staff/orders", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      // 会計モーダルを開いたまま裏で内容が変わったら、表示中の内容も同期する
      setCheckoutTarget((prev) => {
        if (!prev || json.mode !== "table") return null;
        return json.tables.find((g: TableGroupDTO) => g.table.id === prev.table.id) ?? null;
      });
    } catch {
      // 次のポーリングに任せる
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(orderId: string, status: string, cancelReason?: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancelReason }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCheckout() {
    if (!checkoutTarget) return;
    const tableNumber = checkoutTarget.table.number;
    setBusyId(`checkout-${tableNumber}`);
    try {
      await fetch(`/api/staff/tables/${tableNumber}/checkout`, { method: "POST" });
      await refresh();
    } finally {
      setBusyId(null);
      setCheckoutTarget(null);
    }
  }

  async function resolveHelp(tableNumber: number) {
    setBusyId(`help-${tableNumber}`);
    try {
      await fetch(`/api/staff/tables/${tableNumber}/resolve-help`, { method: "POST" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (data.mode === "table") {
    return (
      <div>
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setView("active")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "active" ? "bg-accent text-accent-foreground" : "border border-border text-muted"
            }`}
          >
            進行中の注文
          </button>
          <button
            onClick={() => setView("floor")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "floor" ? "bg-accent text-accent-foreground" : "border border-border text-muted"
            }`}
          >
            卓の状況
          </button>
        </div>

        {view === "floor" ? (
          <FloorView onChanged={refresh} />
        ) : (
          <ActiveOrdersView
            data={data}
            busyId={busyId}
            updateStatus={updateStatus}
            setCheckoutTarget={setCheckoutTarget}
            resolveHelp={resolveHelp}
          />
        )}

        {checkoutTarget && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setCheckoutTarget(null)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-base font-bold text-foreground">
                {checkoutTarget.table.name ?? `卓${checkoutTarget.table.number}`} の会計
              </h2>
              <p className="mb-4 text-xs text-muted">内容を確認してから確定してください</p>

              <div className="max-h-64 space-y-3 overflow-y-auto">
                {checkoutTarget.orders.map((order) => (
                  <ul key={order.id} className="space-y-0.5 text-sm text-foreground">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>{formatYen(item.price * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                ))}
                {checkoutTarget.orders.length === 0 && <p className="text-sm text-muted">注文がありません</p>}
              </div>

              <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                <span>合計</span>
                <span>{formatYen(checkoutTarget.orders.reduce((s, o) => s + o.total, 0))}</span>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setCheckoutTarget(null)}
                  className="flex-1 rounded-full border border-border py-2.5 text-sm font-medium text-foreground"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmCheckout}
                  disabled={busyId === `checkout-${checkoutTarget.table.number}`}
                  className="flex-1 rounded-full bg-accent py-2.5 text-sm font-bold text-accent-foreground disabled:opacity-50"
                >
                  会計を確定する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (data.mode === "number") {
    if (data.orders.length === 0) {
      return (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
          現在、進行中の注文はありません
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.orders.map((order) => (
          <OrderCard key={order.id} order={order} busyId={busyId} onUpdateStatus={updateStatus} mode="number" showNumber />
        ))}
      </div>
    );
  }

  return null;
}

function ActiveOrdersView({
  data,
  busyId,
  updateStatus,
  setCheckoutTarget,
  resolveHelp,
}: {
  data: { mode: "table"; tables: TableGroupDTO[] };
  busyId: string | null;
  updateStatus: (orderId: string, status: string, cancelReason?: string) => void;
  setCheckoutTarget: (group: TableGroupDTO) => void;
  resolveHelp: (tableNumber: number) => void;
}) {
  // pollingで6秒ごとにdataが更新されるため、そのタイミングに合わせて
  // 「現在時刻」も再計算する（render中に直接Date.now()を呼ぶと純粋性ルールに
  // 反するため、dataの変化に紐づけたuseMemoで計算する）。
  const now = useMemo(() => Date.now(), [data]);

  if (data.tables.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        現在、進行中の注文はありません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.tables.map((group) => {
        const { table, orders } = group;
        const tableTotal = orders.reduce((s, o) => s + o.total, 0);
        const latestOrderAt = orders.reduce((max, o) => Math.max(max, new Date(o.createdAt).getTime()), 0);
        const isIdle = latestOrderAt > 0 && now - latestOrderAt > IDLE_THRESHOLD_MS;
        return (
          <div
            key={table.id}
            className={`rounded-2xl border bg-surface p-4 ${isIdle ? "border-warning" : "border-border"}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-foreground">{table.name ?? `卓${table.number}`}</h2>
              <button
                onClick={() => setCheckoutTarget(group)}
                disabled={busyId === `checkout-${table.number}`}
                className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
              >
                会計
              </button>
            </div>

            {table.helpRequestedAt && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-warning bg-warning-surface px-3 py-1.5 text-xs font-medium text-warning">
                <span>スタッフ呼び出し中</span>
                <button
                  onClick={() => resolveHelp(table.number)}
                  disabled={busyId === `help-${table.number}`}
                  className="underline underline-offset-4 disabled:opacity-50"
                >
                  対応済みにする
                </button>
              </div>
            )}
            {isIdle && (
              <p className="mb-3 text-xs font-medium text-warning">30分以上ご注文がありません</p>
            )}

            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} busyId={busyId} onUpdateStatus={updateStatus} mode="table" />
              ))}
            </div>

            <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted">小計</span>
              <span className="font-bold text-foreground">{formatYen(tableTotal)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: "customer", label: "お客様都合" },
  { value: "kitchen", label: "厨房都合" },
  { value: "out_of_stock", label: "欠品" },
];

function OrderCard({
  order,
  busyId,
  onUpdateStatus,
  showNumber,
  mode,
}: {
  order: OrderDTO;
  busyId: string | null;
  onUpdateStatus: (orderId: string, status: string, cancelReason?: string) => void;
  showNumber?: boolean;
  mode: "table" | "number";
}) {
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const isFinal = order.status === "cancelled" || order.status === "paid";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>{showNumber ? `#${order.dailyNumber}` : formatTime(new Date(order.createdAt))}</span>
        {isFinal && (
          <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
        )}
      </div>
      <ul className="mb-2 space-y-0.5 text-sm text-foreground">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatYen(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {!isFinal && !showCancelPicker && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_STEPS.map((step) => (
            <button
              key={step.value}
              onClick={() => onUpdateStatus(order.id, step.value)}
              disabled={busyId === order.id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                order.status === step.value
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted"
              }`}
            >
              {mode === "number" ? step.numberLabel : step.tableLabel}
            </button>
          ))}
          <button
            onClick={() => setShowCancelPicker(true)}
            disabled={busyId === order.id}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-warning underline underline-offset-4 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
      {!isFinal && showCancelPicker && (
        <div className="rounded-lg border border-warning bg-warning-surface p-2">
          <p className="mb-1.5 text-xs font-medium text-warning">取消の理由を選んでください</p>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => {
                  onUpdateStatus(order.id, "cancelled", reason.value);
                  setShowCancelPicker(false);
                }}
                disabled={busyId === order.id}
                className="rounded-full border border-warning px-2.5 py-1 text-xs text-warning disabled:opacity-50"
              >
                {reason.label}
              </button>
            ))}
            <button
              onClick={() => setShowCancelPicker(false)}
              className="rounded-full px-2.5 py-1 text-xs text-muted underline underline-offset-4"
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
