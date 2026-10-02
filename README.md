# Lexiq

Un’app per italiani che imparano l’inglese: ripassa, scopri da 1 a 20 nuove parole al giorno e rivedi il tuo vocabolario quando vuoi.

## Native development on Mac

Use Node.js 22.12 or later. Docker runs exclusively on the remote server through Portainer; do not run Docker commands locally.

```sh
cd backend
npm ci
cp -n .env.example .env
npm run build
npm test
npm run dev
```

The database connection is `MONGODB_URI=mongodb://100.96.72.20:27017/lexiq_db`. The existing `MONGO_URI` variable remains supported for compatibility. `MONGODB_URI` takes precedence. Connect to Tailscale before starting the service. The API defaults to port 5000; set `PORT` to a free port if macOS already occupies it.

```sh
cd frontend
npm ci
npm run dev
npm run build
npm run typecheck
npm run lint
```

Vite serves port 3000 and proxies relative `/api` requests to the native backend on port 5000. Set `API_PROXY_TARGET` for a different development API port. Avoid browser requests directly from localhost to the remote HTTP API: session cookies would cross sites. The development proxy preserves same-origin cookie authentication.

## Production topology

| Service | Endpoint / configuration |
| --- | --- |
| `lexiq-frontend` | , stack file `frontend/docker-compose.yml` |
| `lexiq-backend` | , stack file `backend/docker-compose.yml` |
| `mern-database` | Existing MongoDB service and persistent volumes; unchanged |
| Database | `` |

Set the values in [.env.example](.env.example) in Portainer. Keep real `.env` files private. The frontend reads `VITE_API_URL` at build time, with `API_URL` as a configuration fallback. Production defaults to the Tailscale API, and development defaults to relative paths. The API wrapper contains no static server address. Rebuild the frontend after changing its API URL.

CORS allows the production frontend, `http://localhost:3000`, and `http://localhost:5173` (plus the corresponding loopback IP origins). `FRONTEND_ORIGIN` can replace those defaults with an explicit origin list. The HTTP topology requires `COOKIE_SECURE=false`; set it to true when using HTTPS. Tokens are opaque, hashed in MongoDB, and delivered in HttpOnly, SameSite=Lax cookies. Only set `TRUST_PROXY=1` when the API sits exclusively behind one trusted reverse proxy.

Published ports remain 3000 and 5000. `FRONTEND_PORT` and `BACKEND_PORT` allow host port overrides without changing service ports. No database service, volume, or existing bridge is replaced. Portainer performs all image builds and deployment; local verification uses Node.js builds, type checks, and tests. The backend runtime uses USER node; nginx uses UID 101. Images expose service ports 5000 and 3000 and include readiness healthchecks. Runtime images contain only compiled assets and required production dependencies.

## Habit loop and data

Daily boundaries are UTC. Reviews due through the end of the current UTC day must be cleared before acquisition. Again and Hard keep the card in today's queue until Good or Easy recall. Four buttons map to SM-2 quality scores 1, 3, 4, and 5; intervals begin at one and six days, then multiply by the ease factor with upward rounding and a minimum factor of 1.3. Same-session retries preserve the first scheduling result.

Users own indexed vocabulary progress. Unique `(userId, wordId)` indexes prevent duplicate cards; `(userId, nextReviewDate)` supports review queries. Mastery is Learning, Familiar, or Mastered based on successful repetitions and interval. Streak updates are atomic and increment once per UTC day. Review receipts and durable submission identifiers prevent duplicate grading when requests are retried.

Il catalogo include 56 voci editoriali e oltre 20.000 voci del Wikizionario con significati italiani. Il numero di nuove parole dipende dall’obiettivo scelto alla registrazione. La selezione viene riservata al primo accesso e ciascuna parola viene acquisita quando è mostrata. Fonti, aggiornamento del catalogo e pronuncia sono descritti nelle sezioni seguenti.

## API

Create an account with `POST /api/auth/signup` (`name`, `email`, `password`, minimum ten characters). Sign in with `POST /api/auth/login`; use `GET /api/auth/me` and `POST /api/auth/logout` for session management.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/daily/status` | Due count, acquisition gate, completion, and streak |
| `GET /api/reviews/due` | All cards due today |
| `POST /api/reviews/submit` | Grade `progressId` using `rating` 1–4 and UUID `submissionId`; preserve UUID for retries |
| `GET /api/words/daily-new` | Acquire today's persistent pack; returns 423 while reviews remain |
| `GET /api/vault` | Acquired words with optional `q` and `mastery` filters |
| `GET /api/stats` | Mastery totals, observed seven-day recall accuracy, and streak |
| `GET /api/health` | Database readiness; returns 503 when unavailable |

Space reveals flashcards; 1–4 grade them. Typing and multiple-choice cloze modes provide alternative recall. The vault supports search and mastery filters, with mobile definition sheets. Dark/light theme preference is applied before paint, and Inter is bundled locally.

## Validation and delivery

`npm test` in `backend` runs pure SRS tests and real MongoDB integration tests. Supply a local `mongod` executable, or `MONGO_TEST_URI` pointing to a test server. The suite selects a generated database name and drops only that test database. It verifies authentication, origins, acquisition races, queue locking, repeat recall, duplicate/racing submissions, ownership, logout, and streak transitions.

Every checkpoint is built before committing and pushing to `main`, because pushes synchronize the remote Portainer stacks. Both services use `pull_policy: build` so Compose rebuilds their source even when an older image is cached ([Compose reference](https://docs.docker.com/reference/compose-file/services/#pull_policy)). Dockerfiles and Compose files are reviewed statically on Mac; runtime container checks belong on the remote server.

## Obiettivo e parole viste

Durante la registrazione si sceglie un obiettivo tra 1 e 20 nuove parole al giorno.
Gli account esistenti mantengono il valore salvato (quattro, in assenza di una
scelta). Il server riserva una selezione giornaliera stabile, ma acquisisce una
parola soltanto quando il frontend comunica che è stata mostrata. Ricaricare o
aprire più sessioni non aumenta il limite e non duplica i progressi.

Le parole viste sono subito disponibili in **Ripasso → Tutte le parole** e nel
vocabolario. Il ripasso libero non invia valutazioni al server e non cambia
scadenze o statistiche. Il primo ripasso programmato avviene il giorno successivo.
La serie giornaliera avanza dopo aver visto tutte le parole disponibili per il
proprio obiettivo e completato i ripassi dovuti. Le giornate seguono UTC.

## Catalogo e pronuncia

Il catalogo incluso contiene oltre 20.000 parole con significati italiani,
importate dal Wikizionario italiano tramite Kaikki. Il server le importa in
blocchi all’avvio; non servono chiamate a un dizionario esterno durante lo studio.
Le 56 voci editoriali restano prioritarie. Le importazioni ripetute preservano
identificativi, progressi e correzioni esistenti.

Per aggiornare il file incluso:

```sh
cd backend
npm run catalog:download
npm run build
```

Per importarlo esplicitamente nel database configurato: `npm run seed`.
Le fonti, le licenze e i filtri applicati sono descritti in
[CATALOG-SOURCES.md](backend/src/data/CATALOG-SOURCES.md).
Le voci importate non ricevono livelli CEFR o esempi inventati. L’esercizio
“Completa la frase” è disponibile solo per le parole con un esempio.

La pronuncia usa prima un audio collegato a Wikimedia Commons, quando disponibile;
in alternativa seleziona una voce inglese del dispositivo, preferendo en-GB.
Se nessuna voce inglese è installata, mostra un messaggio invece di usare una
voce italiana. Per parole ambigue, la sintesi usa l’esempio quando presente.
