import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getKitchenOrders, orderTotal } from "@/lib/data";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const board = await getKitchenOrders();

  if (board.mode === "number") {
    return NextResponse.json({
      mode: "number",
      orders: board.orders.map((order) => ({ ...order, total: orderTotal(order) })),
    });
  }

  return NextResponse.json({
    mode: "table",
    tables: board.groups.map((g) => ({
      table: g.table,
      orders: g.orders.map((order) => ({ ...order, total: orderTotal(order) })),
    })),
  });
}
