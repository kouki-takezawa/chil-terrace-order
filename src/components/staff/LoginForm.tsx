"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCredentials, registerStaffAccount } from "@/app/staff/login/actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = mode === "login" ? await signInWithCredentials(email, password) : await registerStaffAccount(email, name, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(searchParams.get("callbackUrl") ?? "/staff/orders");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      {mode === "signup" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">お名前</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">メールアドレス</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">パスワード</label>
        <input
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
        {mode === "signup" && <p className="mt-1 text-xs text-muted">8文字以上</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground disabled:opacity-60"
      >
        {submitting ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
        className="w-full text-center text-xs text-muted underline underline-offset-4"
      >
        {mode === "login" ? "アカウントをお持ちでない方は新規登録" : "すでにアカウントをお持ちの方はログイン"}
      </button>
    </form>
  );
}
