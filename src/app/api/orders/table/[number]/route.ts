import { NextResponse } from "next/server";
import { getActiveSessionOrdersForTable, orderTotal } from "@/lib/data";

export async function GET(_request: Request, context: { params: Promise<{ number: string }> }) {
  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const orders = await getActiveSessionOrdersForTable(tableNumber);
  return NextResponse.json({
    orders: orders.map((order) => ({ ...order, total: orderTotal(order) })),
  });
}
