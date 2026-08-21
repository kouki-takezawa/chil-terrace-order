import Link from "next/link";
import { getReservationsForDate, getSettings, getTables } from "@/lib/data";
import { getJSTDateKey } from "@/lib/date";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import {
  addReservationAction,
  updateReservationAction,
  updateReservationStatusAction,
  deleteReservationAction,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "予約済み",
  seated: "来店済み",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

const STATUS_OPTIONS = ["confirmed", "seated", "cancelled", "no_show"];

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function ReservationsPage(props: PageProps<"/staff/reservations">) {
  const { date: dateQuery, error } = await props.searchParams;
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

      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <div className="mb-4 flex items-center gap-2 text-sm">
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

      <div className="space-y-3">
        {reservations.length === 0 && <p className="text-sm text-muted">この日の予約はまだありません</p>}
        {reservations.map((r) => (
          <form
            key={r.id}
            action={updateReservationAction}
            className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[90px_1fr_1fr_70px_1fr_auto]"
          >
            <input type="hidden" name="id" value={r.id} />
            <input
              type="time"
              name="time"
              defaultValue={r.time}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <input
              type="text"
              name="customerName"
              defaultValue={r.customerName}
              placeholder="お名前"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <input
              type="text"
              name="phone"
              defaultValue={r.phone ?? ""}
              placeholder="電話番号（任意）"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <input
              type="number"
              name="partySize"
              min={1}
              defaultValue={r.partySize}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            {useTables ? (
              <select
                name="tableId"
                defaultValue={r.tableId ?? ""}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">卓未定</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? `卓${t.number}`}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="tableId" value="" />
            )}
            <div className="flex items-center gap-2">
              <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                保存
              </button>
              <ConfirmButton
                confirmText={`${r.customerName}様の予約を削除しますか？`}
                formAction={deleteReservationAction}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-warning"
              >
                削除
              </ConfirmButton>
            </div>

            <input
              type="text"
              name="note"
              defaultValue={r.note ?? ""}
              placeholder="メモ（アレルギー・記念日など、任意）"
              className="col-span-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />

            <div className="col-span-full flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
              <span className="text-[11px] text-muted">ステータス:</span>
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="submit"
                  formAction={updateReservationStatusAction}
                  name="status"
                  value={status}
                  formNoValidate
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.status === status ? "bg-accent text-accent-foreground" : "border border-border text-muted"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
              <input type="hidden" name="id" value={r.id} />
            </div>
          </form>
        ))}
      </div>

      <form
        action={addReservationAction}
        className="mt-6 grid grid-cols-1 gap-2 rounded-2xl border border-dashed border-border bg-surface p-4 sm:grid-cols-[90px_1fr_1fr_70px_1fr]"
      >
        <input type="hidden" name="date" value={date} />
        <input type="time" name="time" required className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        <input
          type="text"
          name="customerName"
          placeholder="お名前"
          required
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="text"
          name="phone"
          placeholder="電話番号（任意）"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="number"
          name="partySize"
          min={1}
          defaultValue={2}
          required
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        {useTables ? (
          <select name="tableId" defaultValue="" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">
            <option value="">卓未定</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? `卓${t.number}`}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="tableId" value="" />
        )}
        <input
          type="text"
          name="note"
          placeholder="メモ（任意）"
          className="col-span-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <button
          type="submit"
          className="col-span-full rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground sm:w-fit"
        >
          予約を追加
        </button>
      </form>
    </div>
  );
}
