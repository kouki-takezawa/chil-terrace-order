import "server-only";
import bcrypt from "bcryptjs";
import { prisma, isUniqueConstraintError } from "./prisma";
import { getTodayRangeJST, isLunchHour, getJSTDateKey } from "./date";
import type { Order, OrderItem } from "@prisma/client";

export const ACTIVE_STATUSES = ["pending", "preparing", "served"] as const;
export type OrderStatus = "pending" | "preparing" | "served" | "paid" | "cancelled";
export type OperationMode = "table" | "number";

type OrderWithItems = Order & { items: OrderItem[] };

export function orderTotal(order: OrderWithItems): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ---- 設定 -------------------------------------------------------------

function toOperationMode(value: string): OperationMode {
  return value === "number" ? "number" : "table";
}

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const settings = existing ?? (await prisma.settings.create({ data: { id: "singleton" } }));
  return { ...settings, operationMode: toOperationMode(settings.operationMode) };
}

export async function updateSettings(data: {
  restaurantName?: string;
  operationMode?: OperationMode;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
}) {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
}

// ---- メニュー -------------------------------------------------------------

// 予約された価格改定（pendingPrice/applyAt）のうち、適用日を過ぎたものを
// price に反映してクリアする。バックグラウンドジョブを持たない構成のため、
// メニューを読み込むたびにその場で遅延適用する。
//
// 事前に別クエリで対象を探してから1件ずつUPDATEする、という素朴な実装は
// メニュー取得のたびに余分なDB往復（往復1回あたり数百ms〜のレイテンシがある）
// を積み重ねてしまい、体感速度を悪化させていた。ここでは既に取得済みの
// カテゴリ一覧に対してJS側で価格を差し替えて即座に返し、DBへの反映は
// await せずバックグラウンドで行う（レスポンスを待たせない）。
function applyScheduledPricesInPlace<
  T extends { menuItems: { price: number; pendingPrice: number | null; applyAt: Date | null; id: string }[] },
>(categories: T[]): T[] {
  const now = Date.now();
  const toPersist: { id: string; price: number }[] = [];
  for (const category of categories) {
    for (const item of category.menuItems) {
      if (item.applyAt && item.applyAt.getTime() <= now && item.pendingPrice != null) {
        item.price = item.pendingPrice;
        toPersist.push({ id: item.id, price: item.pendingPrice });
      }
    }
  }
  if (toPersist.length > 0) {
    Promise.all(
      toPersist.map(({ id, price }) =>
        prisma.menuItem.update({ where: { id }, data: { price, pendingPrice: null, applyAt: null } })
      )
    ).catch((err) => console.error("Failed to persist scheduled menu price", err));
  }
  return categories;
}

// 客側の注文画面用（販売中の商品のみ）
export async function getMenu() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return applyScheduledPricesInPlace(categories);
}

// 設定画面用（販売停止中の商品も含む）
export async function getAllCategoriesWithItems() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });
  return applyScheduledPricesInPlace(categories);
}

export async function createCategory(name: string) {
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({ data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
}

export async function renameCategory(id: string, name: string) {
  return prisma.category.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  const count = await prisma.menuItem.count({ where: { categoryId: id } });
  if (count > 0) throw new Error("商品が残っているカテゴリーは削除できません。先に商品を削除・移動してください");
  return prisma.category.delete({ where: { id } });
}

export async function createMenuItem(input: {
  categoryId: string;
  name: string;
  price: number;
  description?: string;
  isRecommended?: boolean;
  allergens?: string;
}) {
  const max = await prisma.menuItem.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  return prisma.menuItem.create({
    data: { ...input, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
}

export async function updateMenuItem(
  id: string,
  data: Partial<{
    name: string;
    price: number;
    description: string | null;
    isRecommended: boolean;
    isAvailable: boolean;
    categoryId: string;
    allergens: string | null;
    pendingPrice: number | null;
    applyAt: Date | null;
  }>
) {
  return prisma.menuItem.update({ where: { id }, data });
}

export async function deleteMenuItem(id: string) {
  const used = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (used > 0) throw new Error("注文履歴がある商品は削除できません。「販売停止」を使ってください");
  return prisma.menuItem.delete({ where: { id } });
}

// ---- テーブル（卓方式） ------------------------------------------------------

export async function getTableByNumber(number: number) {
  return prisma.restaurantTable.findUnique({ where: { number } });
}

// qrTokenは既存卓へ安全に一括バックフィルできないためスキーマ上は任意
// （詳細はschema.prismaのコメント参照）。読み込みのたびに、まだトークンが
// 無い卓（デプロイ直後の既存卓など）を見つけて自己修復的に発行する。
async function ensureTableTokens() {
  const missing = await prisma.restaurantTable.findMany({ where: { qrToken: null }, select: { id: true } });
  for (const table of missing) {
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { qrToken: crypto.randomUUID() } });
  }
}

export async function getTables() {
  await ensureTableTokens();
  return prisma.restaurantTable.findMany({ orderBy: { number: "asc" } });
}

export async function createTable(name?: string) {
  const max = await prisma.restaurantTable.aggregate({ _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  return prisma.restaurantTable.create({
    data: { number, name: name?.trim() || `卓${number}`, qrToken: crypto.randomUUID() },
  });
}

export async function renameTable(id: string, name: string) {
  return prisma.restaurantTable.update({ where: { id }, data: { name } });
}

export async function deleteTable(id: string) {
  const count = await prisma.order.count({ where: { tableId: id } });
  if (count > 0) throw new Error("注文履歴がある卓は削除できません");
  await prisma.tableSession.deleteMany({ where: { tableId: id } });
  return prisma.restaurantTable.delete({ where: { id } });
}

// 同じ卓のQRから複数人がほぼ同時に初回注文したとき、素朴な
// 「探して無ければ作る」だと二人とも「無い」と判定して別々のセッションを
// 作ってしまう競合状態が起きる（会計が片方にしか反映されなくなる不具合の元）。
// そこで常に作成をまず試み、DBのユニーク制約（openTableId）違反で弾かれたら
// 「別のリクエストが先にセッションを作った」ということなので、そちらを読み直す。
async function getOrCreateActiveSession(tableId: string) {
  try {
    return await prisma.tableSession.create({ data: { tableId, openTableId: tableId } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.tableSession.findFirst({
      where: { tableId, closedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (existing) return existing;
    throw error;
  }
}

// ---- 注文番号（フリー席方式） -------------------------------------------------

async function nextDailyOrderNumber(): Promise<number> {
  const dateKey = getJSTDateKey();
  const counter = await prisma.orderCounter.upsert({
    where: { dateKey },
    create: { dateKey, count: 1 },
    update: { count: { increment: 1 } },
  });
  return counter.count;
}

// ---- 客側: 注文 -----------------------------------------------------------

export async function createOrder(input: {
  tableNumber?: number;
  tableToken?: string;
  items: { menuItemId: string; quantity: number }[];
  note?: string;
  idempotencyKey?: string;
}) {
  // 冪等キーが指定されていて、すでに同じキーの注文が存在するなら新規作成せず
  // それをそのまま返す。通信不安定でクライアントが同じ送信を自動的にやり直した
  // ときに、注文が二重に作られるのを防ぐためのもの。
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing;
  }

  if (input.items.length === 0) throw new Error("注文する商品がありません");

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: input.items.map((i) => i.menuItemId) }, isAvailable: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));
  const itemsCreateData = input.items.map(({ menuItemId, quantity }) => {
    const menuItem = menuItemById.get(menuItemId);
    if (!menuItem) throw new Error("商品が見つかりません");
    if (quantity < 1) throw new Error("数量が不正です");
    return { menuItemId, name: menuItem.name, price: menuItem.price, quantity };
  });

  const settings = await getSettings();

  async function createWithIdempotency(data: Parameters<typeof prisma.order.create>[0]["data"]) {
    try {
      return await prisma.order.create({ data, include: { items: true } });
    } catch (error) {
      // 冪等キーの競合（ほぼ同時に同じキーで2回送信された）なら、先に作られた
      // ほうを読み直して返す。
      if (input.idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  if (settings.operationMode === "number") {
    const dailyNumber = await nextDailyOrderNumber();
    return createWithIdempotency({
      mode: "number",
      dailyNumber,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      items: { create: itemsCreateData },
    });
  }

  if (input.tableNumber == null) throw new Error("卓番号が必要です");
  const table = await getTableByNumber(input.tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  if (input.tableToken !== table.qrToken) {
    throw new Error("卓の確認に失敗しました。QRコードを読み取り直してください");
  }
  const session = await getOrCreateActiveSession(table.id);

  return createWithIdempotency({
    mode: "table",
    tableId: table.id,
    sessionId: session.id,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    items: { create: itemsCreateData },
  });
}

// 客側の注文画面用。「今この卓に紐づいている最新のセッション」を会計済みかどうか
// にかかわらず返す（会計直後は closedAt が入った状態で返る）。これにより客側の
// 画面は「会計が終わったこと」を検知して、それ以上の注文を送れないようロックできる。
// あえて「進行中のセッションだけ」に絞らないのは、絞ってしまうと会計直後に
// 該当セッションが見つからなくなり、客の画面には「注文なし」の空の状態にしか
// 見えず、会計済みであることを伝えられなくなるため。
export async function getTableOrderStatus(tableNumber: number, token: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table || token !== table.qrToken) return null;
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return { orders: [] as OrderWithItems[], sessionClosed: false };
  const orders = await prisma.order.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return { orders, sessionClosed: session.closedAt !== null };
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: { items: true } });
}

// ---- 店舗側: 注文管理 --------------------------------------------------------

export type KitchenBoard =
  | {
      mode: "table";
      groups: {
        table: { id: string; number: number; name: string | null; helpRequestedAt: Date | null };
        orders: OrderWithItems[];
      }[];
    }
  | { mode: "number"; orders: OrderWithItems[] };

export async function getKitchenOrders(): Promise<KitchenBoard> {
  const settings = await getSettings();

  if (settings.operationMode === "number") {
    const orders = await prisma.order.findMany({
      where: { mode: "number", status: { in: ["pending", "preparing"] } },
      orderBy: { dailyNumber: "asc" },
      include: { items: true },
    });
    return { mode: "number", orders };
  }

  const orders = await prisma.order.findMany({
    where: { mode: "table", status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "asc" },
    include: { items: true, table: true },
  });

  const byTable = new Map<
    number,
    { table: { id: string; number: number; name: string | null; helpRequestedAt: Date | null }; orders: typeof orders }
  >();
  for (const order of orders) {
    if (!order.table) continue;
    const key = order.table.number;
    if (!byTable.has(key)) byTable.set(key, { table: order.table, orders: [] });
    byTable.get(key)!.orders.push(order);
  }
  return { mode: "table", groups: Array.from(byTable.values()).sort((a, b) => a.table.number - b.table.number) };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, cancelReason?: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status, cancelReason: status === "cancelled" ? (cancelReason ?? null) : undefined },
  });
}

export async function rateOrder(orderId: string, rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("評価は1〜5で指定してください");
  return prisma.order.update({ where: { id: orderId }, data: { rating } });
}

export async function checkoutTable(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");

  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: null },
  });
  if (!session) throw new Error("進行中の会計セッションがありません");

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { sessionId: session.id, status: { in: [...ACTIVE_STATUSES] } },
      data: { status: "paid" },
    }),
    prisma.tableSession.update({ where: { id: session.id }, data: { closedAt: new Date(), openTableId: null } }),
  ]);
}

// 会計取消の猶予時間。誤タップからの復帰用で、これを過ぎると取消できない。
const UNDO_CHECKOUT_WINDOW_MS = 5 * 60 * 1000;

export async function undoCheckout(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");

  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: { not: null } },
    orderBy: { closedAt: "desc" },
  });
  if (!session || !session.closedAt) throw new Error("直近に会計した記録がありません");
  if (Date.now() - session.closedAt.getTime() > UNDO_CHECKOUT_WINDOW_MS) {
    throw new Error("会計から時間が経ちすぎているため取り消せません");
  }

  try {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { sessionId: session.id, status: "paid" }, data: { status: "served" } }),
      prisma.tableSession.update({ where: { id: session.id }, data: { closedAt: null, openTableId: table.id } }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("すでに次のご注文が始まっているため取り消せません");
    }
    throw error;
  }
}

// ---- 卓: スタッフ呼び出し ----------------------------------------------------

export async function callStaff(tableNumber: number, token: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table || token !== table.qrToken) throw new Error("卓の確認に失敗しました");
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { helpRequestedAt: new Date() } });
}

export async function resolveHelp(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  await prisma.restaurantTable.update({ where: { id: table.id }, data: { helpRequestedAt: null } });
}

// ---- 卓: メモ ---------------------------------------------------------------

export async function setTableStaffNote(tableNumber: number, note: string) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) throw new Error("進行中のご注文がありません");
  await prisma.tableSession.update({ where: { id: session.id }, data: { staffNote: note || null } });
}

// ---- 卓: フロアビュー ---------------------------------------------------------

export type FloorTableStatus = "empty" | "active" | "just_closed";

export async function getFloorStatus() {
  const tables = await getTables();
  const now = Date.now();

  return Promise.all(
    tables.map(async (table) => {
      const [latestSession, latestOrder] = await Promise.all([
        prisma.tableSession.findFirst({ where: { tableId: table.id }, orderBy: { startedAt: "desc" } }),
        prisma.order.findFirst({
          where: { tableId: table.id, status: { in: [...ACTIVE_STATUSES] } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      let status: FloorTableStatus = "empty";
      let canUndoCheckout = false;
      let subtotal = 0;

      if (latestSession && latestSession.closedAt === null) {
        status = "active";
        const orders = await prisma.order.findMany({
          where: { sessionId: latestSession.id, status: { in: [...ACTIVE_STATUSES] } },
          include: { items: true },
        });
        subtotal = orders.reduce((s, o) => s + orderTotal(o), 0);
      } else if (latestSession && latestSession.closedAt) {
        const elapsed = now - latestSession.closedAt.getTime();
        if (elapsed <= UNDO_CHECKOUT_WINDOW_MS) {
          status = "just_closed";
          canUndoCheckout = true;
        }
      }

      return {
        table: { id: table.id, number: table.number, name: table.name },
        status,
        subtotal,
        staffNote: latestSession?.staffNote ?? null,
        helpRequestedAt: table.helpRequestedAt,
        lastOrderAt: latestOrder?.createdAt ?? null,
        canUndoCheckout,
      };
    })
  );
}

export async function getTodaySessionsForTable(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) return [];
  const { start, end } = getTodayRangeJST();
  const sessions = await prisma.tableSession.findMany({
    where: { tableId: table.id, startedAt: { gte: start, lt: end } },
    orderBy: { startedAt: "desc" },
    include: { orders: { include: { items: true } } },
  });
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    closedAt: s.closedAt,
    total: s.orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + orderTotal(o), 0),
  }));
}

// ---- 店舗側: 売上ダッシュボード ---------------------------------------------

export async function getDashboardSummary() {
  const settings = await getSettings();
  const { start, end } = getTodayRangeJST();

  const [orders, closedSessions] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end }, mode: settings.operationMode },
      include: { items: true },
    }),
    settings.operationMode === "table"
      ? prisma.tableSession.count({ where: { closedAt: { gte: start, lt: end } } })
      : Promise.resolve(undefined),
  ]);

  const confirmedStatus: OrderStatus = settings.operationMode === "table" ? "paid" : "served";

  let confirmedAmount = 0;
  let pendingAmount = 0;
  let cancelledCount = 0;
  let orderCount = 0;
  let servedCount = 0;

  const hourly = new Map<number, { lunch: number; dinner: number }>();

  for (const order of orders) {
    const total = orderTotal(order);
    if (order.status === "cancelled") {
      cancelledCount++;
      continue;
    }
    orderCount++;
    if (order.status === confirmedStatus) {
      confirmedAmount += total;
      if (settings.operationMode === "number") servedCount++;
    } else {
      pendingAmount += total;
    }

    const jstHour = new Date(order.createdAt.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    const bucket = hourly.get(jstHour) ?? { lunch: 0, dinner: 0 };
    if (isLunchHour(order.createdAt)) bucket.lunch += total;
    else bucket.dinner += total;
    hourly.set(jstHour, bucket);
  }

  const totalToday = confirmedAmount + pendingAmount;
  const avgOrderValue = orderCount > 0 ? Math.round(totalToday / orderCount) : 0;

  const hourlyBreakdown = Array.from(hourly.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({ hour, ...v }));

  const lunchTotal = hourlyBreakdown.reduce((s, h) => s + h.lunch, 0);
  const dinnerTotal = hourlyBreakdown.reduce((s, h) => s + h.dinner, 0);

  return {
    mode: settings.operationMode,
    totalToday,
    confirmedAmount,
    pendingAmount,
    orderCount,
    avgOrderValue,
    cancelledCount,
    checkoutTableCount: closedSessions,
    servedCount,
    hourlyBreakdown,
    lunchTotal,
    dinnerTotal,
  };
}

// ---- スタッフアカウント -----------------------------------------------------

export async function listStaffAccounts() {
  return prisma.staffUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export async function createStaffAccount(email: string, name: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.staffUser.create({
    data: { email: email.trim().toLowerCase(), name, passwordHash },
  });
}

export async function deleteStaffAccount(id: string) {
  const total = await prisma.staffUser.count();
  if (total <= 1) throw new Error("最後の1件のアカウントは削除できません");
  return prisma.staffUser.delete({ where: { id } });
}

export async function resetStaffPassword(id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.staffUser.update({ where: { id }, data: { passwordHash } });
}

// ---- 注文分析 -----------------------------------------------------------

export type AnalyticsPeriod = "today" | "7d" | "30d";

function getRangeForAnalyticsPeriod(period: AnalyticsPeriod): { start: Date; end: Date } {
  const { start: todayStart, end: todayEnd } = getTodayRangeJST();
  if (period === "today") return { start: todayStart, end: todayEnd };
  const days = period === "7d" ? 7 : 30;
  return { start: new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000), end: todayEnd };
}

export async function getOrderAnalytics(period: AnalyticsPeriod) {
  const settings = await getSettings();
  const { start, end } = getRangeForAnalyticsPeriod(period);

  const [items, orderCount] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: start, lt: end }, mode: settings.operationMode, status: { not: "cancelled" } } },
      include: { menuItem: { include: { category: true } } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: start, lt: end }, mode: settings.operationMode, status: { not: "cancelled" } },
    }),
  ]);

  const byItem = new Map<string, { name: string; quantity: number; revenue: number }>();
  const byCategory = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const item of items) {
    const revenue = item.price * item.quantity;

    const itemBucket = byItem.get(item.menuItemId) ?? { name: item.name, quantity: 0, revenue: 0 };
    itemBucket.quantity += item.quantity;
    itemBucket.revenue += revenue;
    byItem.set(item.menuItemId, itemBucket);

    const categoryName = item.menuItem?.category?.name ?? "その他";
    const categoryBucket = byCategory.get(categoryName) ?? { name: categoryName, quantity: 0, revenue: 0 };
    categoryBucket.quantity += item.quantity;
    categoryBucket.revenue += revenue;
    byCategory.set(categoryName, categoryBucket);
  }

  const allItems = Array.from(byItem.values());
  const totalQuantity = allItems.reduce((s, i) => s + i.quantity, 0);
  const totalRevenue = allItems.reduce((s, i) => s + i.revenue, 0);

  return {
    period,
    orderCount,
    totalQuantity,
    totalRevenue,
    avgItemsPerOrder: orderCount > 0 ? Math.round((totalQuantity / orderCount) * 10) / 10 : 0,
    topItems: allItems.sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    categoryBreakdown: Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue),
  };
}

// ---- 期間分析 -----------------------------------------------------------

export type ReportPeriod = "7d" | "30d" | "90d";

export async function getPeriodAnalysis(period: ReportPeriod) {
  const settings = await getSettings();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const { end } = getTodayRangeJST();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end }, mode: settings.operationMode },
    include: { items: true },
  });

  const confirmedStatus: OrderStatus = settings.operationMode === "table" ? "paid" : "served";

  const dailyMap = new Map<string, { confirmed: number; pending: number; orderCount: number; cancelledCount: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dailyMap.set(getJSTDateKey(d), { confirmed: 0, pending: 0, orderCount: 0, cancelledCount: 0 });
  }

  for (const order of orders) {
    const key = getJSTDateKey(order.createdAt);
    const bucket = dailyMap.get(key) ?? { confirmed: 0, pending: 0, orderCount: 0, cancelledCount: 0 };
    if (order.status === "cancelled") {
      bucket.cancelledCount++;
    } else {
      const total = orderTotal(order);
      bucket.orderCount++;
      if (order.status === confirmedStatus) bucket.confirmed += total;
      else bucket.pending += total;
    }
    dailyMap.set(key, bucket);
  }

  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, ...v, total: v.confirmed + v.pending }));

  const totalRevenue = daily.reduce((s, d) => s + d.total, 0);
  const totalOrders = daily.reduce((s, d) => s + d.orderCount, 0);
  const totalCancelled = daily.reduce((s, d) => s + d.cancelledCount, 0);

  return {
    period,
    daily,
    totalRevenue,
    totalOrders,
    totalCancelled,
    avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
  };
}

// ---- シフト表 -----------------------------------------------------------

export async function listShiftMembers() {
  return prisma.shiftMember.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createShiftMember(name: string) {
  const max = await prisma.shiftMember.aggregate({ _max: { sortOrder: true } });
  return prisma.shiftMember.create({ data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
}

export async function renameShiftMember(id: string, name: string) {
  return prisma.shiftMember.update({ where: { id }, data: { name } });
}

export async function deleteShiftMember(id: string) {
  return prisma.shiftMember.delete({ where: { id } });
}

export async function getShiftsForRange(start: Date, end: Date) {
  return prisma.shift.findMany({
    where: { date: { gte: start, lt: end } },
    include: { member: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function createShift(input: { memberId: string; date: Date; startTime: string; endTime: string; note?: string }) {
  return prisma.shift.create({ data: input });
}

export async function updateShift(id: string, data: Partial<{ startTime: string; endTime: string; note: string | null }>) {
  return prisma.shift.update({ where: { id }, data });
}

export async function removeShift(id: string) {
  return prisma.shift.delete({ where: { id } });
}

// ---- シフトの日次申し送りメモ -------------------------------------------------

export async function getDayNote(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return prisma.dayNote.findUnique({ where: { date } });
}

export async function upsertDayNote(dateKey: string, note: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!note) {
    await prisma.dayNote.deleteMany({ where: { date } });
    return;
  }
  await prisma.dayNote.upsert({
    where: { date },
    update: { note },
    create: { date, note },
  });
}

// ---- 予約表（手動入力の来店予約台帳） -------------------------------------------

export async function getReservationsForDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return prisma.reservation.findMany({
    where: { date },
    orderBy: { time: "asc" },
    include: { table: true },
  });
}

export async function createReservation(input: {
  customerName: string;
  phone?: string;
  partySize: number;
  date: string;
  time: string;
  tableId?: string;
  note?: string;
}) {
  return prisma.reservation.create({
    data: {
      customerName: input.customerName,
      phone: input.phone || null,
      partySize: input.partySize,
      date: new Date(`${input.date}T00:00:00.000Z`),
      time: input.time,
      tableId: input.tableId || null,
      note: input.note || null,
    },
  });
}

export async function updateReservation(
  id: string,
  data: Partial<{
    customerName: string;
    phone: string | null;
    partySize: number;
    time: string;
    tableId: string | null;
    note: string | null;
  }>
) {
  return prisma.reservation.update({ where: { id }, data });
}

export async function updateReservationStatus(id: string, status: string) {
  return prisma.reservation.update({ where: { id }, data: { status } });
}

export async function deleteReservation(id: string) {
  return prisma.reservation.delete({ where: { id } });
}
