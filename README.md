# Chil Terrace Order

QRコードから注文できる、飲食店向けの注文・厨房管理システム。Next.js (App Router) + Prisma Postgres。

- **客側**: `/order/[卓番号]` にアクセス（実運用では卓に設置したQRコードから）してメニューを見て注文
- **店舗側**: `/staff/login` からログインし、注文管理（厨房ボード）・売上ダッシュボード・テーブルQRの発行などを行う
- 同じ卓のQRから複数人が別々に注文しても、店側では同じ卓（会計セッション）にまとめて表示される

## セットアップ

```bash
npm install
```

`.env.local` を作成し、`.env.example` を参考に環境変数を設定する（Postgres接続文字列はVercelでPostgresを接続すると自動生成される）。

```bash
npx prisma db push   # スキーマをDBに反映
npm run db:seed       # スタッフアカウント・テーブル・メニューの初期データを投入
npm run dev
```

## 環境変数

`.env.example` を参照。主なもの:

- `DATABASE_URL` ほか — Postgres接続文字列（`src/lib/env.ts` が複数の命名パターンにフォールバック対応）
- `AUTH_SECRET` — NextAuthのセッション暗号化キー
- `STAFF_EMAIL` / `STAFF_PASSWORD` — シード時に作成される店舗スタッフのログイン情報
- `NEXT_PUBLIC_RESTAURANT_NAME` — 店舗名（画面表示用）
- `TABLE_COUNT` — シード時に作成するテーブル数

## メニューの編集

メニュー編集画面はまだ未実装。`prisma/seed.ts` の `categories` 配列を編集し、再デプロイ（`vercel-build` が `db push` → `seed` → `build` の順に実行）すれば反映される。

## 未実装（ナビゲーションにはあるが「近日公開」表示）

- 注文分析
- 期間分析
- シフト表

## デプロイ

Vercelに接続済み。`main` ブランチへのpushで自動デプロイされる。`vercel-build` スクリプトがデプロイの度に `prisma generate` → `prisma db push --accept-data-loss` → シード投入 → `next build` を実行する。
