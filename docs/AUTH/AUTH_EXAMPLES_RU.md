# 💻 Примеры кода: работа с авторизацией

## Получить текущего пользователя

### На frontend (компонент)

```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';

export function UserProfile() {
  const { user, email, roles, isAdmin, loading, authenticated } = useAuth();

  if (loading) return <div>Загружаю...</div>;
  if (!authenticated) return <div>Войдите в систему</div>;

  return (
    <div>
      <h1>Профиль: {email}</h1>
      <p>ID: {user}</p>
      <p>Роли: {roles.join(', ')}</p>
      {isAdmin() && <p>✓ Вы администратор</p>}
    </div>
  );
}
```

### На backend (Server Action или API route)

```typescript
// src/app/api/me/route.ts
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    roles: user.roles,
    tenantId: user.tenantId
  });
}
```

---

## Защитить маршрут

### Способ 1: SessionAuth компонент

```tsx
'use client';
import { SessionAuth } from '@/components/auth/session-auth';

export default function AdminPage() {
  return (
    <SessionAuth redirect="/auth/sign-in">
      <div>
        <h1>Админ-панель</h1>
        <p>Это видно только авторизованным пользователям</p>
      </div>
    </SessionAuth>
  );
}
```

### Способ 2: Server-side проверка

```typescript
// src/app/admin/page.tsx
import { getSession } from '@/lib/auth/get-session';
import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

export default async function AdminPage(props: any) {
  const request = props.request || ({} as NextRequest);
  const session = await getSession(request);

  if (!session) {
    redirect('/auth/sign-in');
  }

  if (!session.roles.includes('ADMIN')) {
    redirect('/unauthorized');
  }

  return <div>Админ-панель</div>;
}
```

---

## Проверить роли

### В компоненте

```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';

export function FeatureGate() {
  const { hasRole, isAdmin, isManager } = useAuth();

  return (
    <div>
      {hasRole('ADMIN') && <AdminFeature />}
      {hasRole('MANAGER') && <ManagerFeature />}
      {hasRole('UNDERWRITER') && <UnderwriterFeature />}
      {isManager() && <p>Вы manager или admin</p>}
    </div>
  );
}
```

### На backend

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Проверить конкретную роль
  if (!session.roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Выполнить admin-only операцию
  return NextResponse.json({ success: true });
}
```

---

## Вход и выход

### Форма входа

```tsx
'use client';
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const adapter = getAuthClientAdapter();
    const result = await adapter.signIn(email, password);

    if (result.status === 'OK') {
      router.push('/dashboard/overview');
    } else if (result.status === 'WRONG_CREDENTIALS') {
      setError('Email или пароль неверны');
    } else {
      setError(result.message || 'Ошибка входа');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Загружаю...' : 'Войти'}
      </button>
    </form>
  );
}
```

### Кнопка выхода

```tsx
'use client';
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const adapter = getAuthClientAdapter();
    await adapter.signOut();
    router.push('/auth/sign-in');
  };

  return (
    <button onClick={handleLogout} className="button-danger">
      Выйти
    </button>
  );
}
```

---

## Фильтрация навигации по ролям

### Конфиг меню с ролями

```typescript
// src/config/nav-config.ts
import type { NavItem } from '@/types';

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard'
  },
  {
    title: 'Settings',
    url: '/settings/profile',
    icon: 'settings',
    access: {
      role: 'ADMIN'  // Видно только админам
    }
  },
  {
    title: 'Users',
    url: '/settings/organization/users',
    icon: 'users',
    access: {
      role: 'MANAGER'  // Видно только менеджерам и админам
    }
  }
];
```

### Компонент с фильтрацией

```tsx
'use client';
import { useFilteredNavItems } from '@/hooks/use-nav';
import { navItems } from '@/config/nav-config';

export function Sidebar() {
  const visibleItems = useFilteredNavItems(navItems);

  return (
    <nav>
      {visibleItems.map((item) => (
        <a key={item.title} href={item.url}>
          {item.title}
        </a>
      ))}
    </nav>
  );
}
```

---

## Работа с multi-tenancy

### Получить tenantId текущего юзера

```tsx
'use client';
import { useAuth } from '@/hooks/use-auth';

export function OrganizationContext() {
  const { tenantId, authenticated } = useAuth();

  if (!authenticated) return <div>Не авторизован</div>;
  if (!tenantId) return <div>Организация не выбрана</div>;

  return <div>Текущая организация: {tenantId}</div>;
}
```

### Фильтровать данные по tenantId на backend

```typescript
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user?.tenantId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  // Получить только данные для текущей организации
  const data = await prisma.policy.findMany({
    where: {
      tenantId: user.tenantId
    }
  });

  return NextResponse.json(data);
}
```

---

## Проверить, какой провайдер используется

```typescript
import { getAuthProviderType } from '@/lib/auth/providers/client-factory';

export function CheckProvider() {
  const provider = getAuthProviderType();
  
  return (
    <div>
      Текущий провайдер: <strong>{provider}</strong>
    </div>
  );
}
```

---

## Кастомная логика для разных провайдеров

Если нужны провайдер-специфичные операции:

```typescript
import { getAuthProviderType } from '@/lib/auth/providers/client-factory';

export async function doSomethingProvider() {
  const provider = getAuthProviderType();

  if (provider === 'supertokens') {
    // SuperTokens-специфичный код
    console.log('Using SuperTokens');
  } else if (provider === 'stack') {
    // Stack Auth-специфичный код
    console.log('Using Stack Auth');
  }
}
```

⚠️ **Совет**: Старайтесь избегать провайдер-специфичного кода. Вместо этого расширяйте адаптеры новыми методами!

---

## Тестирование авторизации

### Mock-аутентификация для тестов

```typescript
// __tests__/auth.test.ts
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';

jest.mock('@/lib/auth/providers/client-factory', () => ({
  getAuthClientAdapter: jest.fn(() => ({
    useSession: () => ({
      user: { id: 'test-user', email: 'test@example.com', name: 'Test' },
      loading: false,
      authenticated: true
    }),
    signIn: jest.fn().mockResolvedValue({ status: 'OK' }),
    signOut: jest.fn().mockResolvedValue(undefined)
  }))
}));

test('user sees dashboard when authenticated', () => {
  // Ваш тест
});
```

---

## Отладка

### Логирование сессии

```typescript
// В любом компоненте
'use client';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';

export function DebugAuth() {
  const auth = useAuth();

  useEffect(() => {
    console.log('[AUTH DEBUG]', {
      authenticated: auth.authenticated,
      loading: auth.loading,
      userId: auth.userId,
      tenantId: auth.tenantId,
      roles: auth.roles,
      hasAdmin: auth.hasRole('ADMIN'),
      isAdmin: auth.isAdmin(),
      isManager: auth.isManager()
    });
  }, [auth]);

  return null; // Только для отладки
}
```

### Логирование на backend

```typescript
import { getSession } from '@/lib/auth/get-session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  
  console.log('[SESSION DEBUG]', {
    exists: !!session,
    userId: session?.userId,
    tenantId: session?.tenantId,
    roles: session?.roles,
    timestamp: new Date().toISOString()
  });

  return NextResponse.json({ debug: true });
}
```

---

## Миграция между провайдерами

При переключении с SuperTokens на Stack Auth:

### 1. Обновить .env

```bash
AUTH_PROVIDER="stack"
NEXT_PUBLIC_AUTH_PROVIDER="stack"
```

### 2. Перезагрузить dev-сервер

```bash
npm run dev:stack
```

### 3. Все компоненты автоматически перейдут на Stack Auth ✅

Нет необходимости менять:
- ✅ `useAuth()` — одинаковый интерфейс
- ✅ `<SessionAuth>` — одинаковый компонент
- ✅ Role-based access — одинаковая логика
- ✅ API routes — одинаковые endpoints

---

**Готово!** Используйте эти примеры как шаблоны для вашего кода.
