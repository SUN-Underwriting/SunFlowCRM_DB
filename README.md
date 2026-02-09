# SunFlowCRM 🚀

SunFlowCRM is a high-performance, multi-tenant CRM system built with **Next.js 15**, **SuperTokens**, **Prisma**, and **Shadcn UI**. It features a robust security architecture with Row-Level Security (RLS), custom invite-only authentication, and a premium dashboard experience.

---

## 🌟 Key Features

### 🔐 Authentication & Security
- **Self-hosted SuperTokens Auth**: Fully owned authentication system with secure session management.
- **Invite-Only System**: Public signup is disabled; only administrators can invite new users.
- **Tenant Isolation (RLS)**: Enforced via Prisma middleware to prevent cross-tenant data leakage.
- **Strict Role-Based Access Control (RBAC)**: Manage members with `ADMIN`, `MEMBER`, and `VIEWER` roles.
- **Invite Reconciliation**: Seamlessly links invited users to their accounts upon registration.

### 🍱 Robust Architecture
- **Next.js 15 (App Router)**: Leveraging the latest performance improvements and React 18/19 features.
- **Prisma ORM & PostgreSQL**: Type-safe database interactions with a multi-tenant schema.
- **Feature-Based Module Structure**: Scale your application with organized, isolated feature sets.
- **Zod Runtime Validation**: Full validation of API requests and form submissions.

### ✨ Premium UI/UX
- **Shadcn UI & Tailwind CSS**: Beautiful, accessible, and responsive components.
- **Inline Validation**: Powered by `react-hook-form` and `Zod` for real-time user feedback.
- **Password visibility toggle**: A polished user experience for any password field.
- **WCAG 2.1 AA Compliant**: Comprehensive ARIA attributes for screen readers.
- **Empty States & Skeletons**: Gracious handling of data states for a smoother feel.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker/Docker-Compose (optional, for SuperTokens core)

### Installation
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/AnatolyBystrov/SunFlowCRM_DB.git
    cd SunFlowCRM_DB
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Copy `.env.example` to `.env.local` and configure your credentials.
    ```bash
    cp .env.example .env.local
    ```

4.  **Launch Database & Services**
    ```bash
    docker-compose up -d
    ```

5.  **Run Migrations**
    ```bash
    npx prisma migrate dev
    ```

6.  **Start Development Server**
    ```bash
    npm run dev
    ```

Access the app at `http://localhost:3000`.

---

## 📂 Project Structure

```plaintext
src/
├── app/          # Next.js App Router (pages and layouts)
├── components/   # Shared UI components (Shadcn, patterns)
├── features/     # Isolated domain logic (Settings, Auth, CRM)
├── lib/          # Core utilities (Auth, DB context, RLS)
├── hooks/        # Custom React hooks
└── types/        # TypeScript definitions
```

---

## 📝 Documentation
- [Security Features & Fixes](brain/fe19c289-f357-4253-98ce-453cb0c8b123/security_fixes_walkthrough.md)
- [Auth System Deep-Dive](docs/AUTH_SYSTEM.md)
- [SuperTokens Setup Guide](docs/supertokens_setup.md)
- [UI/UX Implementation Walkthrough](brain/fe19c289-f357-4253-98ce-453cb0c8b123/ui_ux_improvements_walkthrough.md)

---

## 👥 Contributors
- **Project Lead**: @usov
- **Architect/Developer**: AI Assistant (Antigravity) 🧠

---

## ⭐ Support
If you find this project useful, please consider giving it a star!
🥂 Cheers!
