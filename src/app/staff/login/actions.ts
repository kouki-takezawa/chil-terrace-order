"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { createStaffAccount } from "@/lib/data";
import { isUniqueConstraintError } from "@/lib/prisma";

export async function signInWithCredentials(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    throw error;
  }
}

export async function registerStaffAccount(email: string, name: string, password: string) {
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください" };
  }
  try {
    await createStaffAccount(email, name, password);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "このメールアドレスは既に登録されています" };
    }
    throw error;
  }
  return signInWithCredentials(email, password);
}
