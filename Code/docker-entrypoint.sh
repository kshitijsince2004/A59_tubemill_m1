#!/bin/sh
set -e

MIGRATE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}"

echo "Running migrationsâ€¦"
DATABASE_URL="$MIGRATE_URL" node server/dist/db/migrate.js

echo "Starting APIâ€¦"
exec node server/dist/index.js
