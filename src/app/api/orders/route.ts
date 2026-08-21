import { NextResponse } from "next/server";
import { createOrder } from "@/lib/data";

interface CreateOrderBody {
  tableNumber?: number;
  items: { menuItemId: string; quantity: number }[];
  note?: string;
}

function isValidBody(body: unknown): body is CreateOrderBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.tableNumber !== undefined && typeof b.tableNumber !== "number") return false;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  return b.items.every(
    (i) =>
      i &&
      typeof i === "object" &&
      typeof (i as Record<string, unknown>).menuItemId === "string" &&
      typeof (i as Record<string, unknown>).quantity === "number"
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  try {
    const order = await createOrder({
      tableNumber: body.tableNumber,
      items: body.items,
      note: body.note?.slice(0, 500),
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注文の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
