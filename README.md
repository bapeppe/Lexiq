# VocaLoop

A daily English vocabulary loop: review what is due, discover four new words, and grow a personal vocabulary vault.

## Architecture

- React/Vite frontend and Express API, both using TypeScript.
- MongoDB via Mongoose, preserving the existing `MONGO_URI` deployment configuration.
- Users own vocabulary progress; a unique `(userId, wordId)` index prevents duplicate cards. A `(userId, nextReviewDate)` index supports the review queue.
- Words include CEFR level, British IPA, definitions, context, and collocations. The seed safely upserts more than 50 B1–C1 entries by term.
- Progress stores intervals, ease factors, repetitions, review dates, and mastery. Streaks store daily completion and the daily acquisition pack.
- Daily boundaries are UTC. Four review buttons map to SM-2 quality scores 1, 3, 4, and 5. Initial intervals are one and six days; later intervals use the card's ease factor, with a minimum factor of 1.3.

## Core development

Use Node.js 22.12 or later and the existing MongoDB service. Never commit real credentials.

```sh
cd backend
npm ci
cp .env.example .env
# Set MONGO_URI for your existing database.
npm run build
npm test
npm run seed
```

The seed command requires `MONGO_URI` explicitly and does not clear collections or alter Docker volumes.

```sh
cd frontend
npm ci
npm run build
```

Each delivery step is built and tested before its Conventional Commit is pushed to `main`, because pushes trigger remote deployment.

## API and authentication

Run `npm run dev` in `backend` during development, or `npm run build && npm start` for the compiled service. The server seeds the vocabulary catalog on startup without deleting existing progress.

Create an account with `POST /api/auth/signup` (`name`, `email`, `password`, minimum ten characters). Sign in with `POST /api/auth/login`; use `GET /api/auth/me` and `POST /api/auth/logout` for the session. Tokens are opaque, hashed in MongoDB, and delivered in HttpOnly cookies. Set `COOKIE_SECURE=true` for HTTPS deployments.

Authenticated endpoints:

| Endpoint | Behavior |
| --- | --- |
| `GET /api/daily/status` | Review count, acquisition gate, daily completion, and streak. |
| `GET /api/reviews/due` | All cards due through the end of the current UTC day. |
| `POST /api/reviews/submit` | Grade a `progressId` with `rating` 1–4 and UUID `submissionId`. Retry a request with the same UUID; use a new UUID for the next recall attempt. |
| `GET /api/words/daily-new` | Claim today's persistent four-word pack; returns 423 while reviews remain. This endpoint acquires the cards, so call it when the learner chooses to unlock. |
| `GET /api/vault` | Acquired words, optionally filtered with `q` and `mastery`. |
| `GET /api/stats` | Mastery totals, review accuracy, and streak. |
| `GET /api/health` | Database readiness, returning 503 if unavailable. |

Again and Hard remain in today's queue until a Good or Easy recall. Same-session retries keep the first scheduling result; they do not repeatedly multiply intervals. Review replay receipts retain the latest 100 submissions per card.

`npm test` runs scheduling tests and real database integration tests. Install `mongod` locally, or supply `MONGO_TEST_URI` for a test MongoDB server. API tests use a generated test database and never clear the application database.
