export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-8 w-56 bg-primary/10 rounded mb-2" />
      <div className="h-4 w-72 bg-primary/10 rounded mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="h-24 bg-primary/5 rounded-card" />
        <div className="h-24 bg-primary/5 rounded-card" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-primary/5 rounded-card" />
        ))}
      </div>
    </div>
  );
}
