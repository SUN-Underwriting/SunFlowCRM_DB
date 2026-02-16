#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "════════════════════════════════════════════════"
echo "  SuperTokens — запуск dev-окружения"
echo "════════════════════════════════════════════════"
echo ""

# ── 1. Переключаем .env на SuperTokens ──────────────
echo "[1/5] Переключаю .env на SuperTokens..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' 's/^AUTH_PROVIDER=.*/AUTH_PROVIDER="supertokens"/' .env
  sed -i '' 's/^NEXT_PUBLIC_AUTH_PROVIDER=.*/NEXT_PUBLIC_AUTH_PROVIDER="supertokens"/' .env
else
  sed -i 's/^AUTH_PROVIDER=.*/AUTH_PROVIDER="supertokens"/' .env
  sed -i 's/^NEXT_PUBLIC_AUTH_PROVIDER=.*/NEXT_PUBLIC_AUTH_PROVIDER="supertokens"/' .env
fi
echo "  AUTH_PROVIDER=supertokens"

# ── 2. Останавливаем Stack Auth (экономим RAM) ──────
echo ""
echo "[2/5] Останавливаю Stack Auth контейнеры..."
docker-compose -f docker-compose.stack.yml stop 2>/dev/null || true
echo "  Stack Auth остановлен"

# ── 3. Запускаем необходимые контейнеры ──────────────
echo ""
echo "[3/5] Запускаю PostgreSQL + Redis + SuperTokens..."
docker-compose -f docker-compose.yml up -d postgres redis supertokens
echo "  Жду готовности SuperTokens..."

for i in $(seq 1 30); do
  if curl -sf http://localhost:3567/hello > /dev/null 2>&1; then
    echo "  SuperTokens готов!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ⚠ SuperTokens долго стартует, но продолжаем..."
  fi
  sleep 1
done

# ── 4. Чистим кэш Next.js ───────────────────────────
echo ""
echo "[4/5] Чищу кэш Next.js..."
rm -rf .next
echo "  .next удалён"

# ── 5. Запускаем dev-сервер ──────────────────────────
echo ""
echo "[5/5] Запускаю Next.js dev-сервер..."
echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ Режим: SuperTokens"
echo "  🌐 Приложение: http://localhost:3000"
echo "  🔑 SuperTokens Core: http://localhost:3567"
echo "  🗄  PostgreSQL: localhost:5432"
echo "════════════════════════════════════════════════"
echo ""

exec npm run dev
