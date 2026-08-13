"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePreferences(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const preferredPersonaId = formData.get("personaId") as string;
  const theme = formData.get("theme") as string;
  const difficultyDefault = formData.get("difficulty") as string;
  const notificationsEnabled = formData.get("notifications") === "on";
  const voiceEnabled = formData.get("voice") === "on";

  const { error } = await supabase
    .from("user_preferences")
    .update({
      preferred_persona_id: preferredPersonaId || null,
      theme,
      difficulty_default: difficultyDefault,
      notifications_enabled: notificationsEnabled,
      voice_enabled: voiceEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
