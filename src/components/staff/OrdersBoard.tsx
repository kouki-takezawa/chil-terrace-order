"use client";

import { useEffect, useState } from "react";
import { formatTime, formatYen, ORDER_STATUS_LABEL } from "@/lib/format";

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
  table: { id: string; number: number; name: string | null };
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

  async function updateStatus(orderId: string, status: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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

  return (
    <div>
      {data.tables.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
          現在、進行中の注文はありません
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.tables.map((group) => {
            const { table, orders } = group;
            const tableTotal = orders.reduce((s, o) => s + o.total, 0);
            return (
              <div key={table.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-foreground">{table.name ?? `卓${table.number}`}</h2>
                  <button
                    onClick={() => setCheckoutTarget(group)}
                    disabled={busyId === `checkout-${table.number}`}
                    className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
                  >
                    会計
                  </button>
                </div>

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

function OrderCard({
  order,
  busyId,
  onUpdateStatus,
  showNumber,
  mode,
}: {
  order: OrderDTO;
  busyId: string | null;
  onUpdateStatus: (orderId: string, status: string) => void;
  showNumber?: boolean;
  mode: "table" | "number";
}) {
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
      {!isFinal && (
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
            onClick={() => onUpdateStatus(order.id, "cancelled")}
            disabled={busyId === order.id}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-warning underline underline-offset-4 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}
