export function PhoneFrame({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="relative rounded-[44px] border-[10px] border-[#1c1c1a] bg-[#1c1c1a] shadow-xl">
        <div className="absolute top-0 left-1/2 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-[#1c1c1a]" />
        <div className="h-[720px] w-[360px] overflow-hidden rounded-[34px] bg-white">
          <iframe src={src} title={label} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}

export function TabletFrame({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="relative w-full max-w-[960px] rounded-[28px] border-[12px] border-[#1c1c1a] bg-[#1c1c1a] shadow-xl">
        <div className="absolute top-1/2 left-1 z-10 h-2 w-2 -translate-y-1/2 rounded-full bg-[#3a3a36]" />
        <div className="h-[680px] w-full overflow-hidden rounded-[16px] bg-white">
          <iframe src={src} title={label} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
