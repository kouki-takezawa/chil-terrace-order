import Link from "next/link";
import { getTables } from "@/lib/data";
import { TableDemoPicker } from "@/components/TableDemoPicker";

const restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Chil Terrace";

export default async function HomePage() {
  const tables = await getTables();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">{restaurantName}</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">QR注文システム</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          お客様は各テーブルのQRコードを読み取るとご注文いただけます。以下はQR読み取りのシミュレーション用リンクです。
        </p>
      </div>

      {tables.length > 0 ? (
        <TableDemoPicker tableNumbers={tables.map((t) => t.number)} />
      ) : (
        <p className="text-sm text-muted">テーブルが登録されていません</p>
      )}

      <Link href="/staff/login" className="text-sm text-muted underline underline-offset-4">
        店舗スタッフの方はこちら
      </Link>
    </div>
  );
}
