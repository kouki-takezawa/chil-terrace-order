import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getShiftsForRange } from "@/lib/data";
import { toCsv, toXlsxBlob, csvResponseHeaders, xlsxResponseHeaders } from "@/lib/export";

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "月の形式が不正です" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const shifts = await getShiftsForRange(start, end);

  const sheet = {
    name: "シフト表",
    headers: ["日付", "メンバー", "開始", "終了", "メモ"],
    rows: shifts.map((s) => [toDateKey(s.date), s.member.name, s.startTime, s.endTime, s.note ?? ""]),
  };

  const filename = `シフト表_${month}.${format}`;
  if (format === "csv") {
    return new NextResponse(toCsv(sheet), { headers: csvResponseHeaders(filename) });
  }
  const blob = await toXlsxBlob([sheet]);
  return new NextResponse(blob, { headers: xlsxResponseHeaders(filename) });
}
