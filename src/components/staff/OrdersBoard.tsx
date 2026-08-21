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

const NEXT_STATUS: Record<string, string> = {
  pending: "preparing",
  preparing: "served",
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  pending: "調理開始",
  preparing: "受け渡し済みにする",
};

export function OrdersBoard({ initialData }: { initialData: BoardData }) {
  const [data, setData] = useState<BoardData>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/staff/orders", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
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

  async function checkout(tableNumber: number) {
    setBusyId(`checkout-${tableNumber}`);
    try {
      await fetch(`/api/staff/tables/${tableNumber}/checkout`, { method: "POST" });
      await refresh();
    } finally {
      setBusyId(null);
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
          <OrderCard key={order.id} order={order} busyId={busyId} onUpdateStatus={updateStatus} showNumber />
        ))}
      </div>
    );
  }

  if (data.tables.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted">
        現在、進行中の注文はありません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.tables.map(({ table, orders }) => {
        const tableTotal = orders.reduce((s, o) => s + o.total, 0);
        return (
          <div key={table.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{table.name ?? `卓${table.number}`}</h2>
              <button
                onClick={() => checkout(table.number)}
                disabled={busyId === `checkout-${table.number}`}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
              >
                会計
              </button>
            </div>

            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} busyId={busyId} onUpdateStatus={updateStatus} />
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

function OrderCard({
  order,
  busyId,
  onUpdateStatus,
  showNumber,
}: {
  order: OrderDTO;
  busyId: string | null;
  onUpdateStatus: (orderId: string, status: string) => void;
  showNumber?: boolean;
}) {
  const next = NEXT_STATUS[order.status];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span>{showNumber ? `#${order.dailyNumber}` : formatTime(new Date(order.createdAt))}</span>
        <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
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
      <div className="flex items-center gap-2">
        {next && (
          <button
            onClick={() => onUpdateStatus(order.id, next)}
            disabled={busyId === order.id}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            {NEXT_STATUS_LABEL[order.status]}
          </button>
        )}
        {order.status !== "served" && (
          <button
            onClick={() => onUpdateStatus(order.id, "cancelled")}
            disabled={busyId === order.id}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted disabled:opacity-50"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
