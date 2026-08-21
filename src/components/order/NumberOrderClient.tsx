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

const STORAGE_KEY = "chil-terrace-last-order-id";
const TERMINAL_STATUSES = ["served", "cancelled"];

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
  const [confirmedOrder, setConfirmedOrder] = useState<OrderDTO | null>(null);
  const [restoring, setRestoring] = useState(true);

  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.menuItems.map((i) => [i.id, i] as const))), [categories]);
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (allItems.get(id)?.price ?? 0) * q, 0);

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

  // ページを開いたとき、前回の注文が進行中ならその画面を復元する
  useEffect(() => {
    const lastId = localStorage.getItem(STORAGE_KEY);
    if (!lastId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 復元対象がなければ即座に読み込み中を解除する
      setRestoring(false);
      return;
    }
    fetchOrder(lastId).then((order) => {
      if (order) setConfirmedOrder(order);
      setRestoring(false);
    });
  }, []);

  // 確認画面表示中は、受け渡し済み/取消になるまで数秒おきに状態を確認する
  useEffect(() => {
    if (!confirmedOrder || TERMINAL_STATUSES.includes(confirmedOrder.status)) return;
    const interval = setInterval(async () => {
      const updated = await fetchOrder(confirmedOrder.id);
      if (updated) setConfirmedOrder(updated);
    }, 5000);
    return () => clearInterval(interval);
  }, [confirmedOrder]);

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
      localStorage.setItem(STORAGE_KEY, order.id);
      setConfirmedOrder(orderDto);
      setCart({});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "注文に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  function orderAgain() {
    localStorage.removeItem(STORAGE_KEY);
    setConfirmedOrder(null);
  }

  if (restoring) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">読み込み中…</div>;
  }

  if (confirmedOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-6 py-10">
        <p className="text-xs text-muted">{restaurantName}</p>
        <p className="mt-6 text-sm text-muted">あなたの注文番号</p>
        <p className="mt-1 text-6xl font-black tabular-nums text-foreground">#{confirmedOrder.dailyNumber}</p>
        <span className="mt-4 rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-foreground">
          {ORDER_STATUS_LABEL[confirmedOrder.status] ?? confirmedOrder.status}
        </span>

        <div className="mt-8 w-full max-w-sm rounded-2xl border border-border bg-surface p-4">
          <ul className="space-y-1 text-sm text-foreground">
            {confirmedOrder.items.map((item) => (
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
            <span>{formatYen(confirmedOrder.total)}</span>
          </div>
        </div>

        <p className="mt-6 max-w-sm text-center text-xs text-muted">
          番号が呼ばれたらお受け取りください。お会計は店舗にてお願いいたします。
        </p>

        <button
          onClick={orderAgain}
          className="mt-8 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground"
        >
          追加で注文する
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div>
          <p className="text-xs text-muted">{restaurantName}</p>
          <h1 className="text-lg font-bold text-foreground">ご注文</h1>
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
