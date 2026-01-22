
### TODO / Incomplete
# CLAUDE.md - Relaiy.io Project Guide

## Project Overview

Relaiy is a Gmail automation platform that lets users describe email workflows in plain English. The system uses an LLM to generate structured, deterministic configurations that are safe and reviewable before execution.

**Core Principle:** LLM is ONLY used for configuration generation. All execution is deterministic and safe.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with Google OAuth (includes Gmail API scopes)
- **AI:** Groq (llama-3.3-70b-versatile) for config generation
- **Email:** Gmail API via `googleapis`
- **Validation:** Zod for schema validation
- **Styling:** Tailwind CSS v4

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
| GET | `/api/workers` | List user's workers |
| POST | `/api/workers/create` | Create new worker from description |
| GET | `/api/workers/[id]` | Get worker details |
| PATCH | `/api/workers/[id]` | Update worker |
| DELETE | `/api/workers/[id]` | Delete worker |
| POST | `/api/workers/[id]/execute` | Execute worker (manual/first run) |
| GET | `/api/workers/[id]/logs` | Get execution logs |
| POST | `/api/workers/[id]/logs` | Create execution log |

### Scheduler
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scheduler/init` | Initialize scheduler (load ACTIVE workers) |
| GET | `/api/scheduler/init` | Get currently scheduled tasks info |

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

### `src/lib/preview.ts`
- `generateEmailPreviews(config, workerType, workerName, contextEmails)` - Generate preview emails using LLM
- Uses type-specific prompts to show what emails will look like
- Called automatically during worker creation for user review

### `src/lib/dryrun.ts`
- `simulateSendEmail(base64EncodedEmail)` - Simulate email sending without actually sending
- Used for testing email generation before activation

### `src/lib/scheduler.ts`
- `parseIntervalToCron(interval)` - Converts natural language intervals to cron expressions
- `executeWorker(workerId, isDryRun)` - Core execution logic for workers (used by both manual and automated runs)
- `registerWorker(workerId, interval)` - Register worker with cron scheduler
- `unregisterWorker(workerId)` - Remove worker from cron scheduler
- `initializeScheduler()` - Load all ACTIVE workers on app startup
- `getScheduledTasks()` - Get list of currently scheduled workers
- Uses `node-cron` for scheduling
- Automatically handles lifespan checking and auto-stopping workers

### `src/instrumentation.ts`
- Next.js server startup hook
- Automatically calls `initializeScheduler()` when server starts
- Ensures all ACTIVE workers are scheduled on app startup

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
GROQ_API_KEY=           # Groq API key
NEXTAUTH_SECRET=        # NextAuth secret
NEXTAUTH_URL=           # App URL (http://localhost:3000 for dev)
```

- [ ] Frontend UI (pages/components)
- [ ] User-configurable timezone for scheduling
- [ ] Enhanced LLM email generation (currently uses placeholder templates)
- [ ] Rate limiting for worker executions
- [ ] Execution retry logic for failed runs

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
4. System fetches context emails (if configured in contextEmails)
5. `generateEmailPreviews()` creates preview emails using LLM (DRY RUN)
6. Worker saved to database with status=DRAFT
7. Preview emails returned to user for review
8. User reviews preview - worker stays in DRAFT until first execution

### First Execution Flow (DRAFT → ACTIVE)
1. User manually triggers first execution via POST `/api/workers/[id]/execute`
2. Worker status transitions from DRAFT → ACTIVE
3. Worker is registered with cron scheduler using `configuration.interval`
4. First email execution happens (via `executeWorker()`)
5. Worker is now scheduled for automated future executions
6. Response includes confirmation of activation and scheduling

### Automated Execution Flow (Scheduled)
1. Cron scheduler triggers based on `configuration.interval` (e.g., "daily at 9am")
2. `executeWorker(workerId)` is called automatically
3. Creates WorkerExecution record with status=RUNNING
4. Fetches context emails based on `configuration.contextEmails`
5. Generates email content using type-specific LLM prompts
6. Sends email via Gmail API
7. Updates WorkerExecution to SUCCESS/ERROR with logs
8. Atomically updates worker's `executionCount`, `lastExecutedAt`, `lastExecutionStatus`
9. Checks if `executionCount >= configuration.lifespan`:
   - If yes: Updates worker status to STOPPED and unregisters from scheduler
   - If no: Continues scheduling future executions

### Worker Lifecycle Management
- **DRAFT**: Created but not activated, no scheduling
- **ACTIVE**: First execution completed, registered with scheduler, runs automatically
- **PAUSED**: User paused via PATCH, unregistered from scheduler, can be resumed
- **STOPPED**: Lifespan reached or user stopped, unregistered from scheduler, permanent

## Scheduler System

### How It Works
The scheduler uses `node-cron` to automatically execute workers based on their configured intervals. It runs in-process with the Next.js server.

### Initialization
On server startup, `src/instrumentation.ts` automatically:
1. Calls `initializeScheduler()` from `src/lib/scheduler.ts`
2. Loads all workers with status=ACTIVE from database
3. Registers each worker with cron using their `configuration.interval`
4. Logs the number of workers registered

### Interval Parsing
Natural language intervals are converted to cron expressions:
- `"daily at 9am"` → `"0 9 * * *"`
- `"every Monday at 10am"` → `"0 10 * * 1"`
- `"every 3 hours"` → `"0 */3 * * *"`
- `"every Tuesday"` → `"0 9 * * 2"` (defaults to 9am)

### Registration/Unregistration
Workers are automatically registered/unregistered with the scheduler:

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
- `POST /api/scheduler/init` - Manually re-initialize scheduler (useful after deployment)
- Check server logs for cron execution messages

### Important Notes
- Scheduler runs in the Next.js server process
- Timezone is currently hardcoded to `America/New_York` (TODO: make configurable)
- If server restarts, scheduler automatically reinitializes via `instrumentation.ts`
- All ACTIVE workers are re-registered on startup

## Notes for Development

- Prisma client is generated to `src/generated/prisma`
- Use `@/` path alias for imports (configured in tsconfig.json)
- Gmail API requires specific scopes: `gmail.modify`, `gmail.send`
- Access tokens stored in `Account` table, refreshed via NextAuth callbacks
- Worker `configuration` stored as JSON in PostgreSQL


---
# SYSTEM BEHAVIOUR - Frontend Development

Use the frontend-design skill.

description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

