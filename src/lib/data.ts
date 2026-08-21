import "server-only";
import { prisma } from "./prisma";
import { getTodayRangeJST, isLunchHour } from "./date";
import type { Order, OrderItem } from "@prisma/client";

export const ACTIVE_STATUSES = ["pending", "preparing", "served"] as const;
export type OrderStatus = "pending" | "preparing" | "served" | "paid" | "cancelled";

type OrderWithItems = Order & { items: OrderItem[] };

export function orderTotal(order: OrderWithItems): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ---- メニュー -------------------------------------------------------------

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

// ---- 客側: 注文 -----------------------------------------------------------

export async function getTableByNumber(number: number) {
  return prisma.restaurantTable.findUnique({ where: { number } });
}

export async function getTables() {
  return prisma.restaurantTable.findMany({ orderBy: { number: "asc" } });
}

async function getOrCreateActiveSession(tableId: string) {
  const existing = await prisma.tableSession.findFirst({
    where: { tableId, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.tableSession.create({ data: { tableId } });
}

export async function createOrder(
  tableNumber: number,
  items: { menuItemId: string; quantity: number }[],
  note?: string
) {
  const table = await getTableByNumber(tableNumber);
  if (!table) throw new Error("卓が見つかりません");
  if (items.length === 0) throw new Error("注文する商品がありません");

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, isAvailable: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  const session = await getOrCreateActiveSession(table.id);

  return prisma.order.create({
    data: {
      tableId: table.id,
      sessionId: session.id,
      note,
      items: {
        create: items.map(({ menuItemId, quantity }) => {
          const menuItem = menuItemById.get(menuItemId);
          if (!menuItem) throw new Error("商品が見つかりません");
          if (quantity < 1) throw new Error("数量が不正です");
          return { menuItemId, name: menuItem.name, price: menuItem.price, quantity };
        }),
      },
    },
    include: { items: true },
  });
}

export async function getActiveSessionOrdersForTable(tableNumber: number) {
  const table = await getTableByNumber(tableNumber);
  if (!table) return [];
  const session = await prisma.tableSession.findFirst({
    where: { tableId: table.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return [];
  return prisma.order.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

// ---- 店舗側: 注文管理 --------------------------------------------------------

export async function getKitchenOrders() {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "asc" },
    include: { items: true, table: true },
  });

  const byTable = new Map<number, { table: { id: string; number: number; name: string | null }; orders: typeof orders }>();
  for (const order of orders) {
    const key = order.table.number;
    if (!byTable.has(key)) {
      byTable.set(key, { table: order.table, orders: [] });
    }
    byTable.get(key)!.orders.push(order);
  }
  return Array.from(byTable.values()).sort((a, b) => a.table.number - b.table.number);
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
    prisma.tableSession.update({ where: { id: session.id }, data: { closedAt: new Date() } }),
  ]);
}

// ---- 店舗側: 売上ダッシュボード ---------------------------------------------

export async function getDashboardSummary() {
  const { start, end } = getTodayRangeJST();

  const [orders, closedSessions] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { items: true },
    }),
    prisma.tableSession.count({
      where: { closedAt: { gte: start, lt: end } },
    }),
  ]);

  let confirmedSales = 0;
  let pendingEstimate = 0;
  let cancelledCount = 0;
  let orderCount = 0;

  const hourly = new Map<number, { lunch: number; dinner: number }>();

  for (const order of orders) {
    const total = orderTotal(order);
    if (order.status === "cancelled") {
      cancelledCount++;
      continue;
    }
    orderCount++;
    if (order.status === "paid") {
      confirmedSales += total;
    } else {
      pendingEstimate += total;
    }

    const jstHour = new Date(order.createdAt.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
    const bucket = hourly.get(jstHour) ?? { lunch: 0, dinner: 0 };
    if (isLunchHour(order.createdAt)) bucket.lunch += total;
    else bucket.dinner += total;
    hourly.set(jstHour, bucket);
  }

  const totalToday = confirmedSales + pendingEstimate;
  const avgOrderValue = orderCount > 0 ? Math.round(totalToday / orderCount) : 0;

  const hourlyBreakdown = Array.from(hourly.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({ hour, ...v }));

  const lunchTotal = hourlyBreakdown.reduce((s, h) => s + h.lunch, 0);
  const dinnerTotal = hourlyBreakdown.reduce((s, h) => s + h.dinner, 0);

  return {
    totalToday,
    confirmedSales,
    pendingEstimate,
    orderCount,
    avgOrderValue,
    checkoutTableCount: closedSessions,
    cancelledCount,
    hourlyBreakdown,
    lunchTotal,
    dinnerTotal,
  };
}
