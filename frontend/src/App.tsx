import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  Flame,
  Layers,
  LoaderCircle,
  LogOut,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { pronounce, stopPronunciation } from "./lib/audio";
import GoalCelebration from "./components/GoalCelebration";

type User = { id: string; name: string; email: string; dailyTarget: number };
type Word = {
  id: string;
  word: string;
  definition: string;
  level?: string;
  ipa: string;
  examples: string[];
  collocations: string[];
  partOfSpeech: string;
  senses: { definition: string; partOfSpeech: string; context: string }[];
  source?: string;
  sourceUrl?: string;
  license?: string;
  audioUrl?: string;
  audioSourceUrl?: string;
};
type Card = {
  id: string;
  word: Word;
  mastery: "learning" | "familiar" | "mastered";
};
type Status = {
  pendingReviews: number;
  streak: number;
  longestStreak: number;
  completedToday: boolean;
  newWordsUnlocked: boolean;
  dailyLimit: number;
  acquiredToday: number;
  availableToday: number | null;
  day: string;
};
type Stats = {
  totalWords: number;
  retention: number;
  reviewCount: number;
  longestStreak: number;
  retentionHistory: {
    date: string;
    reviews: number;
    retention: number | null;
  }[];
};
type View = "today" | "review" | "discover" | "vault";
type Mode = "quiz" | "flashcard" | "recall" | "cloze";
type DailyWords = { words: Word[]; seenIds: string[]; status: Status };
const masteryLabels = {
  learning: "Da imparare",
  familiar: "Familiari",
  mastered: "Padroneggiate",
};
const modeLabels = {
  quiz: "Quiz",
  flashcard: "Schede",
  recall: "Scrivi la parola",
  cloze: "Completa la frase",
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/api${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined
        ? {}
        : { method: "POST", body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Impossibile connettersi al server. Controlla la connessione.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Il server ha restituito una risposta non valida. Riprova più tardi.",
    );
  }
  if (!response.ok)
    throw new Error(
      result.error?.message || "Si è verificato un errore. Riprova.",
    );
  return result as T;
}
function submissionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function WordDetail({
  word,
  onError,
}: {
  word: Word;
  onError: (message: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopPronunciation(), [word.id]);
  return (
    <>
      <div className="word-heading">
        <div>
          <div className="word-meta">
            {word.level && <span className="badge">{word.level}</span>}
            <span>{word.partOfSpeech}</span>
          </div>
          <h2 lang="en">{word.word}</h2>
          {word.ipa && <span className="ipa">{word.ipa}</span>}
        </div>
        <button
          className="audio-button"
          disabled={playing}
          aria-label={`Ascolta la pronuncia di ${word.word}`}
          onClick={async () => {
            setPlaying(true);
            try {
              await pronounce(word);
            } catch (error) {
              onError((error as Error).message);
            } finally {
              setPlaying(false);
            }
          }}
        >
          {playing ? (
            <LoaderCircle className="spin" size={22} />
          ) : (
            <AudioLines size={22} />
          )}
        </button>
      </div>
      <p className="definition">{word.definition}</p>
      {(word.examples.length > 0 ||
        word.collocations.length > 0 ||
        word.senses?.length > 1 ||
        word.sourceUrl ||
        word.audioSourceUrl) && (
        <details className="word-details" key={word.id}>
          <summary>Approfondisci</summary>
          {word.examples.length > 0 && (
            <div>
              <h3>Esempio</h3>
              <p lang="en" className="context">
                {word.examples[0]}
              </p>
            </div>
          )}
          {word.collocations.length > 0 && (
            <div>
              <h3>Combinazioni di parole</h3>
              <div lang="en" className="collocations">
                {word.collocations.map((text) => (
                  <span key={text}>{text}</span>
                ))}
              </div>
            </div>
          )}
          {word.senses?.length > 1 && (
            <div>
              <h3>Altri significati</h3>
              <ul className="sense-list">
                {word.senses
                  .filter(
                    (sense) =>
                      sense.definition !== word.definition ||
                      sense.partOfSpeech !== word.partOfSpeech,
                  )
                  .map((sense, index) => (
                    <li key={index}>
                      <small>{sense.partOfSpeech}</small>
                      <p>{sense.definition}</p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="sources">
            {word.sourceUrl && (
              <a href={word.sourceUrl} target="_blank" rel="noreferrer">
                {word.source || "Fonte"}
                {word.license ? ` · ${word.license}` : ""}
              </a>
            )}
            {word.audioSourceUrl && (
              <a href={word.audioSourceUrl} target="_blank" rel="noreferrer">
                Fonte audio e licenza
              </a>
            )}
          </div>
        </details>
      )}
    </>
  );
}
function BrandSymbol() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <Layers size={21} />
    </span>
  );
}
function PreviewFlashcard() {
  return (
    <article className="auth-preview" aria-label="Esempio di flashcard">
      <div className="preview-head">
        <span className="badge">B2</span>
        <Sparkles size={19} aria-hidden="true" />
      </div>
      <h2 lang="en">serendipity</h2>
      <span className="ipa">/ˌser.ənˈdɪp.ə.ti/</span>
      <p>La felice scoperta di qualcosa che non stavi cercando.</p>
      <div className="preview-foot">Una parola. Una nuova possibilità.</div>
    </article>
  );
}
function HomeFlashcard() {
  return (
    <div className="home-flashcard" aria-hidden="true">
      <div className="visual-card-back">
        <Layers size={28} />
      </div>
      <div className="visual-card-front">
        <span>PAROLA DOPO PAROLA</span>
        <div className="visual-symbol">
          Aa<span>↗</span>
        </div>
        <div className="visual-line" />
        <small>Impara. Ricorda. Ripeti.</small>
      </div>
    </div>
  );
}
function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [signup, setSignup] = useState(true);
  const [target, setTarget] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <a className="brand" href="/">
          <BrandSymbol />
          <span className="brand-name">
            lexiq<span>.</span>
          </span>
        </a>
        <h1>
          Il tuo inglese,
          <br />
          una parola alla volta.
        </h1>
        <p>
          Scopri nuove parole e ricorda quelle che impari.
          <br />
          Bastano pochi minuti al giorno.
        </p>
        <PreviewFlashcard />
      </section>
      <form
        className="auth-form panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(event.currentTarget);
          try {
            const result = await api<{ user: User }>(
              signup ? "/auth/signup" : "/auth/login",
              {
                ...(signup
                  ? { name: data.get("name"), dailyTarget: target }
                  : {}),
                email: data.get("email"),
                password: data.get("password"),
              },
            );
            onLogin(result.user);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{signup ? "Crea il tuo account" : "Bentornato"}</h2>
        {signup && (
          <label>
            Nome
            <input
              name="name"
              autoComplete="name"
              placeholder="Giulia"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@esempio.it"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "Almeno 10 caratteri" : "La tua password"}
            minLength={signup ? 10 : 1}
            maxLength={128}
            required
          />
        </label>
        {signup && (
          <fieldset className="daily-target">
            <legend>Nuove parole al giorno</legend>
            <div className="target-options">
              {[3, 5, 10].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={target === value}
                  className={target === value ? "active" : ""}
                  onClick={() => setTarget(value)}
                >
                  {value}
                </button>
              ))}
              <label className="custom-target">
                Personalizza
                <input
                  name="dailyTarget"
                  aria-label="Numero di nuove parole al giorno"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={Number.isNaN(target) ? "" : target}
                  onChange={(event) => setTarget(event.target.valueAsNumber)}
                  required
                />
              </label>
            </div>
            <p className="muted">
              Da 1 a 20 parole. I ripassi si aggiungono al tuo obiettivo.
            </p>
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : signup ? (
            "Inizia a imparare"
          ) : (
            "Accedi"
          )}
          <ArrowRight size={18} />
        </button>
        <p className="auth-switch">
          {signup ? "Hai già un account?" : "Non hai ancora un account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setSignup(!signup);
              setError("");
            }}
          >
            {signup ? "Accedi" : "Registrati"}
          </button>
        </p>
      </form>
    </main>
  );
}
function Progress({ stats, status }: { stats: Stats; status: Status }) {
  return (
    <div className="progress-content">
      <div className="stats-grid">
        <div>
          <strong>{stats.totalWords}</strong>
          <span>Parole nel vocabolario</span>
        </div>
        <div>
          <strong>{stats.reviewCount ? `${stats.retention}%` : "—"}</strong>
          <span>Risposte ricordate</span>
        </div>
        <div>
          <strong>{status.longestStreak}</strong>
          <span>Record di giorni consecutivi</span>
        </div>
      </div>
      <h3>Ripassi negli ultimi sette giorni</h3>
      <div
        className="chart-bars"
        aria-label="Percentuale di ricordo giornaliera"
      >
        {stats.retentionHistory.map((point) => (
          <div key={point.date} className="chart-column">
            <span>
              {point.retention === null ? "—" : `${point.retention}%`}
            </span>
            <div className="chart-track">
              <div style={{ height: `${point.retention || 0}%` }} />
            </div>
            <span>
              {new Intl.DateTimeFormat("it-IT", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(point.date + "T12:00:00Z"))}
            </span>
          </div>
        ))}
      </div>
      <p className="muted">
        {stats.reviewCount
          ? "I ripassi liberi non modificano questi progressi."
          : "Completa il primo ripasso programmato per iniziare."}{" "}
        Il giorno di allenamento cambia a mezzanotte UTC.
      </p>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "dark",
  );
  const [view, setView] = useState<View>("today");
  const [status, setStatus] = useState<Status | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [due, setDue] = useState<Card[]>([]);
  const [vault, setVault] = useState<Card[]>([]);
  const [newWords, setNewWords] = useState<Word[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [discoveryIndex, setDiscoveryIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedWordId, setFailedWordId] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("quiz");
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [quiz, setQuiz] = useState<{ wordId: string; options: string[] } | null>(null);
  const [quizError, setQuizError] = useState("");
  const [quizAttempt, setQuizAttempt] = useState(0);
  const [reviewTab, setReviewTab] = useState<"due" | "all">("due");
  const [practice, setPractice] = useState<Card[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(30);
  const [selected, setSelected] = useState<Word | null>(null);
  const [retryRating, setRetryRating] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{
    day: string;
    words: number;
  } | null>(null);
  const celebratedGoals = useRef(new Set<string>());
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const celebrateGoal = useCallback(
    (daily: Status) => {
      if (!user?.id || daily.acquiredToday < daily.dailyLimit) return;
      const key = `lexiq-goal-celebration:${user.id}`;
      const goal = `${user.id}:${daily.day}`;
      if (celebratedGoals.current.has(goal)) return;
      try {
        if (localStorage.getItem(key) === daily.day) return;
        localStorage.setItem(key, daily.day);
      } catch {
        /* The in-memory guard still prevents repeated celebrations. */
      }
      celebratedGoals.current.add(goal);
      setCelebration({ day: daily.day, words: daily.dailyLimit });
    },
    [user],
  );
  const pendingSubmission = useRef<{
    progressId: string;
    rating: number;
    submissionId: string;
  } | null>(null);
  const wordSaving = useRef(false);
  const touchStart = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const [daily, reviews, words] = await Promise.all([
      api<Status>("/daily/status"),
      api<{ cards: Card[] }>("/reviews/due"),
      api<{ cards: Card[] }>("/vault"),
    ]);
    setStatus(daily);
    setDue(reviews.cards);
    setVault(words.cards);
    setStats(null);
  }, []);
  useEffect(() => {
    void api<{ user: User }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, []);
  useEffect(() => {
    if (user)
      void Promise.resolve()
        .then(refresh)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
  }, [user, refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("lexiq-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLDialogElement>("dialog");
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, [selected]);
  const discoveryWord =
    view === "discover" ? newWords[discoveryIndex] : undefined;
  const discoverySeen = discoveryWord
    ? seenIds.includes(discoveryWord.id)
    : true;
  const savingWord =
    !!discoveryWord && !discoverySeen && failedWordId !== discoveryWord.id;
  useEffect(() => {
    if (!discoveryWord || discoverySeen) return;
    let active = true;
    wordSaving.current = true;
    void api<{ status: Status }>("/words/seen", { wordId: discoveryWord.id })
      .then(async (result) => {
        if (!active) return;
        await refresh();
        if (!active) return;
        wordSaving.current = false;
        setFailedWordId(null);
        setSeenIds((ids) => [...new Set([...ids, discoveryWord.id])]);
        setStatus(result.status);
        celebrateGoal(result.status);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setFailedWordId(discoveryWord.id);
          wordSaving.current = false;
        }
      });
    return () => {
      active = false;
      wordSaving.current = false;
    };
  }, [discoveryWord, discoverySeen, saveAttempt, refresh, celebrateGoal]);
  const current = practice ? practice[0] : due[0];
  const freeReview = practice !== null;
  const quizWordId = current?.word.id;
  useEffect(() => {
    if (!quizWordId) return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setQuizError("");
        return api<{ wordId: string; options: string[] }>(
          `/reviews/quiz-options?wordId=${quizWordId}`,
        );
      })
      .then((result) => {
        if (!active || !result) return;
        setQuiz(result);
        setQuizError("");
      })
      .catch((err) => {
        if (active) setQuizError((err as Error).message);
      });
    return () => {
      active = false;
    };
  }, [quizWordId, quizAttempt]);
  const quizReady = quiz?.wordId === quizWordId;
  const quizCorrect = answer === current?.word.definition;
  const quizRating = quizCorrect ? 3 : 1;
  const submitReview = useCallback(
    async (rating: number) => {
      if (!current || busy || !revealed) return;
      if (freeReview) {
        setPractice((cards) => cards!.slice(1));
        setRevealed(false);
        setAnswer("");
        return;
      }
      if (
        pendingSubmission.current?.progressId === current.id &&
        pendingSubmission.current.rating !== rating
      )
        return;
      const submission =
        pendingSubmission.current?.progressId === current.id
          ? pendingSubmission.current
          : { progressId: current.id, rating, submissionId: submissionId() };
      pendingSubmission.current = submission;
      setRetryRating(rating);
      setBusy(true);
      setError("");
      try {
        await api("/reviews/submit", submission);
        await refresh();
        pendingSubmission.current = null;
        setRetryRating(null);
        setRevealed(false);
        setAnswer("");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, revealed, freeReview, refresh],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        view !== "review" ||
        !current ||
        busy ||
        selected ||
        (!freeReview && reviewTab === "all") ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (mode === "quiz") {
        if (!revealed && quizReady && /^[1-4]$/.test(event.key)) {
          const option = quiz?.options[Number(event.key) - 1];
          if (option) {
            event.preventDefault();
            setAnswer(option);
            setRevealed(true);
          }
        } else if (revealed && event.key === "Enter") {
          event.preventDefault();
          void submitReview(quizRating);
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        void submitReview(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    view,
    current,
    busy,
    selected,
    freeReview,
    reviewTab,
    revealed,
    submitReview,
    mode,
    quizReady,
    quiz,
    quizRating,
  ]);
  const navigate = (next: View) => {
    if (busy || wordSaving.current || retryRating !== null) return;
    stopPronunciation();
    setView(next);
    if (next === "review") setReviewTab("due");
    setFilter("all");
    setVisibleCount(30);
    setError("");
    setPractice(null);
    setRevealed(false);
    setAnswer("");
    setQuery("");
    setSelected(null);
  };
  const discover = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<DailyWords>("/words/daily-new");
      setNewWords(result.words);
      setSeenIds(result.seenIds);
      setStatus(result.status);
      setFailedWordId(null);
      const unseen = result.words.findIndex(
        (word) => !result.seenIds.includes(word.id),
      );
      setDiscoveryIndex(unseen < 0 ? 0 : unseen);
      setView("discover");
      setPractice(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (busy || wordSaving.current) return;
    setBusy(true);
    try {
      await api("/auth/logout", {});
      stopPronunciation();
      setCelebration(null);
      setUser(null);
      setStatus(null);
      setStats(null);
      setDue([]);
      setVault([]);
      setNewWords([]);
      setSeenIds([]);
      setPractice(null);
      setSelected(null);
      setView("today");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const startPractice = (cards: Card[]) => {
    stopPronunciation();
    setPractice(cards);
    setRevealed(false);
    setAnswer("");
    setView("review");
    setSelected(null);
  };
  const filteredVault = vault.filter(
    (card) =>
      (filter === "all" || card.mastery === filter) &&
      `${card.word.word} ${card.word.definition} ${card.word.senses?.map((sense) => sense.definition).join(" ") || ""}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const alternatives = current
    ? [...new Set(vault.map((card) => card.word.word))]
        .filter((word) => word !== current.word.word)
        .slice(0, 3)
    : [];
  const clozeOptions = current
    ? [...alternatives, current.word.word].sort((a, b) =>
        a.localeCompare(b, "en"),
      )
    : [];
  const activeMode =
    mode === "cloze" && !current?.word.examples[0] ? "flashcard" : mode;
  const navItems = [
    { view: "today" as View, label: "Oggi", icon: Sparkles },
    { view: "review" as View, label: "Ripasso", icon: Layers },
    { view: "vault" as View, label: "Vocabolario", icon: BookOpen },
  ];
  const nav = (
    <>
      {navItems.map((item) => (
        <button
          key={item.view}
          aria-current={
            view === item.view || (item.view === "today" && view === "discover")
              ? "page"
              : undefined
          }
          disabled={busy || savingWord || retryRating !== null}
          onClick={() => navigate(item.view)}
        >
          <item.icon size={19} />
          <span>{item.label}</span>
          {item.view === "review" && !!status?.pendingReviews && (
            <span className="nav-count">{status.pendingReviews}</span>
          )}
        </button>
      ))}
    </>
  );
  const target =
    status?.availableToday ?? status?.dailyLimit ?? user?.dailyTarget ?? 4;
  const dailyFinished =
    !!status && target > 0 && status.acquiredToday >= target;
  const themeButton = (
    <button
      className="icon-button"
      aria-label={`Passa al tema ${theme === "dark" ? "chiaro" : "scuro"}`}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
  if (initializing)
    return (
      <div className="initial-loading">
        <LoaderCircle className="spin" />
        <span>Caricamento…</span>
      </div>
    );
  if (!user)
    return (
      <>
        <div className="auth-theme">{themeButton}</div>
        <Auth
          onLogin={(loggedIn) => {
            setLoading(true);
            setError("");
            setUser(loggedIn);
          }}
        />
      </>
    );
  const listing = (
    <>
      <div className="vault-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Cerca nel tuo vocabolario"
            placeholder="Cerca una parola o un significato"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(30);
            }}
          />
        </label>
        {view === "vault" && (
          <select
            aria-label="Filtra per padronanza"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setVisibleCount(30);
            }}
          >
            <option value="all">Tutte le parole</option>
            {Object.entries(masteryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {filteredVault.length ? (
        <div>
          <ul className="word-list">
            {filteredVault.slice(0, visibleCount).map((card) => (
              <li key={card.id}>
                <button onClick={() => setSelected(card.word)}>
                  <span>
                    <strong lang="en">{card.word.word}</strong>
                    <span className="list-definition">
                      {card.word.definition}
                    </span>
                  </span>
                  <span className="list-status">
                    {masteryLabels[card.mastery]}
                  </span>
                  <ArrowRight size={17} />
                </button>
              </li>
            ))}
          </ul>
          {visibleCount < filteredVault.length && (
            <button
              className="button secondary full load-more"
              onClick={() => setVisibleCount((count) => count + 30)}
            >
              Mostra altre parole ({filteredVault.length - visibleCount})
            </button>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={28} />
          <h2>
            {vault.length
              ? "Nessuna parola trovata"
              : "Il tuo vocabolario inizia da qui"}
          </h2>
          <p>
            {vault.length
              ? "Prova con un’altra ricerca."
              : "Le parole che scopri saranno sempre disponibili qui."}
          </p>
          {!vault.length && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                status?.pendingReviews ? navigate("review") : void discover()
              }
            >
              Inizia
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className="app-shell">
      {celebration && (
        <GoalCelebration
          key={celebration.day}
          words={celebration.words}
          onDismiss={dismissCelebration}
        />
      )}
      <header className="topbar">
        <button
          className="brand"
          disabled={busy || savingWord || retryRating !== null}
          onClick={() => navigate("today")}
        >
          <BrandSymbol />
          <span className="brand-name">
            lexiq<span>.</span>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="Navigazione principale">
          {nav}
        </nav>
        <div className="topbar-actions">
          {themeButton}
          <button
            className="icon-button"
            disabled={busy || savingWord || retryRating !== null}
            aria-label="Esci dall’account"
            onClick={() => void logout()}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <main className="content">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Chiudi il messaggio di errore"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="initial-loading">
            <LoaderCircle className="spin" />
            <span>Caricamento del tuo allenamento…</span>
          </div>
        ) : !status ? (
          <div className="empty-state">
            <h2>Non riusciamo a caricare i tuoi progressi</h2>
            <button
              className="button primary"
              onClick={() => {
                setLoading(true);
                void refresh()
                  .catch((err) => setError(err.message))
                  .finally(() => setLoading(false));
              }}
            >
              Riprova
            </button>
          </div>
        ) : (
          <>
            {view === "today" && (
              <>
                <div className="page-heading">
                  <div>
                    <p className="muted">
                      {new Intl.DateTimeFormat("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(status.day + "T12:00:00Z"))}
                    </p>
                    <h1>Ciao, {user.name.split(" ")[0]}.</h1>
                    <p>Un piccolo passo per il tuo inglese.</p>
                  </div>
                  {status.streak > 0 && (
                    <span className="streak-pill">
                      <Flame size={17} />
                      {status.streak}{" "}
                      {status.streak === 1 ? "giorno" : "giorni"} di costanza
                    </span>
                  )}
                </div>
                <section className="daily-panel panel">
                  <div className="daily-copy">
                    <div className="daily-progress">
                      <span>
                        <strong>{status.pendingReviews}</strong> da ripassare
                      </span>
                      <span>
                        <strong>
                          {status.acquiredToday} / {status.dailyLimit}
                        </strong>{" "}
                        nuove parole
                      </span>
                    </div>
                    <h2>
                      {status.pendingReviews
                        ? "Riprendiamo le parole che conosci."
                        : dailyFinished
                          ? "Obiettivo raggiunto per oggi."
                          : "Scopri le parole di oggi."}
                    </h2>
                    <p>
                      {status.pendingReviews
                        ? "Un breve ripasso, poi spazio a nuove parole."
                        : dailyFinished
                          ? "Puoi rivederle liberamente quando vuoi."
                          : "Una parola alla volta, al tuo ritmo."}
                    </p>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        status.pendingReviews
                          ? navigate("review")
                          : dailyFinished
                            ? startPractice(vault)
                            : void discover()
                      }
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : status.pendingReviews ? (
                        "Inizia il ripasso"
                      ) : dailyFinished ? (
                        "Ripassa liberamente"
                      ) : status.acquiredToday ? (
                        "Continua"
                      ) : (
                        "Inizia"
                      )}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <HomeFlashcard />
                </section>
                <details
                  className="progress-details"
                  onToggle={(event) => {
                    if (event.currentTarget.open && !stats)
                      void api<Stats>("/stats")
                        .then(setStats)
                        .catch((err) => setError(err.message));
                  }}
                >
                  <summary>Vedi progressi</summary>
                  {stats ? (
                    <Progress stats={stats} status={status} />
                  ) : (
                    <p className="muted">Caricamento dei progressi…</p>
                  )}
                </details>
              </>
            )}
            {view === "review" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Ripasso</h1>
                    <p>
                      {freeReview
                        ? "Allenati senza modificare il programma dei ripassi."
                        : "Ricorda le parole, un passo alla volta."}
                    </p>
                  </div>
                  {freeReview && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setPractice(null);
                        setReviewTab("all");
                      }}
                    >
                      Termina
                    </button>
                  )}
                </div>
                {!freeReview && (
                  <div className="tabs" aria-label="Tipo di ripasso">
                    <button
                      aria-pressed={reviewTab === "due"}
                      onClick={() => {
                        setReviewTab("due");
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Da ripassare <span>{due.length}</span>
                    </button>
                    <button
                      aria-pressed={reviewTab === "all"}
                      disabled={busy || retryRating !== null}
                      onClick={() => {
                        setReviewTab("all");
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Tutte le parole <span>{vault.length}</span>
                    </button>
                  </div>
                )}
                {!freeReview && reviewTab === "all" ? (
                  <>
                    {vault.length > 0 && (
                      <div className="practice-heading">
                        <p className="muted">
                          Anche le parole appena scoperte sono già qui.
                        </p>
                        <button
                          className="button secondary"
                          onClick={() => startPractice(filteredVault)}
                          disabled={!filteredVault.length}
                        >
                          Ripassa {query ? "i risultati" : "tutte"}
                        </button>
                      </div>
                    )}
                    {listing}
                  </>
                ) : !current ? (
                  <div className="empty-state">
                    <div className="success-icon">
                      <Check size={28} />
                    </div>
                    <h2>
                      {freeReview
                        ? "Ripasso libero completato"
                        : "Hai completato i ripassi"}
                    </h2>
                    <p>
                      {freeReview
                        ? "Puoi tornare quando vuoi."
                        : dailyFinished
                          ? "Hai già raggiunto l’obiettivo di oggi."
                          : "Ora puoi scoprire nuove parole."}
                    </p>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => {
                        if (freeReview || dailyFinished) {
                          navigate("today");
                        } else void discover();
                      }}
                    >
                      {freeReview || dailyFinished
                        ? "Torna a oggi"
                        : "Scopri nuove parole"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                ) : (
                  <div className={`study-wrap${activeMode === "quiz" ? " quiz-review" : ""}`}>
                    <div className="study-toolbar">
                      <span className="muted">
                        {freeReview
                          ? `${practice!.length} nel ripasso libero`
                          : `${due.length} da ripassare`}
                      </span>
                      <label>
                        Modalità
                        <select
                          aria-label="Modalità di esercizio"
                          value={activeMode}
                          disabled={busy || retryRating !== null}
                          onChange={(event) => {
                            setMode(event.target.value as Mode);
                            setRevealed(false);
                            setAnswer("");
                          }}
                        >
                          {Object.entries(modeLabels)
                            .filter(
                              ([key]) =>
                                key !== "cloze" ||
                                current.word.examples.length > 0,
                            )
                            .map(([key, label]) => (
                              <option value={key} key={key}>
                                {label}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <article
                      className="study-card panel"
                      key={`${current.id}-${activeMode}`}
                      onTouchStart={(event) => {
                        touchStart.current = event.touches[0].clientX;
                      }}
                      onTouchEnd={(event) => {
                        if (
                          activeMode !== "quiz" &&
                          touchStart.current !== null &&
                          Math.abs(
                            event.changedTouches[0].clientX -
                              touchStart.current,
                          ) > 65
                        )
                          setRevealed(true);
                        touchStart.current = null;
                      }}
                    >
                      <div className="review-card-top">
                        <div className="review-card-level">
                          {!revealed && current.word.level && (
                            <span className="badge">{current.word.level}</span>
                          )}
                        </div>
                        <span className="review-card-caption">
                          {activeMode === "quiz"
                            ? "SCEGLI IL SIGNIFICATO"
                            : revealed ? "ECCO LA PAROLA" : "PROVA A RICORDARE"}
                        </span>
                        <span className="card-dots" aria-hidden="true">
                          •••
                        </span>
                      </div>
                      {activeMode === "quiz" ? (
                        <div className="review-prompt quiz-prompt">
                          <h2 lang="en">{current.word.word}</h2>
                          {current.word.ipa && (
                            <span className="ipa">{current.word.ipa}</span>
                          )}
                          <p>Qual è il significato corretto?</p>
                          {quizError ? (
                            <div className="quiz-error" role="alert">
                              <p>{quizError}</p>
                              <button
                                className="button secondary"
                                onClick={() => {
                                  setQuizError("");
                                  setQuiz(null);
                                  setQuizAttempt((attempt) => attempt + 1);
                                }}
                              >
                                Riprova
                              </button>
                            </div>
                          ) : !quizReady ? (
                            <p className="muted" role="status">Preparo le alternative…</p>
                          ) : (
                            <div
                              className="quiz-options"
                              role="group"
                              aria-label="Scegli il significato italiano"
                            >
                              {quiz.options.map((option, index) => {
                                const correct = revealed && option === current.word.definition;
                                const wrong = revealed && option === answer && !correct;
                                return (
                                  <button
                                    key={option}
                                    className={`quiz-option${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}`}
                                    disabled={revealed || busy}
                                    aria-pressed={revealed && option === answer}
                                    onClick={() => {
                                      setAnswer(option);
                                      setRevealed(true);
                                    }}
                                  >
                                    <span className="quiz-option-number" aria-hidden="true">
                                      {index + 1}
                                    </span>
                                    <span>{option}</span>
                                    {correct && <Check size={18} aria-label="Risposta corretta" />}
                                    {wrong && <X size={18} aria-label="Risposta sbagliata" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {revealed && (
                            <>
                              <p className={`quiz-feedback${quizCorrect ? " is-correct" : ""}`} role="status">
                                {quizCorrect
                                  ? "Esatto! Hai scelto il significato corretto."
                                  : `Non è la risposta giusta. Il significato corretto è: ${current.word.definition}`}
                              </p>
                              <details className="quiz-details">
                                <summary>Rivedi i dettagli della parola</summary>
                                <WordDetail word={current.word} onError={setError} />
                              </details>
                            </>
                          )}
                        </div>
                      ) : revealed ? (
                        <>
                          <WordDetail word={current.word} onError={setError} />
                          {activeMode !== "flashcard" && (
                            <p className="answer-feedback" role="status">
                              {answer.trim().toLowerCase() ===
                              current.word.word.toLowerCase()
                                ? "Esatto!"
                                : `La tua risposta: ${answer || "nessuna risposta"}.`}
                            </p>
                          )}
                        </>
                      ) : activeMode === "flashcard" ? (
                        <div className="review-prompt">
                          <h2 lang="en">{current.word.word}</h2>
                          {current.word.ipa && (
                            <span className="ipa">{current.word.ipa}</span>
                          )}
                          <p>Ricordi il significato di questa parola?</p>
                          <button
                            className="button secondary"
                            onClick={() => setRevealed(true)}
                          >
                            Mostra la risposta
                            <ArrowDown size={17} />
                          </button>
                        </div>
                      ) : (
                        <form
                          className="review-prompt"
                          onSubmit={(event) => {
                            event.preventDefault();
                            setRevealed(true);
                          }}
                        >
                          <p className="muted">
                            {activeMode === "recall"
                              ? "Quale parola significa…"
                              : "Completa la frase"}
                          </p>
                          <h2
                            className="recall-definition"
                            lang={activeMode === "cloze" ? "en" : "it"}
                          >
                            {activeMode === "recall"
                              ? current.word.definition
                              : current.word.examples[0].replace(
                                  new RegExp(
                                    current.word.word.replace(
                                      /[.*+?^${}()|[\]\\]/g,
                                      "\\$&",
                                    ),
                                    "ig",
                                  ),
                                  "________",
                                )}
                          </h2>
                          {activeMode === "cloze" ? (
                            <div
                              className="cloze-options"
                              role="group"
                              aria-label="Scegli la parola che completa la frase"
                            >
                              {clozeOptions.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  lang="en"
                                  onClick={() => {
                                    setAnswer(option);
                                    setRevealed(true);
                                  }}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <>
                              <input
                                aria-label="La parola che ricordi"
                                placeholder="Scrivi la parola inglese"
                                value={answer}
                                onChange={(event) =>
                                  setAnswer(event.target.value)
                                }
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                              />
                              <button
                                className="button secondary"
                                type="submit"
                              >
                                Verifica
                              </button>
                            </>
                          )}
                        </form>
                      )}
                    </article>
                    {revealed ? (
                      <div className="rating-section">
                        <p>
                          {activeMode === "quiz"
                            ? (!freeReview && !quizCorrect
                                ? "Questa parola resta da ripassare: la ritroverai nel quiz."
                                : "Continua quando vuoi.")
                            : freeReview
                              ? "Passa alla prossima parola"
                              : "Quanto bene hai ricordato?"}
                        </p>
                        {activeMode === "quiz" || freeReview ? (
                          <button
                            className="button primary full"
                            disabled={busy}
                            onClick={() =>
                              void submitReview(activeMode === "quiz" ? quizRating : 3)
                            }
                          >
                            Prossima parola
                            <ArrowRight size={18} />
                          </button>
                        ) : (
                          <>
                            <div className="rating-grid">
                              {[
                                "Da ripetere",
                                "Difficile",
                                "Bene",
                                "Facile",
                              ].map((label, index) => (
                                <button
                                  key={label}
                                  className={`rating rating-${index}`}
                                  disabled={
                                    busy ||
                                    (retryRating !== null &&
                                      retryRating !== index + 1)
                                  }
                                  onClick={() => void submitReview(index + 1)}
                                >
                                  <kbd>{index + 1}</kbd>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <p className="muted">
                              Con «Da ripetere» e «Difficile» la parola resta
                              nei ripassi di oggi.
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="keyboard-hint">
                        {activeMode === "quiz" ? <><kbd>1–4</kbd> per scegliere una risposta</> : <>
                          <kbd>Spazio</kbd> per mostrare la risposta
                          <span className="hint-divider" aria-hidden="true">·</span>
                          Scorri la scheda sul telefono
                        </>}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {view === "discover" && (
              <>
                <div className="page-heading">
                  <div>
                    <button
                      className="back-button"
                      disabled={savingWord}
                      onClick={() => navigate("today")}
                    >
                      <ArrowLeft size={16} />
                      Oggi
                    </button>
                    <h1>Nuove parole</h1>
                  </div>
                  <span className="muted">
                    {status.acquiredToday} / {status.dailyLimit} viste oggi
                  </span>
                </div>
                {!newWords.length ? (
                  <div className="empty-state">
                    <BookOpen size={28} />
                    <h2>Hai esplorato tutte le parole disponibili</h2>
                    <p>Puoi continuare a ripassare il tuo vocabolario.</p>
                    <button
                      className="button primary"
                      onClick={() => {
                        navigate("review");
                        setReviewTab("all");
                      }}
                    >
                      Rivedi le tue parole
                    </button>
                  </div>
                ) : (
                  <div className="study-wrap">
                    <div className="study-toolbar">
                      <span className="muted">
                        Parola {discoveryIndex + 1} di {newWords.length}
                      </span>
                      <span className="save-status" role="status">
                        {seenIds.includes(newWords[discoveryIndex].id) ? (
                          <>
                            <Check size={15} />
                            Disponibile nel ripasso
                          </>
                        ) : savingWord ? (
                          <>
                            <LoaderCircle className="spin" size={15} />
                            Salvataggio…
                          </>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() => {
                              setError("");
                              setFailedWordId(null);
                              setSaveAttempt((value) => value + 1);
                            }}
                          >
                            Riprova il salvataggio
                          </button>
                        )}
                      </span>
                    </div>
                    <article
                      className="study-card panel"
                      key={newWords[discoveryIndex].id}
                    >
                      <WordDetail
                        word={newWords[discoveryIndex]}
                        onError={setError}
                      />
                    </article>
                    <div className="discovery-nav">
                      <button
                        className="button secondary"
                        disabled={
                          discoveryIndex === 0 ||
                          savingWord ||
                          !seenIds.includes(newWords[discoveryIndex].id)
                        }
                        onClick={() => setDiscoveryIndex((index) => index - 1)}
                      >
                        <ArrowLeft size={17} />
                        Precedente
                      </button>
                      <button
                        className="button primary"
                        disabled={
                          savingWord ||
                          !seenIds.includes(newWords[discoveryIndex].id)
                        }
                        onClick={() => {
                          if (discoveryIndex < newWords.length - 1)
                            setDiscoveryIndex((index) => index + 1);
                          else navigate("today");
                        }}
                      >
                        {discoveryIndex < newWords.length - 1
                          ? "Prossima parola"
                          : "Concludi"}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    <p className="keyboard-hint">
                      Puoi rivedere subito ogni parola in Ripasso → Tutte le
                      parole.
                    </p>
                  </div>
                )}
              </>
            )}
            {view === "vault" && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Il tuo vocabolario</h1>
                    <p>
                      {vault.length}{" "}
                      {vault.length === 1
                        ? "parola raccolta"
                        : "parole raccolte"}
                      , sempre a disposizione.
                    </p>
                  </div>
                </div>
                {listing}
              </>
            )}
          </>
        )}
      </main>
      <nav className="mobile-nav" aria-label="Navigazione principale">
        {nav}
      </nav>
      {selected && (
        <dialog
          className="definition-dialog"
          onCancel={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="dialog-content">
            <button
              className="dialog-close icon-button"
              aria-label="Chiudi il significato"
              onClick={() => setSelected(null)}
            >
              <X size={21} />
            </button>
            <WordDetail word={selected} onError={setError} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button secondary full"
              onClick={() => {
                const card = vault.find((item) => item.word.id === selected.id);
                if (card) startPractice([card]);
              }}
            >
              Ripassa questa parola
              <ArrowRight size={17} />
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
export default App;
