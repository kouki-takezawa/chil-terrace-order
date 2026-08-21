"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/apiAuth";
import { createReservation, updateReservation, updateReservationStatus, deleteReservation } from "@/lib/data";

async function requireAuth() {
  const session = await requireStaffSession();
  if (!session) throw new Error("認証が必要です");
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function runOrRedirectWithError(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "処理に失敗しました";
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
}

export async function addReservationAction(formData: FormData) {
  await requireAuth();
  const date = str(formData, "date");
  const customerName = str(formData, "customerName");
  const phone = str(formData, "phone");
  const partySize = Number(str(formData, "partySize"));
  const time = str(formData, "time");
  const tableId = str(formData, "tableId");
  const note = str(formData, "note");
  if (!date || !customerName || !time || !Number.isFinite(partySize) || partySize < 1) {
    redirect(`/staff/reservations?date=${date}&error=${encodeURIComponent("名前・人数・時刻を入力してください")}`);
  }
  await runOrRedirectWithError(`/staff/reservations?date=${date}`, () =>
    createReservation({
      customerName,
      phone: phone || undefined,
      partySize,
      date,
      time,
      tableId: tableId || undefined,
      note: note || undefined,
    })
  );
  revalidatePath("/staff/reservations");
}

export async function updateReservationAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const customerName = str(formData, "customerName");
  const phone = str(formData, "phone");
  const partySize = Number(str(formData, "partySize"));
  const time = str(formData, "time");
  const tableId = str(formData, "tableId");
  const note = str(formData, "note");
  if (!id || !customerName || !time || !Number.isFinite(partySize) || partySize < 1) return;
  await updateReservation(id, {
    customerName,
    phone: phone || null,
    partySize,
    time,
    tableId: tableId || null,
    note: note || null,
  });
  revalidatePath("/staff/reservations");
}

export async function updateReservationStatusAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;
  await updateReservationStatus(id, status);
  revalidatePath("/staff/reservations");
}

export async function deleteReservationAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "id");
  if (!id) return;
  await deleteReservation(id);
  revalidatePath("/staff/reservations");
}
