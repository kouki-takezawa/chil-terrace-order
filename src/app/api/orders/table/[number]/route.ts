import { NextResponse } from "next/server";
import { getTableOrderStatus, orderTotal } from "@/lib/data";

export async function GET(_request: Request, context: { params: Promise<{ number: string }> }) {
  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const status = await getTableOrderStatus(tableNumber);
  if (!status) {
    return NextResponse.json({ orders: [], sessionClosed: false });
  }
  return NextResponse.json({
    orders: status.orders.map((order) => ({ ...order, total: orderTotal(order) })),
    sessionClosed: status.sessionClosed,
  });
}
