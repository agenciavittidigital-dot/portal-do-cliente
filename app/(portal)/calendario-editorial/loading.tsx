export default function CalendarioEditorialLoading() {
  return (
    <div className="space-y-5 max-w-[1200px] animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/[0.04]" />
            <div className="h-7 w-52 bg-vitti-blue/[0.07] rounded-lg" />
          </div>
          <div className="h-4 w-72 bg-black/[0.04] rounded-lg" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-11 w-72 bg-black/[0.04] rounded-xl" />
        <div className="h-11 w-44 bg-black/[0.04] rounded-xl" />
        <div className="h-11 w-44 bg-black/[0.04] rounded-xl" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-6 border-b border-black/[0.07] pb-0">
        <div className="h-4 w-20 bg-black/[0.04] rounded" />
        <div className="h-4 w-28 bg-black/[0.04] rounded" />
      </div>

      {/* Content area skeleton */}
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl h-[520px]" />
    </div>
  );
}
