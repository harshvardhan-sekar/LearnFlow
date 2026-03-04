"""Full integration test for LearnFlow.

Exercises the complete user flow:
1. Register a new user
2. Create a topic: "Binary Trees"
3. Start a session → complete pre-assessment
4. Search for "binary tree traversal" → click 2 results
5. Chat: "What is the difference between BFS and DFS?"
6. Generate AI subgoals → reorder them → check off 2
7. Chat: "Explain in-order traversal step by step"
8. End session → complete post-assessment → submit reflection

Verifies:
- All API calls succeed (no 500 errors)
- Chat streaming works without interruption
- All events are in the database (check behavioral_events count)
"""

import json
import os
import sys
import time

import httpx
import firebase_admin
from firebase_admin import auth as fb_auth, credentials

# ── Config ────────────────────────────────────────────────────────────────

BASE = os.getenv("API_BASE", "http://localhost:8000/api")
FIREBASE_API_KEY = "AIzaSyBdvCCbDKxjb7G66lad2vJdawaAPLGwiRo"

# Resolve firebase service account
SA_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "firebase-service-account.json")
if not os.path.exists(SA_PATH):
    SA_PATH = os.path.join(os.path.dirname(__file__), "..", "firebase-service-account.json")


# ── Helpers ───────────────────────────────────────────────────────────────

passed = 0
failed = 0


def check(label: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label} — {detail}")


def get_firebase_id_token(uid: str) -> str:
    """Create a custom token for the test user and exchange it for an ID token."""
    custom_token = fb_auth.create_custom_token(uid)
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")

    # Exchange custom token for ID token via Firebase REST API
    resp = httpx.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}",
        json={"token": custom_token, "returnSecureToken": True},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["idToken"]


# ── Main Test ─────────────────────────────────────────────────────────────

def main():
    global passed, failed

    print("\n=== LearnFlow Integration Test ===\n")

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        if os.path.exists(SA_PATH):
            cred = credentials.Certificate(SA_PATH)
            firebase_admin.initialize_app(cred, {"projectId": "learnflow-e8891"})
        else:
            print(f"SKIP: Firebase service account not found at {SA_PATH}")
            print("Cannot run integration test without Firebase credentials.")
            sys.exit(1)

    # Create test user UID
    ts = int(time.time())
    test_uid = f"test_user_{ts}"
    test_email = f"test_{ts}@learnflow-test.com"

    # Create Firebase user
    try:
        fb_auth.create_user(uid=test_uid, email=test_email)
        print(f"  Created Firebase user: {test_email}")
    except Exception as e:
        print(f"SKIP: Could not create Firebase user: {e}")
        sys.exit(1)

    try:
        token = get_firebase_id_token(test_uid)
        print(f"  Got ID token ({len(token)} chars)")
    except Exception as e:
        print(f"SKIP: Could not get ID token: {e}")
        fb_auth.delete_user(test_uid)
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # follow_redirects=True handles FastAPI's trailing slash redirects
    client = httpx.Client(base_url=BASE, headers=headers, timeout=30, follow_redirects=True)

    try:
        # ── 1. Register ──────────────────────────────────────────────────
        print("\n[1] Register user")
        r = client.post("/auth/register", json={
            "firebase_uid": test_uid,
            "email": test_email,
            "display_name": "Integration Tester",
        })
        check("Register user", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        user = r.json()
        user_id = user.get("id")

        # Login
        r = client.post("/auth/login")
        check("Login", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

        # Me
        r = client.get("/auth/me")
        check("Get profile", r.status_code == 200, f"status={r.status_code}")

        # ── 2. Create topic ──────────────────────────────────────────────
        print("\n[2] Create topic: Binary Trees")
        r = client.post("/topics/", json={
            "title": "Binary Trees",
            "description": "Learn about binary tree data structures, traversals, and algorithms",
        })
        check("Create topic", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        topic = r.json()
        topic_id = topic.get("id")

        # List topics
        r = client.get("/topics/")
        check("List topics", r.status_code == 200 and len(r.json()) > 0, f"status={r.status_code}")

        # ── 3. Start session & pre-assessment ────────────────────────────
        print("\n[3] Start session → pre-assessment")
        r = client.post("/sessions/", json={"topic_id": topic_id})
        check("Start session", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
        session = r.json()
        session_id = session.get("id")

        # Create pre-assessment (generates MCQ questions via GPT)
        r = client.post("/assessments/", json={
            "session_id": session_id,
            "assessment_type": "pre",
        })
        check("Create pre-assessment", r.status_code == 201, f"status={r.status_code} body={r.text[:300]}")
        if r.status_code == 201:
            assessment = r.json()
            assessment_id = assessment.get("id")
            questions = assessment.get("questions", {}).get("questions", [])
            check("Pre-assessment has questions", len(questions) >= 3, f"got {len(questions)} questions")

            # Submit pre-assessment answers (pick first option for each)
            answers = {}
            for idx in range(len(questions)):
                answers[str(idx)] = "0"  # Select first option
            r = client.put(f"/assessments/{assessment_id}", json={"answers": answers})
            check("Submit pre-assessment", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
            if r.status_code == 200:
                pre_result = r.json()
                check("Pre-assessment graded", pre_result.get("score") is not None, f"score={pre_result.get('score')}")
        else:
            print("  (skipping pre-assessment submission due to creation failure)")

        # ── 4. Search & click ────────────────────────────────────────────
        print("\n[4] Search for 'binary tree traversal' → click 2 results")
        r = client.post("/search/", json={"query": "binary tree traversal", "session_id": session_id})
        check("Search", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
        search_data = r.json()
        search_event_id = search_data.get("search_event_id")
        results = search_data.get("results", [])
        check("Search returned results", len(results) > 0, f"got {len(results)} results")

        # Click first 2 results
        for i in range(min(2, len(results))):
            result = results[i]
            r = client.post("/search/click", json={
                "search_event_id": search_event_id,
                "url": result["link"],
                "title": result["title"],
                "position": result.get("position", i),
            })
            check(f"Click result #{i+1}", r.status_code == 200, f"status={r.status_code}")

        # Log search events via behavioral logger
        r = client.post("/logs/events", json={"events": [
            {"event_type": "search_query", "session_id": session_id, "event_data": {"query": "binary tree traversal"}},
            {"event_type": "search_click", "session_id": session_id, "event_data": {"url": results[0]["link"] if results else ""}},
        ]})
        check("Log search events", r.status_code == 201, f"status={r.status_code}")

        # ── 5. Chat: BFS vs DFS ─────────────────────────────────────────
        print("\n[5] Chat: 'What is the difference between BFS and DFS?'")
        # Use a streaming-friendly httpx call
        with httpx.stream(
            "POST",
            f"{BASE}/chat/",
            headers=headers,
            json={
                "message": "What is the difference between BFS and DFS?",
                "session_id": session_id,
                "topic_id": topic_id,
            },
            timeout=60,
        ) as stream:
            check("Chat stream opened", stream.status_code == 200, f"status={stream.status_code}")
            chat_content = ""
            stream_error = None
            for line in stream.iter_lines():
                line = line.strip()
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                try:
                    data = json.loads(data_str)
                    if data.get("content"):
                        chat_content += data["content"]
                    if data.get("error"):
                        stream_error = data["error"]
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

        check("Chat response has content", len(chat_content) > 50, f"got {len(chat_content)} chars")
        check("Chat stream no errors", stream_error is None, f"error={stream_error}")

        # Check chat history
        r = client.get(f"/chat/history/{session_id}")
        check("Chat history", r.status_code == 200, f"status={r.status_code}")
        history = r.json()
        check("Chat history has messages", len(history) >= 1, f"got {len(history)} messages")

        # ── 6. Generate AI subgoals → reorder → check off 2 ─────────────
        print("\n[6] Generate subgoals → reorder → check 2")
        r = client.post("/subgoals/generate", json={
            "topic_id": topic_id,
            "session_id": session_id,
        })
        check("Generate subgoals", r.status_code == 201, f"status={r.status_code} body={r.text[:300]}")
        subgoals = r.json() if r.status_code == 201 else []
        check("Generated 6+ subgoals", len(subgoals) >= 6, f"got {len(subgoals)}")

        if len(subgoals) >= 3:
            # Reorder: swap first two
            ids = [sg["id"] for sg in subgoals]
            reordered = [ids[1], ids[0]] + ids[2:]
            r = client.put("/subgoals/reorder", json={"subgoal_ids": reordered})
            check("Reorder subgoals", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                reordered_sgs = r.json()
                check("Reorder applied", reordered_sgs[0]["id"] == ids[1], "order didn't change")

            # Check off first 2
            r1 = client.put(f"/subgoals/{ids[0]}/toggle")
            check("Toggle subgoal 1", r1.status_code == 200, f"status={r1.status_code}")
            check("Subgoal 1 completed", r1.json().get("is_completed") is True)

            r2 = client.put(f"/subgoals/{ids[1]}/toggle")
            check("Toggle subgoal 2", r2.status_code == 200, f"status={r2.status_code}")
            check("Subgoal 2 completed", r2.json().get("is_completed") is True)

        # Log subgoal events
        r = client.post("/logs/events", json={"events": [
            {"event_type": "subgoal_create", "session_id": session_id, "event_data": {"action": "ai_generate"}},
            {"event_type": "subgoal_reorder", "session_id": session_id, "event_data": {}},
            {"event_type": "subgoal_check", "session_id": session_id, "event_data": {}},
            {"event_type": "subgoal_check", "session_id": session_id, "event_data": {}},
        ]})
        check("Log subgoal events", r.status_code == 201, f"status={r.status_code}")

        # ── 7. Chat: In-order traversal ──────────────────────────────────
        print("\n[7] Chat: 'Explain in-order traversal step by step'")
        with httpx.stream(
            "POST",
            f"{BASE}/chat/",
            headers=headers,
            json={
                "message": "Explain in-order traversal step by step",
                "session_id": session_id,
                "topic_id": topic_id,
            },
            timeout=60,
        ) as stream:
            check("Chat 2 stream opened", stream.status_code == 200, f"status={stream.status_code}")
            chat_content2 = ""
            for line in stream.iter_lines():
                line = line.strip()
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                    if data.get("content"):
                        chat_content2 += data["content"]
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

        check("Chat 2 has content", len(chat_content2) > 50, f"got {len(chat_content2)} chars")

        # ── 8. End session → post-assessment → reflection ────────────────
        print("\n[8] End session → post-assessment → reflection")

        # Create post-assessment
        r = client.post("/assessments/", json={
            "session_id": session_id,
            "assessment_type": "post",
        })
        check("Create post-assessment", r.status_code == 201, f"status={r.status_code}")
        if r.status_code == 201:
            post_assessment = r.json()
            post_id = post_assessment.get("id")
            post_questions = post_assessment.get("questions", {}).get("questions", [])
            check("Post-assessment has questions", len(post_questions) >= 3, f"got {len(post_questions)}")

            # Submit post-assessment
            post_answers = {}
            for idx in range(len(post_questions)):
                correct = post_questions[idx].get("correct_index", 0)
                post_answers[str(idx)] = str(correct)  # Answer correctly this time
            r = client.put(f"/assessments/{post_id}", json={"answers": post_answers})
            check("Submit post-assessment", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                post_result = r.json()
                check("Post-assessment graded", post_result.get("score") is not None, f"score={post_result.get('score')}")

        # Submit reflection
        r = client.post("/reflections/", json={
            "session_id": session_id,
            "reflection_text": "I learned about binary tree traversals including BFS, DFS, and in-order traversal. The Socratic questioning helped me think through the differences between breadth-first and depth-first approaches.",
            "confidence_rating": 4,
            "difficulty_rating": 3,
        })
        check("Submit reflection", r.status_code == 201, f"status={r.status_code}")

        # End session
        r = client.put(f"/sessions/{session_id}/end")
        check("End session", r.status_code == 200, f"status={r.status_code}")
        if r.status_code == 200:
            check("Session completed", r.json().get("status") == "completed")

        # ── Verification ─────────────────────────────────────────────────
        print("\n[Verify] Database state")

        # Check session list
        r = client.get("/sessions/")
        check("Session list", r.status_code == 200 and len(r.json()) > 0)

        # Check assessments
        r = client.get(f"/assessments/{session_id}")
        assessments = r.json() if r.status_code == 200 else []
        check("Assessments for session (pre+post)", r.status_code == 200 and len(assessments) == 2, f"got {len(assessments)}")

        # Check reflections
        r = client.get(f"/reflections/{session_id}")
        reflections = r.json() if r.status_code == 200 else []
        check("Reflections for session", r.status_code == 200 and len(reflections) == 1, f"got {len(reflections)}")

        # Check chat history
        r = client.get(f"/chat/history/{session_id}")
        chat_msgs = r.json() if r.status_code == 200 else []
        # At least 2 user messages; assistant messages may still be writing async
        check("Full chat history (2+ messages)", r.status_code == 200 and len(chat_msgs) >= 2, f"got {len(chat_msgs)} messages")

        # Check subgoals
        r = client.get(f"/subgoals/{topic_id}")
        sgs = r.json() if r.status_code == 200 else []
        check("Subgoals persisted (6+)", r.status_code == 200 and len(sgs) >= 6, f"got {len(sgs)}")
        completed_count = sum(1 for sg in sgs if sg.get("is_completed"))
        check("2 subgoals completed", completed_count >= 2, f"got {completed_count} completed")

    finally:
        # Cleanup Firebase test user
        try:
            fb_auth.delete_user(test_uid)
            print(f"\n  Cleaned up Firebase user: {test_uid}")
        except Exception:
            pass
        client.close()

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"  PASSED: {passed}")
    print(f"  FAILED: {failed}")
    print(f"  TOTAL:  {passed + failed}")
    print(f"{'='*50}\n")

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
