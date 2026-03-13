# CI/CD Runner Setup — Mac Mini

Инструкция по настройке Mac Mini как self-hosted GitHub Actions runner
для автоматического деплоя проекта SunFlowCRM.

---

## Предварительные требования

- Mac Mini с macOS 12+
- Установлен Docker Desktop или Docker Engine
- Проект доступен из Mac Mini (Cloudflare Tunnel уже работает)
- Есть аккаунт GitHub с правами admin на репозитории

Проверить Docker:

```bash
docker --version
docker compose version
```

---

## Шаг 1 — Создать workspace для деплоя

```bash
mkdir -p /Users/sun_serv/Documents/sunflow_secret
```

---

## Шаг 2 — Разместить production `.env` на сервере

Файл с секретами никогда не попадает в репозиторий.
Разместить его один раз вручную:

```bash
cp /path/to/your/.env.prod /Users/sun_serv/Documents/sunflow_secret/.env.prod
chmod 600 /Users/sun_serv/Documents/sunflow_secret/.env.prod
```

> Путь `/Users/sun_serv/Documents/sunflow_secret/.env.prod` — фиксированный.
> Именно этот путь ожидает deploy workflow.
> При изменении переменных — редактировать файл прямо на сервере.

---

## Шаг 3 — Зарегистрировать self-hosted runner

1. Открыть репозиторий на GitHub.
2. Перейти: **Settings → Actions → Runners → New self-hosted runner**.
3. Выбрать: **macOS / ARM64** (или x64 — в зависимости от чипа Mac Mini).
4. Следовать инструкции GitHub: скачать архив, распаковать, выполнить `./config.sh`.

Пример регистрации:

```bash
cd ~
mkdir actions-runner && cd actions-runner
# Скачать актуальный пакет по ссылке со страницы GitHub
curl -o actions-runner-osx-arm64.tar.gz -L https://github.com/actions/runner/releases/download/...
tar xzf ./actions-runner-osx-arm64.tar.gz

# Конфигурация (токен взять со страницы GitHub)
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_REGISTRATION_TOKEN
```

Указать имя runner: `mac-mini-prod` (чтобы легко различать в интерфейсе).

---

## Шаг 4 — Запустить runner как системный сервис (LaunchDaemon)

Runner должен работать постоянно, в том числе после перезагрузки.

```bash
cd ~/actions-runner
./svc.sh install
./svc.sh start
```

Проверить статус:

```bash
./svc.sh status
```

Остановить:

```bash
./svc.sh stop
```

---

## Шаг 5 — Назначить лейбл runner'у

В файле конфигурации runner (`~/actions-runner/.runner`) или при регистрации добавить лейбл:

```
mac-mini-prod
```

Этот лейбл указан в deploy workflow как:

```yaml
runs-on: [self-hosted, mac-mini-prod]
```

---

## Шаг 6 — Проверить, что деплой работает вручную

Перед первым автоматическим запуском убедиться, что compose поднимается руками:

```bash
cd /Users/sun_serv/Documents/Dev/SunFlow
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod config --quiet
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod up -d --build
```

Если всё поднялось — автодеплой будет работать аналогично.

---

## Безопасность runner'а

- Runner работает под текущим пользователем macOS.
- Убедиться, что у пользователя есть права на запуск Docker (группа `docker` или Docker Desktop).
- Не давать runner'у доступ к другим директориям, кроме `/opt/sunflow`.
- Workflow из форков к self-hosted runner не допускать: в настройках репозитория →
  **Actions → General → Fork pull request workflows from outside collaborators** установить
  `Require approval for all outside collaborators`.

---

## Обновление runner'а

При выходе новой версии GitHub Actions runner:

```bash
cd ~/actions-runner
./svc.sh stop
# Скачать новую версию, распаковать поверх
./svc.sh start
```

---

## Диагностика

Логи runner'а:

```bash
cat ~/actions-runner/_diag/Runner_*.log
```

Статус контейнеров после деплоя:

```bash
docker compose -f /Users/sun_serv/Documents/Dev/SunFlow/docker-compose.prod.yml ps
```

Перезапустить стек вручную:

```bash
cd /Users/sun_serv/Documents/Dev/SunFlow
docker compose -f docker-compose.prod.yml --env-file /Users/sun_serv/Documents/sunflow_secret/.env.prod up -d --build
```
