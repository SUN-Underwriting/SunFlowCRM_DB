# Стратегия секретов — SunFlowCRM CI/CD

## Принцип

Production-секреты **никогда не покидают Mac Mini**.
Они хранятся в файле `/Users/sun_serv/Documents/sunflow_secret/.env.prod` непосредственно на сервере
и не передаются через GitHub Secrets, переменные окружения CI или любые другие внешние каналы.

---

## Что хранится где

| Значение | Где хранится | Как используется |
|---|---|---|
| `POSTGRES_PASSWORD` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `REDIS_PASSWORD` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `STACK_DB_PASSWORD` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `CLICKHOUSE_PASSWORD` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `STACK_SERVER_SECRET` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `STACK_SECRET_SERVER_KEY` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `INTERNAL_WORKER_SECRET` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `ANTHROPIC_API_KEY` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |
| `NEXT_PUBLIC_STACK_PROJECT_ID` | `/opt/sunflow/.env.prod` | `docker compose --env-file` |

**GitHub Secrets не нужны** при данной схеме, потому что runner работает локально на Mac Mini
и имеет прямой доступ к файлу на диске.

---

## Что НЕ попадает в репозиторий

Файлы, которые нельзя коммитить:

```
.env
.env.prod
.env.local
.env.*.local
```

Убедиться, что они перечислены в `.gitignore`.

---

## Обновление секретов на сервере

При необходимости изменить значение переменной (например, ротация паролей):

```bash
# На Mac Mini
nano /Users/sun_serv/Documents/sunflow_secret/.env.prod
# Отредактировать нужную строку, сохранить

# Перезапустить затронутый сервис
cd /opt/sunflow
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d <service_name>
```

При смене `DATABASE_URL` / `REDIS_URL` — перезапустить `app` и `worker`.
При смене `STACK_SERVER_SECRET` — перезапустить `stack-server`.

---

## Если потребуется добавить переменную через GitHub Secrets

В редких случаях (например, уведомления о деплое через Slack/Telegram) переменные
можно добавить как GitHub Secret и передать в workflow через `env`:

```yaml
env:
  SLACK_WEBHOOK: ${{ secrets.SLACK_DEPLOY_WEBHOOK }}
```

Такие переменные:
- не должны быть production-секретами приложения,
- используются только самим workflow, не передаются в docker compose.

---

## Ротация `.env.prod` целиком

Если нужно полностью заменить файл на сервере:

```bash
# Создать новый файл по шаблону
cp env.prod.example /tmp/.env.prod.new
# Заполнить значения
nano /tmp/.env.prod.new
# Заменить на сервере
mv /tmp/.env.prod.new /Users/sun_serv/Documents/sunflow_secret/.env.prod
chmod 600 /Users/sun_serv/Documents/sunflow_secret/.env.prod
# Перезапустить стек
cd /opt/sunflow
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```
