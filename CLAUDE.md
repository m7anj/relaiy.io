# CLAUDE.md - Relaiy.io Project Guide

## Project Overview

Relaiy is a Gmail automation platform that lets users describe email workflows in plain English. The system uses an LLM to generate structured, deterministic configurations that are safe and reviewable before execution.

**Core Principle:** LLM is ONLY used for configuration generation. All execution is deterministic and safe.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with Google OAuth (includes Gmail API scopes)
- **AI:** OpenAI GPT-4 for config generation
- **Email:** Gmail API via `googleapis`
- **Validation:** Zod for schema validation
- **Styling:** Tailwind CSS v4

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts  # NextAuth handler
│   │   │   └── gmail/
│   │   │       ├── route.ts            # Gmail OAuth initiation
│   │   │       └── callback/route.ts   # Gmail OAuth callback
│   │   ├── gmail/
│   │   │   └── messages/route.ts       # Fetch Gmail messages
│   │   └── workers/
│   │       ├── route.ts                # List workers (empty)
│   │       ├── create/route.ts         # POST: Create new worker
│   │       └── [id]/
│   │           ├── route.ts            # GET/PATCH/DELETE worker (empty)
│   │           ├── execute/route.ts    # POST: Execute worker
│   │           └── logs/route.ts       # GET: Worker execution logs (empty)
│   └── types.ts                        # (empty - use src/types instead)
├── lib/
│   ├── auth.ts         # getAuthenticatedUser() helper
│   ├── creation.ts     # generateWorkerConfig() - LLM config generation
│   ├── gmail.ts        # Gmail API utilities (fetch, send)
│   ├── prisma.ts       # Prisma client singleton
│   └── dryrun.ts       # (empty - dry run logic)
├── types/
│   ├── index.ts        # Central type exports
│   ├── worker.ts       # Worker, WorkerStatus, WorkerType, ExecutionStatus
│   ├── workerTypes.ts  # WORKER_TYPE_CONFIGS, system prompts, defaults
│   ├── configuration.ts # Configuration interface
│   └── next-auth.d.ts  # NextAuth type extensions
└── generated/
    └── prisma/         # Generated Prisma client
prisma/
└── schema.prisma       # Database schema
```

## Type System

### Worker Types (WorkerType enum)
- `OUTREACH` - Cold emails with clear CTAs
- `NURTURE` - Warm relationship check-ins
- `RESPONDER` - Auto-replies to incoming emails
- `DIGEST` - Summarize multiple emails into one

### Worker Lifecycle (WorkerStatus enum)
- `DRAFT` - Being configured, not yet activated
- `ACTIVE` - Enabled and will execute on schedule
- `PAUSED` - Paused by user
- `STOPPED` - Permanently stopped (hit stop conditions)

### Execution Status (ExecutionStatus enum)
- `SUCCESS` - Last execution succeeded
- `ERROR` - Last execution failed
- `RUNNING` - Execution in progress

### Configuration Interface
```typescript
interface Configuration {
  interval: string;              // "daily at 9am", "every Monday"
  recipients: string[];          // Email addresses
  contextEmails?: {
    labels?: string[];           // Gmail labels to fetch
    from?: string[];             // Senders to fetch from
    limit?: number;              // Max emails to fetch
  };
  tone?: string;                 // "professional", "casual", "friendly", "formal"
  style?: string;                // "brief", "detailed", "creative"
  customInstructions?: string;   // Free-form LLM instructions
  subjectTemplate?: string | null; // Subject template or null for LLM
  lifespan?: number;             // Stop after X sends
}
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers |
| GET | `/api/auth/gmail` | Initiate Gmail OAuth |
| GET | `/api/auth/gmail/callback` | Gmail OAuth callback |

### Workers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workers` | List user's workers (TODO) |
| POST | `/api/workers/create` | Create new worker from description |
| GET | `/api/workers/[id]` | Get worker details (TODO) |
| PATCH | `/api/workers/[id]` | Update worker (TODO) |
| DELETE | `/api/workers/[id]` | Delete worker (TODO) |
| POST | `/api/workers/[id]/execute` | Execute worker |
| GET | `/api/workers/[id]/logs` | Get execution logs (TODO) |

### Gmail
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gmail/messages` | Fetch user's recent emails |

## Database Schema (Prisma)

### Models
- **User** - NextAuth user with Gmail tokens
- **Account** - OAuth accounts (NextAuth adapter)
- **Session** - User sessions (NextAuth adapter)
- **Worker** - Email automation workers
- **WorkerExecution** - Execution history and logs

### Key Relations
```
User 1--* Worker 1--* WorkerExecution
User 1--* Account (Google OAuth tokens stored here)
```

## Key Files to Know

### `src/lib/auth.ts`
```typescript
// Use at start of any API route requiring auth
const user = await getAuthenticatedUser();
if (!user) return Response.json({ message: "Not authenticated" }, { status: 401 });
// user.accounts[0].access_token contains Gmail token
```

### `src/lib/creation.ts`
- `generateWorkerConfig(description, type)` - Calls GPT-4 to generate Configuration from natural language
- Uses Zod validation to ensure valid output
- Type-specific system prompts for each WorkerType

### `src/lib/gmail.ts`
- `getGmailClient(accessToken)` - Get authenticated Gmail client
- `fetchEmailsFromRecipients(accessToken, recipients)` - Fetch emails from specific senders
- `sendEmail(accessToken, recipients, subject, body, dryRun)` - Send email via Gmail API

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Prisma
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema to database
npx prisma studio    # Open Prisma Studio GUI
npx prisma migrate dev --name <name>  # Create migration
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=           # PostgreSQL connection string
GOOGLE_CLIENT_ID=       # Google OAuth client ID
GOOGLE_CLIENT_SECRET=   # Google OAuth client secret
OPENAI_API_KEY=         # OpenAI API key
NEXTAUTH_SECRET=        # NextAuth secret
NEXTAUTH_URL=           # App URL (http://localhost:3000 for dev)
```

## Implementation Status

### Completed
- [x] NextAuth with Google OAuth + Gmail scopes
- [x] Prisma schema with User, Worker, WorkerExecution
- [x] Worker creation with LLM config generation
- [x] Gmail API integration (fetch, send)
- [x] Type system for workers and configurations
- [x] Auth helper (`getAuthenticatedUser`)

### TODO / Incomplete
- [x] `GET /api/workers` - List workers
- [x] `GET/PATCH/DELETE /api/workers/[id]` - Worker CRUD
- [ ] `GET /api/workers/[id]/logs` - Execution logs
- [ ] `src/lib/dryrun.ts` - Dry run simulation
- [ ] Worker execution scheduling (cron jobs)
- [ ] Frontend UI (pages/components)
- [ ] Worker pause/resume/stop functionality
- [ ] Execution logging to WorkerExecution table

## Code Patterns

### API Route Pattern
```typescript
export async function POST(req: Request) {
  // 1. Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // 2. Get access token
  const accessToken = user.accounts[0]?.access_token;
  if (!accessToken) {
    return Response.json({ message: "No Google account connected" }, { status: 400 });
  }

  // 3. Business logic
  try {
    // ... use prisma, lib functions
    return Response.json({ data });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Worker Creation Flow
1. User provides natural language description + WorkerType
2. `generateWorkerConfig()` calls GPT-4 with type-specific prompts
3. Zod validates the generated Configuration
4. Worker saved to database with status=DRAFT
5. User reviews and activates

### Execution Flow (To Be Implemented)
1. Scheduler triggers worker based on `configuration.interval`
2. Fetch context emails based on `configuration.contextEmails`
3. Generate email content using type-specific prompts
4. Send email via Gmail API (or dry run)
5. Log execution to WorkerExecution table
6. Update worker's `executionCount`, `lastExecutedAt`, `nextScheduledAt`

## Notes for Development

- Prisma client is generated to `src/generated/prisma`
- Use `@/` path alias for imports (configured in tsconfig.json)
- Gmail API requires specific scopes: `gmail.modify`, `gmail.send`
- Access tokens stored in `Account` table, refreshed via NextAuth callbacks
- Worker `configuration` stored as JSON in PostgreSQL
