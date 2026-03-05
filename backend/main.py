from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, auth, chat, concepts, mastery, search, subjects, subgoals, tests, topics, sessions, logs, assessments, reflections

app = FastAPI(
    title="LearnFlow — SRL Learning Tool",
    description="Self-Regulated Learning tool with dual search interface and adaptive mastery engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(topics.router)
app.include_router(sessions.router)
app.include_router(subgoals.router)
app.include_router(concepts.router)
app.include_router(mastery.router)
app.include_router(tests.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(logs.router)
app.include_router(assessments.router)
app.include_router(reflections.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
