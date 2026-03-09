# SRL Learning Tool — Claude Code Prompting Guide V2

## How to Use This Guide

Each session below is a self-contained Claude Code prompt. Copy-paste the **Prompt** section directly into Claude Code. Each session builds on the previous one. Complete the **Quality Gate** before moving to the next session.

**V2 Changes:** Sessions 0-14 cover the original SRL tool (same as V1 with minor refinements). Sessions 15-22 add the adaptive learning features from LearnFlow (mastery engine, templates, testing, grading, hints, dashboard).

**Prerequisites:** Docker Desktop running, PostgreSQL available via Docker Compose, OpenRouter API key, Google Custom Search API key + CX ID, Firebase project configured (Auth + Storage + Hosting).

---

## Pre-Phase: LearnFlow Kernel Setup

### Session -1: Create LearnFlow Python Kernel

**Goal:** Create a dedicated Python virtual environment and Jupyter kernel called "LearnFlow" with all backend dependencies pre-installed. This kernel can be selected in VS Code for running any .ipynb files or manual testing.

**Prompt:**
```
Create a Python virtual environment and Jupyter kernel called "LearnFlow" for the SRL Learning Tool project:

1. Create and activate a virtual environment:
   python3 -m venv .venv/learnflow
   source .venv/learnflow/bin/activate

2. Install all backend dependencies:
   pip install fastapi uvicorn[standard] sqlalchemy alembic asyncpg firebase-admin httpx openai python-dotenv pydantic aiofiles python-multipart PyMuPDF

3. Install Jupyter kernel support + data analysis extras:
   pip install ipykernel pandas matplotlib seaborn scipy

4. Register the kernel for VS Code / Jupyter:
   python -m ipykernel install --user --name learnflow --display-name "LearnFlow"

5. Verify the kernel is available:
   jupyter kernelspec list
   # Should show "learnflow" in the list

6. Create a quick smoke test notebook (notebooks/kernel_test.ipynb):
   - Cell 1: import fastapi, sqlalchemy, openai, firebase_admin, pandas — all should import without error
   - Cell 2: print("LearnFlow kernel ready ✓")

The kernel should now appear as "LearnFlow" in VS Code's kernel picker (top-right of any .ipynb file).
```

**Quality Gate:** `jupyter kernelspec list` shows "learnflow". Opening any .ipynb in VS Code shows "LearnFlow" as a selectable kernel. All imports succeed.

---

## Phase 1: Foundation & Core UI

### Session 0: Project Setup & Repo Structure

**Goal:** Initialize the project with the full directory structure, Docker Compose, and configuration files.

**Prompt:**
```
Read CLAUDE.md for project context.

Set up the SRL Learning Tool project structure:

1. Create the directory structure:
   - backend/ with routers/, services/, engines/, models/, utils/ subdirectories
   - frontend/ with src/components/, src/api/, src/contexts/, src/hooks/, src/types/
   - docs/

2. Create these config files:
   - docker-compose.yml with PostgreSQL 15, backend (FastAPI), frontend (Vite)
   - backend/requirements.txt: fastapi, uvicorn[standard], sqlalchemy, alembic, asyncpg, firebase-admin, httpx, openai, python-dotenv, pydantic, aiofiles, python-multipart, PyMuPDF
     (Note: the openai package is used to call OpenRouter — same SDK, different base_url. firebase-admin replaces python-jose/passlib for auth.)
   - frontend/package.json with React 18, TypeScript, Vite, Tailwind CSS, @dnd-kit/core, @dnd-kit/sortable, axios, recharts, framer-motion, react-resizable-panels, idb (for IndexedDB offline sync), firebase (client SDK)
   - .env.example with: DATABASE_URL, OPENROUTER_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX, FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT (path to service account JSON), VITE_FIREBASE_CONFIG (JSON string with apiKey, authDomain, projectId, storageBucket, etc.)
   - .gitignore (node_modules, __pycache__, .env, *.pyc, dist/, .venv)

3. Initialize backend/main.py with FastAPI app, CORS middleware (allow localhost:5173), and health check endpoint GET /health

4. Initialize frontend with Vite + React + TypeScript template, add Tailwind CSS config

5. Verify docker-compose up starts all 3 services without errors.
```

**Quality Gate:** `docker-compose up` starts PostgreSQL, FastAPI (port 8000), and Vite dev server (port 5173). GET /health returns {"status": "ok"}.

---

### Session 1: Database Models & Alembic Migrations

**Goal:** Define all database models and run initial migration.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Database Schema section).

Set up the database layer:

1. Create backend/models/database.py:
   - SQLAlchemy async engine connected to DATABASE_URL
   - Session factory with async_sessionmaker
   - Base declarative class

2. Create model files for ALL 21 tables (both core and V2 adaptive):
   - backend/models/user.py: users table (firebase_uid VARCHAR(128), NOT password_hash)
   - backend/models/subject.py: subjects table (course/subject grouping)
   - backend/models/topic.py: learning_topics table (with optional subject_id FK)
   - backend/models/topic_document.py: topic_documents table (PDF uploads → Firebase Storage)
   - backend/models/subgoal.py: subgoals table
   - backend/models/session.py: sessions table (with session_state JSONB, status: active/paused/completed/expired)
   - backend/models/event.py: search_events, search_click_events, chat_events, subgoal_events, behavioral_events tables
   - backend/models/assessment.py: assessments table
   - backend/models/reflection.py: reflections table
   - backend/models/curated_quiz.py: curated_quizzes table (expert-uploaded quizzes)
   - backend/models/concept.py: concept_graphs, concept_nodes tables
   - backend/models/mastery.py: mastery_states table
   - backend/models/test_record.py: test_records, question_results tables
   - backend/models/dashboard_state.py: dashboard_states, learner_goals tables

   Use the exact column names, types, and constraints from the Technical Architecture V2.

3. Set up Alembic:
   - alembic init alembic
   - Configure alembic.ini and env.py for async SQLAlchemy
   - Generate and run initial migration

4. Verify all tables exist in PostgreSQL.
```

**Quality Gate:** `alembic upgrade head` creates all 21 tables. Can connect to PostgreSQL and see the schema.

---

### Session 2: Auth & Core API Routes (Firebase Auth)

**Goal:** Implement Firebase Authentication integration and core API routes.

**Prompt:**
```
Read CLAUDE.md. Implement Firebase Auth:

1. backend/utils/config.py: Load all env vars from .env (including FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT path)

2. backend/utils/firebase.py:
   - Initialize firebase_admin with service account credentials
   - Function: verify_firebase_token(id_token: str) → decoded token (uid, email, etc.)

3. backend/routers/auth.py:
   - POST /api/auth/register: {firebase_uid, email, display_name, role} → create user row in PostgreSQL, return user profile
     (Note: actual account creation happens on the frontend via Firebase Client SDK. This endpoint just creates the DB record.)
   - POST /api/auth/login: validate Firebase ID token → return user profile from DB
   - GET /api/auth/me: requires Firebase token → return user profile

4. Create a dependency get_current_user that extracts Firebase ID token from Authorization: Bearer header, verifies via firebase_admin.auth.verify_id_token(), and returns the user from PostgreSQL

5. backend/routers/subjects.py:
   - POST /api/subjects: create subject/course grouping (requires auth)
   - GET /api/subjects: list all subjects (with topic counts)
   - GET /api/subjects/{id}: get subject by ID (with topics)
   - PUT /api/subjects/{id}: update subject
   - DELETE /api/subjects/{id}: delete subject (topics become ungrouped)

6. backend/routers/topics.py:
   - POST /api/topics: create topic (requires auth, optional subject_id)
   - GET /api/topics: list all topics (filterable by subject_id)
   - GET /api/topics/{id}: get topic by ID

7. backend/routers/sessions.py:
   - POST /api/sessions: start session {topic_id} (requires auth)
   - PUT /api/sessions/{id}/end: end session (triggers post-assessment)
   - PUT /api/sessions/{id}/pause: pause active session
   - PUT /api/sessions/{id}/resume: resume paused session
   - GET /api/sessions: list user's sessions
   - GET /api/sessions/{id}: get session details
   - GET /api/sessions/active: get user's active/paused session (for session resume)
   - PUT /api/sessions/{id}/state: save UI state (auto-save every 60s)
   - GET /api/sessions/{id}/export: export session as markdown

8. Register all routers in main.py

9. Test all endpoints with curl (pass Firebase ID token in Authorization header).
```

**Quality Gate:** Can register (with Firebase UID), verify token, create subjects, create topics within subjects, start/pause/resume/end sessions. Unauthenticated requests return 401. Session export returns valid markdown.

---

### Session 3: Google Search Integration

**Goal:** Proxy Google Custom Search API with result logging.

**Prompt:**
```
Read CLAUDE.md. Implement Google Search:

1. backend/services/google_search.py:
   - Function: search(query: str, num_results: int = 10) → list of results
   - Uses httpx to call Google Custom Search JSON API
   - Returns: [{title, link, snippet, position}]
   - Handle errors: rate limits, empty results, API errors

2. backend/routers/search.py:
   - POST /api/search: {query, session_id} → search results
     - Calls google_search service
     - Logs to search_events table (query, results_count, response_time_ms)
     - Returns results
   - POST /api/search/click: {search_event_id, url, title, position}
     - Logs to search_click_events table

3. Test: Search for "binary trees" and verify results come back, event is logged.
```

**Quality Gate:** POST /api/search returns Google results. search_events table has a row. Click logging works.

---

### Session 4: LLM Chat via OpenRouter with SSE Streaming

**Goal:** Implement streaming chat via OpenRouter (unified LLM gateway) with a learning-optimized system prompt.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Chat Service Design section).

Implement streaming chat via OpenRouter:

1. backend/services/llm_client.py:
   - Unified LLM client wrapper using OpenRouter API
   - OpenRouter uses the same OpenAI SDK format — just change base_url:
     client = openai.AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=OPENROUTER_API_KEY)
   - Functions: chat_completion(messages, system_prompt, model="openai/gpt-4o"), stream_completion(...), json_completion(...)
   - json_completion uses response_format for structured output
   - Model parameter allows easy switching between models later

3. backend/utils/prompts.py:
   - build_chat_system_prompt(topic, subgoals, mastery_states=None)
   - Start with the basic version (topic + subgoals only, mastery comes in Session 16)
   - Socratic style: encourage exploration, ask probing questions

4. backend/routers/chat.py:
   - POST /api/chat: {message, session_id, topic_id}
     - Builds system prompt with current topic and subgoals
     - Returns StreamingResponse (SSE)
     - Logs to chat_events (role, content, tokens_used, response_time_ms)
   - GET /api/chat/history/{session_id}: get chat history

5. Test: Send a chat message and verify SSE stream works, tokens stream in real-time.
```

**Quality Gate:** POST /api/chat streams tokens via SSE. Chat history is retrievable. chat_events table logs both user and assistant messages.

---

### Session 5: Subgoal CRUD & AI Generation

**Goal:** Full subgoal management with drag-and-drop reordering support and AI generation.

**Prompt:**
```
Read CLAUDE.md. Implement subgoals:

1. backend/routers/subgoals.py:
   - GET /api/subgoals/{topic_id}: list subgoals ordered by sort_order
   - POST /api/subgoals: create subgoal {topic_id, title, description}
   - PUT /api/subgoals/{id}: update title/description
   - PUT /api/subgoals/{id}/toggle: toggle is_completed
   - PUT /api/subgoals/reorder: {subgoal_ids: [ordered list]} → update sort_order
   - DELETE /api/subgoals/{id}: delete subgoal
   - POST /api/subgoals/generate: {topic_id}
     - Uses GPT to generate 6-8 subgoals for the topic
     - Saves to DB with is_ai_generated=true
     - Returns generated subgoals

2. backend/services/subgoal_generator.py:
   - Prompt GPT with topic title/description
   - Generate 6-8 progressive subgoals (basic → advanced)
   - Return structured list

3. Log every subgoal action to subgoal_events table.

4. Test: Generate subgoals for "Binary Trees", reorder them, check one off. Verify events are logged.
```

**Quality Gate:** All CRUD operations work. AI generates 6-8 relevant subgoals. subgoal_events logs all interactions.

---

### Session 6: Behavioral Logging & Assessments

**Goal:** Event batching endpoint and pre/post session assessments.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Behavioral Event Logger section).

1. backend/routers/logs.py:
   - POST /api/logs/events: {events: [{event_type, event_data, created_at}]}
     - Batch insert into behavioral_events table
     - Validate event_type against allowed types
   - POST /api/logs/panel-focus: {panel, duration_ms, session_id}
     - Shorthand for panel_focus event

2. backend/routers/assessments.py:
   - POST /api/assessments: {session_id, assessment_type: "pre"|"post"}
     - Uses GPT to generate 3-5 assessment questions about the topic
     - Returns assessment with questions
   - PUT /api/assessments/{id}: {answers}
     - Stores answers, auto-grades MCQ questions
     - Returns score
   - GET /api/assessments/{session_id}: get assessments for session

3. backend/routers/reflections.py:
   - POST /api/reflections: {session_id, reflection_text, confidence_rating, difficulty_rating}
   - GET /api/reflections/{session_id}: get reflections for session

4. Test: Create assessment, submit answers, verify scoring. Submit reflection, verify stored.
```

**Quality Gate:** Batch event insert works (50 events in one call). Assessment generation, submission, and scoring work. Reflections persist.

---

### Session 7: React Setup & Three-Panel Layout

**Goal:** Build the main UI shell with three resizable panels.

**Prompt:**
```
Read CLAUDE.md. Set up the React frontend:

1. Install dependencies: npm install axios @dnd-kit/core @dnd-kit/sortable recharts framer-motion react-resizable-panels firebase idb

2. src/utils/firebase.ts:
   - Initialize Firebase Client SDK with config from VITE_FIREBASE_CONFIG
   - Export: auth (getAuth), storage (getStorage)
   - Helper: getIdToken() to get current user's Firebase ID token

3. src/api/client.ts:
   - Axios instance with baseURL = VITE_API_URL
   - Request interceptor: get Firebase ID token via getIdToken() and add as Authorization: Bearer header
   - Response interceptor: handle 401 → redirect to login

4. src/contexts/AuthContext.tsx:
   - Provides: user, loading, login(), register(), logout()
   - Uses Firebase onAuthStateChanged listener for auth state
   - On auth state change: sync user profile with backend via POST /api/auth/register or /api/auth/login

5. src/contexts/SessionContext.tsx:
   - Provides: activeSession, startSession(), pauseSession(), resumeSession(), endSession()
   - Tracks current topic, subgoals, session status (active/paused)
   - On mount: check for active/paused session via GET /api/sessions/active → show "Resume Session" modal
   - Auto-save session state every 60s via PUT /api/sessions/{id}/state

6. src/App.tsx:
   - React Router with routes: /login, /register, /learn, /dashboard (V2), /test (V2)
   - Protected routes require auth (Firebase onAuthStateChanged)
   - Topic tab bar at top for multi-topic switching

7. src/components/layout/ThreePanelLayout.tsx:
   - Three columns using react-resizable-panels: SearchPanel | ChatPanel | SubgoalPanel
   - Panels are resizable, collapsible, with layout persisted in localStorage
   - Minimum width: 200px per panel
   - Dark theme: slate-900 background, slate-800 panels, white text, frosted glass cards (backdrop-blur)
   - Header bar with: topic name, session timer, Pause/Resume/Finish Studying buttons, context usage indicator (placeholder)

8. Apply Tailwind dark theme globally. Use shadcn/ui components where possible. Add Framer Motion layout animations on panel resize.

9. Verify the three-panel layout renders correctly at 1280px+ width. Panels should resize smoothly.
```

**Quality Gate:** Login/register works. Three-panel layout renders with dark theme. Can navigate between routes.

---

### Session 8: Search Panel Component

**Goal:** Build the search interface with results display and click tracking.

**Prompt:**
```
Read CLAUDE.md. Build the SearchPanel:

1. src/components/search/SearchPanel.tsx:
   - Search input at top (magnifying glass icon, submit on Enter)
   - Results list below (scrollable)
   - Loading spinner during search
   - "No results" message for empty results

2. src/components/search/SearchInput.tsx:
   - Text input with placeholder "Search the web..."
   - Submit button
   - Calls POST /api/search

3. src/components/search/SearchResult.tsx:
   - Displays: title (clickable link), URL (truncated), snippet
   - Click opens URL in new tab
   - Click also calls POST /api/search/click to log

4. src/api/search.ts:
   - search(query, sessionId): POST /api/search
   - logSearchClick(searchEventId, url, title, position): POST /api/search/click

5. Style: Dark card backgrounds, blue links, gray snippets. Match Google-result feel but in dark theme.

6. Test: Search for something, see results, click one — verify click event is logged.
```

**Quality Gate:** Search works, results display, clicks open in new tab and are logged.

---

### Session 9: Chat Panel with Streaming

**Goal:** Build the chat interface with SSE streaming display.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (SSE Streaming Pattern section).

Build the ChatPanel:

1. src/hooks/useSSE.ts:
   - Custom hook for consuming SSE streams
   - Handles: connection, content accumulation, done signal, errors
   - Returns: {content, isStreaming, start}

2. src/components/chat/ChatPanel.tsx:
   - Message list (scrollable, auto-scroll to bottom)
   - Input at bottom
   - Shows streaming indicator while GPT is responding

3. src/components/chat/ChatMessage.tsx:
   - Displays user messages (right-aligned, blue bg) and assistant messages (left-aligned, slate-700 bg)
   - Renders markdown in assistant messages (use a lightweight markdown renderer)
   - For template responses (V2): detect ```template``` blocks and render with TemplateRouter (placeholder for now — just show "Visual template" badge)

4. src/components/chat/ChatInput.tsx:
   - Text input with send button
   - Shift+Enter for newline, Enter to send
   - Disabled while streaming

5. src/api/chat.ts:
   - sendMessage(message, sessionId, topicId): SSE fetch to POST /api/chat
   - getChatHistory(sessionId): GET /api/chat/history/{session_id}

6. Test: Send a message, see tokens stream in real-time, see full message after streaming completes.
```

**Quality Gate:** Chat messages stream in real-time. Both user and assistant messages display correctly. Auto-scrolls to new messages. Template blocks show placeholder badge.

---

### Session 10: Subgoal Manager with Drag-and-Drop

**Goal:** Build the interactive subgoal panel with drag-and-drop reordering.

**Prompt:**
```
Read CLAUDE.md. Build the SubgoalPanel:

1. src/components/subgoals/SubgoalPanel.tsx:
   - Header: "Subgoals" with count (e.g., "3/8 completed")
   - "Generate Subgoals" button (calls AI generation endpoint)
   - "Add Subgoal" button (manual creation)
   - Sortable list of SubgoalItems using @dnd-kit/sortable

2. src/components/subgoals/SubgoalItem.tsx:
   - Drag handle (grip icon on left)
   - Checkbox (toggle completion)
   - Title (editable on double-click)
   - Delete button (trash icon, appears on hover)
   - Completed items: strikethrough text, muted color
   - Shows mastery % badge next to title (placeholder — will connect in Session 17)

3. src/components/subgoals/SubgoalGenerator.tsx:
   - Button that calls POST /api/subgoals/generate
   - Shows loading spinner during generation
   - Confirms before replacing existing subgoals

4. src/api/subgoals.ts:
   - All CRUD operations matching the API spec
   - generateSubgoals(topicId): POST /api/subgoals/generate
   - reorderSubgoals(subgoalIds): PUT /api/subgoals/reorder

5. Log every interaction (create, edit, reorder, check, uncheck, delete) via LoggingContext.

6. Test: Generate subgoals, drag to reorder, check off, edit title, delete one. Verify all events logged.
```

**Quality Gate:** Drag-and-drop reordering works smoothly. All CRUD operations persist to backend. Events are logged for every interaction.

---

### Session 11: Session Lifecycle — Assessments & Reflections

**Goal:** Complete the session flow: start → pre-assessment → learn → post-assessment → reflection → end.

**Prompt:**
```
Read CLAUDE.md. Build the session lifecycle:

1. src/components/session/SessionStart.tsx:
   - Topic selection dropdown
   - "Start Session" button
   - Calls POST /api/sessions

2. src/components/session/AssessmentModal.tsx:
   - Modal overlay with quiz questions
   - Supports MCQ (radio buttons) and short answer (text input)
   - "Submit" button → grades and shows score
   - Used for both pre and post assessments

3. src/components/session/ReflectionModal.tsx:
   - Free text area: "What did you learn today?"
   - Confidence slider (1-5): "How confident are you in what you learned?"
   - Difficulty slider (1-5): "How difficult was today's session?"
   - "Submit" button

4. Wire the full flow in SessionContext:
   - startSession(topicId):
     → POST /api/sessions → show pre-assessment modal → on submit → show ThreePanelLayout
   - endSession():
     → show post-assessment modal → on submit → show reflection modal → on submit → PUT /sessions/{id}/end → navigate to session summary

5. Test the complete flow end-to-end.
```

**Quality Gate:** Full session lifecycle works: start → assess → learn → assess → reflect → end. All data persists to database.

---

### Session 12: Event Logger Integration & Panel Focus Tracking

**Goal:** Wire up the frontend event logging system and panel focus tracking.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Behavioral Event Logger section).

1. src/contexts/LoggingContext.tsx:
   - Implements the EventBatcher class from the architecture doc
   - Batches events and flushes every 30s or at 50 events
   - Flushes on session end (component unmount)
   - Provides: logEvent(type, data) function to all children

2. src/hooks/useEventLogger.ts:
   - Convenience hook that wraps LoggingContext
   - useEventLogger() → { logEvent }

3. Wire event logging into existing components:
   - SearchPanel: log search_query on submit
   - SearchResult: log search_click on click
   - ChatInput: log chat_message on send
   - SubgoalItem: log all subgoal interactions

4. Implement panel focus tracking:
   - Track which panel has focus (mouse enter / click)
   - Log panel_focus events with duration_ms when focus changes
   - Use IntersectionObserver or mouse events

5. Verify: Do a full session, end it, then check behavioral_events table — every action should be logged.
```

**Quality Gate:** All events are batched and flushed to the database. Panel focus tracking records time spent on each panel. No events are lost.

---

### Session 13: Research Admin Dashboard & Data Export

**Goal:** Build the admin panel for researchers.

**Prompt:**
```
Read CLAUDE.md.

1. backend/routers/admin.py:
   - GET /api/admin/participants: list all users with session counts, last active
   - GET /api/admin/sessions: list all sessions with filters (user_id, topic_id, date range)
   - GET /api/admin/events: query events with filters (event_type, user_id, session_id)
   - GET /api/admin/export/csv: export all data as CSV (sessions, events, assessments, reflections)
   - GET /api/admin/metrics: aggregate metrics (search-to-chat ratio, subgoal completion rate, avg session duration)
   - All admin routes require role='researcher' or role='admin'

2. Frontend admin page (simple — a table with filters):
   - Participant list with expandable session details
   - Session event timeline (chronological list of events)
   - CSV download button
   - Basic metric cards (total sessions, avg duration, search/chat ratio)

3. Test: Create some test data via the UI, then view it in the admin dashboard and export CSV.
```

**Quality Gate:** Admin dashboard shows participants, sessions, events. CSV export downloads successfully with all data. Role-based access control works.

---

### Session 14: Integration Testing & Polish

**Goal:** End-to-end testing and UI polish.

**Prompt:**
```
Read CLAUDE.md.

Run a full integration test:

1. Register a new user
2. Create a topic: "Binary Trees"
3. Start a session → complete pre-assessment
4. Search for "binary tree traversal" → click 2 results
5. Chat: "What is the difference between BFS and DFS?"
6. Generate AI subgoals → reorder them → check off 2
7. Chat: "Explain in-order traversal step by step"
8. End session → complete post-assessment → submit reflection

Verify:
- All API calls succeed (no 500 errors)
- Chat streaming works without interruption
- Drag-and-drop is smooth
- All events are in the database (check behavioral_events count)
- Admin dashboard shows the session with correct metrics

Fix any bugs found. Then polish:
- Add loading spinners to all async operations
- Add error toasts for failed API calls
- Ensure consistent dark theme across all components
- Add keyboard shortcuts: Enter to search/send, Esc to close modals
- Test at 1280px, 1440px, and 1920px widths
```

**Quality Gate:** Zero errors in the full flow. UI is polished, responsive (1280px+), and consistent. All events logged correctly.

---

## Phase 2: Adaptive Learning Engine (V2 Sessions)

### Session 15: Concept Extraction Engine

**Goal:** Build the concept graph extraction service.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Concept Extractor section).

1. backend/engines/concept_extractor.py:
   - Function: extract_concept_graph(topic_title: str, topic_description: str) → ConceptGraph
   - Uses the GPT prompt from the architecture doc
   - Parses JSON response into ConceptGraph + ConceptNode models
   - Generates 8-15 concept nodes with keys, descriptions, difficulty, prerequisites, sort_order

2. backend/routers/concepts.py:
   - POST /api/concepts/{topic_id}/generate: calls concept_extractor, saves to DB
   - GET /api/concepts/{topic_id}: returns concept graph JSON
   - GET /api/concepts/{topic_id}/nodes: returns flat list of concept nodes

3. Update the subgoal generation to align with concept nodes:
   - Each subgoal can optionally link to a concept_node_key
   - AI-generated subgoals reference the concept graph

4. Test: Generate a concept graph for "Binary Trees". Verify 8-15 nodes with proper prerequisites and difficulty ratings. Verify nodes are stored in PostgreSQL.
```

**Quality Gate:** Concept graph generates correctly. Prerequisites form a valid DAG (no cycles). Nodes are retrievable via API.

---

### Session 16: Mastery Engine & Recommendations

**Goal:** Implement the mastery scoring system and recommendation engine.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Mastery Engine and Recommendation Engine sections).

1. backend/engines/mastery_engine.py:
   - Implement update_mastery() with the exact EWA (Exponentially Weighted Average) algorithm from the architecture doc
   - Function: process_question_result(user_id, concept_node_id, is_correct, difficulty) → updated mastery
   - Writes to mastery_states table (upsert — create if not exists, update if exists)
   - Increments attempts_count and correct_count

2. backend/engines/recommendation_engine.py:
   - Implement get_focus_weights() with cubic power law from the architecture doc
   - Function: get_recommendations(user_id, topic_id) → sorted list of concept recommendations
   - Returns: [{concept_key, concept_name, mastery, focus_weight}]

3. backend/routers/mastery.py:
   - GET /api/mastery/{topic_id}: get all mastery states for user's concepts in this topic
   - POST /api/mastery/update: update mastery after a test question {concept_node_id, is_correct, difficulty}
   - PUT /api/mastery/override: manual override {concept_node_id, new_mastery}

4. Update the chat system prompt builder to include mastery states:
   - Adapt explanation depth based on mastery level (from the architecture doc)

5. Test:
   - Start at 0.0 mastery, answer easy question correctly → mastery should be ~0.3
   - Answer hard question correctly at 0.9 mastery → gain should be tiny (~0.08)
   - Verify recommendations rank weakest concepts first
```

**Quality Gate:** Mastery engine math is correct (test with specific inputs/outputs). Recommendations sort correctly. Chat prompt adapts to mastery levels.

---

### Session 17: Visual Template System (3 Templates)

**Goal:** Build the template router and 3 visual learning templates.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Visual Template System section).

1. Shared UI building blocks (src/components/ui/):
   - StepNavigator.tsx: prev/next buttons with step counter and progress bar
   - DataTable.tsx: sortable table with row highlighting (highlight_rows, highlight_color)
   - CodeBlock.tsx: syntax-highlighted code display with line highlighting (use a simple highlight, no heavy library)
   - Badge.tsx: colored status badges (difficulty, mastery level)
   - MasteryBar.tsx: horizontal progress bar colored by mastery (red/yellow/green)
   - NodeBubble.tsx: circular node for knowledge map (colored by mastery, shows name on hover)

2. src/components/templates/TemplateRouter.tsx:
   - Receives JSON data from chat response
   - Inspects "template" field → routes to the correct component
   - Falls back to plain text if template field is missing

3. src/components/templates/SolutionWalkthrough.tsx:
   - Step-by-step problem solving (model after binary_tree_walkthrough.jsx)
   - Uses StepNavigator for navigation
   - Each step shows: title, explanation, optional DataTable, optional CodeBlock
   - Final step shows the complete answer
   - Dark gradient theme, monospace font for code

4. src/components/templates/ConceptComparison.tsx:
   - Side-by-side concept cards (2-4 concepts)
   - Each card: name, definition, properties table, key insight callout
   - Highlighted properties draw attention to key differences

5. src/components/templates/KnowledgeMap.tsx:
   - Interactive concept graph
   - NodeBubble components positioned by x/y coordinates
   - Edges drawn as SVG lines between related nodes
   - Nodes colored by mastery (red/yellow/green)
   - Click a node to see its details in a tooltip

6. Update ChatMessage.tsx:
   - Detect ```template``` blocks in assistant messages
   - Parse JSON and pass to TemplateRouter
   - Show inline within the chat flow

7. Test: Ask GPT to explain "balanced vs full binary trees" → should render ConceptComparison. Ask for a walkthrough → should render SolutionWalkthrough. View knowledge map for a topic with mastery data.
```

**Quality Gate:** All 3 templates render correctly from JSON data. Step navigation works in SolutionWalkthrough. KnowledgeMap shows mastery-colored nodes. Templates display inline in chat.

---

### Session 18: Test Generation & Grading

**Goal:** Build the test generation, test-taking, and dual-mode grading system.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Test Engine and Grading Engine sections).

1. backend/engines/test_engine.py:
   - Function: generate_test(topic_id, user_id, num_questions=5, grading_mode="informal")
   - Fetches concept nodes + mastery states
   - Uses GPT prompt from architecture doc
   - Returns structured question list (MCQ + subjective, tagged with concept_keys)
   - Stores in test_records and question_results tables

2. backend/engines/grading_engine.py:
   - Function: grade_answer(question, user_answer, grading_mode)
   - Uses the informal or formal prompt from architecture doc
   - Returns: {score, max_score, rubric, feedback, sources}
   - Function: grade_test(test_record_id, answers)
   - Grades each question, updates total_score
   - Calls mastery_engine.process_question_result for each question

3. backend/routers/tests.py:
   - POST /api/tests/generate: {topic_id, num_questions, grading_mode}
   - POST /api/tests/{id}/grade: {answers: [{question_id, answer}]}
   - GET /api/tests/{id}: get test with results
   - GET /api/tests/history/{topic_id}: test history

4. Frontend:
   - src/components/testing/TestGenerator.tsx: config form (# questions, mode toggle)
   - src/components/testing/TestTaker.tsx: display questions one at a time, MCQ radio buttons, text areas
   - src/components/testing/GradingResult.tsx: score display, expandable rubric cards, feedback, source citations

5. Test: Generate a 5-question test, answer all questions, grade in both modes. Verify mastery updates after grading. Verify rubric differences between formal/informal.
```

**Quality Gate:** Test generation produces relevant questions. Grading returns rubrics and scores. Informal mode is lenient, formal mode is strict. Mastery states update after grading.

---

### Session 19: Thought-Bubble Hints

**Goal:** Build the progressive hint system with SSE streaming.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Hint Engine section).

1. backend/engines/hint_engine.py:
   - Function: generate_hint(question_text, concept_name, concept_description, ideal_answer, level)
   - Uses level-specific prompts from architecture doc (nudge / concept / steps)
   - Returns hint text via SSE stream

2. backend/routers/hints.py:
   - POST /api/hints: {question_id, concept_key, level}
   - Returns SSE stream (same pattern as chat)
   - Tracks hint level per question (starts at 1, increments on each request)

3. src/components/testing/ThoughtBubble.tsx:
   - Floating popover component (appears above or beside the question)
   - Comic-book thought cloud styling: rounded bubble with small circles trailing down
   - Background: semi-transparent dark with slight blur
   - "Need a hint?" button → Level 1 streams in
   - "More help" button → Level 2
   - "Show me" button → Level 3
   - Each level replaces the previous hint content
   - Close button to dismiss

4. Integrate ThoughtBubble into TestTaker:
   - Available during test-taking
   - Button next to each question
   - Hint usage logged as behavioral event: {type: "hint_request", question_id, hint_level, concept_key}

5. Test: During a test, request hints at all 3 levels. Verify Level 1 is vague, Level 2 explains the concept, Level 3 gives the answer. Verify hint events are logged.
```

**Quality Gate:** Hints stream via SSE. ThoughtBubble renders with comic-book styling. Progressive escalation works (1→2→3). Hint usage is tracked.

---

### Session 20: SRL Dashboard — Mastery Heatmap & Goal Editor

**Goal:** Build the first half of the self-regulated learning dashboard.

**Prompt:**
```
Read CLAUDE.md and Technical_Architecture_V2.md (Dashboard section).

1. backend/routers/dashboard.py:
   - GET /api/dashboard/{topic_id}: returns mastery snapshot, goals, study plan
   - PUT /api/dashboard/{topic_id}: save dashboard edits
   - GET /api/dashboard/{topic_id}/goals: list learner goals
   - POST /api/dashboard/{topic_id}/goals: create/update goals
   - DELETE /api/dashboard/goals/{id}: delete a goal

2. src/components/dashboard/DashboardPage.tsx:
   - Full-width page layout (replaces three-panel view when navigated to)
   - 2x2 grid of dashboard panels
   - Header: topic name, mastery summary ("67% mastered, 12 concepts")
   - Navigation back to learning interface

3. src/components/dashboard/MasteryHeatmap.tsx:
   - Grid: rows = concept categories, columns = subtopics
   - Each cell colored by mastery (red/yellow/green)
   - Click a cell → view concept details + mastery history
   - Click + hold → manual mastery override (slider appears)
   - Override triggers: PUT /api/mastery/override + behavioral event

4. src/components/dashboard/GoalEditor.tsx:
   - List of learning goals (user-created + AI-suggested)
   - Each goal: concept name, target mastery %, deadline, priority
   - Add new goal button → select concept, set target/deadline/priority
   - Edit existing goals inline
   - Delete goal button
   - AI-suggested goals shown with a sparkle icon, can be accepted or dismissed

5. Wire to MasteryContext so dashboard updates live when mastery changes.

6. Test: View dashboard for a topic with some mastery data. Edit a goal. Override a mastery score. Verify all changes persist to DB and events are logged.
```

**Quality Gate:** Heatmap displays all concepts with correct colors. Goals are editable and persist. Manual mastery override works and is logged.

---

### Session 21: SRL Dashboard — Progress Charts & Weakness Panel

**Goal:** Build the second half of the dashboard with progress tracking and recommendations.

**Prompt:**
```
Read CLAUDE.md.

1. src/components/dashboard/ProgressChart.tsx:
   - Line chart (using recharts) showing mastery % over time
   - One line per concept category (or top 5 concepts)
   - X-axis: dates of test/interaction events
   - Y-axis: mastery percentage (0-100%)
   - Hover to see exact values
   - Time range selector: 7 days, 30 days, all time

2. src/components/dashboard/WeaknessPanel.tsx:
   - Ranked list of weakest concepts (from recommendation engine)
   - Each row: concept name, mastery bar, focus weight indicator
   - "Study Now" button → navigates to chat with topic pre-loaded and asks GPT to explain the concept
   - "Take Quiz" button → generates a mini-test (3 questions) on just that concept

3. Add "Generate Study Plan" button to DashboardPage:
   - POST /api/dashboard/{topic_id}/study-plan
   - GPT generates a prioritized study plan based on mastery + goals
   - Rendered as a checklist with recommended concepts and estimated time

4. Wire the adaptive cycle end-to-end:
   - Take test → mastery updates → dashboard refreshes → recommendations change
   - User edits goals → recommendations adjust
   - User overrides mastery → recommendations adjust

5. Test the full adaptive cycle: take a test (get some wrong), check dashboard (weaknesses should be top), study a weak concept, take another test, verify mastery improved and recommendations shifted.
```

**Quality Gate:** Progress chart shows mastery over time with multiple data points. Weakness panel correctly ranks by focus weight. Study plan generates. Full adaptive cycle works end-to-end.

---

### Session 22: Final Integration & V2 Polish

**Goal:** Connect all V2 features, ensure consistency, and polish.

**Prompt:**
```
Read CLAUDE.md.

Final integration pass:

1. Navigation:
   - Add sidebar with navigation: Learn (three-panel) | Test | Dashboard
   - "Learn" is the default three-panel view
   - "Test" shows TestGenerator page
   - "Dashboard" shows DashboardPage
   - Current mastery summary shown in sidebar

2. Cross-feature integration:
   - SubgoalPanel: show mastery % badge next to each subgoal (if linked to concept)
   - ChatPanel: mastery-aware responses (GPT adapts depth based on mastery)
   - After each test: auto-show dashboard with updated results
   - ThoughtBubble available in both test and chat contexts

3. Template polish:
   - Smooth transitions between steps in SolutionWalkthrough
   - Hover effects on KnowledgeMap nodes
   - Responsive layout for templates within chat panel width

4. Update admin dashboard to include V2 metrics:
   - Mastery progression per participant
   - Test scores over time
   - Hint escalation patterns
   - Goal completion rates
   - Add these to the CSV export

5. End-to-end test:
   - Register → Create topic → Generate concept graph
   - Start session → Pre-assessment
   - Search + Chat + Subgoals (with mastery-aware chat)
   - Ask for a concept explanation → template renders in chat
   - Take a test → get hints → grade (both modes)
   - View dashboard → edit goals → override mastery
   - Generate study plan → study weakest concept → re-test
   - End session → Post-assessment → Reflection
   - Admin views all data

6. Fix any remaining bugs. Polish loading states, error handling, transitions.
```

**Quality Gate:** All features work together seamlessly. Navigation is intuitive. Templates render in chat. Mastery flows through the entire system. Admin can see all V2 data. No crashes or 500 errors.

---

## Phase 3: Production Deployment

### Session 23: Deploy to Railway.app

**Goal:** Deploy the complete application as a production product that others can use.

**Prompt:**
```
Read CLAUDE.md.

Deploy the SRL Learning Tool to Railway.app:

1. Pre-deployment checklist:
   - Ensure all environment variables are in .env.example
   - Verify docker-compose.yml works locally
   - Run full integration test (Session 22 quality gate)
   - Set DEBUG=False in backend config
   - Add CORS origin for the production domain

2. Railway.app setup:
   - Create Railway project
   - Connect GitHub repo (Markkkx/Subgoal-Manager-Learning-Tool)
   - Railway auto-detects Docker Compose
   - Configure 3 services: PostgreSQL, backend, frontend

3. Environment variables (set in Railway dashboard):
   - DATABASE_URL (auto-configured by Railway for PostgreSQL)
   - OPENROUTER_API_KEY (from openrouter.ai)
   - GOOGLE_SEARCH_API_KEY
   - GOOGLE_SEARCH_CX
   - FIREBASE_PROJECT_ID
   - FIREBASE_SERVICE_ACCOUNT (base64 encoded service account JSON, or mount as file)
   - VITE_API_URL (set to Railway backend URL)
   - VITE_FIREBASE_CONFIG (JSON string with Firebase client config)

4. Database migration:
   - Run `alembic upgrade head` on the Railway backend service
   - Verify all 21 tables are created

5. Post-deployment verification:
   - Test: register, login, start session, search, chat, subgoals, test, dashboard
   - Verify SSE streaming works in production
   - Verify all events are logged
   - Check API response times (<2s for non-LLM endpoints)

6. Optional: Configure custom domain via Railway settings

7. Create seed data for demo: 2-3 topics with concept graphs
```

**Quality Gate:** Application is live at a Railway.app URL. All features work in production. SSE streaming is stable. Database persists between deployments. Can share URL with others for testing.

---

## Quick Reference: Session Map

| Session | Phase | Focus | New Files |
|---------|-------|-------|-----------|
| -1 | Setup | LearnFlow kernel + venv | .venv/learnflow, notebooks/kernel_test.ipynb |
| 0 | Setup | Project structure + Docker | docker-compose.yml, configs |
| 1 | Setup | Database models (all 21 tables) | models/*.py, alembic/ |
| 2 | Backend | Auth (Firebase) + Subjects + Topics + Sessions | utils/firebase.py, routers/auth.py, subjects.py, topics.py, sessions.py |
| 3 | Backend | Google Search proxy | services/google_search.py, routers/search.py |
| 4 | Backend | LLM Chat via OpenRouter + SSE streaming | services/llm_client.py, routers/chat.py |
| 5 | Backend | Subgoal CRUD + AI generation | routers/subgoals.py, services/subgoal_generator.py |
| 6 | Backend | Event logging + Assessments | routers/logs.py, assessments.py, reflections.py |
| 7 | Frontend | React + Firebase Auth + Resizable three-panel layout | App.tsx, ThreePanelLayout.tsx, contexts/, utils/firebase.ts |
| 8 | Frontend | Search panel | SearchPanel.tsx, SearchInput.tsx, SearchResult.tsx |
| 9 | Frontend | Chat panel + SSE | ChatPanel.tsx, ChatMessage.tsx, useSSE.ts |
| 10 | Frontend | Subgoal panel + drag-and-drop | SubgoalPanel.tsx, SubgoalItem.tsx |
| 11 | Frontend | Session lifecycle (Pause/Resume/Finish + modals) | SessionStart.tsx, AssessmentModal.tsx, ReflectionModal.tsx |
| 12 | Frontend | Event logger + panel tracking + offline sync | LoggingContext.tsx, useEventLogger.ts, offlineSync.ts |
| 13 | Admin | Research dashboard + CSV export | routers/admin.py, admin page |
| 14 | Polish | Integration testing | Bug fixes, polish |
| **15** | **V2** | **Concept extraction engine** | **engines/concept_extractor.py, routers/concepts.py** |
| **16** | **V2** | **Mastery engine + recommendations** | **engines/mastery_engine.py, recommendation_engine.py** |
| **17** | **V2** | **Visual templates (3 of 6)** | **templates/*.tsx, ui/*.tsx** |
| **18** | **V2** | **Test generation + grading** | **engines/test_engine.py, grading_engine.py** |
| **19** | **V2** | **Thought-bubble hints** | **engines/hint_engine.py, ThoughtBubble.tsx** |
| **20** | **V2** | **Dashboard: Heatmap + Goals** | **DashboardPage.tsx, MasteryHeatmap.tsx, GoalEditor.tsx** |
| **21** | **V2** | **Dashboard: Progress + Weakness + Context Indicator** | **ProgressChart.tsx, WeaknessPanel.tsx, ContextMeter.tsx** |
| **22** | **V2** | **Final integration + polish** | **Navigation, cross-feature wiring, WCAG pass** |
| **23** | **Deploy** | **Production deployment + backup setup** | **Railway.app config, Firebase hosting, backup cron** |
