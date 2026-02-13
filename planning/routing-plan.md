# Routing & Auth Plan

## Deferred: Auth + Chat Creation Flow

On authenticated load:
1. User lands on `/` → auth guard checks session
2. If authenticated → `POST /api/chat/create` automatically
3. Server returns `{ id: newUuid }`
4. Client navigates to `/chat/{newId}`
5. When user types and submits first message → optimistic UI updates the chat immediately
6. Message is sent to `POST /api/chat/send` in background

This means `/` is never a "resting" state for authenticated users — they always land in a fresh chat.

## Current: Phase 1 — Layout + URL-based Chat Loading
- AppLayout renders sidebar (later) + `<Outlet />`
- `/chat/:id` in URL → ChatView loads that conversation via `GET /api/chat/conversations/:id`
- No sidebar yet, just prove the nested route works with a UUID in the URL bar
