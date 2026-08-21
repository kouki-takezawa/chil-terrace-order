import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getReservationsForDate } from "@/lib/data";
import { toCsv, toXlsxBlob, csvResponseHeaders, xlsxResponseHeaders } from "@/lib/export";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "予約済み",
  seated: "来店済み",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export async function GET(request: Request) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "日付の形式が不正です" }, { status: 400 });
  }

  const reservations = await getReservationsForDate(date);
  const sheet = {
    name: "予約表",
    headers: ["時刻", "お名前", "電話番号", "人数", "卓", "ステータス", "メモ"],
    rows: reservations.map((r) => [
      r.time,
      r.customerName,
      r.phone ?? "",
      r.partySize,
      r.table ? (r.table.name ?? `卓${r.table.number}`) : "卓未定",
      STATUS_LABEL[r.status] ?? r.status,
      r.note ?? "",
    ]),
  };

  const filename = `予約表_${date}.${format}`;
  if (format === "csv") {
    return new NextResponse(toCsv(sheet), { headers: csvResponseHeaders(filename) });
  }
  const blob = await toXlsxBlob([sheet]);
  return new NextResponse(blob, { headers: xlsxResponseHeaders(filename) });
}
