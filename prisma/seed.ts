// デプロイのたびに実行される初期データ投入スクリプト（package.json の
// vercel-build 参照）。すべて upsert なので、既存データを壊さずに何度実行
// しても安全。メニュー編集UIは未実装のため、メニューを変更する場合は
// このファイルを編集してデプロイし直す運用とする。
import "../src/lib/load-env";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // --- スタッフアカウント -----------------------------------------------
  const staffEmail = (process.env.STAFF_EMAIL ?? "staff@example.com").trim().toLowerCase();
  const staffPassword = process.env.STAFF_PASSWORD ?? "changeme1234";
  const passwordHash = await bcrypt.hash(staffPassword, 10);

  await prisma.staffUser.upsert({
    where: { email: staffEmail },
    update: { passwordHash },
    create: { email: staffEmail, passwordHash, name: "スタッフ" },
  });

  // --- テーブル -----------------------------------------------------------
  const tableCount = Number(process.env.TABLE_COUNT ?? 8);
  for (let number = 1; number <= tableCount; number++) {
    await prisma.restaurantTable.upsert({
      where: { number },
      update: {},
      create: { number, name: `卓${number}` },
    });
  }

  // --- カテゴリ + メニュー --------------------------------------------------
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
    // Category に一意制約がないため、name で find-or-create する。
    const existingCategory = await prisma.category.findFirst({ where: { name: category.name } });
    const cat =
      existingCategory ??
      (await prisma.category.create({ data: { name: category.name, sortOrder: category.sortOrder } }));

    for (let i = 0; i < category.items.length; i++) {
      const item = category.items[i];
      const existing = await prisma.menuItem.findFirst({
        where: { categoryId: cat.id, name: item.name },
      });
      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            price: item.price,
            description: item.description,
            isRecommended: item.isRecommended ?? false,
            sortOrder: i,
          },
        });
      } else {
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
  }

  console.log(`Seed complete. Staff login: ${staffEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
