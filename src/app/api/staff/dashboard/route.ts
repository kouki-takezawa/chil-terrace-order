import { NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/data";

// 現段階はログイン機能を無効化しているため認証チェックなし。
export async function GET() {
  const summary = await getDashboardSummary();
  return NextResponse.json(summary);
}
