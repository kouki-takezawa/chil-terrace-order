import Link from "next/link";
import { getReservationsForDate, getSettings, getTables } from "@/lib/data";
import { getJSTDateKey } from "@/lib/date";
import { ReservationDayView } from "@/components/staff/ReservationDayView";
import { ExportLinks } from "@/components/staff/ExportLinks";

export const dynamic = "force-dynamic";

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function ReservationsPage(props: PageProps<"/staff/reservations">) {
  const { date: dateQuery } = await props.searchParams;
  const date = typeof dateQuery === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery) ? dateQuery : getJSTDateKey();
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const prevDate = toDateKey(new Date(dayStart.getTime() - 86400000));
  const nextDate = toDateKey(new Date(dayStart.getTime() + 86400000));
  const [y, m, d] = date.split("-").map(Number);
  const weekdayLabel = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

  const [reservations, settings] = await Promise.all([getReservationsForDate(date), getSettings()]);
  const useTables = settings.operationMode === "table";
  const tables = useTables ? await getTables() : [];

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">予約表</h1>
      <p className="mb-6 text-sm text-muted">来店予約を手動で記録・管理します（決済・注文とは連動しません）</p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/staff/reservations?date=${prevDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ‹
          </Link>
          <span className="min-w-32 text-center font-medium text-foreground">
            {y}年{m}月{d}日（{weekdayLabel}）
          </span>
          <Link href={`/staff/reservations?date=${nextDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ›
          </Link>
          <Link href={`/staff/reservations?date=${getJSTDateKey()}`} className="ml-1 rounded-full border border-border px-3 py-1.5 text-foreground">
            今日
          </Link>
        </div>
        <ExportLinks href="/api/staff/export/reservations" params={{ date }} />
      </div>

      <ReservationDayView
        date={date}
        useTables={useTables}
        tables={tables.map((t) => ({ id: t.id, number: t.number, name: t.name }))}
        reservations={reservations.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          phone: r.phone,
          partySize: r.partySize,
          time: r.time,
          tableId: r.tableId,
          note: r.note,
          status: r.status,
        }))}
      />
    </div>
  );
}
