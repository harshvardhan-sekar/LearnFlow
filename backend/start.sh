#!/bin/sh
set -e

# Normalise DATABASE_URL scheme: Railway provides postgresql:// but asyncpg needs postgresql+asyncpg://
if [ -n "$DATABASE_URL" ]; then
    DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|^postgres://|postgresql+asyncpg://|' | sed 's|^postgresql://|postgresql+asyncpg://|')
    export DATABASE_URL
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
