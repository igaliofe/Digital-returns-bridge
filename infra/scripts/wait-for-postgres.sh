#!/bin/sh
# Wait for PostgreSQL to be ready before starting the server
set -e

HOST="${1:-postgres}"
PORT="${2:-5432}"
USER="${3:-drb}"

echo "Waiting for PostgreSQL at $HOST:$PORT..."

until pg_isready -h "$HOST" -p "$PORT" -U "$USER"; do
  echo "PostgreSQL is not ready yet. Retrying in 2 seconds..."
  sleep 2
done

echo "PostgreSQL is ready!"
exec "$@"
