# LearnFlow — Self-Regulated Learning Tool

A research-grade Self-Regulated Learning (SRL) tool for UIUC (Prof. Jessie Chin's lab). Integrates web search (Google Custom Search) and conversational AI search (OpenRouter/GPT-4o) in a unified interface with an interactive Subgoal Manager, adaptive mastery engine, and SRL dashboard.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Framer Motion + react-resizable-panels
- **Backend:** FastAPI (Python) with SSE streaming
- **Database:** PostgreSQL + SQLAlchemy + Alembic
- **LLM:** OpenRouter API (GPT-4o default)
- **Search:** Google Custom Search API
- **Auth:** Firebase Authentication

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Docker

```bash
docker-compose up
```

## Project Structure

```
LearnFlow/
├── backend/
│   ├── main.py          # FastAPI entry point
│   ├── routers/         # API route handlers
│   ├── services/        # Business logic
│   ├── engines/         # V2 adaptive engines
│   ├── models/          # SQLAlchemy models
│   └── utils/           # Config, Firebase, prompts
├── frontend/
│   └── src/
│       ├── components/  # React components
│       ├── api/         # API client
│       ├── contexts/    # React contexts
│       ├── hooks/       # Custom hooks
│       └── types/       # TypeScript types
├── docs/
└── scripts/
```
