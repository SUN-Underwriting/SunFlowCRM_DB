# 🔐 Архитектура системы авторизации Sun MGA

## Обзор

Sun MGA использует **абстрактный слой авторизации**, который позволяет работать с двумя провайдерами:
- **SuperTokens** — самостоятельный сервер аутентификации (по умолчанию)
- **Stack Auth** — облачный/локальный провайдер идентификации

Вы можете **легко переключаться** между ними через переменную окружения `AUTH_PROVIDER`.

---

## 📊 Архитектурная диаграмма

```
┌─────────────────────────────────────────┐
│         Next.js Application             │
│  (/dashboard, /settings, и т.д.)        │
└──────────────┬──────────────────────────┘
               │
               ├─ useAuth()              (компоненты)
               ├─ SessionAuth            (маршруты)
               └─ getAuthClientAdapter() (кастом)
               │
        ┌──────▼──────┐
        │  Абстракция  │
        │  (Adapter    │
        │   Pattern)   │
        └──────┬──────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ SuperTokens  │  │ Stack Auth   │
│   Server     │  │   Server     │
│ (3567)       │  │  (8102)      │
└──────────────┘  └──────────────┘
```

---

## 📁 Структура файлов

### Абстрактный слой (не зависит от провайдера)

```
src/lib/auth/
├── providers/
│   ├── types.ts                    # Интерфейсы: AuthClientAdapter, AuthServerAdapter
│   ├── factory.ts                  # Выбор server-адаптера по AUTH_PROVIDER
│   ├── client-factory.tsx          # Выбор client-адаптера по NEXT_PUBLIC_AUTH_PROVIDER
│   ├── middleware-utils.ts         # Проверка сессии в middleware (быстро)
│   ├── supertokens/                # Реализация для SuperTokens
│   │   ├── server-adapter.ts       # ServerAdapter для SuperTokens
│   │   └── client-adapter.tsx      # ClientAdapter для SuperTokens
│   └── stack/                      # Реализация для Stack Auth
│       ├── server-adapter.ts       # ServerAdapter для Stack Auth
│       └── client-adapter.tsx      # ClientAdapter для Stack Auth
│
├── get-session.ts                  # Чтение сессии на сервере
├── get-current-user.ts             # Получить текущего юзера из БД
├── middleware-utils.ts             # Проверка cookie в middleware
└── invite-reconciliation.ts        # Логика приглашений
```

### Компоненты приложения (используют абстракцию)

```
src/hooks/
├── use-auth.ts                     # const { tenantId, roles } = useAuth()
└── use-nav.ts                      # const items = useFilteredNavItems(navItems)

src/components/
├── auth/
│   ├── session-auth.tsx            # <SessionAuth> — охранитель маршрутов
│   └── supertokens-provider.tsx    # Специфичный провайдер для SuperTokens
│
└── layout/
    ├── app-sidebar.tsx             # Использует useAuth() для фильтрации меню
    ├── header.tsx
    └── providers.tsx               # Оборачивает приложение в AuthProvider
```

---

## 🔄 Как выбирается провайдер?

### На сервере

**Файл**: `src/lib/auth/providers/factory.ts`

```typescript
// Читает AUTH_PROVIDER из .env
// Возвращает нужный ServerAdapter
const adapter = await getAuthAdapter();
```

**Значения**:
- `AUTH_PROVIDER="supertokens"` → SuperTokensServerAdapter
- `AUTH_PROVIDER="stack"` → StackAuthServerAdapter

### На клиенте

**Файл**: `src/lib/auth/providers/client-factory.tsx`

```typescript
// Читает NEXT_PUBLIC_AUTH_PROVIDER из .env
const adapter = getAuthClientAdapter();
```

**Значения**:
- `NEXT_PUBLIC_AUTH_PROVIDER="supertokens"` → SuperTokensClientAdapter
- `NEXT_PUBLIC_AUTH_PROVIDER="stack"` → StackAuthClientAdapter

---

## 🔑 Ключевые интерфейсы

### ServerAdapter

Методы на **backend** для управления сессией и пользователями:

```typescript
interface AuthServerAdapter {
  // Получить сессию из request
  getSession(request: NextRequest): Promise<SessionPayload | null>;

  // Создать сессию после входа
  createSession(userId, email, tenantId, roles): Promise<CreateSessionResult>;

  // Получить обработчик для /api/auth/* routes
  getApiHandler(): (request: NextRequest) => Promise<NextResponse>;

  // Проверить, есть ли валидный cookie в запросе
  hasValidSessionCookie(request: NextRequest): boolean;
}
```

### ClientAdapter

Методы на **frontend** для UI и интеракций:

```typescript
interface AuthClientAdapter {
  // React компонент-провайдер
  Provider: React.ComponentType<{ children }>;

  // Hook для получения сессии
  useSession: () => {
    user: { id, email, name } | null;
    loading: boolean;
    authenticated: boolean;
  };

  // Методы входа/выхода
  signIn(email, password): Promise<SignInResult>;
  signOut(): Promise<void>;

  // Охранитель маршрутов
  SessionGuard: React.ComponentType<{ children, redirect? }>;
}
```

---

## 🌐 API Endpoints

### SuperTokens

| Метод | URL | Описание |
|-------|-----|---------|
| POST | `/api/auth/signin` | Вход в систему |
| POST | `/api/auth/signout` | Выход из системы |
| POST | `/api/auth/signup` | Регистрация |
| GET | `http://localhost:3567/hello` | Проверка состояния |

**Dashboard**: http://localhost:3567

---

### Stack Auth

| Метод | URL | Описание |
|-------|-----|---------|
| POST | `/api/auth/...` | Различные routes |
| GET | `http://localhost:8102/health` | Проверка API |
| GET | `http://localhost:8101` | Dashboard |

**Dashboard**: http://localhost:8101
**API**: http://localhost:8102

---

## 📝 Сессия и данные юзера

### Структура SessionPayload

```typescript
interface SessionPayload {
  userId: string;        // ID в провайдере (supertokensUserId или stackAuthUserId)
  tenantId: string;      // ID организации (для multi-tenancy)
  roles: string[];       // Роли: ["ADMIN", "MANAGER", "UNDERWRITER"]
  email?: string;        // Email юзера
}
```

### Где хранятся данные?

| Данные | Где | Как получить |
|--------|-----|--------------|
| **Сессия** | Cookie (httpOnly) | `getSession(request)` (backend) |
| **Юзер** | BD (таблица users) | `getCurrentUser()` |
| **Роли** | SessionPayload | `useAuth().roles` (frontend) |

---

## 🔐 Как работает вход

### 1. Юзер заполняет форму

```tsx
const { email, password } = formData;
const adapter = getAuthClientAdapter();
const result = await adapter.signIn(email, password);
```

### 2. Провайдер создаёт сессию

**SuperTokens**:
- Проверяет пароль в своей БД
- Создаёт JWT токен
- Сохраняет в cookie

**Stack Auth**:
- Вызывает SDK для создания сессии
- Получает токен
- Сохраняет в cookie

### 3. Сессия отправляется в браузер

Cookie автоматически добавляется ко всем запросам.

### 4. Backend проверяет сессию

```typescript
// middleware.ts
const session = await getSession(request);
if (!session) {
  return redirect('/auth/sign-in');
}
```

---

## 👤 Как работает авторизация (RBAC)

### 1. Проверка ролей в компоненте

```tsx
const { roles, hasRole, isAdmin } = useAuth();

if (isAdmin()) {
  return <AdminPanel />;
}
```

### 2. Фильтрация меню по ролям

```tsx
// src/hooks/use-nav.ts
const filteredItems = useFilteredNavItems(navItems);

// Пример navItem:
{
  title: "Settings",
  access: { role: "ADMIN" }  // Видно только для ADMIN
}
```

### 3. Защита маршрутов

```tsx
// Вариант 1: SessionGuard компонент
<SessionAuth redirect="/auth/sign-in">
  <ProtectedPage />
</SessionAuth>

// Вариант 2: RolesGuard middleware
if (!session) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 🚀 Как переключаться между провайдерами?

### Способ 1: Скрипты (рекомендуется)

```bash
# Включить SuperTokens
npm run dev:supertokens

# Включить Stack Auth
npm run dev:stack
```

### Способ 2: Ручное переключение

Измените в `.env`:

```bash
AUTH_PROVIDER="supertokens"           # или "stack"
NEXT_PUBLIC_AUTH_PROVIDER="supertokens"  # или "stack"
```

Перезагрузите сервер:

```bash
npm run dev
```

---

## 🔧 Расширение: добавить третий провайдер (например, Auth0)

### Шаг 1: Создать адаптер

```typescript
// src/lib/auth/providers/auth0/server-adapter.ts
export class Auth0ServerAdapter implements AuthServerAdapter {
  async getSession(request) { /* ... */ }
  async signIn(email, password) { /* ... */ }
  // ... остальные методы
}
```

### Шаг 2: Обновить factory

```typescript
// src/lib/auth/providers/factory.ts
if (provider === 'auth0') {
  return new Auth0ServerAdapter();
}
```

### Шаг 3: Обновить .env

```bash
AUTH_PROVIDER="auth0"
```

**Всё!** Остальной код автоматически будет работать с Auth0.

---

## 📊 Таблица сравнения провайдеров

| Функция | SuperTokens | Stack Auth |
|---------|-------------|-----------|
| **Где работает** | localhost:3567 | localhost:8101/8102 (или облако) |
| **Setup** | Docker (простой) | Docker (комплексный) |
| **Роли** | В SessionPayload | В SessionPayload |
| **Refresh Token** | Автоматический | Автоматический |
| **SSO** | Есть | Есть |
| **Self-hosted** | ✅ | ✅ |
| **Cloud** | Платная | Платная |

---

## 🐛 Отладка

### Проверить текущую сессию

```typescript
// Backend
const session = await getSession(request);
console.log('Session:', session);

// Frontend
const { user, loading } = useAuth();
console.log('User:', user);
```

### Проверить, какой провайдер активен

```typescript
import { getAuthProviderType } from '@/lib/auth/providers/client-factory';
const provider = getAuthProviderType();
console.log('Provider:', provider); // "supertokens" или "stack"
```

### Очистить сессию (logout)

```typescript
const adapter = getAuthClientAdapter();
await adapter.signOut();
```

---

## 👥 Управление пользователями (User Provisioning)

### Архитектура

Связь между auth-провайдером (Stack Auth / SuperTokens) и нашей БД (Prisma) обеспечивается через **UserProvisioningService** — единую точку входа для создания и синхронизации пользователей.

```
┌─────────────────────────────────────────────────────────┐
│                UserProvisioningService                    │
│  src/lib/services/user-provisioning-service.ts           │
├──────────────┬──────────────────┬───────────────────────┤
│  Admin API   │   Webhook        │   Session-time        │
│  (явное      │   (Stack Auth    │   (auto-provisioning  │
│   создание)  │    Dashboard)    │    при первом входе)  │
└──────┬───────┴────────┬─────────┴──────────┬────────────┘
       │                │                    │
       ▼                ▼                    ▼
  POST /api/       POST /api/         getSession()
  admin/users      webhooks/stack     в server-adapter
```

### 3 способа создания пользователя

#### 1. Admin API (рекомендуется для прода)

Админ создаёт пользователя через API. Пользователь создаётся **одновременно** в auth-провайдере и в нашей БД.

```bash
POST /api/admin/users
{
  "email": "user@company.com",
  "password": "SecurePass123",    # опционально
  "firstName": "Иван",
  "lastName": "Петров",
  "role": "MEMBER"
}
```

**Что происходит:**
1. Проверка: текущий юзер — ADMIN?
2. Проверка: пользователь уже существует в tenant?
3. Создание в auth-провайдере (Stack Auth / SuperTokens)
4. Создание в Prisma DB (таблица users)
5. Синхронизация serverMetadata (tenantId, roles) в Stack Auth
6. Запись в audit log
7. Если шаг 4 упал — откат шага 3 (удаление из auth-провайдера)

#### 2. Webhook (синхронизация из Dashboard)

Когда пользователь создан через Stack Auth Dashboard, webhook автоматически синхронизирует его в нашу БД.

```
Stack Auth Dashboard
  → user.created event
    → POST /api/webhooks/stack
      → UserProvisioningService.syncFromAuthProvider()
        → Создаёт запись в Prisma (или привязывает к существующей)
```

**Поддерживаемые события:**
- `user.created` — создание записи в нашей БД
- `user.updated` — синхронизация email / имени
- `user.deleted` — деактивация (soft delete)

**Настройка webhook:**
1. Откройте Stack Auth Dashboard → Webhooks
2. URL: `https://your-domain.com/api/webhooks/stack`
3. Для локальной разработки: используйте [ngrok](https://ngrok.com) или [Svix Playground](https://www.svix.com/play/)

#### 3. Auto-provisioning (при первом запросе)

Если пользователь залогинен в Stack Auth, но не найден в нашей БД — адаптер автоматически создаёт tenant + user. Это удобно для разработки.

```
Login через Stack Auth → Session cookie установлен
  → Первый API запрос → getSession()
    → serverMetadata.tenantId = undefined
      → UserProvisioningService.syncFromAuthProvider()
        → Ищет в БД по stackAuthUserId / email
        → Не нашёл → Создаёт tenant + user
        → Сохраняет tenantId в serverMetadata
  → Следующие запросы → serverMetadata.tenantId уже есть → быстро
```

### Stack Auth: serverMetadata

Stack Auth хранит дополнительные данные пользователя в `serverMetadata` (доступен только на сервере):

```typescript
// Что мы храним в serverMetadata:
{
  tenantId: "cuid_...",        // ID организации в нашей БД
  roles: ["ADMIN"]             // Роли пользователя
}

// Как читаем:
const user = await stackServerApp.getUser();
const { tenantId, roles } = user.serverMetadata;
```

Это позволяет **не обращаться к БД при каждом запросе** — tenantId кешируется в Stack Auth.

---

## 📚 Полезные файлы для изучения

| Файл | Цель |
|------|------|
| `src/lib/auth/providers/types.ts` | Интерфейсы всех адаптеров |
| `src/lib/auth/get-session.ts` | Как читать сессию на сервере |
| `src/lib/services/user-provisioning-service.ts` | Создание/синхронизация пользователей |
| `src/app/api/admin/users/route.ts` | Admin API для провизионирования |
| `src/app/api/webhooks/stack/route.ts` | Webhook-обработчик Stack Auth |
| `src/hooks/use-auth.ts` | Как использовать auth в компонентах |
| `src/middleware.ts` | Как защищать маршруты |
| `src/app/dashboard/layout.tsx` | Пример: как обёртывать UI в SessionAuth |

---

## ✅ Чек-лист при добавлении нового компонента

- [ ] Компонент использует `useAuth()` для проверки ролей?
  - Используйте только через `useAuth()`, не импортируйте провайдер напрямую
- [ ] Нужна защита маршрута?
  - Оберните в `<SessionAuth>`
- [ ] Показываю пользовательские данные?
  - Используйте `const { user, email } = useAuth()`
- [ ] Нужно логировать действия?
  - Используйте `userId` из `useAuth()`
- [ ] Создаю пользователя?
  - Используйте `UserProvisioningService.provisionUser()` — не создавайте напрямую в Prisma или auth-провайдере

---

## 🔗 Ссылки

- **SuperTokens docs**: https://supertokens.com/docs
- **Stack Auth docs**: https://docs.stack-auth.com
- **Stack Auth Webhooks**: https://docs.stack-auth.com/docs/apps/webhooks
- **Stack Auth Custom User Data**: https://docs.stack-auth.com/docs/concepts/custom-user-data
- **Next.js Auth**: https://nextjs.org/docs/app/building-your-application/authentication-and-authorization

---

**Последнее обновление**: февраль 2026  
**Версия**: 2.0
