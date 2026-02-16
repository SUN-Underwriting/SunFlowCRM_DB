# Sales CRM Module

This module provides a comprehensive Sales CRM system integrated into the SunApp AG dashboard.

## Features

### 1. Dashboard
- **Overview**: Visual representation of sales performance, including pipeline value, recent activity, and key metrics.
- **Widgets**: Customizable widgets for tracking goals and KPIs.

### 2. Lead Management (`/leads`)
- **Lead Capture**: Tools for capturing leads from various sources.
- **Lead Scoring**: Automated scoring to prioritize high-potential leads.
- **Status Tracking**: Kanban and list views for tracking lead status (New, Contacted, Qualified, etc.).

### 3. Contact Management (`/contacts`)
- **Centralized Database**: Store and manage all customer contact information.
- **Interaction History**: Log calls, emails, and meetings.
- **Organization Support**: Link contacts to companies/organizations.

### 4. Deal Pipeline (`/deals`)
- **Visual Pipeline**: Drag-and-drop Kanban board for managing deals through stages.
- **Stage Customization**: Configurable deal stages to match your sales process.
- **Forecasting**: Revenue forecasting based on deal value and probability.

### 5. Activities (`/activities`)
- **Task Management**: Schedule and track calls, meetings, and emails.
- **Calendar Integration**: Sync activities with a calendar view.
- **Reminders**: Automated notifications for upcoming tasks.

### 6. Email Integration (`/emails`)
- **Inbox**: Integrated email client for sales correspondence.
- **Templates**: Reusable email templates for common communications.
- **Tracking**: Track email opens and clicks.

### 7. Settings (`/settings`)
- **Configuration**: module-specific settings.

## Technical Structure

The module is located in `src/features/crm` and follows the feature-based architecture.

- **Components**: Reusable UI components specific to CRM.
- **Hooks**: Custom React hooks for CRM logic (e.g., `useLeads`, `useDeals`).
- **Types**: TypeScript definitions for CRM entities.
- **Utils**: Helper functions for CRM data processing.

## Database Models
The module uses the following Prisma models (see `schema.prisma`):
- `Lead`
- `Contact`
- `Deal`
- `Activity`
- `Organization`
