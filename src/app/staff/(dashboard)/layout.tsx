import type { ReactNode } from "react";
import { getDashboardSummary } from "@/lib/data";
import { formatDate, formatYen } from "@/lib/format";
import { Sidebar } from "@/components/staff/Sidebar";
import { MobileNav } from "@/components/staff/MobileNav";

const restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Chil Terrace";

// 本日の売上バッジをリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

// 現段階はログイン機能を無効化し、/staff配下は誰でもアクセスできる（仕様確認
// 用デモのため）。src/auth.ts / login画面 / STAFF_EMAIL・STAFF_PASSWORD は
// そのまま残してあるので、本運用時に認証を戻す場合はこのlayoutとsrc/app/api/
// staff/**のrequireStaffSession呼び出しを復活させる。
export default async function StaffDashboardLayout({ children }: { children: ReactNode }) {
  const summary = await getDashboardSummary();
  const dateLabel = formatDate(new Date());

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar restaurantName={restaurantName} dateLabel={dateLabel} staffName="デモモード" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav restaurantName={restaurantName} />
        <div className="hidden items-center justify-end border-b border-border px-6 py-4 md:flex">
          <div className="rounded-full border border-border bg-surface px-4 py-2 text-sm">
            <span className="text-muted">本日の売上　</span>
            <span className="font-bold text-foreground">{formatYen(summary.totalToday)}</span>
          </div>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
