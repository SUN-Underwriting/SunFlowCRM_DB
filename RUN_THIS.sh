#!/bin/bash
# Запустите этот скрипт для исправления EMFILE и запуска сервера
# Выполните: ./RUN_THIS.sh

echo "================================================"
echo "  🚀 Финальная настройка Dev сервера"
echo "================================================"
echo ""

echo "📋 Шаг 1: Увеличение лимита file descriptors..."
echo "   (потребуется ввести ваш пароль)"
echo ""

sudo launchctl limit maxfiles 65536 200000

if [ $? -eq 0 ]; then
    echo "✅ Лимит увеличен успешно!"
else
    echo "❌ Не удалось увеличить лимит. Попробуйте вручную:"
    echo "   sudo launchctl limit maxfiles 65536 200000"
    exit 1
fi

echo ""
echo "📋 Шаг 2: Проверка новых лимитов..."
launchctl limit maxfiles

echo ""
echo "📋 Шаг 3: Остановка старого dev сервера..."
pkill -f "next dev" 2>/dev/null
sleep 2

echo ""
echo "📋 Шаг 4: Запуск dev сервера..."
echo ""

cd "/Users/usov/Documents/DEV/SunApp AG"
ulimit -n 10240
npm run dev
