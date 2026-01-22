# CLAUDE.md - Relaiy.io Project Guide

## Project Overview

Relaiy is a Gmail automation platform that lets users describe email workflows in plain English. The system uses an LLM to generate structured, deterministic configurations that are safe and reviewable before execution.

**Core Principle:** LLM is used for configuration generation AND email content generation. Execution logic is deterministic.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with Google OAuth (includes Gmail API scopes)
- **AI:** Groq (llama-3.3-70b-versatile) for config and email generation
- **Email:** Gmail API via `googleapis`
- **Scheduling:** node-cron for automated worker execution
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
│   │   ├── scheduler/
│   │   │   ├── init/route.ts           # Initialize/view scheduler
│   │   │   └── register/route.ts       # Register worker with scheduler
│   │   ├── debug/
│   │   │   └── scheduler/route.ts      # Debug scheduler state
│   │   └── workers/
│   │       ├── route.ts                # GET: List workers
│   │       ├── create/route.ts         # POST: Create new worker
│   │       └── [id]/
│   │           ├── route.ts            # GET/PATCH/DELETE worker
│   │           ├── execute/route.ts    # POST: Execute worker
│   │           └── logs/route.ts       # GET/POST: Execution logs
├── lib/
│   ├── auth.ts                # getAuthenticatedUser() helper
│   ├── creation.ts            # generateWorkerConfig() - LLM config generation
│   ├── gmail.ts               # Gmail API utilities (fetch, send)
│   ├── preview.ts             # generateEmailPreviews() - LLM email generation
│   ├── scheduler.ts           # Cron scheduling & worker execution
│   ├── conversationHistory.ts # Fetch email conversation threads
│   ├── tokenValidator.ts      # Google OAuth token validation
│   ├── dryrun.ts              # Dry run simulation helper
│   └── prisma.ts              # Prisma client singleton
├── types/
│   ├── index.ts               # Central type exports
│   ├── worker.ts              # Worker, WorkerStatus, WorkerType, ExecutionStatus
│   ├── workerTypes.ts         # WORKER_TYPE_CONFIGS, system prompts, defaults
│   ├── configuration.ts       # Configuration interface
│   └── next-auth.d.ts         # NextAuth type extensions
├── generated/
│   └── prisma/                # Generated Prisma client
└── instrumentation.ts         # Next.js server startup hook (scheduler init)
prisma/
└── schema.prisma              # Database schema
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
  style?: string;                // "brief", "detailed", "creative", "super-human"
  customInstructions?: string;   // Free-form LLM instructions
  subjectTemplate?: string | null; // Subject template or null for LLM
  senderName?: string;           // Name for personalization and signatures
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
| GET | `/api/workers` | List user's workers |
| POST | `/api/workers/create` | Create new worker from description |
| GET | `/api/workers/[id]` | Get worker details |
| PATCH | `/api/workers/[id]` | Update worker (name, status, config, recipients) |
| DELETE | `/api/workers/[id]` | Delete worker (also unregisters from scheduler) |
| POST | `/api/workers/[id]/execute` | Execute worker (manual trigger or first run) |
| GET | `/api/workers/[id]/logs` | Get execution logs (paginated, filterable) |
| POST | `/api/workers/[id]/logs` | Create execution log entry |

### Scheduler
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scheduler/init` | Initialize scheduler (load ACTIVE workers) |
| GET | `/api/scheduler/init` | Get currently scheduled tasks info |
| POST | `/api/scheduler/register` | Register a specific worker |
| GET | `/api/debug/scheduler` | Debug scheduler state |

### Gmail
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gmail/messages` | Fetch user's recent emails |

## Database Schema (Prisma)

### Models
- **User** - NextAuth user with Gmail tokens
- **Account** - OAuth accounts (NextAuth adapter) - stores access_token, refresh_token
- **Session** - User sessions (NextAuth adapter)
- **Worker** - Email automation workers
- **WorkerExecution** - Execution history and logs

### Key Relations
```
User 1--* Worker 1--* WorkerExecution
User 1--* Account (Google OAuth tokens stored here)
```

## Key Library Files

### `src/lib/auth.ts`
```typescript
// Use at start of any API route requiring auth
const user = await getAuthenticatedUser();
if (!user) return Response.json({ message: "Not authenticated" }, { status: 401 });
// user.accounts[0].access_token contains Gmail token
```

### `src/lib/creation.ts`
- `generateWorkerConfig(description, type, context?)` - Calls Groq to generate Configuration from natural language
- Uses Zod validation to ensure valid output
- `normalizeConfiguration()` - Handles LLM output normalization (arrays to strings, etc.)
- Type-specific system prompts for each WorkerType

### `src/lib/gmail.ts`
- `getGmailClient(accessToken)` - Get authenticated Gmail client
- `fetchEmailsFromRecipients(accessToken, recipients)` - Fetch emails from specific senders
- `sendEmail(accessToken, recipients, subject, body, dryRun)` - Send email via Gmail API

### `src/lib/preview.ts`
- `generateEmailPreviews(config, workerType, workerName, contextEmails, conversationHistory)` - Generate email content using LLM
- Uses type-specific prompts with style guidelines (super-human, professional, concise)
- Incorporates conversation history to avoid repetition and build on previous exchanges
- Higher temperature (0.9) when history exists for variation

### `src/lib/conversationHistory.ts`
- `fetchConversationWithRecipients(accessToken, recipients, limit)` - Get full email threads
- Returns both sent and received emails with direction indicator
- Used to provide context for LLM email generation

### `src/lib/tokenValidator.ts`
- `validateGoogleToken(accessToken)` - Test if OAuth token is valid
- `getTokenInfo(accessToken)` - Get detailed token info for debugging

### `src/lib/scheduler.ts`
- `parseIntervalToCron(interval)` - Converts natural language intervals to cron expressions
- `executeWorker(workerId, isDryRun)` - Core execution logic (creates logs, sends emails, updates worker)
- `registerWorker(workerId, interval)` - Register worker with cron scheduler
- `unregisterWorker(workerId)` - Remove worker from cron scheduler
- `initializeScheduler()` - Load all ACTIVE workers on app startup
- `getScheduledTasks()` - Get list of currently scheduled workers

### `src/lib/dryrun.ts`
- `simulateSendEmail(base64EncodedEmail)` - Simulate email sending without actually sending

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
GROQ_API_KEY=           # Groq API key (for LLM)
NEXTAUTH_SECRET=        # NextAuth secret
NEXTAUTH_URL=           # App URL (http://localhost:3000 for dev)
```

## Implementation Status

### Completed
- [x] NextAuth with Google OAuth + Gmail scopes
- [x] Prisma schema with User, Worker, WorkerExecution
- [x] Worker creation with LLM config generation (Groq)
- [x] Gmail API integration (fetch, send)
- [x] Type system for workers and configurations
- [x] Auth helper (`getAuthenticatedUser`)
- [x] Worker CRUD endpoints (GET/PATCH/DELETE)
- [x] Worker listing endpoint
- [x] Execution logs endpoints (GET with pagination/filtering, POST)
- [x] Worker execution with logging (creates WorkerExecution records)
- [x] Cron scheduler with natural language interval parsing
- [x] Auto-registration of workers on first execution (DRAFT → ACTIVE)
- [x] Lifespan enforcement (auto-stop when limit reached)
- [x] Conversation history fetching for contextual emails
- [x] LLM email generation with conversation context
- [x] Token validation before execution
- [x] Scheduler initialization on server startup (instrumentation.ts)

### TODO / Incomplete
- [ ] Frontend UI (pages/components)
- [ ] User-configurable timezone for scheduling
- [ ] Rate limiting for worker executions
- [ ] Execution retry logic for failed runs
- [ ] Email preview endpoint (preview without executing)

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
2. `generateWorkerConfig()` calls Groq with type-specific prompts
3. Zod validates the generated Configuration
4. Worker saved to database with status=DRAFT
5. User can update recipients via PATCH before activation

### First Execution Flow (DRAFT → ACTIVE)
1. User manually triggers first execution via POST `/api/workers/[id]/execute`
2. Token validation checks Google OAuth token is valid
3. Worker status transitions from DRAFT → ACTIVE
4. Worker is registered with cron scheduler using `configuration.interval`
5. `executeWorker()` runs:
   - Creates WorkerExecution with status=RUNNING
   - Fetches conversation history with recipients
   - Generates email content via `generateEmailPreviews()`
   - Sends emails via Gmail API
   - Updates WorkerExecution to SUCCESS/ERROR
   - Updates worker's executionCount, lastExecutedAt, lastExecutionStatus
6. Response confirms activation and scheduling

### Automated Execution Flow (Scheduled)
1. Cron scheduler triggers based on `configuration.interval`
2. `executeWorker(workerId)` is called automatically
3. Same execution logic as manual trigger
4. Checks if `executionCount >= configuration.lifespan`:
   - If yes: Updates worker status to STOPPED and unregisters from scheduler
   - If no: Continues scheduling future executions

### Worker Lifecycle Management
- **DRAFT**: Created but not activated, no scheduling
- **ACTIVE**: First execution completed, registered with scheduler, runs automatically
- **PAUSED**: User paused via PATCH, unregistered from scheduler, can be resumed
- **STOPPED**: Lifespan reached or user stopped, unregistered from scheduler

## Scheduler System

### How It Works
The scheduler uses `node-cron` to automatically execute workers based on their configured intervals. It runs in-process with the Next.js server.

### Initialization
On server startup, `src/instrumentation.ts` automatically:
1. Calls `initializeScheduler()` from `src/lib/scheduler.ts`
2. Loads all workers with status=ACTIVE from database
3. Registers each worker with cron using their `configuration.interval`

### Interval Parsing Examples
- `"daily at 9am"` → `"0 9 * * *"`
- `"every Monday at 10am"` → `"0 10 * * 1"`
- `"every 3 hours"` → `"0 */3 * * *"`
- `"every 5 minutes"` → `"*/5 * * * *"`
- `"every Tuesday"` → `"0 9 * * 2"` (defaults to 9am)

### Registration/Unregistration
**Registered when:**
- First execution (DRAFT → ACTIVE transition)
- Status updated to ACTIVE via PATCH
- Configuration.interval updated via PATCH (re-registers with new schedule)

**Unregistered when:**
- Status updated to PAUSED or STOPPED via PATCH
- Worker deleted via DELETE
- Lifespan reached (auto-stops and unregisters)

### Debugging
- `GET /api/scheduler/init` - View currently scheduled workers
- `GET /api/debug/scheduler` - Debug scheduler state
- `POST /api/scheduler/init` - Manually re-initialize scheduler
- Check server logs for cron execution messages

## Notes for Development

- Prisma client is generated to `src/generated/prisma`
- Use `@/` path alias for imports (configured in tsconfig.json)
- Gmail API requires scopes: `gmail.modify`, `gmail.send`
- Access tokens stored in `Account` table, refreshed via NextAuth callbacks
- Worker `configuration` stored as JSON in PostgreSQL
- Scheduler timezone is currently hardcoded to UTC
- If server restarts, scheduler automatically reinitializes via `instrumentation.ts`

---

# Frontend Development Guidelines

Use distinctive, production-grade frontend interfaces with high design quality.

## Design Principles
- **Typography**: Choose distinctive fonts, avoid generic (Inter, Arial, Roboto)
- **Color**: Commit to cohesive aesthetic with dominant colors and sharp accents
- **Motion**: Use CSS animations and micro-interactions for high-impact moments
- **Spatial Composition**: Unexpected layouts, asymmetry, generous negative space
- **Backgrounds**: Create atmosphere with gradients, textures, patterns

## Style Options
- "super-human": Exceptionally polished, warm yet professional
- "professional": Clear, business-appropriate, focused
- "concise": Brief, direct, gets to the point quickly

Avoid generic AI aesthetics: overused fonts, cliched purple gradients, cookie-cutter layouts.
