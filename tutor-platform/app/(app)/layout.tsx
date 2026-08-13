import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name, email").eq("id", user.id).single()
    : { data: null };

  const { data: recentSessions } = user
    ? await supabase
        .from("sessions")
        .select("id, title, started_at, concept_map_id")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const grouped: Record<string, { id: string; title: string }[]> = {};
  for (const s of recentSessions ?? []) {
    const label = dateLabel(s.started_at);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push({ id: s.concept_map_id ?? s.id, title: s.title ?? "Untitled session" });
  }
  const historyGroups = Object.entries(grouped).map(([label, sessions]) => ({ label, sessions }));

  return (
    <div className="flex">
      <Sidebar historyGroups={historyGroups} />
      <div className="flex-1 flex flex-col min-h-screen">
        <Navbar displayName={profile?.display_name ?? profile?.email ?? "Account"} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
