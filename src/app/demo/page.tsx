import { getTables } from "@/lib/data";
import { DemoView } from "@/components/demo/DemoView";

const restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Chil Terrace";

export default async function DemoPage() {
  const tables = await getTables();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 text-center">
        <p className="text-xs text-muted">{restaurantName}</p>
        <h1 className="text-lg font-bold text-foreground">仕様確認デモ</h1>
        <p className="mt-1 text-xs text-muted">
          左：客側の注文画面（スマホ）／右：店舗スタッフ側の注文管理画面（タブレット）。スマホ側で注文すると、右側にリアルタイムで反映されます。
        </p>
      </div>
      <DemoView tableNumbers={tables.map((t) => t.number)} />
    </div>
  );
}
