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
