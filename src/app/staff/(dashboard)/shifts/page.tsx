import Link from "next/link";
import { getShiftsForRange, listShiftMembers } from "@/lib/data";
import { ShiftCalendar } from "@/components/staff/ShiftCalendar";

export const dynamic = "force-dynamic";

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { year: jstNow.getUTCFullYear(), month: jstNow.getUTCMonth() };
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 月曜始まりの6週間（42日）分のグリッドを作る
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth.getTime() - mondayOffset * 86400000);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400000));
}

function monthParam(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function StaffShiftsPage(props: PageProps<"/staff/shifts">) {
  const { month: monthQuery } = await props.searchParams;
  const { year, month } = parseMonthParam(typeof monthQuery === "string" ? monthQuery : undefined);

  const gridDays = buildMonthGrid(year, month);
  const gridStart = gridDays[0];
  const gridEnd = new Date(gridDays[gridDays.length - 1].getTime() + 24 * 60 * 60 * 1000);

  const [shifts, members] = await Promise.all([getShiftsForRange(gridStart, gridEnd), listShiftMembers()]);

  const shiftsByDate = new Map<string, { id: string; memberId: string; memberName: string; note: string | null }[]>();
  for (const shift of shifts) {
    const key = toDateKey(shift.date);
    const list = shiftsByDate.get(key) ?? [];
    list.push({ id: shift.id, memberId: shift.memberId, memberName: shift.member.name, note: shift.note });
    shiftsByDate.set(key, list);
  }

  const calendarDays = gridDays.map((d) => ({
    date: toDateKey(d),
    inMonth: d.getUTCMonth() === month,
    shifts: shiftsByDate.get(toDateKey(d)) ?? [],
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">シフト表</h1>
          <p className="text-sm text-muted">スタッフの勤務予定を月単位で確認・編集します</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/staff/shifts?month=${monthParam(year, month, -1)}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ‹
          </Link>
          <span className="min-w-24 text-center font-medium text-foreground">
            {year}年{month + 1}月
          </span>
          <Link href={`/staff/shifts?month=${monthParam(year, month, 1)}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ›
          </Link>
          <Link href="/staff/shifts" className="ml-2 rounded-full border border-border px-3 py-1.5 text-foreground">
            今月
          </Link>
        </div>
      </div>

      {members.length === 0 && (
        <p className="mb-4 rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted">
          シフトメンバーが登録されていません。設定＞シフトメンバーから追加してください。
        </p>
      )}

      <ShiftCalendar days={calendarDays} members={members.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}
