#!/usr/bin/env bash
# Ручная проверка состояния production-стека после деплоя.
# Использование: ./scripts/deploy/health-check.sh

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="/Users/sun_serv/Documents/sunflow_secret/.env.prod"
APP_URL="${APP_URL:-https://testcloud24.com}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail() { echo -e "${RED}[FAIL]${NC}  $1"; }

if [ ! -f "$ENV_FILE" ]; then
  fail "Production .env not found at $ENV_FILE"
  exit 1
fi

echo ""
echo "=== Container status ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo ""
echo "=== HTTP checks ==="

check_http() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$code" -ge 200 ] && [ "$code" -lt 500 ]; then
    ok "$name → $url — HTTP $code"
  elif [ "$code" = "000" ]; then
    fail "$name → $url — no response"
  else
    warn "$name → $url — HTTP $code"
  fi
}

check_http "App (root)"        "$APP_URL"
check_http "App (health)"      "$APP_URL/api/health"
check_http "App (auth)"        "$APP_URL/api/auth/signout"

STACK_API=$(grep -E '^NEXT_PUBLIC_STACK_API_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
if [ -n "$STACK_API" ]; then
  check_http "Stack Auth API"  "$STACK_API/"
fi

echo ""
echo "=== Recent app logs (last 20 lines) ==="
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=20 app 2>/dev/null || true
