-- Run this AFTER database-schema.sql.
-- Fill in real elevenlabs_voice_id values once you've picked voices in the
-- ElevenLabs dashboard — leaving them null is fine for now; voice playback
-- just won't work until they're set.

insert into tutor_personas (name, style_description, gender_presentation, elevenlabs_voice_id, is_active)
values
  ('Nova', 'Energetic, analogy-heavy, great for beginners', 'female', null, true),
  ('Professor Kade', 'Calm, structured, textbook-precise', 'male', null, true),
  ('Ari', 'Socratic — answers your question with a guiding question', 'neutral', null, true),
  ('Master Vin', 'Storytelling-based, ties concepts to history and real events', 'male', null, true),
  ('Zee', 'Fast-paced, exam-cram style, minimal fluff', 'female', null, true);
