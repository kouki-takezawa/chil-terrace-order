import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { updateShift, removeShift } from "@/lib/data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const b = body as { startTime?: unknown; endTime?: unknown; note?: unknown } | null;

  const startTime = typeof b?.startTime === "string" && TIME_RE.test(b.startTime) ? b.startTime : undefined;
  const endTime = typeof b?.endTime === "string" && TIME_RE.test(b.endTime) ? b.endTime : undefined;
  // 終了時刻が開始時刻以前（例: 22:00〜2:00）の場合は日をまたぐ勤務として許可する
  if (startTime && endTime && endTime === startTime) {
    return NextResponse.json({ error: "開始時刻と終了時刻が同じです" }, { status: 400 });
  }
  const note = typeof b?.note === "string" ? b.note.slice(0, 100) : b?.note === null ? null : undefined;

  try {
    const shift = await updateShift(id, { startTime, endTime, note });
    return NextResponse.json({ shift });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  try {
    await removeShift(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
