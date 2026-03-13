# Deploy Runbook — SunFlowCRM

Руководство по тестированию CI/CD, ручному деплою и откату.

---

## Нормальный сценарий (PR → merge → автодеплой)

```
feature-branch ──► pull request ──► CI checks ──► merge to main ──► автодеплой
```

1. Разработчик создаёт branch от `main` и открывает Pull Request.
2. Автоматически запускается `CI — Pull Request Checks`:
   - ESLint
   - TypeScript type check
   - Docker Compose syntax validation
   - Dockerfile lint
3. После того как все проверки прошли и PR одобрен — нажимаем **Merge**.
4. Автоматически запускается `Deploy — Production (Mac Mini)`:
   - `docker compose build`
   - `prisma migrate deploy`
   - `docker compose up -d`
   - HTTP health checks
5. В GitHub Actions видим зелёный статус и итоговый summary с версией.

---

## Ручной деплой (если нужно задеплоить без PR)

Перейти на Mac Mini и выполнить:

```bash
cd /Users/sun_serv/Documents/Dev/SunFlow
git pull origin main
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod build
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod run --rm migrate
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod up -d --remove-orphans
./scripts/deploy/health-check.sh
```

---

## Принудительный запуск workflow из GitHub

Перейти: **GitHub → Actions → Deploy — Production (Mac Mini) → Run workflow → main**.

---

## Откат (Rollback)

### Быстрый откат через Git

```bash
# На Mac Mini
cd /Users/sun_serv/Documents/Dev/SunFlow

# Посмотреть последние коммиты
git log --oneline -10

# Вернуться к нужному коммиту (например, abc1234)
git checkout abc1234

# Пересобрать и поднять стек с предыдущей версией кода
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod build
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod up -d --remove-orphans

# Проверить
./scripts/deploy/health-check.sh
```

> После отката обязательно вернуться на `main` после исправления проблемы:
> ```bash
> git checkout main
> git pull origin main
> ```

### Откат через Docker образы (если образы не были перезаписаны)

```bash
# Посмотреть доступные образы
docker images sunflow-app

# Если нужный образ сохранён, запустить с ним без пересборки
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Откат миграций

Prisma не поддерживает автоматический rollback миграций.
При откате кода на версию без конкретной миграции:

1. Убедиться, что приложение совместимо со схемой (обычно — да, если миграции обратно совместимы).
2. Если нет — вручную написать DOWN-миграцию или восстановить backup БД.
3. Backup БД создаётся командой:

```bash
docker exec sunflow-postgres pg_dump -U postgres sun_uw > /opt/sunflow/backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Диагностика при ошибках деплоя

### Контейнер не запускается

```bash
cd /opt/sunflow
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 app
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 worker
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 migrate
```

### Приложение не отвечает по HTTP

```bash
# Проверить порт
curl -v http://localhost:3000/api/health

# Проверить Cloudflare Tunnel
# (tunel работает отдельно, его состояние не зависит от деплоя)
```

### Runner не запускается (задача завит в GitHub Actions)

```bash
# На Mac Mini
cd ~/actions-runner
./svc.sh status
./svc.sh start
```

---

## Мониторинг в реальном времени

```bash
# Следить за логами app в реальном времени
docker compose -f /Users/sun_serv/Documents/Dev/SunFlow/docker-compose.prod.yml \
  --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod logs -f app worker

# Статус всех контейнеров
watch -n 5 "docker compose -f /Users/sun_serv/Documents/Dev/SunFlow/docker-compose.prod.yml \
  --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod ps"
```
