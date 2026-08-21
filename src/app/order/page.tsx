import { getMenu, getSettings } from "@/lib/data";
import { NumberOrderClient } from "@/components/order/NumberOrderClient";

// 運用方式の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function NumberOrderPage() {
  const settings = await getSettings();

  if (settings.operationMode !== "number") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-lg font-bold text-foreground">この店舗は卓ごとのQRからご注文ください</p>
        <p className="text-sm text-muted">お席のQRコードを読み取ってアクセスしてください。</p>
      </div>
    );
  }

  const categories = await getMenu();

  return <NumberOrderClient restaurantName={settings.restaurantName} categories={categories} />;
}
