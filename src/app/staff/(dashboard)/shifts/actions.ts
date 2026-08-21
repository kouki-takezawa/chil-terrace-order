"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/apiAuth";
import { upsertDayNote } from "@/lib/data";

async function requireAuth() {
  const session = await requireStaffSession();
  if (!session) throw new Error("認証が必要です");
}

export async function saveDayNoteAction(formData: FormData) {
  await requireAuth();
  const date = formData.get("date");
  const note = formData.get("note");
  if (typeof date !== "string" || typeof note !== "string") return;
  await upsertDayNote(date, note.trim().slice(0, 1000));
  revalidatePath("/staff/shifts");
}
