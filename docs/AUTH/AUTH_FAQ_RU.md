# ❓ FAQ: Авторизация в Sun MGA

## 🚀 Как начать работать с авторизацией?

**Q: С чего начать, если я новый в проекте?**

A: Прочитайте в этом порядке:
1. `AUTH_ARCHITECTURE_RU.md` — понимание архитектуры
2. `AUTH_EXAMPLES_RU.md` — копируйте примеры кода
3. Изучите файлы:
   - `src/lib/auth/providers/types.ts` — что есть
   - `src/hooks/use-auth.ts` — как использовать

---

## 🔄 Переключение между SuperTokens и Stack Auth

**Q: Как переключаться между провайдерами?**

A: Есть два способа:

**Способ 1 (рекомендуется):**
```bash
npm run dev:supertokens  # SuperTokens
npm run dev:stack       # Stack Auth
```

**Способ 2 (ручной):**
```bash
# Измените в .env:
AUTH_PROVIDER="supertokens"
NEXT_PUBLIC_AUTH_PROVIDER="supertokens"

# Или:
AUTH_PROVIDER="stack"
NEXT_PUBLIC_AUTH_PROVIDER="stack"

# Перезагрузите сервер
npm run dev
```

---

## 🔑 Сессия и токены

**Q: Где хранятся токены?**

A: В cookie (httpOnly):
- SuperTokens: `sAccessToken`, `sRefreshToken`
- Stack Auth: `stack-token-set` (или специфичные)

Cookies автоматически отправляются со всеми запросами.

---

**Q: Как долго действует сессия?**

A: По умолчанию:
- Access token: 15 минут
- Refresh token: 7 дней

Когда access token истекает, автоматически используется refresh token.

---

**Q: Как получить текущую сессию?**

A:
```tsx
// На frontend
const { user, roles } = useAuth();

// На backend
const session = await getSession(request);
```

---

## 👤 Пользователи и роли

**Q: Как добавить новую роль?**

A: Роли хранятся в `SessionPayload`:

1. **При создании пользователя** (backend):
```typescript
await authAdapter.createSession(
  userId,
  email,
  tenantId,
  ['ADMIN', 'MANAGER']  // ← Роли здесь
);
```

2. **При обновлении** (backend):
```typescript
// Обновить роли в БД через SQL/Prisma
await prisma.user.update({
  where: { id: userId },
  data: { roles: ['UNDERWRITER'] }
});

// При следующем входе роли обновятся в сессии
```

---

**Q: Как проверить, есть ли у юзера роль?**

A:
```tsx
const { hasRole, isAdmin } = useAuth();

if (hasRole('MANAGER')) { /* ... */ }
if (isAdmin()) { /* ... */ }  // ADMIN или MANAGER
```

---

**Q: Как скрыть элемент меню от пользователя?**

A: В конфиге добавьте `access`:

```typescript
// src/config/nav-config.ts
{
  title: 'Admin Panel',
  url: '/admin',
  icon: 'shield',
  access: {
    role: 'ADMIN'  // Видно только для ADMIN
  }
}
```

Компонент `useFilteredNavItems` автоматически отфильтрует недоступные элементы.

---

## 🔐 Защита маршрутов

**Q: Как защитить страницу от неавторизованных?**

A: Используйте `<SessionAuth>`:

```tsx
'use client';
import { SessionAuth } from '@/components/auth/session-auth';

export default function AdminPage() {
  return (
    <SessionAuth redirect="/auth/sign-in">
      <h1>Admin Panel</h1>
    </SessionAuth>
  );
}
```

Если юзер не авторизован, перенаправится на `/auth/sign-in`.

---

**Q: Как защитить API route?**

A:
```typescript
// src/app/api/admin/users/route.ts
import { getSession } from '@/lib/auth/get-session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!session.roles.includes('ADMIN')) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // Безопасный код
  return NextResponse.json({ data: [] });
}
```

---

## 🏢 Multi-tenancy (многотеннтность)

**Q: Что такое tenantId?**

A: ID организации. Юзер может работать с данными только своей организации.

Например:
- Юзер 1: tenantId = "org_acme"
- Юзер 2: tenantId = "org_globex"

Они не видят друг у друга данные.

---

**Q: Как получить tenantId текущего юзера?**

A:
```tsx
const { tenantId } = useAuth();
console.log('My organization:', tenantId);
```

---

**Q: Как отфильтровать данные по tenantId?**

A: В API route используйте `getSession()`:

```typescript
const session = await getSession(request);

// Получить только данные текущей организации
const policies = await prisma.policy.findMany({
  where: {
    tenantId: session.tenantId
  }
});
```

---

## 🔌 Интеграция с компонентами

**Q: Как использовать auth в компоненте?**

A: Используйте `useAuth()`:

```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';

export function MyComponent() {
  const { 
    authenticated,  // boolean
    loading,        // boolean
    userId,         // string
    email,          // string
    tenantId,       // string
    roles,          // string[]
    hasRole,        // (role: string) => boolean
    isAdmin,        // () => boolean
    isManager       // () => boolean
  } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!authenticated) return <div>Sign in first</div>;

  return <div>Welcome, {email}!</div>;
}
```

---

**Q: Можно ли использовать auth в Server Component?**

A: Нет, используйте `getSession()`:

```tsx
// ❌ НЕПРАВИЛЬНО (Server Component)
import { useAuth } from '@/hooks/use-auth';
export default function Page() {
  const auth = useAuth();  // ❌ Error!
}

// ✅ ПРАВИЛЬНО
import { getSession } from '@/lib/auth/get-session';
export default async function Page(props: any) {
  const session = await getSession(props.request);
  return <div>Session: {session?.userId}</div>;
}
```

---

## 🛠️ Расширение и кастомизация

**Q: Как добавить новый метод в auth?**

A: Расширьте интерфейсы в `types.ts`:

```typescript
// src/lib/auth/providers/types.ts
export interface AuthServerAdapter {
  // Существующие методы...
  
  // Новый метод
  resetPassword(userId: string, newPassword: string): Promise<void>;
}
```

Затем реализуйте в обоих адаптерах:

```typescript
// src/lib/auth/providers/supertokens/server-adapter.ts
async resetPassword(userId: string, newPassword: string) {
  // SuperTokens-специфичная реализация
}

// src/lib/auth/providers/stack/server-adapter.ts
async resetPassword(userId: string, newPassword: string) {
  // Stack Auth-специфичная реализация
}
```

---

**Q: Как использовать кастомный провайдер?**

A: Создайте адаптер:

```typescript
// src/lib/auth/providers/myauth/server-adapter.ts
import { AuthServerAdapter } from '../types';

export class MyAuthServerAdapter implements AuthServerAdapter {
  async getSession(request) { /* ... */ }
  async createSession(userId, email, tenantId, roles) { /* ... */ }
  // ... остальные методы
}
```

Добавьте в factory:

```typescript
// src/lib/auth/providers/factory.ts
if (provider === 'myauth') {
  return new MyAuthServerAdapter();
}
```

Установите в .env:

```bash
AUTH_PROVIDER="myauth"
```

---

## 🐛 Отладка

**Q: Как узнать, какой провайдер сейчас активен?**

A:
```typescript
import { getAuthProviderType } from '@/lib/auth/providers/client-factory';

const provider = getAuthProviderType();
console.log('Provider:', provider); // "supertokens" или "stack"
```

---

**Q: Как проверить текущую сессию?**

A:
```tsx
// Frontend
'use client';
import { useAuth } from '@/hooks/use-auth';

export function DebugAuth() {
  const auth = useAuth();
  return <pre>{JSON.stringify(auth, null, 2)}</pre>;
}

// Backend
import { getSession } from '@/lib/auth/get-session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  return Response.json(session);
}
```

---

**Q: Что делать, если `useSessionContext` выбрасывает ошибку?**

A: Вероятно, вы импортируете напрямую из SuperTokens вместо абстракции:

```tsx
// ❌ НЕПРАВИЛЬНО
import { useSessionContext } from 'supertokens-auth-react/recipe/session';

// ✅ ПРАВИЛЬНО
import { useAuth } from '@/hooks/use-auth';
const auth = useAuth();
```

---

**Q: Как очистить кэш браузера при разработке?**

A:
```bash
# Очистить cookies и localStorage
# Chrome DevTools → Application → Clear Storage

# Или перезапустить dev-сервер:
npm run dev
```

---

## ⚡ Производительность

**Q: Как оптимизировать auth-запросы?**

A: `useAuth()` вызывает `useSession()` адаптера, что может быть дорого:

```tsx
// ✅ ХОРОШО: вызовите один раз, используйте везде
const { authenticated, roles } = useAuth();

// ❌ ПЛОХО: избегайте множественных вызовов
if (useAuth().authenticated) { /* ... */ }
if (useAuth().hasRole('ADMIN')) { /* ... */ }
```

---

## 📖 Дополнительные ресурсы

- **Архитектура**: `AUTH_ARCHITECTURE_RU.md`
- **Примеры кода**: `AUTH_EXAMPLES_RU.md`
- **Типы**: `src/lib/auth/providers/types.ts`
- **Хуки**: `src/hooks/use-auth.ts`
- **Middleware**: `src/middleware.ts`

---

**Остались вопросы?** Создайте issue или спросите в чате команды!
