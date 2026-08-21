import { NextResponse } from "next/server";
import { checkoutTable } from "@/lib/data";

// 現段階はログイン機能を無効化しているため認証チェックなし。
export async function POST(_request: Request, context: { params: Promise<{ number: string }> }) {
  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  try {
    await checkoutTable(tableNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "会計処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
