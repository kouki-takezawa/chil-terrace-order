import "server-only";
import { auth } from "@/auth";

// Proxy（src/proxy.ts）は /staff の画面遷移をガードするが、Next.js公式ドキュ
// メントも警告する通り、ルーティング上の抜け漏れに備えて各APIルート側でも
// 個別に認証を確認する（多層防御）。
export async function requireStaffSession() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}
