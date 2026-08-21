import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTables } from "@/lib/data";

export default async function StaffTablesPage() {
  const [tables, headerList] = await Promise.all([getTables(), headers()]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const url = `${baseUrl}/order/${table.number}`;
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
      return { ...table, url, qrDataUrl };
    })
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">テーブルQR</h1>
      <p className="mb-6 text-sm text-muted">各テーブルに設置するQRコードです。印刷してご利用ください。</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tablesWithQr.map((table) => (
          <div key={table.id} className="flex flex-col items-center rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-bold text-foreground">{table.name ?? `卓${table.number}`}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={`卓${table.number}のQRコード`} className="h-32 w-32" />
            <p className="mt-2 break-all text-center text-[10px] text-muted">{table.url}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
