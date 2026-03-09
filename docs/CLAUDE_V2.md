# CLAUDE.md — SRL Learning Tool & Subgoal Manager (V2)

## Project Context
Self-Regulated Learning tool for UIUC research (Prof. Jessie Chin's lab). Dual search interface (Google + GPT chat) with interactive Subgoal Manager, adaptive mastery engine, visual learning templates, transparent grading, and SRL dashboard.

## Team
- Harsha (Harshvardhan Sekar) — project lead, design, docs
- Mark (GitHub: Markkkx) — development partner
- Repo: https://github.com/Markkkx/Subgoal-Manager-Learning-Tool

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + Framer Motion + shadcn/ui
- Backend: FastAPI (Python)
- Database: PostgreSQL + SQLAlchemy + Alembic
- LLM: OpenRouter API → GPT-4o default (Claude Sonnet for JSX generation)
- Search: Google Custom Search API
- Auth: Firebase Authentication (Email/Password + Google Sign-In)
- File Storage: Firebase Storage (PDF uploads, backups)
- Frontend Hosting: Firebase Hosting (CDN)
- Backend Hosting: Railway.app ($5/mo) — FastAPI + PostgreSQL
- Backup: Railway daily snapshots + 6-hourly pg_dump to Firebase Storage

## Architecture Decisions
- Three-panel UI: Search | Chat | Subgoals (always visible during learning)
- Session-based: every interaction happens within a learning session with pre/post assessments
- Event-sourced: every user action logged to behavioral_events for research
- Template system: GPT generates JSON data, pre-built React components render (not raw JSX)
- Mastery engine: EWA scoring with time decay (ewa = α × performance + (1-α) × decayed_mastery, α=0.2, 30-day half-life)
- Recommendations: cubic power law (focusWeight = (1 - mastery)³ + EPSILON)
- Dual grading: formal (academic precision) + informal (concept-focused)
- Progressive hints: 3 levels (nudge → concept → steps) via SSE streaming
- Dashboard: Apple Widget aesthetic, mastery heatmap/rings, goal editor, progress charts, weakness panel — customizable drag-and-drop layout
- Session resume: full state restoration on return (chat, subgoals, panel positions, scroll state)
- Citation system: mandatory source links in all chat responses and grading feedback
- Grading rubric fallback: GPT confidence < 0.7 → re-grade with uploaded rubric
- Expert quiz hosting: researchers upload pre-made quizzes alongside AI-generated tests
- JSX generation (stretch): sandpack-react sandbox with auto-fallback to templates
- Offline sync: IndexedDB local event queue, auto-replays on reconnect
- Context usage indicator: token meter in header (green/yellow/orange/red), auto-summarize old messages at 90%
- Data retention: 6 months, participant deletion on request
- WCAG 2.1 AA accessibility: shadcn/ui + Radix primitives, color-blind-safe mastery patterns
- Session model: explicit Pause/Resume/Finish Studying — no auto-idle detection
- Panels: resizable + collapsible (react-resizable-panels), layout persisted

## Coding Standards
- Backend: Python 3.11+, type hints on all functions, Pydantic models for request/response
- Frontend: TypeScript strict mode, functional components with hooks
- API: RESTful, all routes under /api/, Firebase Auth token verification on protected routes
- Events: batch insert (flush every 30s or 50 events)
- Errors: return proper HTTP status codes, log errors server-side

## Event Types (behavioral_events)
search_query, search_click, chat_message, subgoal_create, subgoal_edit, subgoal_reorder, subgoal_check, subgoal_uncheck, panel_focus (duration_ms per panel), template_view, test_start, test_submit, hint_request, mastery_override, goal_create, goal_edit, dashboard_view

## Database Tables (21 total)
Core (14): users, subjects, learning_topics, topic_documents, subgoals, sessions (with session_state JSONB), search_events, search_click_events, chat_events, subgoal_events, behavioral_events, assessments, reflections, curated_quizzes
V2 (7): concept_graphs, concept_nodes, mastery_states, test_records, question_results, dashboard_states, learner_goals

## Key Files
- docs/Project_Roadmap_V2.md — full roadmap with phases and day-by-day tasks
- docs/Technical_Architecture_V2.md — DB schema, API spec, engine designs, template system
- docs/Claude_Code_Prompting_Guide_V2.md — 23 session-by-session build prompts

## Design Language
Dark theme: slate-900 backgrounds, slate-800/60 frosted glass panels (backdrop-blur-xl), white text, rounded-2xl cards, subtle borders. Dashboard: Apple Widget aesthetic with Framer Motion animations, activity ring mastery indicators, drag-and-drop customizable layout. Mastery colors: red (#EF4444) = 0-33%, yellow (#F59E0B) = 34-66%, green (#10B981) = 67-100%.
