"use client";

import { useEffect, useMemo, useState } from "react";
import { formatYen, ORDER_STATUS_LABEL } from "@/lib/format";

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
  dailyNumber: number | null;
  items: OrderItemDTO[];
  total: number;
}

const STORAGE_KEY = "chil-terrace-order-ids";
const TERMINAL_STATUSES = ["served", "cancelled"];

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveStoredIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function NumberOrderClient({
  restaurantName,
  categories,
}: {
  restaurantName: string;
  categories: CategoryDTO[];
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [view, setView] = useState<"menu" | "confirmation">("menu");
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.menuItems.map((i) => [i.id, i] as const))), [categories]);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (allItems.get(id)?.price ?? 0) * q, 0);

  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const grandTotal = validOrders.reduce((s, o) => s + o.total, 0);
  const latestOrder = orders[orders.length - 1] ?? null;

  async function fetchOrder(id: string): Promise<OrderDTO | null> {
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.order ?? null;
    } catch {
      return null;
    }
  }

  // ページを開いたとき、これまでの注文（複数）を復元する
  useEffect(() => {
    const ids = loadStoredIds();
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 復元対象がなければ即座に読み込み中を解除する
      setRestoring(false);
      return;
    }
    Promise.all(ids.map(fetchOrder)).then((results) => {
      const found = results.filter((o): o is OrderDTO => o !== null);
      setOrders(found);
      saveStoredIds(found.map((o) => o.id));
      if (found.length > 0) setView("confirmation");
      setRestoring(false);
    });
  }, []);

  // 進行中の注文があるあいだは、数秒おきに全件の状態を確認する
  useEffect(() => {
    const pendingIds = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).map((o) => o.id);
    if (pendingIds.length === 0) return;
    const interval = setInterval(async () => {
      const updates = await Promise.all(pendingIds.map(fetchOrder));
      setOrders((prev) =>
        prev.map((o) => updates.find((u): u is OrderDTO => u !== null && u.id === o.id) ?? o)
      );
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.map((o) => o.status).join(",")]);

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
    setErrorMsg(null);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "注文に失敗しました");

      const order = data.order;
      const total = order.items.reduce((s: number, i: OrderItemDTO) => s + i.price * i.quantity, 0);
      const orderDto: OrderDTO = { ...order, total };
      setOrders((prev) => {
        const next = [...prev, orderDto];
        saveStoredIds(next.map((o) => o.id));
        return next;
      });
      setCart({});
      setView("confirmation");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (restoring) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">読み込み中…</div>;
  }

  if (view === "confirmation" && latestOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-6 py-10">
        <p className="text-xs text-muted">{restaurantName}</p>
        <p className="mt-6 text-sm text-muted">あなたの注文番号</p>
        <p className="mt-1 text-6xl font-black tabular-nums text-foreground">#{latestOrder.dailyNumber}</p>
        <span className="mt-4 rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-foreground">
          {ORDER_STATUS_LABEL[latestOrder.status] ?? latestOrder.status}
        </span>

        <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-surface p-4">
          <ul className="space-y-1 text-sm text-foreground">
            {latestOrder.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatYen(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-bold text-foreground">
            <span>合計</span>
            <span>{formatYen(latestOrder.total)}</span>
          </div>
        </div>

        <p className="mt-6 max-w-sm text-center text-xs text-muted">
          番号が呼ばれたらお受け取りください。お会計は店舗にてお願いいたします。
        </p>

        {orders.length > 1 && (
          <button
            onClick={() => setShowHistory(true)}
            className="mt-6 text-xs text-muted underline underline-offset-4"
          >
            これまでの注文履歴・合計 {formatYen(grandTotal)}
          </button>
        )}

        <button
          onClick={() => setView("menu")}
          className="mt-8 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground"
        >
          追加で注文する
        </button>

        {showHistory && (
          <HistorySheet orders={orders} grandTotal={grandTotal} onClose={() => setShowHistory(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">{restaurantName}</p>
            <h1 className="text-lg font-bold text-foreground">ご注文</h1>
          </div>
          {orders.length > 0 && (
            <button
              onClick={() => setView("confirmation")}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground"
            >
              直前の注文へ戻る
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                cat.id === activeCategory?.id ? "bg-accent text-accent-foreground" : "bg-surface text-muted border border-border"
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

      {errorMsg && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground shadow-lg">{errorMsg}</div>
        </div>
      )}
    </div>
  );
}

function HistorySheet({
  orders,
  grandTotal,
  onClose,
}: {
  orders: OrderDTO[];
  grandTotal: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">注文履歴</h2>
          <button onClick={onClose} className="text-sm text-muted">
            閉じる
          </button>
        </div>
        <div className="space-y-3">
          {[...orders].reverse().map((order) => {
            const cancelled = order.status === "cancelled";
            return (
              <div key={order.id} className={`rounded-xl border border-border p-3 ${cancelled ? "opacity-50" : ""}`}>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                  <span>#{order.dailyNumber}</span>
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
        <div className="mt-4 flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
          <span>合計</span>
          <span>{formatYen(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
