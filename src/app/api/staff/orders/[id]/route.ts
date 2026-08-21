import { NextResponse } from "next/server";
import { updateOrderStatus, type OrderStatus } from "@/lib/data";

const VALID_STATUSES: OrderStatus[] = ["pending", "preparing", "served", "paid", "cancelled"];

// 現段階はログイン機能を無効化しているため認証チェックなし。
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const status = (body as { status?: unknown } | null)?.status;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "ステータスが不正です" }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(id, status as OrderStatus);
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "注文の更新に失敗しました" }, { status: 400 });
  }
}
