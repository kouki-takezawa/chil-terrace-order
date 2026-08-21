import { redirect } from "next/navigation";
import { getMenu, getTableByNumber, getSettings } from "@/lib/data";
import { OrderClient } from "@/components/order/OrderClient";

// 卓ごとのQR先。運用方式の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: PageProps<"/order/[table]">) {
  const { table: tableParam } = await params;
  const tableNumber = Number(tableParam);

  const settings = await getSettings();
  if (settings.operationMode === "number") {
    redirect("/order");
  }

  if (!Number.isInteger(tableNumber)) {
    return <NotFoundMessage />;
  }

  const table = await getTableByNumber(tableNumber);
  if (!table) {
    return <NotFoundMessage />;
  }

  const categories = await getMenu();

  return (
    <OrderClient
      restaurantName={settings.restaurantName}
      tableNumber={tableNumber}
      tableName={table.name ?? `卓${table.number}`}
      categories={categories}
    />
  );
}

function NotFoundMessage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <p className="text-lg font-bold text-foreground">卓が見つかりません</p>
      <p className="text-sm text-muted">QRコードを確認するか、店舗スタッフにお声がけください。</p>
    </div>
  );
}
