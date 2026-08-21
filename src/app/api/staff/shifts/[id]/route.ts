import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { removeShift } from "@/lib/data";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  try {
    await removeShift(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
