-- ============================================================================
-- DATABASE SCHEMA — Adaptive Tutor + Career Prep Platform
-- Target: PostgreSQL via Supabase (uses built-in auth.users table)
-- ============================================================================
-- Section map:
--   1. Profiles & Preferences
--   2. Tutor Personas
--   3. Projects (folder grouping, like Claude's "Projects")
--   4. Concept Maps & Nodes (the core engine's data)
--   5. Sessions & Messages (chat history)
--   6. Checkpoint Attempts (gap-detection results)
--   7. Uploaded Documents (RAG source files)
--   8. Career Prep: Resumes
--   9. Career Prep: Mock Interviews
--  10. Readiness Dashboard (aggregated snapshots)
--  11. Row Level Security
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES & PREFERENCES
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  preferred_persona_id uuid,               -- fk added after tutor_personas exists
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  voice_enabled boolean not null default true,
  difficulty_default text not null default 'intermediate'
    check (difficulty_default in ('foundational', 'intermediate', 'advanced')),
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. TUTOR PERSONAS  (seed data, not user-owned)
-- ============================================================================

create table tutor_personas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                      -- "Nova", "Professor Kade", etc.
  style_description text not null,
  gender_presentation text,                -- "female" | "male" | "neutral"
  elevenlabs_voice_id text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table user_preferences
  add constraint fk_preferred_persona
  foreign key (preferred_persona_id) references tutor_personas(id) on delete set null;

-- ============================================================================
-- 3. PROJECTS  (folder grouping — e.g. "Data Structures", "GATE CS Prep")
-- ============================================================================

create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_user on projects(user_id);

-- ============================================================================
-- 4. CONCEPT MAPS & NODES  (core engine data — see core-engine-design.md)
-- ============================================================================

create table concept_maps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  mode text not null check (mode in ('learn', 'prep')),
  root_topic text not null,
  role_context text,                       -- prep mode only, e.g. "SDE-1, Product-based"
  company_tier text,                       -- prep mode only
  source_document_id uuid,                 -- fk added after uploaded_documents exists
  raw_json jsonb not null,                 -- full generated concept map, source of truth
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_concept_maps_user on concept_maps(user_id);
create index idx_concept_maps_project on concept_maps(project_id);

create table concept_nodes (
  id uuid primary key default uuid_generate_v4(),
  concept_map_id uuid not null references concept_maps(id) on delete cascade,
  slug text not null,                      -- short id used inside the JSON graph, e.g. "bst-insertion"
  title text not null,
  parent_id uuid references concept_nodes(id) on delete set null,
  summary text not null,
  difficulty text not null check (difficulty in ('foundational', 'intermediate', 'advanced')),
  depends_on text[] not null default '{}',  -- array of sibling slugs, resolved at query time
  -- Explicit ordinal from the LLM's generation order (which reflects
  -- dependency order per the prompt). Nodes in one concept map are always
  -- inserted in a single batch, so they share an identical created_at —
  -- ordering by timestamp alone is NOT reliable here; always order by
  -- `position` when teaching sequence matters.
  position int not null default 0,
  node_type text default 'concept'
    check (node_type in ('concept', 'dsa', 'mcq', 'hr', 'aptitude', 'core_subject')),
  status text not null default 'untouched'
    check (status in ('untouched', 'weak', 'mastered')),
  last_assessed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_concept_nodes_map on concept_nodes(concept_map_id, position);
create index idx_concept_nodes_parent on concept_nodes(parent_id);
create unique index uq_concept_nodes_slug on concept_nodes(concept_map_id, slug);

-- ============================================================================
-- 5. SESSIONS & MESSAGES  (chat history — powers the History sidebar)
-- ============================================================================

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept_map_id uuid references concept_maps(id) on delete set null,
  persona_id uuid references tutor_personas(id) on delete set null,
  session_type text not null check (session_type in ('learn', 'prep')),
  title text,                              -- auto-generated summary title for the sidebar
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index idx_sessions_user on sessions(user_id, started_at desc);
create index idx_sessions_concept_map on sessions(concept_map_id);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  node_id uuid references concept_nodes(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  message_type text check (
    message_type in ('explanation', 'question', 'answer', 'reteach', 'general')
  ),
  content text not null,
  audio_url text,                          -- if voice message / TTS playback stored
  created_at timestamptz not null default now()
);

create index idx_messages_session on messages(session_id, created_at);

-- ============================================================================
-- 6. CHECKPOINT ATTEMPTS  (gap-detection results — Prompt 4 output)
-- ============================================================================

create table checkpoint_attempts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  node_id uuid not null references concept_nodes(id) on delete cascade,
  user_answer text not null,
  covered_correctly jsonb not null default '[]',
  missing jsonb not null default '[]',
  misunderstood jsonb not null default '[]',
  overall_status text not null check (overall_status in ('mastered', 'weak', 'not_understood')),
  encouraging_summary text,
  created_at timestamptz not null default now()
);

create index idx_checkpoint_node on checkpoint_attempts(node_id, created_at desc);

-- ============================================================================
-- 7. UPLOADED DOCUMENTS  (RAG source files — notes, PDFs, syllabi)
-- ============================================================================

create table uploaded_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,                 -- "pdf" | "docx" | "txt" etc.
  extracted_topic text,                    -- LLM-inferred topic, used to seed a concept map
  vector_namespace text,                   -- pointer to the vector-store collection for this doc
  created_at timestamptz not null default now()
);

alter table concept_maps
  add constraint fk_source_document
  foreign key (source_document_id) references uploaded_documents(id) on delete set null;

create index idx_documents_user on uploaded_documents(user_id);

-- ============================================================================
-- 8. CAREER PREP: RESUMES
-- ============================================================================

create table resumes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_url text not null,
  target_role text,
  created_at timestamptz not null default now()
);

create table resume_feedback (
  id uuid primary key default uuid_generate_v4(),
  resume_id uuid not null references resumes(id) on delete cascade,
  ats_score integer check (ats_score between 0 and 100),
  strengths jsonb not null default '[]',
  suggestions jsonb not null default '[]',   -- [{ section, issue, suggestion }]
  missing_keywords jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index idx_resume_feedback_resume on resume_feedback(resume_id);

-- ============================================================================
-- 9. CAREER PREP: MOCK INTERVIEWS
-- ============================================================================

create table mock_interviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept_map_id uuid references concept_maps(id) on delete set null,  -- role-based map
  interview_type text not null check (interview_type in ('hr', 'technical', 'aptitude')),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  overall_score integer check (overall_score between 0 and 100),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index idx_mock_interviews_user on mock_interviews(user_id, started_at desc);

create table mock_interview_questions (
  id uuid primary key default uuid_generate_v4(),
  mock_interview_id uuid not null references mock_interviews(id) on delete cascade,
  node_id uuid references concept_nodes(id) on delete set null,
  question_type text not null check (question_type in ('open', 'coding', 'mcq')),
  question_text text not null,
  options jsonb,                            -- for mcq
  correct_option text,                      -- for mcq
  user_answer text,
  evaluation jsonb,                         -- gap-detection style breakdown
  score integer check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index idx_mock_questions_interview on mock_interview_questions(mock_interview_id);

-- ============================================================================
-- 10. READINESS DASHBOARD  (aggregated snapshots, computed periodically)
-- ============================================================================

create table readiness_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  area text not null,                       -- "dsa" | "aptitude" | "hr" | "core_subject" | topic slug
  score integer not null check (score between 0 and 100),
  computed_at timestamptz not null default now()
);

create index idx_readiness_user_area on readiness_snapshots(user_id, area, computed_at desc);

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================
-- Every user-owned table: users can only read/write their own rows.
-- tutor_personas is public read-only (seed data), no RLS needed beyond that.

alter table profiles enable row level security;
alter table user_preferences enable row level security;
alter table projects enable row level security;
alter table concept_maps enable row level security;
alter table concept_nodes enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;
alter table checkpoint_attempts enable row level security;
alter table uploaded_documents enable row level security;
alter table resumes enable row level security;
alter table resume_feedback enable row level security;
alter table mock_interviews enable row level security;
alter table mock_interview_questions enable row level security;
alter table readiness_snapshots enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

create policy "Users manage own preferences" on user_preferences
  for all using (auth.uid() = user_id);

create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id);

create policy "Users manage own concept maps" on concept_maps
  for all using (auth.uid() = user_id);

-- concept_nodes has no direct user_id — scope through its parent concept_map
create policy "Users manage nodes via concept map" on concept_nodes
  for all using (
    exists (
      select 1 from concept_maps
      where concept_maps.id = concept_nodes.concept_map_id
      and concept_maps.user_id = auth.uid()
    )
  );

create policy "Users manage own sessions" on sessions
  for all using (auth.uid() = user_id);

create policy "Users manage messages via session" on messages
  for all using (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users manage checkpoints via node" on checkpoint_attempts
  for all using (
    exists (
      select 1 from sessions
      where sessions.id = checkpoint_attempts.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users manage own documents" on uploaded_documents
  for all using (auth.uid() = user_id);

create policy "Users manage own resumes" on resumes
  for all using (auth.uid() = user_id);

create policy "Users manage feedback via resume" on resume_feedback
  for all using (
    exists (
      select 1 from resumes
      where resumes.id = resume_feedback.resume_id
      and resumes.user_id = auth.uid()
    )
  );

create policy "Users manage own mock interviews" on mock_interviews
  for all using (auth.uid() = user_id);

create policy "Users manage questions via interview" on mock_interview_questions
  for all using (
    exists (
      select 1 from mock_interviews
      where mock_interviews.id = mock_interview_questions.mock_interview_id
      and mock_interviews.user_id = auth.uid()
    )
  );

create policy "Users manage own readiness snapshots" on readiness_snapshots
  for all using (auth.uid() = user_id);

-- tutor_personas: public read access, no write policy (managed via admin/service role)
alter table tutor_personas enable row level security;
create policy "Anyone can read active personas" on tutor_personas
  for select using (is_active = true);
