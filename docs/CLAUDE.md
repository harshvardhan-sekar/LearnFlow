# Self-Regulated Learning Tool & Subgoal Manager

## Project Context
Building a research-grade Self-Regulated Learning (SRL) tool for a UIUC study (Prof. Jessie Chin's lab). The tool integrates web search (Google Custom Search) and conversational AI search (OpenAI GPT) in a unified interface with an interactive Subgoal Manager, to study how learners coordinate multiple search modalities for long-term learning tasks.

## Team
- Harsha (Harshvardhan Sekar) — Developer
- Mark (Markkkx on GitHub) — Developer
- Prof. Jessie Chin — Principal Investigator
- Ke Xu — Research team member

## Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL + SQLAlchemy + Alembic
- **LLM:** OpenAI GPT API (gpt-4o) for chat and subgoal generation
- **Search:** Google Custom Search API
- **Deployment:** Docker Compose (local development)

## Key Technical Decisions

### Architecture
- **Three-panel layout:** Search (left) | Chat (center) | Subgoal Manager (right)
- **Session-based:** Each learning session has explicit start/end with reflection + assessment
- **Event-sourced logging:** Every user action is captured as a behavioral event in PostgreSQL
- **Streaming chat:** SSE (Server-Sent Events) for real-time GPT response display
- **Drag-and-drop subgoals:** @dnd-kit/sortable for reorderable subgoal list

### API Design
- RESTful endpoints under /api/
- JWT authentication (simple token-based)
- Batch event logging (flush every 5 seconds or 20 events)
- Streaming endpoint for chat (SSE)

### Database
- PostgreSQL with SQLAlchemy ORM
- Tables: users, learning_topics, subgoals, sessions, search_events, search_click_events, chat_events, subgoal_events, behavioral_events, assessments, reflections
- Alembic for schema migrations
- All events timestamped for research analysis

### Chat System Prompt Design
The chat AI is NOT a simple Q&A bot. It follows learning-optimized principles:
- Socratic method: asks clarifying questions, provides scaffolded hints
- References the user's subgoal progress in responses
- Encourages productive struggle (desirable difficulty)
- Suggests web searches when authoritative sources would be more appropriate
- System prompt is dynamically built per session with topic + subgoal context

### Subgoal Generation
- When user selects a learning topic, GPT generates 6-8 scaffolded subgoals
- Subgoals progress from basic → intermediate → advanced
- Users can accept, edit, delete, reorder, or add their own subgoals
- All subgoal interactions are logged (create, edit, reorder, check, uncheck)
- Source tracked: ai_generated vs. user_created

### Behavioral Event Types
All events captured for research analysis:
- search_query, search_click — web search behavior
- chat_message_sent, chat_response_received — chat engagement
- subgoal_created, subgoal_edited, subgoal_reordered, subgoal_checked, subgoal_unchecked — SRL behavior
- interface_switch — modality switching between panels
- panel_focus — time spent in each panel (duration_ms per panel)
- reflection_submitted, assessment_submitted — learning outcomes
- session_started, session_ended — session lifecycle

## Research Context
This tool is a research instrument for studying:
1. How learners distribute effort between web search and conversational AI
2. Whether subgoal scaffolding improves learning outcomes in exploratory tasks
3. What behavioral patterns predict learning success
4. Whether the "desirable difficulty" principle holds in dual-modality learning

The study design is:
- 3-4 week longitudinal study per participant
- 6-8 subgoals per learning topic
- Post-session reflection + multiple choice assessment
- Exploratory phase first (no control conditions in V1)

## Project Structure
```
subgoal-manager-learning-tool/
├── CLAUDE.md                    # This file
├── README.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py
│   ├── api/routes/              # API route handlers
│   ├── models/                  # SQLAlchemy models
│   ├── services/                # Business logic (search, chat, subgoal gen)
│   ├── db/                      # Database config + migrations
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/          # React components (search/, chat/, subgoals/, etc.)
│   │   ├── contexts/            # React contexts (Auth, Session, Logging)
│   │   ├── hooks/               # Custom hooks (useSearch, useChat, useSubgoals, useEventLogger)
│   │   ├── services/            # API client
│   │   └── types/               # TypeScript types
│   └── public/
├── docs/                        # Roadmap, Architecture, Prompting Guide
└── scripts/                     # Seed data, export utilities
```

## Coding Standards
- **Python:** Type hints on all function signatures. Docstrings on all public functions. Pydantic models for request/response validation.
- **TypeScript:** Strict mode. Interface definitions for all data types. Custom hooks for API interactions.
- **Both:** Consistent formatting (Black for Python, Prettier for TS). Meaningful variable names.
- **Git:** Descriptive commit messages. Feature branches off main.

## Environment Variables
```
OPENAI_API_KEY=sk-...
GOOGLE_SEARCH_API_KEY=AIza...
GOOGLE_SEARCH_ENGINE_ID=...
DATABASE_URL=postgresql://srl_user:password@localhost:5432/srl_tool
SECRET_KEY=jwt_secret_here
```

## Dependencies

### Backend (Python)
fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary, openai, google-api-python-client, python-jose, passlib, python-dotenv, pydantic, httpx

### Frontend (Node.js)
react, react-dom, react-router-dom, @dnd-kit/core, @dnd-kit/sortable, tailwindcss, axios, typescript, vite

## Key Design Principles
1. **Every action is an event** — The tool is both a learning environment and a research instrument
2. **Support learning, don't replace it** — The chat AI scaffolds understanding; it doesn't just give answers
3. **Subgoals are always visible** — The Subgoal Manager panel stays persistent, not hidden behind a menu
4. **No bias toward either modality** — The UI gives equal prominence to search and chat
5. **Session boundaries matter** — Clean data boundaries for longitudinal analysis
6. **Simple over clever** — This is a research prototype; maintainability beats elegance
