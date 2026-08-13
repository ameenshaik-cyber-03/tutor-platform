import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getCachedPersonas } from "@/lib/cached-queries";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const personas = await getCachedPersonas();

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("preferred_persona_id, theme, difficulty_default, notifications_enabled, voice_enabled")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-2xl mb-6">Settings</h1>
      <SettingsForm
        personas={personas}
        preferences={
          preferences ?? {
            preferred_persona_id: null,
            theme: "system",
            difficulty_default: "intermediate",
            notifications_enabled: true,
            voice_enabled: true,
          }
        }
      />
    </div>
  );
}
