# AJEY — Learn. Plan. Remember. Grow.

AJEY is an AI-assisted learning and productivity workspace built with Next.js, TypeScript, Tailwind CSS, Supabase and Vercel. It follows the eight-stage flowchart: sign up/log in, AI onboarding, learn, plan your day, set reminders, daily use, get help and keep growing.

## Included
- Responsive dashboard and navigation
- Interactive task planner with completion tracking
- Learning overview and course progress cards
- Reminder manager and goal-setting interface
- Progress and consistency view
- AI assistant chat UI backed by a server-side API route
- Supabase client foundation and PostgreSQL schema with row-level security
- Environment template and Vercel deployment instructions

## Run locally
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add the Supabase URL and publishable key. Add `GEMINI_API_KEY` to activate AI replies.
5. Run `npm run dev` and visit `http://localhost:3000`.

The dashboard includes demo interactions. Tasks, reminders and goals are currently held in client state; they are not yet persisted across devices. Supabase authentication and persistent CRUD are the next integration stage.

## Supabase
Create a Supabase project, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to local/Vercel environment variables, then run `supabase/schema.sql` in the SQL Editor. The schema enables owner-scoped row-level security for profiles, goals, tasks, reminders, learning progress and notes. Never expose a service-role key in browser code.

## AI
Set `GEMINI_API_KEY` as a server-only environment variable in Vercel and local `.env.local`. It is read only by `src/app/api/assistant/route.ts`; never add a `NEXT_PUBLIC_` prefix or commit the real key. AJEY uses Google's Gemini Developer API.

## Deploy
Import this repository into Vercel, select Next.js, and connect `main` as the production branch. Add the environment variables in Vercel before enabling live integrations.

## Eight product stages
1. Account setup — authentication foundation
2. AI onboarding — goals and preference foundation
3. Learn — courses and progress
4. Plan your day — task planner
5. Reminders — reminder manager
6. Daily use — dashboard and completion tracking
7. Need help? — AI assistant
8. Keep growing — goals and progress

## Next implementation work
- Connect Supabase Auth and persistent, authenticated CRUD
- Build full lesson content, notes and quiz history
- Add time-zone-aware calendar and scheduled reminders
- Add permissioned AI actions for tasks and reminders
- Add email/web-push delivery and analytics/streak history
