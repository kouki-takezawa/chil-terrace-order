import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { updateReservation, deleteReservation } from "@/lib/data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUS_VALUES = ["confirmed", "seated", "cancelled", "no_show"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const b = body as
    | {
        customerName?: unknown;
        phone?: unknown;
        partySize?: unknown;
        time?: unknown;
        tableId?: unknown;
        note?: unknown;
        status?: unknown;
      }
    | null;

  const data: Parameters<typeof updateReservation>[1] = {};
  if (typeof b?.customerName === "string" && b.customerName.trim()) data.customerName = b.customerName.trim().slice(0, 100);
  if (typeof b?.phone === "string") data.phone = b.phone.slice(0, 30) || null;
  if (typeof b?.partySize === "number" && b.partySize >= 1) data.partySize = b.partySize;
  if (typeof b?.time === "string" && TIME_RE.test(b.time)) data.time = b.time;
  if (typeof b?.tableId === "string") data.tableId = b.tableId || null;
  if (typeof b?.note === "string") data.note = b.note.slice(0, 200) || null;
  if (typeof b?.status === "string" && STATUS_VALUES.includes(b.status)) data.status = b.status;

  try {
    const reservation = await updateReservation(id, data);
    return NextResponse.json({ reservation });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  try {
    await deleteReservation(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
