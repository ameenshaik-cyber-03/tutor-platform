export default function HistoryLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-7 w-32 bg-primary/10 rounded mb-6" />
      <div className="h-3 w-20 bg-primary/10 rounded mb-2" />
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 bg-primary/5 rounded-card" />
        ))}
      </div>
    </div>
  );
}
