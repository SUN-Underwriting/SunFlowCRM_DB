#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "════════════════════════════════════════════════"
echo "  Stack Auth — запуск dev-окружения"
echo "════════════════════════════════════════════════"
echo ""

# ── 1. Переключаем .env на Stack Auth ───────────────
echo "[1/6] Переключаю .env на Stack Auth..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' 's/^AUTH_PROVIDER=.*/AUTH_PROVIDER="stack"/' .env
  sed -i '' 's/^NEXT_PUBLIC_AUTH_PROVIDER=.*/NEXT_PUBLIC_AUTH_PROVIDER="stack"/' .env
else
  sed -i 's/^AUTH_PROVIDER=.*/AUTH_PROVIDER="stack"/' .env
  sed -i 's/^NEXT_PUBLIC_AUTH_PROVIDER=.*/NEXT_PUBLIC_AUTH_PROVIDER="stack"/' .env
fi
echo "  AUTH_PROVIDER=stack"

# ── 2. Проверяем credentials ────────────────────────
echo ""
echo "[2/6] Проверяю Stack Auth credentials..."

source .env 2>/dev/null || true
if [[ "$NEXT_PUBLIC_STACK_PROJECT_ID" == *"placeholder"* ]] || \
   [[ "$NEXT_PUBLIC_STACK_PROJECT_ID" == *"00000000"* ]] || \
   [[ -z "$NEXT_PUBLIC_STACK_PROJECT_ID" ]]; then
  echo ""
  echo "  ⚠  Stack Auth credentials не настроены!"
  echo ""
  echo "  Откройте http://localhost:8101 и создайте проект,"
  echo "  затем обновите .env:"
  echo ""
  echo "    NEXT_PUBLIC_STACK_PROJECT_ID=\"proj_...\""
  echo "    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=\"pck_...\""
  echo "    STACK_SECRET_SERVER_KEY=\"ssk_...\""
  echo ""
  echo "  После этого запустите скрипт повторно."
  echo ""
fi

# ── 3. Останавливаем SuperTokens (экономим RAM) ─────
echo "[3/6] Останавливаю SuperTokens..."
docker stop sunappag-supertokens-1 2>/dev/null || true
echo "  SuperTokens остановлен"

# ── 4. Запускаем основную БД + Stack Auth ────────────
echo ""
echo "[4/6] Запускаю PostgreSQL (основная БД) + Redis..."
docker-compose -f docker-compose.yml up -d postgres redis

echo ""
echo "[4/6] Запускаю Stack Auth (PostgreSQL, ClickHouse, Server, Inbucket)..."
docker-compose -f docker-compose.stack.yml up -d

echo "  Жду готовности Stack Auth..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:8101 > /dev/null 2>&1; then
    echo "  Stack Auth Dashboard готов!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "  ⚠ Stack Auth долго стартует. Проверьте: docker logs stack-server"
  fi
  sleep 2
done

# ── 5. Чистим кэш Next.js ───────────────────────────
echo ""
echo "[5/6] Чищу кэш Next.js..."
rm -rf .next
echo "  .next удалён"

# ── 6. Запускаем dev-сервер ──────────────────────────
echo ""
echo "[6/6] Запускаю Next.js dev-сервер..."
echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ Режим: Stack Auth (self-hosted)"
echo "  🌐 Приложение:       http://localhost:3000"
echo "  🔑 Stack Dashboard:  http://localhost:8101"
echo "  📡 Stack API:        http://localhost:8102"
echo "  📧 Emails (Inbucket):http://localhost:8105"
echo "  🗄  PostgreSQL:       localhost:5432"
echo "════════════════════════════════════════════════"
echo ""

exec npm run dev
