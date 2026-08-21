import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { createShift } from "@/lib/data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const b = body as { memberId?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; note?: unknown } | null;

  if (
    typeof b?.memberId !== "string" ||
    typeof b?.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    typeof b.startTime !== "string" ||
    typeof b.endTime !== "string" ||
    !TIME_RE.test(b.startTime) ||
    !TIME_RE.test(b.endTime) ||
    b.endTime <= b.startTime
  ) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません（終了時刻は開始時刻より後にしてください）" }, { status: 400 });
  }
  const note = typeof b.note === "string" ? b.note.slice(0, 100) : undefined;

  try {
    const shift = await createShift({
      memberId: b.memberId,
      date: new Date(`${b.date}T00:00:00.000Z`),
      startTime: b.startTime,
      endTime: b.endTime,
      note,
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 400 });
  }
}
