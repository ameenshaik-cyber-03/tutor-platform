export default function LearnSessionLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] animate-pulse">
      <div className="flex-1 px-6 py-6 space-y-4">
        <div className="h-16 w-2/3 bg-primary/5 rounded-card" />
        <div className="h-16 w-1/2 bg-primary/5 rounded-card" />
        <div className="h-16 w-2/3 bg-primary/5 rounded-card ml-auto" />
      </div>
      <div className="w-80 border-l border-primary/10 p-5 space-y-2">
        <div className="h-4 w-24 bg-primary/10 rounded mb-3" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 bg-primary/5 rounded-md" />
        ))}
      </div>
    </div>
  );
}
