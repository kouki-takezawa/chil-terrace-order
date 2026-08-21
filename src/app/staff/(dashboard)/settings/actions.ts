"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/apiAuth";
import { isUniqueConstraintError } from "@/lib/prisma";
import {
  updateSettings,
  createCategory,
  renameCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createTable,
  renameTable,
  deleteTable,
  createStaffAccount,
  deleteStaffAccount,
  resetStaffPassword,
  createShiftMember,
  renameShiftMember,
  deleteShiftMember,
  type OperationMode,
} from "@/lib/data";

async function requireAuth() {
  const session = await requireStaffSession();
  if (!session) throw new Error("認証が必要です");
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** ドメインエラーを ?error= 付きリダイレクトに変換して、フォームの画面に友好的な
 *  メッセージで表示できるようにする（例外を投げっぱなしにしてerror.tsxに
 *  落とさないようにするため）。 */
async function runOrRedirectWithError(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "処理に失敗しました";
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
}

// ---- 一般設定 ---------------------------------------------------------------

export async function updateGeneralSettingsAction(formData: FormData) {
  await requireAuth();
  const restaurantName = str(formData, "restaurantName");
  const operationMode = str(formData, "operationMode") as OperationMode;
  await updateSettings({
    restaurantName: restaurantName || undefined,
    operationMode: operationMode === "number" ? "number" : "table",
  });
  revalidatePath("/staff", "layout");
}

// ---- メニュー -----------------------------------------------------------------

export async function addCategoryAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  if (!name) return;
  await createCategory(name);
  revalidatePath("/staff/settings/menu");
}

export async function renameCategoryAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await renameCategory(id, name);
  revalidatePath("/staff/settings/menu");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/menu", () => deleteCategory(id));
  revalidatePath("/staff/settings/menu");
}

export async function addMenuItemAction(formData: FormData) {
  await requireAuth();
  const categoryId = str(formData, "categoryId");
  const name = str(formData, "name");
  const price = Number(str(formData, "price"));
  const description = str(formData, "description");
  const isRecommended = formData.get("isRecommended") === "on";
  if (!categoryId || !name || !Number.isFinite(price) || price < 0) return;
  await createMenuItem({ categoryId, name, price, description: description || undefined, isRecommended });
  revalidatePath("/staff/settings/menu");
}

export async function updateMenuItemAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const price = Number(str(formData, "price"));
  const description = str(formData, "description");
  const isRecommended = formData.get("isRecommended") === "on";
  const isAvailable = formData.get("isAvailable") === "on";
  if (!id || !name || !Number.isFinite(price) || price < 0) return;
  await updateMenuItem(id, { name, price, description: description || null, isRecommended, isAvailable });
  revalidatePath("/staff/settings/menu");
}

export async function deleteMenuItemAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/menu", () => deleteMenuItem(id));
  revalidatePath("/staff/settings/menu");
}

// ---- テーブル -----------------------------------------------------------------

export async function addTableAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  await createTable(name || undefined);
  revalidatePath("/staff/settings/tables");
  revalidatePath("/staff/settings/qr");
}

export async function renameTableAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await renameTable(id, name);
  revalidatePath("/staff/settings/tables");
  revalidatePath("/staff/settings/qr");
}

export async function deleteTableAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/tables", () => deleteTable(id));
  revalidatePath("/staff/settings/tables");
  revalidatePath("/staff/settings/qr");
}

// ---- アカウント ---------------------------------------------------------------

export async function addAccountAction(formData: FormData) {
  await requireAuth();
  const email = str(formData, "email");
  const name = str(formData, "name");
  const password = str(formData, "password");
  if (!email || !name || password.length < 8) {
    redirect("/staff/settings/accounts?error=" + encodeURIComponent("メール・名前・8文字以上のパスワードを入力してください"));
  }
  await runOrRedirectWithError("/staff/settings/accounts", async () => {
    try {
      await createStaffAccount(email, name, password);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new Error("このメールアドレスは既に使われています");
      throw error;
    }
  });
  revalidatePath("/staff/settings/accounts");
}

export async function deleteAccountAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/accounts", () => deleteStaffAccount(id));
  revalidatePath("/staff/settings/accounts");
}

export async function resetPasswordAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const password = str(formData, "password");
  if (!id || password.length < 8) {
    redirect("/staff/settings/accounts?error=" + encodeURIComponent("パスワードは8文字以上にしてください"));
  }
  await resetStaffPassword(id, password);
  revalidatePath("/staff/settings/accounts");
}

// ---- シフトメンバー -------------------------------------------------------------

export async function addShiftMemberAction(formData: FormData) {
  await requireAuth();
  const name = str(formData, "name");
  if (!name) return;
  await createShiftMember(name);
  revalidatePath("/staff/settings/shift-members");
  revalidatePath("/staff/shifts");
}

export async function renameShiftMemberAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;
  await renameShiftMember(id, name);
  revalidatePath("/staff/settings/shift-members");
  revalidatePath("/staff/shifts");
}

export async function deleteShiftMemberAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await runOrRedirectWithError("/staff/settings/shift-members", () => deleteShiftMember(id));
  revalidatePath("/staff/settings/shift-members");
  revalidatePath("/staff/shifts");
}
