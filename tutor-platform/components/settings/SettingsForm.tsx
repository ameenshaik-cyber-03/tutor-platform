"use client";

import { useState } from "react";
import { updatePreferences } from "@/app/(app)/settings/actions";

interface Persona {
  id: string;
  name: string;
  style_description: string;
}

interface SettingsFormProps {
  personas: Persona[];
  preferences: {
    preferred_persona_id: string | null;
    theme: string;
    difficulty_default: string;
    notifications_enabled: boolean;
    voice_enabled: boolean;
  };
}

export function SettingsForm({ personas, preferences }: SettingsFormProps) {
  const [saved, setSaved] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(
    preferences.preferred_persona_id ?? personas[0]?.id ?? ""
  );

  async function handleSubmit(formData: FormData) {
    setSaved(false);
    const result = await updatePreferences(formData);
    if (result?.success) setSaved(true);
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <div>
        <h2 className="text-sm font-medium mb-3">Tutor persona</h2>
        <div className="grid grid-cols-2 gap-2">
          {personas.map((p) => (
            <label
              key={p.id}
              className={`flex flex-col gap-1 p-3 rounded-card border cursor-pointer text-sm ${
                selectedPersona === p.id ? "border-secondary bg-secondary/5" : "border-primary/10 hover:bg-primary/5"
              }`}
            >
              <input
                type="radio"
                name="personaId"
                value={p.id}
                checked={selectedPersona === p.id}
                onChange={() => setSelectedPersona(p.id)}
                className="sr-only"
              />
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-ink/50">{p.style_description}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Difficulty default</h2>
        <select
          name="difficulty"
          defaultValue={preferences.difficulty_default}
          className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm bg-white"
        >
          <option value="foundational">Foundational — ELI5</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Appearance</h2>
        <select
          name="theme"
          defaultValue={preferences.theme}
          className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm bg-white"
        >
          <option value="system">Match system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="voice" defaultChecked={preferences.voice_enabled} />
          Play tutor voice (ElevenLabs)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifications" defaultChecked={preferences.notifications_enabled} />
          Spaced-repetition reminders
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn-3d text-sm"
        >
          Save changes
        </button>
        {saved && <span className="text-sm text-success">Saved.</span>}
      </div>
    </form>
  );
}
