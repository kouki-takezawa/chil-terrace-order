import { NextResponse } from "next/server";
import { getKitchenOrders, orderTotal } from "@/lib/data";

// 現段階はログイン機能を無効化しているため認証チェックなし（src/lib/apiAuth.ts
// のrequireStaffSessionは温存してあるので、認証を戻す際はここで呼び出す）。
export async function GET() {
  const groups = await getKitchenOrders();
  return NextResponse.json({
    tables: groups.map((g) => ({
      table: g.table,
      orders: g.orders.map((order) => ({ ...order, total: orderTotal(order) })),
    })),
  });
}
