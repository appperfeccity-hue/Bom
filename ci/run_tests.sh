#!/usr/bin/env bash
# ============================================================================
# PERFECCITY MVP v1.1.5 – CI Test Runner
# ============================================================================
# Usage:
#   ./ci/run_tests.sh
#
# Environment variables (required):
#   DB_HOST     - PostgreSQL host
#   DB_USER     - PostgreSQL user
#   DB_NAME     - PostgreSQL database name
#   DB_PORT     - PostgreSQL port (default: 5432)
#   PGPASSWORD  - PostgreSQL password (or use .pgpass)
#
# For Supabase:
#   DB_HOST=db.fbiemsbykrmrbqcsobvh.supabase.co
#   DB_USER=postgres
#   DB_NAME=postgres
#   DB_PORT=5432
# ============================================================================

set -euo pipefail

DB_PORT="${DB_PORT:-5432}"

echo "============================================="
echo "PERFECCITY MVP v1.1.5 – Regression Test Suite"
echo "============================================="
echo ""
echo "Host: ${DB_HOST}"
echo "Port: ${DB_PORT}"
echo "User: ${DB_USER}"
echo "Database: ${DB_NAME}"
echo ""

# Verify connection
echo "[1/3] Verifying database connection..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT version();" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "ERROR: Cannot connect to database"
    exit 1
fi
echo "  ✓ Connection successful"
echo ""

# Verify schema exists
echo "[2/3] Verifying perfecity schema..."
SCHEMA_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c \
    "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'perfecity');" 2>/dev/null | tr -d ' ')
if [ "${SCHEMA_EXISTS}" != "t" ]; then
    echo "ERROR: perfecity schema does not exist. Run baseline first."
    exit 1
fi
echo "  ✓ Schema exists"
echo ""

# Run regression tests
echo "[3/3] Running regression tests..."
echo ""
psql -v ON_ERROR_STOP=1 \
     -h "${DB_HOST}" \
     -p "${DB_PORT}" \
     -U "${DB_USER}" \
     -d "${DB_NAME}" \
     -f "$(dirname "$0")/../tests/regression_v1.1.5.sql"

EXIT_CODE=$?

echo ""
if [ ${EXIT_CODE} -eq 0 ]; then
    echo "============================================="
    echo "ALL TESTS PASSED ✓"
    echo "v1.1.5 Execution-Verified"
    echo "============================================="
else
    echo "============================================="
    echo "TESTS FAILED ✗"
    echo "Exit code: ${EXIT_CODE}"
    echo "============================================="
fi

exit ${EXIT_CODE}
