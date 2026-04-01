

# Plan: Fix Asistente IA layout + Floating chat widget

## Problem
The `AsistenteIA` page uses `h-[calc(100vh-4rem)]` but sits inside `<main class="flex-1 overflow-auto p-6">`, causing double scroll. The `main` padding (1.5rem x2 = 3rem) plus header (3.5rem) aren't accounted for.

## Changes

### 1. Extract shared chat hook (`src/hooks/useChatMessages.ts`)
- Move message state, localStorage persistence, and `sendMessage` logic out of `AsistenteIA.tsx` into a reusable hook.
- Returns `{ messages, input, setInput, loading, sendMessage, clearChat }`.
- Same `STORAGE_KEY = "ava-asistente-messages"` so both page and widget share history.

### 2. Fix AsistenteIA layout (`src/pages/AsistenteIA.tsx`)
- Change container to `h-[calc(100vh-6.5rem)]` (header 3.5rem + padding 3rem).
- Use the shared `useChatMessages` hook instead of inline state.

### 3. Create FloatingChat widget (`src/components/FloatingChat.tsx`)
- Fixed button bottom-right (`fixed bottom-6 right-6 z-50`) with `Bot` icon.
- Click opens a panel (w-96, h-[500px]) with the same chat UI (messages, input, markdown).
- Uses `useChatMessages` hook -- same conversation as full page.
- Close/minimize button. Unread dot indicator.
- Smooth open/close animation with scale transition.

### 4. Mount in AppLayout (`src/components/AppLayout.tsx`)
- Add `<FloatingChat />` after `<main>`.
- Use `useLocation()` to hide widget when on `/asistente` (avoid duplication).

### Files
- **Create**: `src/hooks/useChatMessages.ts`, `src/components/FloatingChat.tsx`
- **Edit**: `src/pages/AsistenteIA.tsx`, `src/components/AppLayout.tsx`

