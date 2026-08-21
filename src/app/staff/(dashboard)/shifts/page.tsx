import Link from "next/link";
import { getShiftsForRange, listShiftMembers, getDayNote } from "@/lib/data";
import { ShiftDayView } from "@/components/staff/ShiftDayView";
import { PrintButton } from "@/components/staff/PrintButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { ExportLinks } from "@/components/staff/ExportLinks";
import { saveDayNoteAction } from "./actions";

export const dynamic = "force-dynamic";

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function todayKeyJST(): string {
  return toDateKey(new Date(Date.now() + 9 * 60 * 60 * 1000));
}

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { year: jstNow.getUTCFullYear(), month: jstNow.getUTCMonth() };
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

// 指定日を含む週の月曜日を返す
function weekStartFor(dateKey: string): Date {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - mondayOffset * 86400000);
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export default async function StaffShiftsPage(props: PageProps<"/staff/shifts">) {
  const { view: viewParam, month: monthQuery, date: dateQuery } = await props.searchParams;
  const view = viewParam === "day" ? "day" : viewParam === "week" ? "week" : "month";
  const members = await listShiftMembers();

  if (view === "week") {
    const anchorDate = typeof dateQuery === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery) ? dateQuery : todayKeyJST();
    const weekStart = weekStartFor(anchorDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    const shifts = await getShiftsForRange(weekStart, weekEnd);

    const shiftsByMemberAndDate = new Map<string, { id: string; date: string; startTime: string; endTime: string }[]>();
    for (const shift of shifts) {
      const key = shift.memberId;
      const list = shiftsByMemberAndDate.get(key) ?? [];
      list.push({ id: shift.id, date: toDateKey(shift.date), startTime: shift.startTime, endTime: shift.endTime });
      shiftsByMemberAndDate.set(key, list);
    }

    const prevWeekDate = toDateKey(new Date(weekStart.getTime() - 86400000));
    const nextWeekDate = toDateKey(new Date(weekStart.getTime() + 7 * 86400000));
    const monthOfWeek = toDateKey(weekStart).slice(0, 7);
    const weekLabel = `${weekDays[0].getUTCMonth() + 1}/${weekDays[0].getUTCDate()} 〜 ${weekDays[6].getUTCMonth() + 1}/${weekDays[6].getUTCDate()}`;

    return (
      <div>
        <ShiftHeader monthOfDate={weekLabel} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/staff/shifts?view=week&date=${prevWeekDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
              ‹
            </Link>
            <span className="min-w-32 text-center font-medium text-foreground">{weekLabel}</span>
            <Link href={`/staff/shifts?view=week&date=${nextWeekDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
              ›
            </Link>
            <Link href={`/staff/shifts?view=week&date=${todayKeyJST()}`} className="ml-1 rounded-full border border-border px-3 py-1.5 text-foreground">
              今週
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ExportLinks href="/api/staff/export/shifts" params={{ month: monthOfWeek }} />
            <PrintButton className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground" />
            <Link href={`/staff/shifts?view=month&month=${monthOfWeek}`} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
              月表示
            </Link>
          </div>
        </div>

        {members.length === 0 && (
          <p className="mb-4 rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted print:hidden">
            シフトメンバーが登録されていません。設定＞シフトメンバーから追加してください。
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-8" style={{ minWidth: 640 }}>
            <div className="border-b border-r border-border p-2 text-xs text-muted">メンバー</div>
            {weekDays.map((d) => {
              const key = toDateKey(d);
              const isToday = key === todayKeyJST();
              return (
                <Link
                  key={key}
                  href={`/staff/shifts?view=day&date=${key}`}
                  className={`border-b border-r border-border p-2 text-center text-xs last:border-r-0 ${
                    isToday ? "bg-background font-bold text-foreground" : "text-muted"
                  }`}
                >
                  {WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7]} {d.getUTCMonth() + 1}/{d.getUTCDate()}
                </Link>
              );
            })}

            {members.map((member) => (
              <div key={member.id} className="contents">
                <div className="border-r border-b border-border p-2 text-xs font-medium text-foreground">{member.name}</div>
                {weekDays.map((d) => {
                  const key = toDateKey(d);
                  const dayShifts = (shiftsByMemberAndDate.get(member.id) ?? []).filter((s) => s.date === key);
                  return (
                    <Link
                      key={key}
                      href={`/staff/shifts?view=day&date=${key}`}
                      className="space-y-1 border-r border-b border-border p-1.5 text-center last:border-r-0"
                    >
                      {dayShifts.map((s) => (
                        <p key={s.id} className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                          {s.startTime}-{s.endTime}
                        </p>
                      ))}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "day") {
    const date = typeof dateQuery === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery) ? dateQuery : todayKeyJST();
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const [shifts, dayNote] = await Promise.all([getShiftsForRange(dayStart, dayEnd), getDayNote(date)]);
    const monthOfDate = `${date.slice(0, 4)}-${date.slice(5, 7)}`;
    const prevDate = toDateKey(new Date(dayStart.getTime() - 86400000));
    const nextDate = toDateKey(new Date(dayStart.getTime() + 86400000));
    const [y, m, d] = date.split("-").map(Number);
    const weekdayLabel = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

    return (
      <div>
        <ShiftHeader monthOfDate={monthOfDate} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/staff/shifts?view=day&date=${prevDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
              ‹
            </Link>
            <span className="min-w-32 text-center font-medium text-foreground">
              {y}年{m}月{d}日（{weekdayLabel}）
            </span>
            <Link href={`/staff/shifts?view=day&date=${nextDate}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
              ›
            </Link>
            <Link href={`/staff/shifts?view=day&date=${todayKeyJST()}`} className="ml-1 rounded-full border border-border px-3 py-1.5 text-foreground">
              今日
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ExportLinks href="/api/staff/export/shifts" params={{ month: monthOfDate }} />
            <PrintButton className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground" />
            <Link href={`/staff/shifts?view=week&date=${date}`} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
              週表示
            </Link>
            <Link href={`/staff/shifts?view=month&month=${monthOfDate}`} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
              月表示に戻る
            </Link>
          </div>
        </div>

        {members.length === 0 && (
          <p className="mb-4 rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted print:hidden">
            シフトメンバーが登録されていません。設定＞シフトメンバーから追加してください。
          </p>
        )}

        <form action={saveDayNoteAction} className="mb-4 rounded-xl border border-border bg-surface p-3">
          <input type="hidden" name="date" value={date} />
          <label className="mb-1 block text-xs font-medium text-muted">この日の申し送り</label>
          <textarea
            name="note"
            defaultValue={dayNote?.note ?? ""}
            rows={2}
            placeholder="例: 15時から団体のご予約あり／〇〇さんは18時に一旦退勤"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground print:hidden"
          />
          <p className="hidden text-sm print:block">{dayNote?.note}</p>
          <SubmitButton
            pendingText="保存中…"
            className="mt-2 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground print:hidden"
          >
            保存
          </SubmitButton>
        </form>

        <ShiftDayView
          date={date}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          shifts={shifts.map((s) => ({
            id: s.id,
            memberId: s.memberId,
            startTime: s.startTime,
            endTime: s.endTime,
            note: s.note,
          }))}
        />
      </div>
    );
  }

  // --- 月表示 ---
  const { year, month } = parseMonthParam(typeof monthQuery === "string" ? monthQuery : undefined);
  const gridDays = buildMonthGrid(year, month);
  const gridStart = gridDays[0];
  const gridEnd = new Date(gridDays[gridDays.length - 1].getTime() + 24 * 60 * 60 * 1000);
  const shifts = await getShiftsForRange(gridStart, gridEnd);

  const shiftsByDate = new Map<string, { memberName: string }[]>();
  for (const shift of shifts) {
    const key = toDateKey(shift.date);
    const list = shiftsByDate.get(key) ?? [];
    list.push({ memberName: shift.member.name });
    shiftsByDate.set(key, list);
  }

  return (
    <div>
      <ShiftHeader monthOfDate={`${year}-${String(month + 1).padStart(2, "0")}`} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/staff/shifts?view=month&month=${monthParam(year, month, -1)}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ‹
          </Link>
          <span className="min-w-24 text-center font-medium text-foreground">
            {year}年{month + 1}月
          </span>
          <Link href={`/staff/shifts?view=month&month=${monthParam(year, month, 1)}`} className="rounded-full border border-border px-3 py-1.5 text-foreground">
            ›
          </Link>
          <Link href="/staff/shifts?view=month" className="ml-1 rounded-full border border-border px-3 py-1.5 text-foreground">
            今月
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ExportLinks href="/api/staff/export/shifts" params={{ month: `${year}-${String(month + 1).padStart(2, "0")}` }} />
          <PrintButton className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground" />
          <Link href={`/staff/shifts?view=week&date=${todayKeyJST()}`} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
            週表示
          </Link>
        </div>
      </div>

      {members.length === 0 && (
        <p className="mb-4 rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-muted print:hidden">
          シフトメンバーが登録されていません。設定＞シフトメンバーから追加してください。
        </p>
      )}

      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-xs text-muted sm:gap-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 print:gap-1">
        {gridDays.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getUTCMonth() === month;
          const dayShifts = shiftsByDate.get(key) ?? [];
          return (
            <Link
              key={key}
              href={`/staff/shifts?view=day&date=${key}`}
              className={`block min-h-20 rounded-xl border border-border p-1.5 text-left sm:min-h-24 sm:p-2 print:min-h-16 ${
                inMonth ? "bg-surface" : "bg-background opacity-40"
              } ${key === todayKeyJST() ? "border-accent" : ""}`}
            >
              <p className="text-xs text-muted">{d.getUTCDate()}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {dayShifts.slice(0, 3).map((s, i) => (
                  <span key={i} className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-foreground">
                    {s.memberName}
                  </span>
                ))}
                {dayShifts.length > 3 && <span className="text-[10px] text-muted">+{dayShifts.length - 3}</span>}
              </div>
              {dayShifts.length > 0 && <p className="mt-1 text-[10px] text-muted">{dayShifts.length}人出勤</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ShiftHeader({ monthOfDate }: { monthOfDate: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-foreground">シフト表</h1>
      <p className="text-sm text-muted print:hidden">スタッフの勤務予定を月・日で確認・編集します</p>
      <p className="hidden text-sm text-muted print:block">{monthOfDate}</p>
    </div>
  );
}
