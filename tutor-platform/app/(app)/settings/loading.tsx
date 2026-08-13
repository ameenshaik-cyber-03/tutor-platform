export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-7 w-28 bg-primary/10 rounded mb-6" />
      <div className="grid grid-cols-2 gap-2 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-primary/5 rounded-card" />
        ))}
      </div>
      <div className="h-10 bg-primary/5 rounded-card mb-4" />
      <div className="h-10 bg-primary/5 rounded-card" />
    </div>
  );
}
