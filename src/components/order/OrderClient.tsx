"use client";

import { useEffect, useMemo, useState } from "react";
import { formatYen, formatTime, ORDER_STATUS_LABEL } from "@/lib/format";

interface MenuItemDTO {
  id: string;
  name: string;
  price: number;
  description: string | null;
  isRecommended: boolean;
}

interface CategoryDTO {
  id: string;
  name: string;
  menuItems: MenuItemDTO[];
}

interface OrderItemDTO {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderDTO {
  id: string;
  status: string;
  createdAt: string;
  items: OrderItemDTO[];
  total: number;
}

export function OrderClient({
  restaurantName,
  tableNumber,
  tableName,
  categories,
}: {
  restaurantName: string;
  tableNumber: number;
  tableName: string;
  categories: CategoryDTO[];
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [orders, setOrders] = useState<OrderDTO[]>([]);

  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.menuItems.map((i) => [i.id, i] as const))), [categories]);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (allItems.get(id)?.price ?? 0) * q, 0);

  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const orderedTotal = validOrders.reduce((s, o) => s + o.total, 0);

  async function refreshOrders() {
    try {
      const res = await fetch(`/api/orders/table/${tableNumber}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      // ネットワーク一時エラーは無視して次のポーリングに任せる
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示を待たず即取得したい
    refreshOrders();
    const interval = setInterval(refreshOrders, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNumber]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function updateQty(itemId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[itemId];
      else copy[itemId] = next;
      return copy;
    });
  }

  async function submitOrder() {
    if (cartCount === 0 || submitting) return;
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber, items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "注文に失敗しました");
      }
      setCart({});
      setToast("注文を受け付けました");
      refreshOrders();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">{restaurantName}</p>
            <h1 className="text-lg font-bold text-foreground">{tableName}</h1>
          </div>
          {orders.length > 0 && (
            <button
              onClick={() => setShowStatus(true)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
            >
              注文履歴・合計 {formatYen(orderedTotal)}
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                cat.id === activeCategory?.id
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface text-muted border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="divide-y divide-border px-4">
        {activeCategory?.menuItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{item.name}</p>
              {item.description && <p className="mt-0.5 truncate text-xs text-muted">{item.description}</p>}
              <p className="mt-1 text-sm text-muted">{formatYen(item.price)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => updateQty(item.id, -1)}
                disabled={!cart[item.id]}
                aria-label="減らす"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-30"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-medium tabular-nums">{cart[item.id] ?? 0}</span>
              <button
                onClick={() => updateQty(item.id, 1)}
                aria-label="増やす"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground"
              >
                +
              </button>
            </div>
          </div>
        ))}
        {!activeCategory?.menuItems.length && (
          <p className="py-10 text-center text-sm text-muted">現在このカテゴリーの商品はありません</p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div>
            <p className="text-xs text-muted">{cartCount}点</p>
            <p className="text-lg font-bold text-foreground">{formatYen(cartTotal)}</p>
          </div>
          <button
            onClick={submitOrder}
            disabled={cartCount === 0 || submitting}
            className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-accent-foreground disabled:bg-border disabled:text-muted"
          >
            {submitting ? "送信中…" : "注文する"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground shadow-lg">{toast}</div>
        </div>
      )}

      {showStatus && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowStatus(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">注文履歴</h2>
              <button onClick={() => setShowStatus(false)} className="text-sm text-muted">
                閉じる
              </button>
            </div>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-sm text-muted">まだ注文はありません</p>}
              {orders.map((order) => {
                const cancelled = order.status === "cancelled";
                return (
                  <div key={order.id} className={`rounded-xl border border-border p-3 ${cancelled ? "opacity-50" : ""}`}>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                      <span>{formatTime(new Date(order.createdAt))}</span>
                      <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground">
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    <ul className={`space-y-0.5 text-sm text-foreground ${cancelled ? "line-through" : ""}`}>
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span>
                            {item.name} × {item.quantity}
                          </span>
                          <span>{formatYen(item.price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {orders.length > 0 && (
              <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                <span>合計</span>
                <span>{formatYen(orderedTotal)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
