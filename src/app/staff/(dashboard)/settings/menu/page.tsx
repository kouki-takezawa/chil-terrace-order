import { getAllCategoriesWithItems } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import {
  addCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  addMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
} from "../actions";

export default async function MenuSettingsPage(props: PageProps<"/staff/settings/menu">) {
  const { error } = await props.searchParams;
  const categories = await getAllCategoriesWithItems();

  return (
    <div>
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <form action={renameCategoryAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={category.id} />
                <input
                  type="text"
                  name="name"
                  defaultValue={category.name}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-bold text-foreground"
                />
                <button type="submit" className="text-xs text-muted underline underline-offset-4">
                  名前を保存
                </button>
              </form>
              <form action={deleteCategoryAction} className="ml-auto">
                <input type="hidden" name="id" value={category.id} />
                <ConfirmButton confirmText={`「${category.name}」を削除しますか？`} className="text-xs text-red-600 underline underline-offset-4">
                  カテゴリーを削除
                </ConfirmButton>
              </form>
            </div>

            <div className="space-y-3">
              {category.menuItems.map((item) => (
                <form
                  key={item.id}
                  action={updateMenuItemAction}
                  className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_100px_1fr_auto_auto_auto_auto]"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="text"
                    name="name"
                    defaultValue={item.name}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <input
                    type="number"
                    name="price"
                    defaultValue={item.price}
                    min={0}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <input
                    type="text"
                    name="description"
                    defaultValue={item.description ?? ""}
                    placeholder="説明（任意）"
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" name="isRecommended" defaultChecked={item.isRecommended} />
                    おすすめ
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} />
                    販売中
                  </label>
                  <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                    保存
                  </button>
                  <ConfirmButton
                    confirmText={`「${item.name}」を削除しますか？`}
                    formAction={deleteMenuItemAction}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-red-600"
                  >
                    削除
                  </ConfirmButton>
                </form>
              ))}
              {category.menuItems.length === 0 && <p className="text-xs text-muted">商品がありません</p>}
            </div>

            <form action={addMenuItemAction} className="mt-3 grid grid-cols-1 items-center gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_100px_1fr_auto_auto]">
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                type="text"
                name="name"
                placeholder="商品名"
                required
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <input
                type="number"
                name="price"
                placeholder="価格"
                min={0}
                required
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <input
                type="text"
                name="description"
                placeholder="説明（任意）"
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="isRecommended" />
                おすすめ
              </label>
              <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                商品を追加
              </button>
            </form>
          </div>
        ))}
      </div>

      <form action={addCategoryAction} className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-4">
        <input
          type="text"
          name="name"
          placeholder="新しいカテゴリー名（例：デザート）"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <button type="submit" className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          カテゴリーを追加
        </button>
      </form>
    </div>
  );
}
