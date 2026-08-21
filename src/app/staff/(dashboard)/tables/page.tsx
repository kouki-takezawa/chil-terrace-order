import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTables, getSettings } from "@/lib/data";

// 発行するQRのURLはホスト名に依存するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function StaffTablesPage() {
  const [tables, settings, headerList] = await Promise.all([getTables(), getSettings(), headers()]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  if (settings.operationMode === "number") {
    const url = `${baseUrl}/order`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    return (
      <div>
        <h1 className="mb-1 text-xl font-bold text-foreground">QRコード</h1>
        <p className="mb-6 text-sm text-muted">
          フリー席・注文番号方式です。レジ・カウンターに1枚設置してください。読み取ると注文番号が発行されます。
        </p>
        <div className="flex max-w-xs flex-col items-center rounded-2xl border border-border bg-surface p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="注文用QRコード" className="h-56 w-56" />
          <p className="mt-3 break-all text-center text-xs text-muted">{url}</p>
        </div>
      </div>
    );
  }

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const url = `${baseUrl}/order/${table.number}`;
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
      return { ...table, url, qrDataUrl };
    })
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">QRコード</h1>
      <p className="mb-6 text-sm text-muted">各テーブルに設置するQRコードです。印刷してご利用ください。テーブルの追加・削除は設定＞テーブルから行えます。</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tablesWithQr.map((table) => (
          <div key={table.id} className="flex flex-col items-center rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-bold text-foreground">{table.name ?? `卓${table.number}`}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={`卓${table.number}のQRコード`} className="h-32 w-32" />
            <p className="mt-2 break-all text-center text-[10px] text-muted">{table.url}</p>
          </div>
        ))}
        {tablesWithQr.length === 0 && <p className="text-sm text-muted">テーブルが登録されていません</p>}
      </div>
    </div>
  );
}
