import { getKitchenOrders, orderTotal } from "@/lib/data";
import { OrdersBoard } from "@/components/staff/OrdersBoard";

// 注文状況をリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function StaffOrdersPage() {
  const groups = await getKitchenOrders();
  const initialTables = groups.map((g) => ({
    table: { id: g.table.id, number: g.table.number, name: g.table.name },
    orders: g.orders.map((order) => ({
      id: order.id,
      status: order.status,
      note: order.note,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      total: orderTotal(order),
    })),
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">注文管理</h1>
      <p className="mb-6 text-sm text-muted">卓ごとの進行中の注文をリアルタイムに確認・更新します</p>
      <OrdersBoard initialTables={initialTables} />
    </div>
  );
}
