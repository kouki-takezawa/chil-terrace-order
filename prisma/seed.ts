// デプロイのたびに実行される初期データ投入スクリプト（package.json の
// vercel-build 参照）。カテゴリ・メニュー・テーブル・スタッフアカウントは
// 設定画面から編集できるようになったため、このスクリプトは「まだデータが
// 何もない場合にだけ」初期値を投入する（既存データは一切上書きしない）。
import "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // --- 設定（シングルトン行）。なければ作成するだけで、既存の設定は変更しない ---
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // --- スタッフアカウント: 1件も無いときだけ、環境変数から初期アカウントを作る ---
  const staffCount = await prisma.staffUser.count();
  if (staffCount === 0) {
    const staffEmail = (process.env.STAFF_EMAIL ?? "staff@example.com").trim().toLowerCase();
    const staffPassword = process.env.STAFF_PASSWORD ?? "changeme1234";
    const passwordHash = await bcrypt.hash(staffPassword, 10);
    await prisma.staffUser.create({
      data: { email: staffEmail, passwordHash, name: "スタッフ" },
    });
    console.log(`Created initial staff account: ${staffEmail}`);
  }

  // --- テーブル: 1件も無いときだけ、初期テーブルを作る -------------------------
  const tableCount = await prisma.restaurantTable.count();
  if (tableCount === 0) {
    const count = Number(process.env.TABLE_COUNT ?? 8);
    for (let number = 1; number <= count; number++) {
      await prisma.restaurantTable.create({ data: { number, name: `卓${number}` } });
    }
    console.log(`Created ${count} initial tables`);
  }

  // --- カテゴリ + メニュー: カテゴリが1件も無いときだけ初期メニューを作る ---------
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    const categories: {
      name: string;
      sortOrder: number;
      items: { name: string; price: number; description?: string; isRecommended?: boolean }[];
    }[] = [
      {
        name: "おすすめ",
        sortOrder: 0,
        items: [
          { name: "本日の刺身盛り合わせ", price: 1200, description: "仕入れによって内容が変わります", isRecommended: true },
          { name: "出汁巻き玉子", price: 580, isRecommended: true },
          { name: "炙り明太子ポテサラ", price: 620, isRecommended: true },
        ],
      },
      {
        name: "フード",
        sortOrder: 1,
        items: [
          { name: "唐揚げ", price: 680 },
          { name: "枝豆", price: 380 },
          { name: "焼き鳥盛り合わせ（5本）", price: 980 },
          { name: "だし巻き玉子", price: 580 },
          { name: "海鮮サラダ", price: 780 },
          { name: "牛すじ煮込み", price: 620 },
          { name: "石焼ビビンバ", price: 890 },
          { name: "本日のおにぎり", price: 320 },
        ],
      },
      {
        name: "ドリンク",
        sortOrder: 2,
        items: [
          { name: "生ビール", price: 580 },
          { name: "ハイボール", price: 480 },
          { name: "レモンサワー", price: 480 },
          { name: "梅酒ロック", price: 520 },
          { name: "ウーロン茶", price: 350 },
          { name: "烏龍ハイ", price: 480 },
          { name: "日本酒（冷）", price: 680 },
          { name: "ソフトドリンク各種", price: 350 },
        ],
      },
    ];

    for (const category of categories) {
      const cat = await prisma.category.create({ data: { name: category.name, sortOrder: category.sortOrder } });
      for (let i = 0; i < category.items.length; i++) {
        const item = category.items[i];
        await prisma.menuItem.create({
          data: {
            categoryId: cat.id,
            name: item.name,
            price: item.price,
            description: item.description,
            isRecommended: item.isRecommended ?? false,
            sortOrder: i,
          },
        });
      }
    }
    console.log("Created initial menu");
  }

  console.log("Seed check complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
