# SRL Learning Tool & Subgoal Manager — Technical Architecture V2

## Overview

This document specifies the technical architecture for the Self-Regulated Learning (SRL) tool. It covers the API design, database schema, frontend component hierarchy, data flow, engine specifications, and the visual template system. Use this as the implementation reference alongside the Project Roadmap V2.

**Core Design Principle:** Every user action is an observable event. The tool is both a learning environment and a research instrument.

**V2 Additions:** Mastery engine, concept graph, visual learning templates (3 of 6), test generation/grading, hint system, SRL dashboard, and adaptive recommendation engine — all integrated from the LearnFlow HackIllinois prototype.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite + TS)                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐  │
│  │  SearchPanel  │  │  ChatPanel   │  │    SubgoalPanel                │  │
│  │  (Web Search) │  │  (GPT Chat)  │  │    (SRL Scaffolding)           │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────────────┘  │
│         │                 │                        │                      │
│  ┌──────┴─────────────────┴────────────────────────┴──────────────────┐  │
│  │  ┌───────────────┐ ┌──────────────┐ ┌──────────────┐              │  │
│  │  │TemplateViewer │ │ TestTaker    │ │ DashboardPage│   (V2)       │  │
│  │  │(Walkthroughs) │ │(Tests+Grade) │ │(SRL Metrics) │              │  │
│  │  └───────────────┘ └──────────────┘ └──────────────┘              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              LoggingContext (captures all events)                    │  │
│  └──────────────────────────────┬─────────────────────────────────────┘  │
│                                 │                                        │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │  HTTP / SSE
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (FastAPI)                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                         API Routes                                 │   │
│  │  /search │ /chat │ /subgoals │ /logs │ /concepts │ /mastery │     │   │
│  │  /tests  │ /hints │ /dashboard │ /admin                           │   │
│  └────┬─────┴───┬───┴─────┬──────┴───┬───┴─────┬──────┴────┬────────┘   │
│       │         │         │          │         │           │             │
│  ┌────▼────┐ ┌──▼──────┐ ┌▼────────┐ ┌▼───────┐ ┌▼───────┐ ┌▼────────┐ │
│  │Google   │ │OpenAI   │ │Subgoal  │ │Event   │ │Mastery │ │Grading  │ │
│  │Search   │ │Chat Svc │ │Generat. │ │Logger  │ │Engine  │ │Engine   │ │
│  │Service  │ │(SSE)    │ │         │ │        │ │        │ │         │ │
│  └────┬────┘ └──┬──────┘ └─────────┘ └────────┘ └────────┘ └─────────┘ │
│       │         │                                                       │
│  ┌────▼────┐ ┌──▼──────┐  ┌───────────────────────────────────────┐    │
│  │Google   │ │OpenAI   │  │          Engines (V2)                  │    │
│  │Custom   │ │GPT API  │  │  concept_extractor · mastery_engine    │    │
│  │Search   │ │         │  │  recommendation_engine · test_engine   │    │
│  │API      │ │         │  │  grading_engine · hint_engine          │    │
│  └─────────┘ └─────────┘  └───────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     SQLAlchemy ORM                                │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │     PostgreSQL            │
                    │                          │
                    │  users                   │
                    │  learning_topics         │
                    │  subgoals                │
                    │  sessions                │
                    │  search_events           │
                    │  search_click_events     │
                    │  chat_events             │
                    │  subgoal_events          │
                    │  behavioral_events       │
                    │  assessments             │
                    │  reflections             │
                    │  concept_graphs   (V2)   │
                    │  concept_nodes    (V2)   │
                    │  mastery_states   (V2)   │
                    │  test_records     (V2)   │
                    │  question_results (V2)   │
                    │  dashboard_states (V2)   │
                    │  learner_goals    (V2)   │
                    └──────────────────────────┘
```

---

## Database Schema

### Core Tables (V1 — unchanged)

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,  -- Firebase Auth UID (replaces email/password auth)
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'participant',  -- participant, researcher, admin
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subjects / Courses (groups topics)
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,              -- e.g., "CS 225: Data Structures"
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Learning topics
CREATE TABLE learning_topics (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,  -- optional course grouping
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_sessions INTEGER DEFAULT 8,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Topic documents (uploaded PDFs for grounding)
CREATE TABLE topic_documents (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES learning_topics(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    firebase_storage_path TEXT NOT NULL,       -- path in Firebase Storage
    extracted_text TEXT,                        -- full text extracted via PyMuPDF
    page_count INTEGER,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Subgoals
CREATE TABLE subgoals (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES learning_topics(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Learning sessions
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    topic_id INTEGER REFERENCES learning_topics(id),
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, abandoned
    session_state JSONB DEFAULT '{}',     -- (V2) UI state for resume: active_panel, scroll_positions, last_question_id
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- Search events
CREATE TABLE search_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    query TEXT NOT NULL,
    results_count INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Search click events
CREATE TABLE search_click_events (
    id SERIAL PRIMARY KEY,
    search_event_id INTEGER REFERENCES search_events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    result_url TEXT NOT NULL,
    result_title TEXT,
    result_position INTEGER,
    dwell_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat events
CREATE TABLE chat_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(20) NOT NULL,  -- user, assistant
    content TEXT NOT NULL,
    tokens_used INTEGER,
    response_time_ms INTEGER,
    template_type VARCHAR(50),  -- (V2) null for text, or 'solution_walkthrough', 'concept_comparison', etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subgoal events (every interaction)
CREATE TABLE subgoal_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    subgoal_id INTEGER REFERENCES subgoals(id),
    event_type VARCHAR(50) NOT NULL,  -- create, edit, reorder, check, uncheck, delete
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Behavioral events (catch-all for panel focus, navigation, etc.)
CREATE TABLE behavioral_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,  -- panel_focus, page_navigation, template_view, hint_request, test_start, etc.
    event_data JSONB,  -- flexible payload
    created_at TIMESTAMP DEFAULT NOW()
);

-- Assessments (pre/post session)
CREATE TABLE assessments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    assessment_type VARCHAR(20) NOT NULL,  -- pre, post
    questions JSONB NOT NULL,
    answers JSONB,
    score FLOAT,
    max_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Reflections
CREATE TABLE reflections (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    reflection_text TEXT,
    confidence_rating INTEGER,  -- 1-5 Likert scale
    difficulty_rating INTEGER,  -- 1-5 Likert scale
    created_at TIMESTAMP DEFAULT NOW()
);
```

### V2 Tables — Adaptive Learning

```sql
-- Concept graphs (one per topic)
CREATE TABLE concept_graphs (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES learning_topics(id) ON DELETE CASCADE,
    graph_data JSONB NOT NULL,  -- Full concept graph JSON
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Concept nodes (individual concepts within a graph)
CREATE TABLE concept_nodes (
    id SERIAL PRIMARY KEY,
    graph_id INTEGER REFERENCES concept_graphs(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,           -- e.g., "binary_trees.balanced"
    name VARCHAR(255) NOT NULL,          -- e.g., "Balanced Binary Tree"
    description TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium',  -- easy, medium, hard
    prerequisites JSONB DEFAULT '[]',     -- array of concept_node keys
    sort_order INTEGER DEFAULT 0,
    UNIQUE(graph_id, key)
);

-- Mastery states (per user per concept node)
CREATE TABLE mastery_states (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    concept_node_id INTEGER REFERENCES concept_nodes(id) ON DELETE CASCADE,
    mastery_score FLOAT DEFAULT 0.0,     -- 0.0 to 1.0
    attempts_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    last_tested_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, concept_node_id)
);

-- Test records (each generated test)
CREATE TABLE test_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    topic_id INTEGER REFERENCES learning_topics(id),
    session_id INTEGER REFERENCES sessions(id),
    grading_mode VARCHAR(20) NOT NULL,   -- formal, informal
    total_score FLOAT,
    max_score FLOAT,
    questions_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Question results (individual question outcomes)
CREATE TABLE question_results (
    id SERIAL PRIMARY KEY,
    test_record_id INTEGER REFERENCES test_records(id) ON DELETE CASCADE,
    concept_node_id INTEGER REFERENCES concept_nodes(id),
    question_type VARCHAR(20) NOT NULL,  -- objective, subjective
    question_text TEXT NOT NULL,
    options JSONB,                        -- MCQ options (null for subjective)
    correct_answer TEXT,
    user_answer TEXT,
    score FLOAT,
    max_score FLOAT,
    rubric JSONB,                         -- grading rubric breakdown
    feedback TEXT,                         -- specific feedback for this answer
    hints_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dashboard states (persisted dashboard per user per topic)
CREATE TABLE dashboard_states (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    topic_id INTEGER REFERENCES learning_topics(id),
    mastery_snapshot JSONB,              -- cached mastery grid data
    study_plan JSONB,                    -- AI-generated study recommendations
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, topic_id)
);

-- Curated quizzes (expert-prepared, uploaded by researchers/professors)
CREATE TABLE curated_quizzes (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES learning_topics(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL,              -- Array of {question_text, question_type, options, correct_answer, concept_key, difficulty}
    rubric_document TEXT,                  -- Optional uploaded rubric text for grading reference
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Learner goals (user-editable goals)
CREATE TABLE learner_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    topic_id INTEGER REFERENCES learning_topics(id),
    concept_node_id INTEGER REFERENCES concept_nodes(id),
    target_mastery FLOAT DEFAULT 0.8,    -- target mastery score
    deadline DATE,
    priority INTEGER DEFAULT 1,          -- 1=high, 2=medium, 3=low
    is_completed BOOLEAN DEFAULT FALSE,
    is_ai_suggested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Specification

### Auth Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login via Firebase Auth, returns Firebase ID token |
| GET | /api/auth/me | Get current user profile |

### Subject Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/subjects | Create subject/course grouping |
| GET | /api/subjects | List all subjects (with topic counts) |
| GET | /api/subjects/{id} | Get subject by ID (with topics) |
| PUT | /api/subjects/{id} | Update subject name/description |
| DELETE | /api/subjects/{id} | Delete subject (topics become ungrouped) |

### Topic Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/topics | Create learning topic |
| GET | /api/topics | List all topics (filterable by subject_id) |
| GET | /api/topics/{id} | Get topic by ID |

### Session Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/sessions | Start new session (topic_id required) |
| PUT | /api/sessions/{id}/end | End session |
| GET | /api/sessions | List user's sessions |
| GET | /api/sessions/{id} | Get session details |
| GET | /api/sessions/active | Get user's active (resumable) session |
| PUT | /api/sessions/{id}/state | Save UI state for session resume (panel, scroll, etc.) |
| PUT | /api/sessions/{id}/pause | Pause active session |
| PUT | /api/sessions/{id}/resume | Resume paused session |
| GET | /api/sessions/{id}/export | Export session as markdown (chat history, subgoals, mastery snapshot) |

### Search Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/search | Proxy to Google Custom Search |
| POST | /api/search/click | Log a search result click |

### Chat Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/chat | Send message, receive SSE stream |
| GET | /api/chat/history/{session_id} | Get chat history for session |

### Subgoal Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/subgoals/{topic_id} | Get subgoals for topic |
| POST | /api/subgoals | Create subgoal |
| PUT | /api/subgoals/{id} | Update subgoal (title, description) |
| PUT | /api/subgoals/{id}/toggle | Toggle completion |
| PUT | /api/subgoals/reorder | Reorder subgoals (send ordered IDs) |
| DELETE | /api/subgoals/{id} | Delete subgoal |
| POST | /api/subgoals/generate | AI-generate subgoals for topic |

### Assessment Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/assessments | Create assessment (pre/post) |
| PUT | /api/assessments/{id} | Submit answers |
| GET | /api/assessments/{session_id} | Get assessments for session |

### Reflection Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/reflections | Submit reflection |
| GET | /api/reflections/{session_id} | Get reflections for session |

### Event Logging Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/logs/events | Batch insert behavioral events |
| POST | /api/logs/panel-focus | Log panel focus change |

### V2: Concept Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/concepts/{topic_id} | Get concept graph for topic |
| POST | /api/concepts/{topic_id}/generate | Generate concept graph via LLM |
| GET | /api/concepts/{topic_id}/nodes | List all concept nodes |

### V2: Mastery Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/mastery/{topic_id} | Get mastery state for all concepts in topic |
| POST | /api/mastery/update | Update mastery after test/interaction |
| PUT | /api/mastery/override | Manual mastery override (user edits) |

### V2: Test Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/tests/generate | Generate adaptive test |
| POST | /api/tests/{id}/grade | Grade completed test |
| GET | /api/tests/{id} | Get test details + results |
| GET | /api/tests/history/{topic_id} | Get test history for topic |
| POST | /api/tests/curated | Upload expert-curated quiz (researcher role) |
| GET | /api/tests/curated/{topic_id} | Get curated quizzes for topic |

### V2: Hint Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/hints | SSE stream — progressive hint for question |

### V2: Dashboard Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard/{topic_id} | Get dashboard state |
| PUT | /api/dashboard/{topic_id} | Save dashboard edits |
| POST | /api/dashboard/{topic_id}/study-plan | Generate AI study plan |
| GET | /api/dashboard/{topic_id}/goals | Get learner goals |
| POST | /api/dashboard/{topic_id}/goals | Create/update goals |
| DELETE | /api/dashboard/goals/{id} | Delete a goal |

### Admin Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/participants | List all participants |
| GET | /api/admin/sessions | List all sessions (filterable) |
| GET | /api/admin/events | Query events (filterable) |
| GET | /api/admin/export/csv | Export all data as CSV |
| GET | /api/admin/metrics | Aggregate research metrics |

---

## V2 Engine Specifications

### Concept Extractor (concept_extractor.py)

Decomposes a learning topic into a structured concept graph using GPT.

**Input:** Topic title + description (e.g., "Binary Trees — data structures, traversals, properties")

**Output:** Concept graph JSON

```json
{
  "topic": "Binary Trees",
  "nodes": [
    {
      "key": "binary_trees.definition",
      "name": "Binary Tree Definition",
      "description": "A tree where each node has at most two children",
      "difficulty": "easy",
      "prerequisites": [],
      "sort_order": 0
    },
    {
      "key": "binary_trees.traversal.inorder",
      "name": "In-Order Traversal",
      "description": "Visit left subtree, root, right subtree (LNR)",
      "difficulty": "medium",
      "prerequisites": ["binary_trees.definition"],
      "sort_order": 1
    },
    {
      "key": "binary_trees.balanced",
      "name": "Balanced Binary Tree",
      "description": "Height of left/right subtrees differ by at most 1 for every node",
      "difficulty": "hard",
      "prerequisites": ["binary_trees.definition", "binary_trees.traversal.inorder"],
      "sort_order": 5
    }
  ]
}
```

**GPT Prompt Pattern:**
```
You are a curriculum designer. Given a learning topic, decompose it into
a concept graph with 8-15 concept nodes. Each node should have:
- key: dot-notation path (e.g., "topic.subtopic.skill")
- name: human-readable name
- description: 1-2 sentence explanation
- difficulty: easy/medium/hard
- prerequisites: array of concept keys this concept depends on
- sort_order: suggested learning order (0 = first)

Topic: {title}
Description: {description}

Return valid JSON matching the schema above.
```

### Mastery Engine (mastery_engine.py)

Tracks per-concept mastery using an Exponentially Weighted Average (EWA) model with optional time decay. This approach is grounded in Ebbinghaus's forgetting curve research and outperforms both Bayesian Knowledge Tracing (70% accuracy) and Deep Knowledge Tracing (72%) — Performance Factor Analysis using time-decay weighting achieves 81% accuracy in mastery prediction.

**Core Algorithm:**

```python
from math import exp
from datetime import datetime, timedelta

ALPHA = 0.2  # EWA learning rate — recent performance gets 20% weight
DECAY_HALF_LIFE_DAYS = 30  # Mastery decays with a 30-day half-life
DIFFICULTY_WEIGHTS = {"easy": 0.3, "medium": 0.5, "hard": 0.8}

def update_mastery(
    current_mastery: float,
    is_correct: bool,
    difficulty: str,
    last_tested_at: datetime | None = None
) -> float:
    """
    EWA-based mastery update with time decay.
    - Recent performance weighted by ALPHA (momentum effect)
    - Time decay models Ebbinghaus forgetting curve
    - Difficulty affects the weight of each observation
    """
    question_weight = DIFFICULTY_WEIGHTS.get(difficulty, 0.5)

    # Performance signal: 1.0 for correct, 0.0 for incorrect
    # Weighted by difficulty (harder questions provide stronger signal)
    performance = question_weight if is_correct else 0.0

    # Apply time decay if we know when they were last tested
    decayed_mastery = current_mastery
    if last_tested_at:
        days_since = (datetime.utcnow() - last_tested_at).total_seconds() / 86400
        decay_factor = exp(-0.693 * days_since / DECAY_HALF_LIFE_DAYS)  # ln(2) ≈ 0.693
        decayed_mastery = current_mastery * decay_factor

    # EWA update: blend recent performance with decayed history
    new_mastery = ALPHA * performance + (1 - ALPHA) * decayed_mastery
    return round(max(0.0, min(1.0, new_mastery)), 4)
```

**Properties:**
- New concepts start at 0.0 mastery
- Getting a hard question right at 0.0 mastery → 0.16 (0.2 × 0.8 + 0.8 × 0.0)
- Getting a hard question right at 0.9 mastery → 0.88 (0.2 × 0.8 + 0.8 × 0.9)
- Mastery decays over time if not practiced (30-day half-life matches Ebbinghaus curve)
- Momentum effect: consistent correct answers build mastery smoothly, consistent errors erode it
- ALPHA can be tuned: higher = more reactive to recent performance, lower = more stable
- **Why EWA over diminishing returns:** Captures performance trajectory (improving vs declining), aligns with cognitive science on exponential forgetting, and PFA research shows 11% higher accuracy than BKT

### Recommendation Engine (recommendation_engine.py)

Generates study recommendations using cubic power law weighting.

```python
EPSILON = 0.01  # Prevents fully mastered concepts from having zero weight

def get_focus_weights(mastery_states: list[dict]) -> list[dict]:
    """
    Cubic power law: lower mastery = exponentially higher focus weight.
    Returns sorted list (highest priority first).
    """
    weighted = []
    for state in mastery_states:
        weight = (1.0 - state["mastery_score"]) ** 3 + EPSILON
        weighted.append({
            "concept_key": state["concept_key"],
            "concept_name": state["concept_name"],
            "mastery": state["mastery_score"],
            "focus_weight": round(weight, 4)
        })

    # Sort by focus weight descending (weakest concepts first)
    weighted.sort(key=lambda x: x["focus_weight"], reverse=True)
    return weighted
```

**Properties:**
- 0.0 mastery → focus weight 1.01 (maximum priority)
- 0.5 mastery → focus weight 0.135
- 0.9 mastery → focus weight 0.011
- 1.0 mastery → focus weight 0.01 (EPSILON, never truly zero)

### Test Engine (test_engine.py)

Generates adaptive tests with a mix of objective and subjective questions.

**GPT Prompt Pattern (Test Generation):**
```
You are a test generator for a learning tool. Generate {num_questions} questions
about the following concepts, with difficulty adapted to the learner's mastery:

Concepts and mastery levels:
{concept_list_with_mastery}

Rules:
- Mix of objective (MCQ with 4 options) and subjective (short answer)
- Higher mastery concepts get harder questions
- Lower mastery concepts get easier questions
- Each question must be tagged with a concept_key
- For MCQ: provide exactly 4 options with one correct answer
- For subjective: provide an ideal answer for grading

Return JSON array of question objects.
```

**Response Schema:**
```json
[
  {
    "question_type": "objective",
    "concept_key": "binary_trees.traversal.inorder",
    "difficulty": "medium",
    "question_text": "What is the output of in-order traversal on [3, 1, 4, 1, 5]?",
    "options": ["1 1 3 4 5", "3 1 4 1 5", "5 4 3 1 1", "1 3 1 4 5"],
    "correct_answer": "1 1 3 4 5"
  },
  {
    "question_type": "subjective",
    "concept_key": "binary_trees.balanced",
    "difficulty": "hard",
    "question_text": "Explain why AVL trees guarantee O(log n) operations.",
    "ideal_answer": "AVL trees maintain the balance property where the height difference between left and right subtrees is at most 1 for every node. This guarantees the tree height is O(log n), which means search, insert, and delete operations all traverse at most O(log n) nodes."
  }
]
```

### Grading Engine (grading_engine.py)

Dual-mode grading with transparent rubrics.

**Informal Mode Prompt (with confidence + rubric fallback):**
```
You are a friendly tutor grading a student's answer. Focus on whether they
understand the CORE CONCEPT, not on exact wording or terminology.

Question: {question_text}
Ideal Answer: {ideal_answer}
Student's Answer: {user_answer}
{rubric_context}  # Injected only when uploaded rubric exists and confidence < 0.7

Grade on a scale of 0-{max_score}. Be generous with partial credit if:
- The main idea is present, even if terminology is imprecise
- The student demonstrates understanding, even if the explanation is informal
- Key concepts are referenced, even if the structure is non-academic

Return JSON:
{
  "score": <number>,
  "max_score": <number>,
  "confidence": <0.0-1.0>,  # How confident are you in this grade?
  "rubric": [
    {"criterion": "Core Concept Understanding", "points": <n>, "max": <n>, "comment": "..."},
    {"criterion": "Key Details", "points": <n>, "max": <n>, "comment": "..."}
  ],
  "feedback": "Overall feedback for the student",
  "sources": ["Reference to concept definition or source material"],
  "citations": ["URL or reference backing the correct answer"]
}
```

**Rubric Fallback Flow (Informal Mode):**
1. GPT grades informally → returns confidence score
2. If confidence >= 0.7 → accept grade as-is
3. If confidence < 0.7 AND user/professor uploaded a rubric → re-grade with rubric injected into prompt
4. If no rubric uploaded → flag answer for manual review (show "Low Confidence" badge)

**Formal Mode Prompt:**
```
You are an academic evaluator grading with precision. Evaluate for:
- Exact terminology and definitions
- Completeness of explanation
- Logical structure and reasoning
- Correct use of domain-specific language

Question: {question_text}
Ideal Answer: {ideal_answer}
Student's Answer: {user_answer}

Grade strictly on a scale of 0-{max_score}. Deduct points for:
- Imprecise terminology
- Missing key components of the definition
- Logical gaps or incorrect reasoning
- Vague or ambiguous language

Return JSON:
{
  "score": <number>,
  "max_score": <number>,
  "rubric": [
    {"criterion": "Terminology Precision", "points": <n>, "max": <n>, "comment": "..."},
    {"criterion": "Completeness", "points": <n>, "max": <n>, "comment": "..."},
    {"criterion": "Logical Reasoning", "points": <n>, "max": <n>, "comment": "..."},
    {"criterion": "Academic Rigor", "points": <n>, "max": <n>, "comment": "..."}
  ],
  "feedback": "Detailed academic feedback",
  "sources": ["Reference to concept definition or source material"],
  "citations": ["URL or reference backing the correct answer"]
}
```

### Hint Engine (hint_engine.py)

Progressive 3-level hints delivered via SSE streaming.

```python
HINT_LEVELS = {
    1: "nudge",    # Direction without answer
    2: "concept",  # Relevant concept explained
    3: "steps"     # Full step-by-step solution
}

# Level 1 Prompt:
"""
The student is stuck on this question. Give a subtle NUDGE — point them
in the right direction without revealing the answer. Keep it to 1-2 sentences.
Think of it like a thought bubble floating above a comic book character.

Question: {question_text}
Concept: {concept_name}
"""

# Level 2 Prompt:
"""
The student needs more help. Explain the relevant CONCEPT clearly but don't
solve the question directly. Give them the knowledge they need to figure it out.

Question: {question_text}
Concept: {concept_name}
Concept Description: {concept_description}
"""

# Level 3 Prompt:
"""
The student has requested full help. Walk through the SOLUTION step-by-step.
Be thorough and educational — explain WHY each step works.

Question: {question_text}
Concept: {concept_name}
Ideal Answer: {ideal_answer}
"""
```

**SSE Streaming:** Uses the same EventSource pattern as chat. The frontend ThoughtBubble component listens for SSE events and renders them in a floating popover with a comic-book thought cloud style.

---

## Visual Template System

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    TEMPLATE SYSTEM                         │
│                                                           │
│  ┌─────────────────────────────────────────────────┐      │
│  │              GPT API Response                    │      │
│  │         (Structured JSON, not JSX)               │      │
│  └────────────────────────┬────────────────────────┘      │
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────────┐      │
│  │           TemplateRouter.tsx                      │      │
│  │    Inspects template field, routes to component   │      │
│  └────┬──────────────────┬──────────────┬──────────┘      │
│       │                  │              │                   │
│       ▼                  ▼              ▼                   │
│  ┌──────────┐  ┌────────────────┐ ┌──────────────┐        │
│  │Solution  │  │Concept         │ │Knowledge     │        │
│  │Walkthru  │  │Comparison      │ │Map           │        │
│  └──────────┘  └────────────────┘ └──────────────┘        │
│                                                            │
│  ┌─────────────────────────────────────────────────┐      │
│  │           Shared Building Blocks                  │      │
│  │  StepNavigator · DataTable · CodeBlock · Badge    │      │
│  │  MasteryBar · NodeBubble                          │      │
│  └─────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

**Why Templates Over Raw JSX:**

| Concern | Raw JSX Generation | Template System |
|---------|-------------------|-----------------|
| Render reliability | ~80-90% (JSX errors crash component) | ~100% (pre-tested components) |
| Generation time | 8-15 seconds (200+ lines) | 2-4 seconds (JSON only) |
| Visual consistency | Varies per generation | Identical every time |
| Cost per question | ~$0.03-0.05 (large output tokens) | ~$0.005-0.01 (small JSON) |
| Interactivity | Limited (static generated code) | Full (hover, click, step navigation) |

### Template 1: SolutionWalkthrough

**Use Case:** Step-by-step problem solving (modeled after binary_tree_walkthrough.jsx)

**JSON Data Contract:**
```json
{
  "template": "solution_walkthrough",
  "title": "Finding Root, Inner, and Leaf Nodes in a Binary Tree",
  "problem_statement": "Given a binary tree table, classify each node...",
  "steps": [
    {
      "step_number": 1,
      "title": "Understand the Table Structure",
      "explanation": "The Tree table has two columns: id (node) and p_id (parent)...",
      "data_table": {
        "headers": ["id", "p_id", "Type"],
        "rows": [
          [1, null, "?"],
          [2, 1, "?"],
          [3, 1, "?"]
        ],
        "highlight_rows": [0],
        "highlight_color": "blue"
      },
      "code_snippet": {
        "language": "sql",
        "code": "SELECT id, p_id FROM Tree;",
        "highlight_lines": [1]
      }
    }
  ],
  "final_answer": {
    "explanation": "The root is the node with no parent...",
    "code": "SELECT id, CASE WHEN p_id IS NULL THEN 'Root' ... END AS type FROM Tree;"
  }
}
```

### Template 2: ConceptComparison

**Use Case:** Side-by-side comparison of 2-4 related concepts

**JSON Data Contract:**
```json
{
  "template": "concept_comparison",
  "title": "Binary Tree Types Compared",
  "concepts": [
    {
      "name": "Balanced Binary Tree",
      "key": "binary_trees.balanced",
      "definition": "Height of left/right subtrees differ by at most 1",
      "properties": [
        {"label": "Height Guarantee", "value": "O(log n)", "highlight": true},
        {"label": "Self-Balancing", "value": "Yes (AVL, Red-Black)"},
        {"label": "Use Case", "value": "Fast search/insert/delete"}
      ],
      "key_insight": "The tree never becomes a linked list"
    },
    {
      "name": "Full Binary Tree",
      "key": "binary_trees.full",
      "definition": "Every node has either 0 or 2 children",
      "properties": [
        {"label": "Height Guarantee", "value": "None", "highlight": true},
        {"label": "Node Count", "value": "2^(h+1) - 1 max"},
        {"label": "Use Case", "value": "Expression trees, Huffman coding"}
      ],
      "key_insight": "No single-child nodes allowed"
    }
  ]
}
```

### Template 3: KnowledgeMap

**Use Case:** Interactive concept graph showing mastery state

**JSON Data Contract:**
```json
{
  "template": "knowledge_map",
  "title": "Binary Trees — Knowledge Map",
  "nodes": [
    {
      "key": "binary_trees.definition",
      "name": "BT Definition",
      "mastery": 0.85,
      "x": 300, "y": 50
    },
    {
      "key": "binary_trees.traversal.inorder",
      "name": "In-Order",
      "mastery": 0.6,
      "x": 150, "y": 150
    }
  ],
  "edges": [
    {"from": "binary_trees.definition", "to": "binary_trees.traversal.inorder"}
  ]
}
```

**Mastery Color Scheme:**
- 0.0 – 0.33: Red (#EF4444)
- 0.34 – 0.66: Yellow (#F59E0B)
- 0.67 – 1.0: Green (#10B981)

---

## Session Resume System

When a user returns to the tool, they should be able to pick up exactly where they left off.

**What Gets Persisted:**
- `sessions.session_state` JSONB: `{active_panel, scroll_positions, last_question_id, chat_draft}`
- `chat_events`: full chat history restored to ChatPanel
- `subgoals`: current subgoal state restored to SubgoalPanel
- `mastery_states`: current mastery restored to MasteryContext
- `dashboard_states`: dashboard layout and goals

**Resume Flow:**
```
User logs in
  → GET /api/sessions/active
  → If active session exists:
    → Show "Resume Session" modal with topic name, last active time
    → On confirm: load session_state, restore chat history, subgoals, mastery
    → Three-panel layout appears exactly as user left it
  → If no active session:
    → Show SessionStart (topic selection)
```

**Auto-Save (every 60s while session is active):**
```
PUT /api/sessions/{id}/state {
  active_panel: "chat",
  scroll_positions: { search: 0, chat: 450, subgoals: 120 },
  last_question_id: null,
  chat_draft: "what is the difference between..."
}
```

---

## JSX Generation System (Stretch Goal)

For cases where the 3 pre-built templates aren't sufficient, users can request custom visual explanations via raw JSX generation.

**Architecture:**
```
User clicks "Generate Custom Visual" in chat
  → POST /api/chat with {custom_visual: true}
  → GPT/Claude generates JSX code (sandpack-compatible)
  → TemplateRouter detects JSX response
  → Renders in sandpack-react sandbox (safe execution)
  → If render fails → auto-fallback to closest template
```

**Model Selection (via OpenRouter):**
- JSX generation: `anthropic/claude-sonnet-4-20250514` (best at code generation)
- Fallback: `openai/gpt-4o` if Claude is unavailable

**Safety:**
- All JSX runs in sandpack-react sandbox (iframe isolation)
- No access to user data, network, or localStorage
- Render timeout: 5 seconds (kill and fallback if exceeded)

**Cost Estimate:** ~$0.03-0.05 per generation vs ~$0.005-0.01 for templates

---

## Data Flow Diagrams

### Flow 0: Session Resume (V2)

```
User opens app
  → GET /api/sessions/active
  → Active session found (topic: "Binary Trees", last active: 2 hours ago)
  → "Resume Session" modal appears
  → User clicks "Resume"
  → GET /api/chat/history/{session_id} → restore chat
  → GET /api/subgoals/{topic_id} → restore subgoals
  → GET /api/mastery/{topic_id} → restore mastery
  → Load session_state JSON → restore panel focus, scroll positions
  → Three-panel layout appears exactly as user left it
```

### Flow 1: Learning Session (Core — V1)

```
User clicks "Start Session"
  → POST /api/sessions {topic_id}
  → Returns session_id
  → Show pre-assessment modal
  → POST /api/assessments {type: "pre", questions from GPT}
  → User answers → PUT /api/assessments/{id}
  → Three-panel layout appears
  → User searches / chats / manages subgoals
  → All events batched via POST /api/logs/events every 30s
  → User clicks "End Session"
  → Show post-assessment modal
  → POST /api/assessments {type: "post"}
  → Show reflection modal
  → POST /api/reflections
  → PUT /api/sessions/{id}/end
```

### Flow 2: Adaptive Test Cycle (V2)

```
User clicks "Take a Test"
  → TestGenerator shows config (# questions, grading mode)
  → POST /api/tests/generate {topic_id, num_questions, grading_mode, mastery_states}
  → GPT generates questions adapted to mastery levels
  → TestTaker displays questions one at a time
  → User can click "Hint" → POST /api/hints (SSE stream)
    → Level 1: Nudge appears in ThoughtBubble
    → Level 2: Concept explanation (if clicked again)
    → Level 3: Full walkthrough (if clicked again)
  → User submits all answers
  → POST /api/tests/{id}/grade
  → GPT grades each answer (formal or informal mode)
  → GradingResult shows score + rubric + source citations
  → POST /api/mastery/update (mastery engine recalculates)
  → Dashboard auto-refreshes
```

### Flow 3: Template Explanation (V2)

```
User asks in chat: "Explain balanced vs full binary trees"
  → POST /api/chat (with template_hint: true)
  → GPT decides: this is a comparison → generate concept_comparison JSON
  → Response includes {template: "concept_comparison", ...data}
  → TemplateRouter detects template field
  → Routes to ConceptComparison.tsx
  → Component renders side-by-side cards with properties and insights
  → User can also click "Show Walkthrough" button for a step-by-step version
  → Behavioral event logged: {type: "template_view", template: "concept_comparison"}
```

### Flow 4: Dashboard Self-Regulation (V2)

```
User navigates to Dashboard
  → GET /api/dashboard/{topic_id}
  → MasteryHeatmap renders topic × concept grid
  → GoalEditor shows current goals
  → ProgressChart shows mastery over time
  → WeaknessPanel lists weakest concepts

User edits a goal (changes target mastery from 80% to 90%)
  → PUT /api/dashboard/{topic_id}/goals
  → Saved to PostgreSQL
  → Behavioral event: {type: "goal_edit", old: 0.8, new: 0.9}

User clicks "Generate Study Plan"
  → POST /api/dashboard/{topic_id}/study-plan
  → GPT generates prioritized plan based on current mastery + goals
  → Study plan rendered in dashboard

User overrides mastery for a concept (clicks heatmap cell, sets to 0.7)
  → PUT /api/mastery/override {concept_node_id, new_mastery: 0.7}
  → Mastery state updated in DB
  → Recommendations recalculated
  → Behavioral event: {type: "mastery_override", concept: "...", old: 0.4, new: 0.7}
```

---

## Chat Service Design

### Dynamic System Prompt Builder

The chat system prompt adapts based on the user's current context:

```python
def build_chat_system_prompt(
    topic: str,
    subgoals: list[dict],
    mastery_states: list[dict],  # V2
    session_context: dict
) -> str:
    prompt = f"""You are a Socratic learning assistant helping a student learn about {topic}.

Your goals:
1. Encourage exploration before giving answers
2. Ask probing questions to deepen understanding
3. Reference the student's subgoals when relevant
4. Suggest related concepts based on their learning path

Current subgoals:
{format_subgoals(subgoals)}

Student's current mastery levels:
{format_mastery(mastery_states)}

Guidelines:
- For concepts with LOW mastery (<0.3): Explain fundamentals, use simple language
- For concepts with MEDIUM mastery (0.3-0.7): Challenge with deeper questions, introduce nuance
- For concepts with HIGH mastery (>0.7): Connect to advanced topics, explore edge cases

When the student asks to "explain" or "show" a concept, decide whether to:
1. Return a text explanation (for simple answers)
2. Return a template JSON (for visual, step-by-step explanations)

If returning a template, use one of these formats:
- solution_walkthrough: For step-by-step problem solving
- concept_comparison: For comparing 2-4 related concepts
- knowledge_map: For showing concept relationships

To return a template, wrap your response in:
```template
{{valid JSON matching template schema}}
```

Do NOT return raw code or JSX. Only return structured JSON for templates.
"""
    return prompt
```

### SSE Streaming Pattern

Used for both chat and hints:

```python
# Backend (FastAPI) — uses OpenRouter via OpenAI SDK
from fastapi.responses import StreamingResponse
import openai

@router.post("/api/chat")
async def chat(request: ChatRequest):
    async def stream_response():
        client = openai.AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY")
        )
        stream = await client.chat.completions.create(
            model="openai/gpt-4o",
            messages=request.messages,
            stream=True
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")
```

```typescript
// Frontend (React hook)
function useSSE(url: string, body: object) {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const start = useCallback(async () => {
    setIsStreaming(true);
    setContent("");

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n").filter(l => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") { setIsStreaming(false); return; }
        const parsed = JSON.parse(data);
        setContent(prev => prev + parsed.content);
      }
    }
  }, [url, body]);

  return { content, isStreaming, start };
}
```

---

## Behavioral Event Logger

### Event Types

| Event Type | Payload (event_data JSONB) | Trigger |
|-----------|---------------------------|---------|
| search_query | {query, results_count} | User submits search |
| search_click | {url, title, position} | User clicks a search result |
| chat_message | {role, content_length, template_type} | User sends/receives chat message |
| subgoal_create | {subgoal_id, title, is_ai_generated} | New subgoal created |
| subgoal_edit | {subgoal_id, old_title, new_title} | Subgoal title edited |
| subgoal_reorder | {subgoal_id, old_order, new_order} | Subgoal dragged to new position |
| subgoal_check | {subgoal_id} | Subgoal marked complete |
| subgoal_uncheck | {subgoal_id} | Subgoal unmarked |
| panel_focus | {panel: "search"\|"chat"\|"subgoals", duration_ms} | User changes active panel |
| template_view | {template_type, concept_key, duration_ms} | User views a visual template |
| test_start | {test_record_id, num_questions, grading_mode} | User begins a test |
| test_submit | {test_record_id, score, time_taken_ms} | User submits test |
| hint_request | {question_id, hint_level, concept_key} | User requests hint |
| mastery_override | {concept_key, old_mastery, new_mastery} | User overrides mastery |
| goal_create | {goal_id, concept_key, target_mastery} | User creates learning goal |
| goal_edit | {goal_id, old_target, new_target} | User edits goal |
| dashboard_view | {topic_id, duration_ms} | User views dashboard |

### Batch Queue Pattern

```typescript
// Frontend: LoggingContext
class EventBatcher {
  private queue: BehavioralEvent[] = [];
  private flushInterval: NodeJS.Timer;

  constructor() {
    this.flushInterval = setInterval(() => this.flush(), 30000); // 30s
  }

  push(event: BehavioralEvent) {
    this.queue.push({ ...event, created_at: new Date().toISOString() });
    if (this.queue.length >= 50) this.flush(); // Flush at 50 events
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];
    await api.post("/api/logs/events", { events: batch });
  }

  destroy() {
    clearInterval(this.flushInterval);
    this.flush(); // Final flush
  }
}
```

---

## Research Metrics Computation

```sql
-- Search-to-chat ratio per participant per session
SELECT
    s.user_id,
    s.id as session_id,
    COUNT(DISTINCT se.id) as search_count,
    COUNT(DISTINCT ce.id) as chat_count,
    CASE WHEN COUNT(DISTINCT ce.id) > 0
         THEN ROUND(COUNT(DISTINCT se.id)::numeric / COUNT(DISTINCT ce.id), 2)
         ELSE NULL END as search_to_chat_ratio
FROM sessions s
LEFT JOIN search_events se ON se.session_id = s.id
LEFT JOIN chat_events ce ON ce.session_id = s.id AND ce.role = 'user'
GROUP BY s.user_id, s.id;

-- Mastery progression per concept per user
SELECT
    ms.user_id,
    cn.name as concept_name,
    ms.mastery_score,
    ms.attempts_count,
    ms.correct_count,
    CASE WHEN ms.attempts_count > 0
         THEN ROUND(ms.correct_count::numeric / ms.attempts_count, 2)
         ELSE 0 END as accuracy_rate
FROM mastery_states ms
JOIN concept_nodes cn ON cn.id = ms.concept_node_id
ORDER BY ms.user_id, cn.sort_order;

-- Hint escalation patterns (how often do users need Level 3?)
SELECT
    be.user_id,
    be.event_data->>'hint_level' as hint_level,
    COUNT(*) as count
FROM behavioral_events be
WHERE be.event_type = 'hint_request'
GROUP BY be.user_id, be.event_data->>'hint_level'
ORDER BY be.user_id, hint_level;

-- Average mastery gain per session
SELECT
    tr.user_id,
    tr.session_id,
    AVG(tr.total_score / NULLIF(tr.max_score, 0)) as avg_test_score,
    COUNT(tr.id) as tests_taken
FROM test_records tr
WHERE tr.completed_at IS NOT NULL
GROUP BY tr.user_id, tr.session_id;
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: srl_tool
      POSTGRES_USER: srl_user
      POSTGRES_PASSWORD: srl_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://srl_user:srl_password@db:5432/srl_tool
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      GOOGLE_SEARCH_API_KEY: ${GOOGLE_SEARCH_API_KEY}
      GOOGLE_SEARCH_CX: ${GOOGLE_SEARCH_CX}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_SERVICE_ACCOUNT: /app/firebase-service-account.json
    depends_on:
      - db
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host

volumes:
  pgdata:
```

---

## Dashboard Customization & Design Language

### Apple Widget Aesthetic

The SRL Dashboard uses a premium, clean design language inspired by Apple's widget system:

**Visual Properties:**
- Frosted glass card backgrounds: `backdrop-blur-xl bg-slate-800/60 border border-slate-700/50`
- Rounded corners: `rounded-2xl` (16px) for cards, `rounded-full` for badges
- Generous whitespace: `p-6` card padding, `gap-4` grid spacing
- Smooth animations: Framer Motion `layoutId` transitions between states
- Activity ring-style mastery indicators (circular progress with gradient)
- Subtle shadows: `shadow-lg shadow-black/20`
- Micro-interactions: hover scale (1.02), press scale (0.98)

**Customizable by User (stored in dashboard_states.mastery_snapshot JSONB):**
```json
{
  "widget_layout": ["mastery_heatmap", "progress_chart", "goals", "weakness_panel", "study_streak"],
  "widget_visibility": {"mastery_heatmap": true, "progress_chart": true, "goals": true, "weakness_panel": true, "study_streak": true},
  "widget_order": [0, 1, 2, 3, 4],
  "theme_preference": "dark",
  "mastery_display": "rings"  // "rings" | "heatmap" | "bars"
}
```

**Learner Metrics (displayed in dashboard):**
- Mastery per concept (heatmap or rings)
- Progress over time (line chart with trend arrows)
- Weakest concepts ranked with "Study Now" links
- Goal completion progress bars
- Study streak (consecutive active days)
- Total time invested per topic
- Test score history trend
- Hint reliance trend (decreasing = improving)
- AI-generated study plan (user-editable)

### Widget Drag-and-Drop Grid

Users can rearrange dashboard widgets using a CSS Grid + @dnd-kit/sortable layout:
- 2-column grid on desktop, 1-column on narrow screens
- Widgets snap to grid positions
- Drag handle on each widget header
- Layout persists in `dashboard_states`

---

## Session Model

### Session States

| Status | Meaning | Trigger | Post-Assessment |
|--------|---------|---------|-----------------|
| `active` | Currently studying, clock running | User clicks Resume or starts new session | Not yet |
| `paused` | User stepped away, clock stopped | User clicks Pause, switches topic, or closes browser | Not yet |
| `completed` | User finished studying | User clicks "Finish Studying" | Done immediately |
| `expired` | Paused for >24 hours | Daily cleanup job | Deferred to next login |

### Pause / Resume / Finish Controls

- **Pause (⏸):** Stops session timer, saves all state (panel layout, scroll positions, chat draft). Session remains in `paused` status.
- **Resume (▶):** Restarts session timer, restores full state. Appears when session is paused.
- **Finish Studying:** Ends session permanently. Triggers post-assessment with rotating motivational message, reflection modal, final timing save.
- **Topic Switch:** Auto-pauses current topic's session, resumes/starts destination topic's session. Only one topic can be `active` at a time.
- **Browser Close:** `beforeunload` event saves state, marks session as `paused`.
- **No auto-idle detection.** No 4-hour ceiling. User controls the clock explicitly.

### Deferred Post-Assessment

If a session ends without a post-assessment (expired or interrupted), the user sees a non-skippable modal on next login: motivational message + 3-5 assessment questions + reflection form. Must complete before starting/resuming any session.

### Context Usage Indicator

Token meter displayed in header near session timer:
- 0-50% context: green (unobtrusive)
- 50-75%: yellow
- 75-90%: orange + tooltip ("Context getting full — consider a fresh session")
- 90%+: red — backend auto-summarizes oldest messages to free space

---

## Offline Sync System

### IndexedDB Event Queue

When network requests fail, behavioral events are stored locally in IndexedDB using the `idb` library:

```typescript
import { openDB } from 'idb';

const db = await openDB('srl-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending_events', { keyPath: 'id', autoIncrement: true });
  }
});

// On network failure: store locally
async function queueEvent(event: BehavioralEvent) {
  await db.add('pending_events', { ...event, queued_at: new Date().toISOString() });
}

// On reconnect: replay all pending events
async function syncPendingEvents() {
  const events = await db.getAll('pending_events');
  if (events.length === 0) return;
  await api.post('/api/logs/events', { events });
  await db.clear('pending_events');
}

// Listen for connectivity changes
window.addEventListener('online', syncPendingEvents);
```

### User-Facing Indicators
- Offline: banner "You're offline — progress saved locally"
- Reconnecting: "Back online — syncing..."
- Synced: "All caught up" (auto-dismisses after 3s)

### What Works Offline
- Subgoal management (check, edit, reorder) — local state changes synced later
- Reviewing existing chat history and search results
- Dashboard viewing (cached data)

### What Requires Connectivity
- Chat (needs LLM API)
- Search (needs Google API)
- Test generation and grading (needs LLM API)

---

## Data Retention & Privacy

- All participant data retained for **6 months** from study completion
- Monthly cleanup job deletes data older than 6 months (cascading delete by user_id)
- Participants can request deletion via "Delete My Data" in settings
- Deletion cascades through all tables: sessions, events, mastery, tests, reflections, goals, dashboard states
- Researcher CSV exports are the researcher's responsibility to manage separately
- Firebase Auth user record deleted alongside PostgreSQL data

---

## Backup Strategy

### Layer 1: Railway Daily Snapshots (automatic)
- Included in Railway Hobby plan ($5/mo)
- Daily automatic PostgreSQL snapshots
- 7-day retention, one-click restore via Railway dashboard

### Layer 2: Scheduled pg_dump to Firebase Storage (every 6 hours)
```python
# backup_job.py — runs every 6 hours via cron
import subprocess, firebase_admin
from firebase_admin import storage
from datetime import datetime

dump_file = f"srl_backup_{datetime.now().strftime('%Y%m%d_%H%M')}.sql.gz"
subprocess.run(f"pg_dump $DATABASE_URL | gzip > /tmp/{dump_file}", shell=True)

bucket = storage.bucket()
blob = bucket.blob(f"backups/{dump_file}")
blob.upload_from_filename(f"/tmp/{dump_file}")
```

### Recovery
- Routine issues: restore from Railway snapshot (minutes)
- Disaster recovery: download latest pg_dump from Firebase Storage, restore to new PostgreSQL instance

---

## Accessibility (WCAG 2.1 AA)

### Built-in via shadcn/ui + Radix Primitives
- Keyboard navigation on all interactive elements
- Focus management for modals, dropdowns, popovers
- ARIA labels and roles on all components
- Screen reader announcements for state changes

### Color-Blind Safe Mastery Indicators
Alongside the red/yellow/green color scheme, mastery cells include pattern overlays:
- Low mastery (0-33%): red + "×" crosshatch pattern
- Medium mastery (34-66%): yellow + "~" wave pattern
- High mastery (67-100%): green + "✓" check pattern

### Contrast Ratios
- Dark theme (slate-900 bg, white text): 15.4:1 ratio (exceeds AA minimum of 4.5:1)
- All interactive elements meet minimum 3:1 contrast for non-text elements
- Focus indicators: 2px solid ring in blue-400 (visible against dark backgrounds)

---

## Security Considerations

| Concern | Implementation |
|---------|---------------|
| Authentication | Firebase Auth (managed tokens, Google Sign-In, no custom JWT needed) |
| API Keys | All keys in .env, never committed to git |
| SQL Injection | SQLAlchemy ORM (parameterized queries) |
| XSS | React auto-escapes; no dangerouslySetInnerHTML |
| CORS | Whitelist frontend origin only |
| Rate Limiting | Per-user: 60 LLM calls/min overall (30 chat, 20 hints, 10 grading, 5 test gen) |
| Data Privacy | User data isolated by user_id; admin access requires role check; 6-month retention; deletion on request |
| Template Safety | JSON data only — no executable code from LLM |
| Backup | Railway daily snapshots + 6-hourly pg_dump to Firebase Storage |
