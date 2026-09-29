#!/usr/bin/env bash
# Rebuilds a throwaway local Postgres database with the pilot schema, seed and
# demo seed, for testing without a Supabase project.
#
#   scripts/local-db.sh            # database "ssn_pilot_test"
#   SSN_TEST_DB=other scripts/local-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${SSN_TEST_DB:-ssn_pilot_test}"

dropdb --if-exists "$DB"
createdb "$DB"

run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

run supabase/local/supabase-stub.sql
for migration in supabase/migrations/*.sql; do
  run "$migration"
done
run supabase/seed.sql
run supabase/demo-seed.sql

echo "Local database \"$DB\" is ready."
