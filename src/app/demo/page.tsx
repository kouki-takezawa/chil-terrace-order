import { getTables, getSettings } from "@/lib/data";
import { DemoView } from "@/components/demo/DemoView";

// 運用方式の切り替えをすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [tables, settings] = await Promise.all([getTables(), getSettings()]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 text-center">
        <p className="text-xs text-muted">{settings.restaurantName}</p>
        <h1 className="text-lg font-bold text-foreground">仕様確認デモ</h1>
        <p className="mt-1 text-xs text-muted">
          左：客側の注文画面（スマホ）／右：店舗スタッフ側の画面（タブレット、要ログイン）。スマホ側で注文すると、右側にリアルタイムで反映されます。
        </p>
      </div>
      <DemoView tableNumbers={tables.map((t) => t.number)} operationMode={settings.operationMode} />
    </div>
  );
}
