import Link from "next/link";
import { getTables, getSettings } from "@/lib/data";
import { TableDemoPicker } from "@/components/TableDemoPicker";

// 運用方式の切り替えをすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getSettings();
  const tables = settings.operationMode === "table" ? await getTables() : [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">{settings.restaurantName}</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">QR注文システム</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {settings.operationMode === "table"
            ? "お客様は各テーブルのQRコードを読み取るとご注文いただけます。以下はQR読み取りのシミュレーション用リンクです。"
            : "お客様はレジ・カウンターのQRコードを読み取るとご注文いただけます。以下は読み取りのシミュレーション用リンクです。"}
        </p>
      </div>

      {settings.operationMode === "table" ? (
        tables.length > 0 ? (
          <TableDemoPicker tableNumbers={tables.map((t) => t.number)} />
        ) : (
          <p className="text-sm text-muted">テーブルが登録されていません</p>
        )
      ) : (
        <Link href="/order" className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground">
          注文画面を開く
        </Link>
      )}

      <Link href="/staff/login" className="text-sm text-muted underline underline-offset-4">
        店舗スタッフの方はこちら
      </Link>
    </div>
  );
}
