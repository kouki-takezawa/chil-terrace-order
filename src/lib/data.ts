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

export async function updateSettings(data: { restaurantName?: string; operationMode?: OperationMode }) {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
}

// ---- メニュー -------------------------------------------------------------

// 客側の注文画面用（販売中の商品のみ）
export async function getMenu() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// 設定画面用（販売停止中の商品も含む）
export async function getAllCategoriesWithItems() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });
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

export async function getTables() {
  return prisma.restaurantTable.findMany({ orderBy: { number: "asc" } });
}

export async function createTable(name?: string) {
  const max = await prisma.restaurantTable.aggregate({ _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  return prisma.restaurantTable.create({ data: { number, name: name?.trim() || `卓${number}` } });
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
  items: { menuItemId: string; quantity: number }[];
  note?: string;
}) {
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

  if (settings.operationMode === "number") {
    const dailyNumber = await nextDailyOrderNumber();
    return prisma.order.create({
      data: { mode: "number", dailyNumber, note: input.note, items: { create: itemsCreateData } },
      include: { items: true },
    });
  }

  if (input.tableNumber == null) throw new Error("卓番号が必要です");
  const table = await getTableByNumber(input.tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  const session = await getOrCreateActiveSession(table.id);

  return prisma.order.create({
    data: { mode: "table", tableId: table.id, sessionId: session.id, note: input.note, items: { create: itemsCreateData } },
    include: { items: true },
  });
}

// 客側の注文画面用。「今この卓に紐づいている最新のセッション」を会計済みかどうか
// にかかわらず返す（会計直後は closedAt が入った状態で返る）。これにより客側の
// 画面は「会計が終わったこと」を検知して、それ以上の注文を送れないようロックできる。
// あえて「進行中のセッションだけ」に絞らないのは、絞ってしまうと会計直後に
// 該当セッションが見つからなくなり、客の画面には「注文なし」の空の状態にしか
// 見えず、会計済みであることを伝えられなくなるため。
export async function getTableOrderStatus(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) return null;
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
        table: { id: string; number: number; name: string | null };
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
    { table: { id: string; number: number; name: string | null }; orders: typeof orders }
  >();
  for (const order of orders) {
    if (!order.table) continue;
    const key = order.table.number;
    if (!byTable.has(key)) byTable.set(key, { table: order.table, orders: [] });
    byTable.get(key)!.orders.push(order);
  }
  return { mode: "table", groups: Array.from(byTable.values()).sort((a, b) => a.table.number - b.table.number) };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  return prisma.order.update({ where: { id: orderId }, data: { status } });
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
