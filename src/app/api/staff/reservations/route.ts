import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { createReservation } from "@/lib/data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const b = body as
    | {
        customerName?: unknown;
        phone?: unknown;
        partySize?: unknown;
        date?: unknown;
        time?: unknown;
        tableId?: unknown;
        note?: unknown;
      }
    | null;

  if (
    typeof b?.customerName !== "string" ||
    !b.customerName.trim() ||
    typeof b.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    typeof b.time !== "string" ||
    !TIME_RE.test(b.time) ||
    typeof b.partySize !== "number" ||
    b.partySize < 1
  ) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }
  const phone = typeof b.phone === "string" ? b.phone.slice(0, 30) : undefined;
  const tableId = typeof b.tableId === "string" && b.tableId ? b.tableId : undefined;
  const note = typeof b.note === "string" ? b.note.slice(0, 200) : undefined;

  try {
    const reservation = await createReservation({
      customerName: b.customerName.trim().slice(0, 100),
      phone,
      partySize: b.partySize,
      date: b.date,
      time: b.time,
      tableId,
      note,
    });
    return NextResponse.json({ reservation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 400 });
  }
}
