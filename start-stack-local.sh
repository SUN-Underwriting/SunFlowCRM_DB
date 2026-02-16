#!/bin/bash
# Запуск Stack Auth локально через Docker
# Выполните: ./start-stack-local.sh

set -e

echo "================================================"
echo "  🚀 Запуск Stack Auth локально"
echo "================================================"
echo ""

cd "/Users/usov/Documents/DEV/SunApp AG"

echo "📋 Шаг 1: Проверка Docker..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker не запущен или недоступен"
    echo ""
    echo "Запустите Docker Desktop или Colima:"
    echo "   colima start"
    echo ""
    exit 1
fi
echo "✅ Docker работает"
echo ""

echo "📋 Шаг 2: Остановка старых контейнеров (если есть)..."
docker-compose -f docker-compose.stack.yml down 2>/dev/null || true
echo ""

echo "📋 Шаг 3: Запуск Stack Auth..."
echo "   - PostgreSQL на порту 5434"
echo "   - Stack Dashboard на порту 8101"
echo "   - Stack API на порту 8102"
echo "   - Inbucket (email) на порту 8105"
echo ""

docker-compose -f docker-compose.stack.yml up -d

echo ""
echo "⏳ Ожидание запуска сервисов (15 секунд)..."
sleep 15

echo ""
echo "📋 Шаг 4: Проверка статуса..."
docker-compose -f docker-compose.stack.yml ps

echo ""
echo "================================================"
echo "  ✅ Stack Auth запущен локально!"
echo "================================================"
echo ""
echo "🌐 Откройте в браузере:"
echo "   Dashboard: http://localhost:8101"
echo "   API:       http://localhost:8102"
echo "   Emails:    http://localhost:8105"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Откройте http://localhost:8101"
echo "   2. Создайте admin аккаунт"
echo "   3. Создайте проект 'Sun MGA'"
echo "   4. Скопируйте credentials"
echo "   5. Обновите .env файл"
echo ""
echo "📚 Подробнее: STACK_LOCAL_SETUP.md"
echo ""
