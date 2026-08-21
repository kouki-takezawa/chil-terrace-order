import { getKitchenOrders, getMenu, orderTotal } from "@/lib/data";
import { OrdersBoard } from "@/components/staff/OrdersBoard";

// 注文状況をリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

function serializeOrder(order: Parameters<typeof orderTotal>[0]) {
  return {
    id: order.id,
    status: order.status,
    note: order.note,
    dailyNumber: order.dailyNumber,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
    total: orderTotal(order),
  };
}

export default async function StaffOrdersPage() {
  const board = await getKitchenOrders();

  const initialData =
    board.mode === "number"
      ? { mode: "number" as const, orders: board.orders.map(serializeOrder) }
      : {
          mode: "table" as const,
          tables: board.groups.map((g) => ({
            table: {
              id: g.table.id,
              number: g.table.number,
              name: g.table.name,
              helpRequestedAt: g.table.helpRequestedAt ? g.table.helpRequestedAt.toISOString() : null,
            },
            orders: g.orders.map(serializeOrder),
          })),
        };

  // 卓方式のときだけ、フロアビューから口頭注文を代理入力できるようメニューを渡す
  const categories = board.mode === "table" ? await getMenu() : [];

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">注文管理</h1>
      <p className="mb-6 text-sm text-muted">
        {board.mode === "number" ? "受付中の注文をリアルタイムに確認・更新します" : "卓ごとの進行中の注文をリアルタイムに確認・更新します"}
      </p>
      <OrdersBoard
        initialData={initialData}
        menuCategories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          menuItems: c.menuItems.map((i) => ({ id: i.id, name: i.name, price: i.price })),
        }))}
      />
    </div>
  );
}
