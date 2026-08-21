export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "新規注文",
  preparing: "調理中",
  served: "提供済み",
  paid: "会計済み",
  cancelled: "取消",
};
