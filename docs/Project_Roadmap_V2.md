# Self-Regulated Learning Tool & Subgoal Manager — Project Roadmap V2

## Executive Summary

**Objective:** Build a research-grade Self-Regulated Learning (SRL) tool that integrates web search and conversational AI search within a unified interface, scaffolded by an interactive Subgoal Manager, enhanced with an adaptive mastery engine, visual learning templates, transparent grading, and a self-regulated learning dashboard — to study how users coordinate multiple search modalities for long-term learning tasks.

**Timeline:** Flexible — quality over speed, target a working prototype for pilot study

**Research Context:** This tool supports a user study at UIUC (Prof. Jessie Chin's lab) exploring how learners use web search vs. conversational search to achieve learning objectives across 3-4 week sessions, with 6-8 subgoals per learning topic.

**What Changed in V2:** This roadmap merges the original SRL research tool (V1) with the best features from the LearnFlow HackIllinois prototype — specifically the mastery engine, visual learning templates, transparent grading with dual modes, on-demand test generation, thought-bubble hints, and a self-regulated learning dashboard. Features were triaged for feasibility given reduced compute constraints (single LLM provider, no external memory services).

**Key Research Questions the Tool Must Support:**
1. How do learners distribute their effort between web search and chat-based search?
2. Does subgoal scaffolding improve learning outcomes in exploratory information-seeking tasks?
3. What behavioral patterns (click frequency, query volume, time-on-task) predict learning success?
4. Does the "desirable difficulty" principle hold — do users who engage more deeply retain more?
5. **(New)** Does mastery-based adaptive testing improve self-regulated learning outcomes?
6. **(New)** Do visual walkthroughs improve concept comprehension compared to text-only explanations?

**Three Core Deliverables:**
1. **Learning Environment Prototype** (Weeks 1-4): React + FastAPI web app with dual search interface, interactive Subgoal Manager, mastery engine, visual templates, session-based assessments, and full behavioral logging
2. **Adaptive Learning Features** (Weeks 5-6): On-demand test generation, transparent grading (formal/informal), thought-bubble hints, and SRL dashboard with adaptive goals
3. **Research Dashboard** (Week 7): Admin panel for researchers to view participant data, export logs, and analyze behavioral metrics across study sessions

---

## Foundational Research (From the Two Papers)

### Paper 1: "Search+Chat: Integrating Search and GenAI"

**Key Findings That Shape Our Design:**
- Users who combined web search with chat-based search showed improved learning outcomes compared to using either modality alone
- The integration pattern matters: users tend to start with broad web searches, then use chat for deeper exploration or clarification
- Chat interfaces encourage more reflective, question-driven learning
- Web search provides breadth and source diversity; chat provides depth and synthesis
- Participants valued having both tools available simultaneously (side-by-side or tabbed)

**Design Implications:**
- The dual-interface must be accessible simultaneously, not sequentially
- We should log which interface users turn to first, and when they switch
- The UI should not bias users toward one modality over the other

### Paper 2: "The Enhanced Subgoal Manager"

**Key Findings That Shape Our Design:**
- Subgoal scaffolding helps users organize complex, open-ended learning tasks
- AI-generated subgoals provide useful starting scaffolds, but users benefit from editing them
- The subgoal checklist acts as a metacognitive support — helping users track where they are
- Users who actively managed their subgoals (reordering, editing, checking off) showed better learning outcomes
- The subgoal UI should be persistent and visible, not hidden behind a menu

**Design Implications:**
- Subgoals should be editable, reorderable, and checkable (like Claude Cowork's progress checklist)
- Pre-populated subgoals (AI-generated) give users a starting point
- The Subgoal Manager must be always-visible alongside the search interfaces
- We need to log every subgoal interaction (create, edit, reorder, check, uncheck)

### Prof. Jessie Chin's Meeting Directives

From the meeting transcript (Feb 2025):
- "Right level of cognitive effort is necessary" — align with desirable difficulty principle
- "Integration of search and web search" — dual-interface is core
- "Scaffolding in having this more explorative task" — subgoal manager is essential
- "6-8 different subgoals in each learning objective" — concrete subgoal count
- "3-4 week learning test" — longitudinal study design
- "Small place to submit what they learned + brief assessment" — post-session reflection + quiz
- "Don't need monitoring or control — just need a space people can coordinate tasks on their own" — exploratory phase first
- "Start from having this more explorative face, then build more control" — iterative design

### LearnFlow Adaptive Learning Research (V2 Addition)

From educational research (Bloom's 2-Sigma Problem, Mastery Learning, Self-Regulated Learning theory):
- One-on-one tutoring produces 2σ improvement over classroom instruction (Bloom, 1984) — our LLM chat acts as a 1:1 tutor
- Students learn best when they can see multiple representations of the same concept — visual templates provide this
- Immediate feedback on errors is critical for learning — transparent grading with rubrics
- Self-regulated learners outperform passive learners by 0.7σ — user-customizable dashboard with editable goals
- Mastery-based progression prevents knowledge gaps from compounding — diminishing returns scoring ensures prerequisites are solid

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Frontend** | React (Vite + TypeScript) | Rich interactive UI for multi-panel layout; component reusability |
| **Backend** | FastAPI (Python) | Fast async API, easy to integrate with Google Search & OpenAI APIs |
| **Database** | PostgreSQL | Structured relational data for users, sessions, subgoals, mastery, and interaction logs |
| **ORM** | SQLAlchemy + Alembic | Database migrations, model definitions |
| **LLM Gateway** | OpenRouter API → GPT-4o (default) | Unified access to all models via one API key; start with GPT-4o, add routing later |
| **Web Search** | Google Custom Search API | Real Google search results |
| **State Management** | React Context + useReducer | Lightweight state management for session data |
| **Styling** | Tailwind CSS | Rapid UI development, consistent dark-theme design system |
| **Animation** | Framer Motion | Smooth transitions, Apple-widget-style micro-interactions, panel animations |
| **UI Components** | shadcn/ui | Pre-built accessible components (modals, dropdowns, tooltips, cards) on Tailwind |
| **Auth** | Firebase Authentication | Email/Password + Google Sign-In, free tier (50K MAU), replaces custom JWT |
| **File Storage** | Firebase Storage | PDF uploads for study materials/rubrics, backup dump storage |
| **Frontend Hosting** | Firebase Hosting | Global CDN, free SSL, generous free tier |
| **Backend Hosting** | Railway.app ($5/mo) | FastAPI + PostgreSQL, no timeout limits, full Docker support |
| **Backup** | Railway snapshots + pg_dump → Firebase Storage | Daily auto-snapshots + 6-hourly dumps for disaster recovery |
| **Offline Sync** | IndexedDB (idb library) | Local event queue, auto-replays on reconnect, prevents data loss |

**V2 Decision: OpenRouter as Unified LLM Gateway.** The LearnFlow hackathon used Claude + OpenAI + Gemini with separate API keys. For this project, we route all LLM calls through OpenRouter — a unified API that provides access to 500+ models with a single API key. We default to GPT-4o for all tasks initially, but can easily switch models per task later (e.g., Claude for complex reasoning, GPT-4o-mini for simple classification). OpenRouter adds ~5% cost markup but eliminates multi-provider complexity. This keeps the door open for intelligent model routing without committing to the infrastructure overhead upfront.

**V2 Decision: EWA Mastery Scoring.** The original LearnFlow mastery engine used a diminishing returns formula. Based on research into knowledge tracing algorithms, we've upgraded to Exponentially Weighted Average (EWA) scoring with time decay. PFA (which uses similar time-decay principles) achieves 81% accuracy vs 70% for BKT — and EWA naturally models Ebbinghaus's forgetting curve (exponential decay, not polynomial). The cubic power law for focus recommendations remains unchanged.

---

## Feature Triage: What Made the Cut from LearnFlow

| Feature | Status | Rationale |
|---------|--------|-----------|
| Mastery Engine (EWA scoring with time decay) | **IN — Phase 2** | Core adaptive capability, research-backed, no extra APIs |
| Visual Template System (3 of 6 templates) | **IN — Phase 2** | SolutionWalkthrough, ConceptComparison, KnowledgeMap |
| Transparent Grading + Dual Modes (Formal/Informal) | **IN — Phase 3** | Just LLM prompts, high user value |
| On-Demand Test Generation (objective + subjective) | **IN — Phase 3** | Same — LLM prompts, great for SRL |
| ThoughtBubble Hints (SSE streaming) | **IN — Phase 3** | Reuses existing SSE chat infrastructure |
| SRL Dashboard (Goals, Mastery Heatmap, Progress) | **IN — Phase 3** | Essential for self-regulated learning |
| PDF Concept Graph Ingestion | **IN — Phase 2** | Makes tool domain-agnostic |
| Cubic Power Law Recommendations | **IN — Phase 3** | Lightweight math, drives study plan |
| Multi-Provider LLM (Claude+OpenAI+Gemini) | **OUT** | Stick with OpenAI GPT only — simpler, fewer API keys |
| Supermemory Integration | **OUT** | PostgreSQL handles all persistence — no need for extra service |
| CodeExecutionTrace Template | **DEFER** | Nice but niche, add post-prototype |
| TestResults / FocusRecommendations Templates | **DEFER** | Lower priority visuals, add later |
| Raw JSX Generation (sandpack-react) | **IN — Phase 3 Stretch** | User wants to push boundaries; auto-fallback to templates on failure |
| Expert-Curated Quiz Hosting | **IN — Phase 3** | Professors upload pre-made quizzes for research validity |
| Session Resume (pick up where you left off) | **IN — Phase 1** | Full state restoration on return: chat, subgoals, panel positions |
| Citation/Source Links in Responses | **IN — Phase 2** | Factual accuracy guaranteed via mandatory citations in chat + grading |
| Rubric Upload for Grading Fallback | **IN — Phase 3** | Informal grading falls back to uploaded rubric when GPT confidence < 0.7 |
| Dashboard Customization (drag-and-drop widgets) | **IN — Phase 3** | Apple Widget aesthetic, user-rearrangeable, persisted layout |
| Subject/Course Grouping | **IN — Phase 1** | Subjects table groups topics, home screen groups by subject, dashboard scope selector |
| Offline Sync (IndexedDB event queue) | **IN — Phase 2** | Auto-queues events offline, replays on reconnect, user-facing sync banners |
| Context Usage Indicator (token meter) | **IN — Phase 3** | Green/yellow/orange/red meter in header, auto-summarize old messages at 90% |
| Session Markdown Export | **IN — Phase 1** | Export button downloads .md with chat history, subgoals, mastery snapshot |
| Next.js (from LearnFlow) | **OUT** | Staying with React + Vite (simpler, already committed) |

---

## Project Architecture

```
srl-learning-tool/
├── CLAUDE.md                              # Context file for Claude Code sessions
├── README.md                              # Project overview
├── docker-compose.yml                     # PostgreSQL + backend + frontend
├── .env.example                           # API keys template
├── .gitignore
│
├── backend/
│   ├── main.py                            # FastAPI entry, CORS, lifespan
│   ├── requirements.txt                   # Python dependencies
│   ├── alembic.ini                        # Migration config
│   ├── alembic/                           # Migration scripts
│   ├── routers/
│   │   ├── auth.py                        # POST /register, /login, /me
│   │   ├── topics.py                      # CRUD learning topics
│   │   ├── sessions.py                    # Start/end learning sessions
│   │   ├── search.py                      # POST /search (Google proxy)
│   │   ├── chat.py                        # POST /chat (GPT streaming)
│   │   ├── subgoals.py                    # CRUD + AI generation + reorder
│   │   ├── assessments.py                 # Pre/post session assessments
│   │   ├── reflections.py                 # Post-session reflections
│   │   ├── logs.py                        # Behavioral event ingestion
│   │   ├── admin.py                       # Research dashboard APIs
│   │   ├── concepts.py                    # (V2) GET concept graph for a topic
│   │   ├── mastery.py                     # (V2) POST update, GET state
│   │   ├── tests.py                       # (V2) POST generate, POST grade
│   │   ├── hints.py                       # (V2) POST hint (SSE streaming)
│   │   └── dashboard.py                   # (V2) GET/PUT learner dashboard
│   ├── engines/                           # (V2) Adaptive learning engines
│   │   ├── concept_extractor.py           # Topic → concept graph via LLM
│   │   ├── mastery_engine.py              # EWA scoring with time decay
│   │   ├── recommendation_engine.py       # Cubic power law focus weights
│   │   ├── grading_engine.py              # Dual-mode grading (formal/informal)
│   │   ├── test_engine.py                 # Question generation (MCQ + subjective)
│   │   └── hint_engine.py                 # Progressive 3-level hints
│   ├── services/
│   │   ├── google_search.py               # Google Custom Search wrapper
│   │   ├── openai_chat.py                 # OpenAI GPT with SSE streaming
│   │   ├── subgoal_generator.py           # AI subgoal generation
│   │   └── llm_client.py                  # (V2) Unified OpenAI client
│   ├── models/
│   │   ├── database.py                    # SQLAlchemy engine + session
│   │   ├── user.py                        # User model
│   │   ├── topic.py                       # LearningTopic model
│   │   ├── session.py                     # LearningSession model
│   │   ├── subgoal.py                     # Subgoal model
│   │   ├── event.py                       # BehavioralEvent model
│   │   ├── assessment.py                  # Assessment model
│   │   ├── reflection.py                  # Reflection model
│   │   ├── concept.py                     # (V2) ConceptGraph, ConceptNode models
│   │   ├── mastery.py                     # (V2) MasteryState model
│   │   ├── test_record.py                 # (V2) TestRecord, QuestionResult models
│   │   └── dashboard_state.py             # (V2) DashboardState, LearnerGoal models
│   └── utils/
│       ├── prompts.py                     # All system prompt templates
│       └── config.py                      # Environment config
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx                       # Entry point
│       ├── App.tsx                        # Router + layout
│       ├── api/                           # API client functions
│       │   ├── client.ts                  # Axios instance + interceptors
│       │   ├── auth.ts                    # Auth API calls
│       │   ├── search.ts                  # Search API calls
│       │   ├── chat.ts                    # Chat API (SSE)
│       │   ├── subgoals.ts               # Subgoal API calls
│       │   ├── sessions.ts               # Session lifecycle
│       │   ├── mastery.ts                # (V2) Mastery API calls
│       │   ├── tests.ts                  # (V2) Test generation/grading
│       │   └── dashboard.ts              # (V2) Dashboard API calls
│       ├── contexts/
│       │   ├── AuthContext.tsx            # Firebase Auth state
│       │   ├── SessionContext.tsx         # Active session state
│       │   ├── LoggingContext.tsx         # Event capture
│       │   └── MasteryContext.tsx         # (V2) Mastery state
│       ├── components/
│       │   ├── layout/
│       │   │   ├── ThreePanelLayout.tsx   # Search | Chat | Subgoals
│       │   │   ├── Header.tsx             # Nav bar with session controls
│       │   │   └── Sidebar.tsx            # (V2) Nav: Learn | Test | Dashboard
│       │   ├── search/
│       │   │   ├── SearchPanel.tsx        # Search input + results
│       │   │   ├── SearchInput.tsx        # Query input with submit
│       │   │   └── SearchResult.tsx       # Individual result card
│       │   ├── chat/
│       │   │   ├── ChatPanel.tsx          # Chat interface
│       │   │   ├── ChatMessage.tsx        # Single message bubble
│       │   │   └── ChatInput.tsx          # Message input with send
│       │   ├── subgoals/
│       │   │   ├── SubgoalPanel.tsx       # Subgoal list + controls
│       │   │   ├── SubgoalItem.tsx        # Single subgoal (edit/check/drag)
│       │   │   └── SubgoalGenerator.tsx   # AI generate button
│       │   ├── session/
│       │   │   ├── SessionStart.tsx       # Topic selection + start
│       │   │   ├── AssessmentModal.tsx    # Pre/post quiz
│       │   │   └── ReflectionModal.tsx    # Post-session reflection
│       │   ├── templates/                 # (V2) Visual learning templates
│       │   │   ├── TemplateRouter.tsx     # Routes JSON to correct template
│       │   │   ├── SolutionWalkthrough.tsx # Step-by-step problem solving
│       │   │   ├── ConceptComparison.tsx  # Side-by-side concept compare
│       │   │   └── KnowledgeMap.tsx       # Interactive mastery graph
│       │   ├── testing/                   # (V2) Test-taking interface
│       │   │   ├── TestGenerator.tsx      # Generate test button + config
│       │   │   ├── TestTaker.tsx          # Question display + answer input
│       │   │   ├── GradingResult.tsx      # Score + rubric + sources
│       │   │   └── ThoughtBubble.tsx      # Floating hint popover
│       │   ├── dashboard/                 # (V2) SRL dashboard
│       │   │   ├── DashboardPage.tsx      # Dashboard layout
│       │   │   ├── MasteryHeatmap.tsx     # Topic × subtopic mastery grid
│       │   │   ├── GoalEditor.tsx         # User-editable learning goals
│       │   │   ├── ProgressChart.tsx      # Mastery over time (line chart)
│       │   │   └── WeaknessPanel.tsx      # Current weaknesses + links
│       │   └── ui/                        # (V2) Shared building blocks
│       │       ├── StepNavigator.tsx      # Step prev/next bar
│       │       ├── DataTable.tsx          # Sortable table with highlights
│       │       ├── CodeBlock.tsx          # Syntax-highlighted code
│       │       ├── Badge.tsx              # Status badges
│       │       ├── MasteryBar.tsx         # Mastery progress bar (0-100%)
│       │       └── NodeBubble.tsx         # Graph node for knowledge map
│       ├── hooks/
│       │   ├── useEventLogger.ts          # Behavioral event hook
│       │   ├── useSSE.ts                  # Server-sent events hook
│       │   └── useMastery.ts             # (V2) Mastery state hook
│       └── types/
│           └── index.ts                   # TypeScript type definitions
│
└── docs/
    ├── Project_Roadmap_V2.md              # This file
    ├── Technical_Architecture_V2.md       # System design spec
    ├── Claude_Code_Prompting_Guide_V2.md  # Session-by-session build prompts
    └── CLAUDE.md                          # Context file for Claude Code
```

---

## Phase 1: Foundation & Core UI (Week 1-2)

**Goal:** Get the three-panel learning interface working with real search results, streaming chat, and interactive subgoals. This is the research baseline — everything Prof. Chin needs for the initial study design.

### Day 1-2: Project Setup & Backend Foundation

**Tasks:**
- Initialize Git repo structure (backend/, frontend/, docs/)
- Set up FastAPI with CORS, health check endpoint
- Configure PostgreSQL with Docker Compose
- Define SQLAlchemy models for ALL 21 tables:
  Core (14): users, subjects, learning_topics, topic_documents, subgoals, sessions, search_events, search_click_events, chat_events, subgoal_events, behavioral_events, assessments, reflections, curated_quizzes
  V2 (7): concept_graphs, concept_nodes, mastery_states, test_records, question_results, dashboard_states, learner_goals
- Build Subjects CRUD: POST/GET/PUT/DELETE /api/subjects
- Run Alembic initial migration
- Implement Firebase Auth integration (register, login, /me endpoint with Firebase ID token verification)

**Quality Gate:** `docker-compose up` starts PostgreSQL + FastAPI, can register/login via Postman, database tables exist.

### Day 3-4: Core API Routes

**Tasks:**
- Learning topics CRUD (create, list, get by ID)
- Session lifecycle (start session → active → end session)
- Google Custom Search proxy endpoint (POST /api/search)
- OpenAI Chat endpoint with SSE streaming (POST /api/chat)
- Subgoal CRUD (create, update, delete, reorder, toggle complete)
- AI subgoal generation endpoint (POST /api/subgoals/generate)
- Behavioral event logging endpoint (POST /api/logs/events — batch insert)

**Quality Gate:** All endpoints return correct responses via Postman. Chat streams tokens via SSE. Subgoals can be created, reordered, and checked.

### Day 5-6: React Frontend — Three-Panel Layout

**Tasks:**
- Initialize React + Vite + TypeScript + Tailwind
- Build ThreePanelLayout (Search | Chat | Subgoals) — resizable panels
- Build SearchPanel with SearchInput and SearchResult components
- Build ChatPanel with ChatMessage and ChatInput — consuming SSE stream
- Build SubgoalPanel with SubgoalItem — drag-and-drop reorder (@dnd-kit/sortable)
- Build Header with session controls (start/end session)
- Wire up AuthContext (Firebase Auth token management) and SessionContext

**Quality Gate:** Can start a session, search Google, chat with GPT (streaming), create/edit/reorder/check subgoals — all in the three-panel layout.

### Day 7-8: Session Lifecycle, Resume & Behavioral Logging

**Tasks:**
- Build SessionStart component (topic selection → start session → pre-assessment)
- Build Session Resume flow: on login, check for active session → "Resume Session" modal → restore chat history, subgoals, panel state
- Add `session_state` JSONB auto-save (every 60s): active panel, scroll positions, chat draft
- Add GET /api/sessions/active endpoint for resume detection
- Add GET /api/sessions/{id}/export — export session as markdown (.md download: chat history, subgoals, mastery snapshot, session metadata)
- Add Pause/Resume/Finish Studying session controls in Header component
- Build AssessmentModal (pre/post session quiz — 3-5 questions, LLM-generated)
- Build ReflectionModal (free-text reflection + Likert scale self-assessment)
- Implement LoggingContext — captures all events with timestamps
- Wire up event types: search_query, search_click, chat_message, subgoal_create, subgoal_edit, subgoal_reorder, subgoal_check, subgoal_uncheck, panel_focus (duration_ms per panel)
- Implement batch event flush (every 30s or on session end)
- Add panel focus tracking (which panel the user is actively viewing)

**Quality Gate:** Full session flow works: start → pre-assessment → learn (search + chat + subgoals) → post-assessment → reflection → end. All events are logged to the database.

---

## Phase 2: Adaptive Learning Engine (Week 3-4)

**Goal:** Add the mastery engine, concept extraction, and visual learning templates. This transforms the tool from a basic search+chat interface into an adaptive tutor.

### Day 9-10: Concept Extraction & Mastery Engine

**Tasks:**
- Build concept_extractor.py — given a learning topic, use GPT to decompose it into a concept graph: topics → subtopics → micro-skills, with prerequisite links and difficulty ratings
- Build mastery_engine.py — implement EWA (Exponentially Weighted Average) scoring:
  ```
  performance = difficulty_weight if is_correct else 0.0
  decayed_mastery = current_mastery × exp(-0.693 × days_since / 30)
  new_mastery = α × performance + (1 - α) × decayed_mastery
  ```
  Where α = 0.2 (learning rate), difficulty_weight = easy:0.3, medium:0.5, hard:0.8
  Includes time decay with 30-day half-life (models Ebbinghaus forgetting curve)
- Build recommendation_engine.py — cubic power law for focus weights:
  ```
  focusWeight = (1 - mastery)³ + EPSILON
  ```
  Higher weight = lower mastery = study this first
- Create database models: ConceptGraph, ConceptNode, MasteryState
- Build API routes: GET /api/concepts/{topic_id}, POST /api/mastery/update, GET /api/mastery/state

**Quality Gate:** Given a topic like "Binary Trees", GPT returns a structured concept graph. Mastery scores update correctly after test answers. Recommendations rank weakest concepts first.

### Day 11-12: Visual Learning Templates (3 of 6)

**Tasks:**
- Build TemplateRouter.tsx — inspects JSON `template` field, routes to correct component
- Build SolutionWalkthrough.tsx — step-by-step problem solving with:
  - StepNavigator (prev/next with progress bar)
  - DataTable (sortable, with row highlighting per step)
  - CodeBlock (syntax-highlighted, with line highlighting)
  - Dark gradient theme matching binary_tree_walkthrough.jsx aesthetic
- Build ConceptComparison.tsx — side-by-side concept cards with:
  - Property comparison table
  - Visual diagrams (tree/graph rendering for applicable concepts)
  - Key insight callouts
- Build KnowledgeMap.tsx — interactive concept graph with:
  - NodeBubble components (mastery-colored: red/yellow/green)
  - Click to expand concept details
  - Prerequisite edge lines
- Build shared UI components: StepNavigator, DataTable, CodeBlock, Badge, MasteryBar, NodeBubble

**Key Design Decision — Templates vs Raw JSX:**
Claude/GPT generates structured JSON data, NOT JSX code. Pre-built React components render the JSON. This gives ~100% render reliability (vs ~80-90% for raw JSX), 2-4 second response times (vs 8-15s for full JSX generation), consistent visual quality, and 3-5x lower API cost per request.

**Quality Gate:** Given a topic, GPT generates template JSON. All 3 templates render correctly with step navigation, data tables, and mastery-colored nodes. Dark theme matches reference aesthetic.

### Day 13-14: Template Integration & Chat Enhancement

**Tasks:**
- Connect templates to chat — when a user asks "explain X", GPT decides whether to return a text response or a template JSON response
- Add "Show Walkthrough" button in chat that triggers template generation for the current topic
- Enhance chat system prompt to be Socratic/learning-optimized (not a simple Q&A bot):
  - Encourage exploration before giving answers
  - Reference subgoals in responses
  - Suggest related concepts based on mastery state
  - Adapt explanation depth to mastery level
  - **Mandatory citations:** All factual claims must include source URLs (from user's search history or authoritative references)
- Add `citations: list[str]` field to chat responses — frontend renders as clickable links below each message
- Add concept-aware search — when user searches, tag results with relevant concept nodes
- Wire MasteryContext to frontend — mastery state available across all components
- Implement offline sync: IndexedDB event queue (idb library), auto-queue behavioral events when offline, auto-replay on reconnect, user-facing offline/sync banners
- Add `beforeunload` handler: save session state + mark as paused on browser close

**Quality Gate:** Chat produces both text responses and visual templates. "Explain binary tree traversal" generates a SolutionWalkthrough. Mastery state is visible in the SubgoalPanel (each subgoal shows mastery %). Offline events queue and sync on reconnect.

---

## Phase 3: Testing, Grading & SRL Dashboard (Week 5-6)

**Goal:** Add on-demand test generation, transparent grading with dual modes, thought-bubble hints, and the full self-regulated learning dashboard.

### Day 15-16: Test Generation & Grading Engine

**Tasks:**
- Build test_engine.py — generates tests with configurable parameters:
  - Number of questions (default 5-10)
  - Mix of objective (MCQ) and subjective (short answer)
  - Difficulty adapts to mastery state (harder questions for mastered concepts, easier for weak ones)
  - Questions tagged with concept nodes for mastery tracking
- Build grading_engine.py with dual modes:
  - **Informal Mode:** Checks if the core concept is present. Lenient on terminology. Partial credit for directional correctness. Rubric focuses on "Did you get the main idea?"
  - **Formal Mode:** Academic precision expected. Exact terminology required. Stricter rubric with point deductions for imprecise language. Rubric focuses on "Is this definition complete and precise?"
  - Both modes provide: score (0-100), rubric breakdown, source citations, specific feedback per question
- Build API routes: POST /api/tests/generate, POST /api/tests/grade
- Build expert quiz upload: POST /api/tests/curated (researcher role uploads JSON/CSV of pre-made questions)
- Build rubric upload: professors can attach a rubric document to a topic for grading fallback
- Grading engine confidence scoring: GPT returns confidence 0-1; if < 0.7 in informal mode, re-grade with uploaded rubric
- Build TestGenerator.tsx — "Take a Test" button with configuration (# questions, difficulty, grading mode toggle, AI-Generated vs Expert Quiz selector)
- Build TestTaker.tsx — question display with answer input (MCQ radio buttons, short answer text area)
- Build GradingResult.tsx — score display with expandable rubric cards showing point breakdown and source references

**Quality Gate:** Can generate a test on any topic, take it, and receive graded results with transparent rubrics in both formal and informal modes. Mastery scores update based on test performance.

### Day 17-18: Thought-Bubble Hints & Progressive Help

**Tasks:**
- Build hint_engine.py — 3-level progressive hint system:
  - Level 1 (Nudge): "Think about what property defines a balanced tree..."
  - Level 2 (Concept): "A balanced binary tree has a height difference of at most 1 between left and right subtrees."
  - Level 3 (Steps): Full step-by-step solution walkthrough
- Build ThoughtBubble.tsx — floating hint popover that appears:
  - When user clicks "Hint" button during a test
  - Dynamically mid-problem (optional — can be toggled)
  - Uses SSE streaming for real-time hint delivery (same infrastructure as chat)
  - Comic-book style thought cloud visual treatment
- Build API route: POST /api/hints (SSE streaming)
- Track hint usage in behavioral events (which hints were requested, at which level)

**Quality Gate:** During a test, clicking "Hint" streams a Level 1 hint. Clicking again escalates to Level 2, then Level 3. Hints are contextual to the current question. Hint usage is logged.

### Day 19-20: Self-Regulated Learning Dashboard

**Tasks:**
- Build DashboardPage.tsx — full SRL dashboard with **Apple Widget aesthetic** (frosted glass cards, rounded-2xl, backdrop-blur, Framer Motion animations):
  1. **MasteryHeatmap** — topic × subtopic grid, cells colored by mastery (red=0-33%, yellow=34-66%, green=67-100%). Alternate view: Apple Watch-style activity rings per concept.
  2. **GoalEditor** — user-editable learning goals with target mastery %, deadline, priority. User can add/edit/delete goals. System suggests goals based on weaknesses.
  3. **ProgressChart** — line chart showing mastery % over time per topic (recharts) with trend arrows
  4. **WeaknessPanel** — ranked list of weakest concepts with "Study Now" links
  5. **StudyStreak** — consecutive active days counter (motivational widget)
  6. **HintRelianceTrend** — shows decreasing hint usage over time (improvement indicator)
- Dashboard **customization**: users can show/hide widgets, drag-and-drop to rearrange order (@dnd-kit/sortable grid), choose mastery display style (rings/heatmap/bars). Layout persists in `dashboard_states` JSONB.
- Build dashboard persistence:
  - GET /api/dashboard — load current dashboard state
  - PUT /api/dashboard — save user edits (goals, manual mastery overrides)
  - Dashboard state stored in PostgreSQL (dashboard_state, learner_goals tables)
- Implement the adaptive cycle:
  1. User completes test → mastery engine updates scores
  2. Dashboard reflects new mastery state
  3. Recommendations update (cubic power law)
  4. User can manually edit goals or override mastery
  5. System saves updated state to DB
  6. Next test adapts to the new state

**Quality Gate:** Dashboard shows mastery heatmap, editable goals, progress over time, and weakness rankings. Editing a goal and saving persists to DB. Taking a test updates the dashboard in real-time.

### Day 21-22: Dashboard Polish & Adaptive Integration

**Tasks:**
- Connect dashboard to all learning flows:
  - After each test: auto-refresh dashboard
  - After each chat session: update mastery if concepts were discussed
  - After each search session: track which concepts were explored
- Add "Generate Study Plan" button — GPT generates a prioritized study plan based on current mastery state and goals
- Add manual mastery override — user can click a heatmap cell and adjust mastery % (logged as a behavioral event)
- Add goal suggestions — when mastery changes significantly, system suggests new goals
- Polish all dashboard components for visual consistency (dark theme, consistent spacing, hover effects)
- Build context usage indicator: token meter in Header (green/yellow/orange/red), auto-summarize oldest messages when context window > 90%, option to start fresh session
- Add subject-level dashboard scope selector: All Subjects / specific subject / specific topic

**Quality Gate:** Full adaptive cycle works end-to-end: learn → test → dashboard updates → recommendations change → next test adapts. Manual edits persist and affect future recommendations.

### Day 22 (Stretch): Raw JSX Generation via sandpack-react

**Tasks (if time permits — stretch goal):**
- Add "Generate Custom Visual" button in chat for when templates aren't sufficient
- Use Claude Sonnet (via OpenRouter) for JSX code generation (best code quality)
- Render JSX in sandpack-react sandbox (iframe isolation, 5-second timeout)
- Auto-fallback to closest pre-built template if JSX render fails
- Log JSX generation success/failure rate for cost-benefit analysis
- Cost: ~$0.03-0.05 per generation (vs ~$0.005-0.01 for templates)

**Quality Gate:** "Generate Custom Visual" produces a rendered React component in sandbox. On render failure, gracefully falls back to template. Success rate logged.

---

## Phase 4: Research Dashboard & Study Readiness (Week 7)

**Goal:** Build the admin panel for researchers, add data export, seed data for testing, and polish everything for the pilot study.

### Day 23-24: Research Admin Dashboard

**Tasks:**
- Build admin routes: GET /api/admin/participants, GET /api/admin/sessions, GET /api/admin/events
- Build data export: GET /api/admin/export/csv — exports all behavioral events, mastery changes, test results, and session data as CSV
- Build admin UI page with:
  - Participant list with session counts and last active
  - Session timeline view (events plotted on a timeline)
  - Aggregate metrics: search/chat usage distribution, subgoal engagement, mastery progression
  - Filter by participant, topic, date range
- Add research-specific metrics:
  - Search-to-chat ratio per participant
  - Subgoal completion rate
  - Average mastery gain per session
  - Hint usage frequency and escalation patterns
  - Time-on-task per panel

**Quality Gate:** Admin can view all participants, drill into individual sessions, see event timelines, and export data as CSV for analysis.

### Day 25-26: Seed Data, Testing & Polish

**Tasks:**
- Create seed data script: 2-3 sample topics with concept graphs, sample users with mastery states, sample test results
- End-to-end integration testing:
  - Full session flow with all features
  - Visual template rendering across topics
  - Test generation and grading accuracy
  - Dashboard state persistence
  - Event logging completeness
- Cross-browser testing (Chrome, Firefox)
- Responsive design check (minimum 1280px width for three-panel layout)
- Error handling: graceful failures for API timeouts, rate limits, empty results
- Loading states for all async operations

**Quality Gate:** Seed data provides a realistic demo. All features work end-to-end without errors. UI is polished and consistent.

### Day 27-28: Documentation & Deployment

**Tasks:**
- Write README.md with setup instructions
- Document all API endpoints (request/response examples)
- Document environment variables (.env.example)
- Docker Compose deployment guide
- Write study protocol notes: how to onboard participants, how to assign topics, how to export data
- Set up dual-layer backup: Railway daily snapshots (included) + 6-hourly pg_dump to Firebase Storage (cron job)
- Build data deletion endpoint: DELETE /api/admin/participants/{id} — cascading delete per data retention policy (6-month post-study)
- Build daily cleanup job: expire paused sessions after 24 hours, queue deferred post-assessments
- WCAG 2.1 AA accessibility pass: verify keyboard navigation, ARIA labels, focus indicators (2px blue-400 ring), screen reader support via shadcn/ui + Radix primitives
- Add color-blind safe mastery patterns: × (low), ~ (medium), ✓ (high) overlays alongside red/yellow/green
- Final code review and cleanup

**Quality Gate:** A new developer can clone the repo, follow the README, and have the full system running locally with `docker-compose up`.

---

## Phase 5: Future Enhancements (Post-Prototype)

These features are documented for later but not in the initial build:

| Feature | Description | Priority |
|---------|-------------|----------|
| CodeExecutionTrace Template | Step-by-step variable state walkthrough for code problems | High |
| TestResults Template | Visual rubric display with animated score reveal | Medium |
| FocusRecommendations Template | Mastery-weighted study plan visualization | Medium |
| PDF Ingestion Pipeline | Upload PDFs → automatic concept graph extraction | High |
| Raw JSX Generation | Claude generates custom JSX via sandpack-react (stretch) | Low |
| Spaced Repetition | Recency decay on mastery scores for long-term retention | Medium |
| Multi-User Collaboration | Shared subgoals and group learning sessions | Low |
| Mobile Responsive | Full mobile layout for smaller screens | Low |
| Analytics Dashboard V2 | Statistical analysis built into the admin panel | Medium |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template System vs Raw JSX | Templates (JSON data → pre-built components) | ~100% reliability, 3-5x cheaper, faster, consistent visuals |
| LLM Gateway | OpenRouter → GPT-4o default | Single API key for all models, easy to add routing later |
| PostgreSQL vs Supermemory | PostgreSQL for all persistence | Already in stack, no extra service, full SQL query capability |
| React + Vite vs Next.js | React + Vite | Simpler (no SSR needed), faster HMR, already committed in V1 |
| Mastery Scoring Model | EWA with time decay (research-backed) | Matches Ebbinghaus forgetting curve, captures performance trajectory, 81% accuracy (PFA research) |
| Grading Modes | Dual (Formal/Informal) | Formal for academic rigor, Informal for conceptual understanding |
| Hint System | 3-level progressive (Nudge → Concept → Steps) | Supports desirable difficulty — help only when needed |
| Dashboard Persistence | DB-backed with manual override | Users control their learning journey (core SRL principle) |
| Session Resume | Full state restoration on return | Users pick up exactly where they left off — chat, subgoals, panel positions |
| Citation System | Mandatory source links in chat + grading | Guarantees factual accuracy, builds user trust |
| Grading Rubric Fallback | GPT confidence < 0.7 → re-grade with rubric | Hybrid: fast informal grading + rubric-backed rigor for edge cases |
| Expert Quiz Hosting | Researcher uploads pre-made quizzes | Research validity — standardized assessments alongside adaptive tests |
| Dashboard UX | Apple Widget aesthetic, drag-and-drop | Clean, motivating, customizable — users own their learning dashboard |
| Animation Library | Framer Motion | Smooth transitions, micro-interactions, professional feel |
| UI Components | shadcn/ui on Tailwind | Pre-built accessible components, consistent design, faster dev |

---

## Target Metrics for Pilot Study

**Behavioral Metrics (logged automatically):**
- Search queries per session (count + content)
- Chat messages per session (count + content)
- Search-to-chat ratio
- Panel focus time (seconds per panel per session)
- Subgoal interactions (create, edit, reorder, check, uncheck)
- Search result click-through rate
- Time between subgoal completion events
- Hint request frequency and escalation patterns
- Test attempts per topic
- Mastery progression over time

**Learning Outcome Metrics (via assessments):**
- Pre/post assessment score delta
- Mastery gain per session
- Concept coverage (% of concept graph explored)
- Grading mode preference (formal vs informal)
- Self-reported confidence (Likert scale in reflections)
- Goal completion rate (dashboard goals achieved)

**System Health Metrics:**
- API response times
- LLM token usage per session
- Error rates
- Session duration
