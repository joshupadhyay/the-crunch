# PRD: The Crunch v1 - Restaurant Recommendation Chatbot

## Problem
Finding the right restaurant for a night out is overwhelming. Too many options, scattered across Yelp/Google/Resy/Infatuation, with no single place to have a conversation about what you actually want. Users need a concierge-style experience that understands their preferences, budget, vibe, and neighborhood to narrow down the perfect spot.

## Solution
A conversational AI chatbot with a 70s-inspired aesthetic that acts as your personal dining concierge. Chat naturally about what you're looking for, and the bot searches restaurant data, tracks your preferences visually on a corkboard sidebar, and helps you decide.

## User Stories
1. As a diner, I want to describe what I'm in the mood for and get restaurant suggestions
2. As a diner, I want the bot to remember my dietary restrictions and preferences during our conversation
3. As a diner, I want to see my preferences and shortlisted restaurants visually on a sidebar
4. As a diner, I want the bot to search real restaurant data (not just make things up)

## Architecture

### Backend (Bun.serve)
- **Server**: `src/server.ts` - Bun.serve with HTML import + API routes
- **ChatBot**: `src/AnthropicChatBot.ts` - Wraps Anthropic SDK with tool-use support
- **Database**: `src/Database.ts` - In-memory Map for conversations
- **Tools**: `src/tools.ts` - Restaurant search tool definitions for Claude
- **System Prompt**: `src/system-prompt.ts` - Restaurant concierge personality

### Frontend (React + Tailwind)
- **App**: `src/App.tsx` - Main layout with chat + corkboard sidebar
- **ChatView**: `src/ChatView.tsx` - Chat interface with 70s styling
- **CorkBoard**: `src/CorkBoard.tsx` - Corkboard sidebar with sticky notes + pins
- **StickyNote**: `src/StickyNote.tsx` - Individual preference note component
- **RestaurantPin**: `src/RestaurantPin.tsx` - Pinned restaurant card

### API Routes
- `POST /api/chat/create` - Create new conversation
- `POST /api/chat/send` - Send message (with tool-use handling)
- `GET /api/chat/conversations` - List conversations
- `GET /api/chat/conversations/:id` - Get conversation messages
- `GET /api/chat/conversations/:id/context` - Get extracted preferences + restaurants

### Color Palette (70s Earth Tones)
- Dark Walnut: #e75a18 (primary accent)
- Dark Khaki: #af9250 (secondary/warm neutral)
- Tiger Orange: #e87c17 (highlights)
- Rich Mahogany: #e34a1c (deep accent)
- Rosy Copper: #c85637 (warm mid-tone)
- Background: cream/off-white tones from the 50 shades

### Design Language
- Typography: Retro serif display (Google Fonts)
- Rounded corners, organic shapes
- Cork texture on sidebar
- Sticky notes with slight rotation/shadow
- Warm, inviting feel

## Acceptance Criteria
- [ ] Chat interface works with Anthropic API
- [ ] 70s aesthetic applied consistently
- [ ] Corkboard sidebar shows sticky notes for preferences
- [ ] Restaurant pins appear when bot suggests places
- [ ] System prompt gives bot restaurant concierge personality
- [ ] Tool use allows bot to "search" for restaurants
