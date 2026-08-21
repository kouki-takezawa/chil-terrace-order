import { listShiftMembers } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { addShiftMemberAction, renameShiftMemberAction, deleteShiftMemberAction } from "../actions";

export default async function ShiftMembersSettingsPage(props: PageProps<"/staff/settings/shift-members">) {
  const { error } = await props.searchParams;
  const members = await listShiftMembers();

  return (
    <div className="max-w-lg">
      <ErrorBanner error={typeof error === "string" ? error : undefined} />
      <p className="mb-4 text-sm text-muted">
        シフト表に表示するメンバーです。ログインアカウントとは別の名簿で、システムへのログイン権限は持ちません。
      </p>

      <div className="space-y-2">
        {members.map((member) => (
          <form
            key={member.id}
            action={renameShiftMemberAction}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
          >
            <input type="hidden" name="id" value={member.id} />
            <input
              type="text"
              name="name"
              defaultValue={member.name}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <SubmitButton className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
              保存
            </SubmitButton>
            <ConfirmButton
              confirmText={`「${member.name}」を削除しますか？シフト表からも削除されます。`}
              formAction={deleteShiftMemberAction}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-warning"
            >
              削除
            </ConfirmButton>
          </form>
        ))}
        {members.length === 0 && <p className="text-sm text-muted">メンバーが登録されていません</p>}
      </div>

      <form
        action={addShiftMemberAction}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-4"
      >
        <input
          type="text"
          name="name"
          placeholder="メンバー名"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <SubmitButton pendingText="追加中…" className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          メンバーを追加
        </SubmitButton>
      </form>
    </div>
  );
}
