export default function Loading() {
  return (
    <div className="space-y-6 p-4 pt-12">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          {[0, 1, 2, 3].map((j) => <div key={j} className="h-48 w-32 animate-pulse rounded-2xl bg-ink-700" />)}
        </div>
      ))}
    </div>
  );
}
