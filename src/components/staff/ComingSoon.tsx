export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">{title}</h1>
      <p className="mb-6 text-sm text-muted">{description}</p>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm font-medium text-foreground">近日公開予定です</p>
        <p className="mt-1 text-xs text-muted">このページは今後のアップデートで実装予定です</p>
      </div>
    </div>
  );
}
