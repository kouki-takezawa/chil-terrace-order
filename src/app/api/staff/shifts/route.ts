import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { setShift } from "@/lib/data";

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const b = body as { memberId?: unknown; date?: unknown; note?: unknown } | null;

  if (typeof b?.memberId !== "string" || typeof b?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }
  const note = typeof b.note === "string" ? b.note.slice(0, 100) : undefined;

  try {
    const shift = await setShift(b.memberId, new Date(`${b.date}T00:00:00.000Z`), note);
    return NextResponse.json({ shift }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 400 });
  }
}
