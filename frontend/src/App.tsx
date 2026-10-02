import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Flame,
  Focus,
  Layers,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Moon,
  Search,
  Sparkles,
  Sun,
  Target,
  Trophy,
  X,
} from "lucide-react";

type User = { id: string; name: string; email: string };
type Word = {
  id: string;
  word: string;
  definition: string;
  level: string;
  ipa: string;
  examples: string[];
  collocations: string[];
  partOfSpeech: string;
};
type Card = {
  id: string;
  word: Word;
  repetitions: number;
  interval: number;
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
  day: string;
};
type Stats = {
  totalWords: number;
  learning: number;
  familiar: number;
  mastered: number;
  retention: number;
  reviewCount: number;
  streak: number;
  longestStreak: number;
  retentionHistory: {
    date: string;
    reviews: number;
    retention: number | null;
  }[];
};
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
type View = "today" | "review" | "discover" | "vault";
const masteryLabels: Record<string, string> = {
  all: "Tutte",
  learning: "Da imparare",
  familiar: "Familiari",
  mastered: "Padroneggiate",
};
type Mode = "flashcard" | "recall" | "cloze";
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
  } catch (err) {
    throw new Error("Impossibile connettersi al server. Controlla la connessione.");
  }

  const text = await response.text();
  let result: any;
  try {
    result = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(
      response.ok
        ? "Il server ha restituito una risposta non valida."
        : `Errore del server (${response.status}). Riprova più tardi.`
    );
  }

  if (!response.ok)
    throw new Error(
      result.error?.message ||
        result.message ||
        "Si è verificato un errore. Riprova.",
    );
  return result as T;
}
function pronounce(word: string, onError: (message: string) => void) {
  if (!("speechSynthesis" in window)) {
    onError("La pronuncia audio non è disponibile in questo browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(word);
  speech.lang = "en-GB";
  speech.rate = 0.85;
  speech.onerror = () =>
    onError("Impossibile riprodurre la pronuncia. Riprova.");
  window.speechSynthesis.speak(speech);
}
function Context({ word }: { word: Word }) {
  const sentence = word.examples[0] || "";
  const index = sentence.toLowerCase().indexOf(word.word.toLowerCase());
  return (
    <p className="context">
      {index < 0 ? (
        sentence
      ) : (
        <>
          {sentence.slice(0, index)}
          <mark>{sentence.slice(index, index + word.word.length)}</mark>
          {sentence.slice(index + word.word.length)}
        </>
      )}
    </p>
  );
}
function WordDetail({
  word,
  onError,
}: {
  word: Word;
  onError: (message: string) => void;
}) {
  return (
    <>
      <div className="word-heading">
        <div>
          <span className="badge">{word.level}</span>
          <span className="muted word-part">{word.partOfSpeech}</span>
          <h2>{word.word}</h2>
          <span className="ipa">{word.ipa}</span>
        </div>
        <button
          className="icon-button"
          aria-label={`Ascolta la pronuncia di ${word.word}`}
          onClick={() => pronounce(word.word, onError)}
        >
          <AudioLines size={22} />
        </button>
      </div>
      <p className="definition">{word.definition}</p>
      <span className="eyebrow">NEL CONTESTO</span>
      <Context word={word} />
      <span className="eyebrow">COMBINAZIONI DI PAROLE</span>
      <div className="collocations">
        {word.collocations.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </div>
    </>
  );
}
function RetentionChart({ history }: { history: Stats["retentionHistory"] }) {
  const observed = history.some((point) => point.retention !== null);
  return (
    <section className="retention-chart">
      <div className="retention-chart-heading">
        <div>
          <h2>Un’abitudine che prende forma.</h2>
          <p>Quanto hai ricordato negli ultimi sette giorni</p>
        </div>
        <span className="badge">ULTIMI 7 GIORNI · UTC</span>
      </div>
      {!observed && (
        <p className="chart-empty">
          Il grafico si aggiornerà dopo il tuo primo ripasso.
        </p>
      )}
      <div className="chart-bars" aria-label="Percentuale giornaliera di risposte ricordate">
        {history.map((point) => (
          <div className="chart-column" key={point.date}>
            <div className="chart-track">
              <div
                className={`chart-bar ${point.retention === null ? "no-data" : ""}`}
                style={{
                  height:
                    point.retention === null
                      ? "3px"
                      : `${Math.max(3, point.retention)}%`,
                }}
              />
              <span className="chart-value">
                {point.retention === null ? "—" : `${point.retention}%`}
              </span>
            </div>
            <span>
              {new Intl.DateTimeFormat("it-IT", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(point.date + "T12:00:00Z"))}
            </span>
            <span className="chart-reviews">
              {point.reviews ? `${point.reviews} ripassi` : "Nessun ripasso"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [signup, setSignup] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <div className="brand-symbol">
            <Layers size={22} />
          </div>
          lexiq<span className="brand-dot">.</span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">UN PO’ OGNI GIORNO. TANTO NEL TEMPO.</span>
          <h1>
            Fai entrare le parole
            <br />
            nel tuo mondo.
          </h1>
          <p>
            Migliora il tuo inglese, con calma. Ricorda ciò che impari, scopri
            nuove parole e costruisci un’abitudine che dura.
          </p>
          <div className="auth-preview">
            <div className="preview-head">
              <span className="badge">B2</span>
              <Sparkles size={19} />
            </div>
            <h2>serendipity</h2>
            <span className="ipa">/ˌser.ənˈdɪp.ə.ti/</span>
            <p>La felice scoperta di qualcosa che non stavi cercando.</p>
            <div className="preview-foot">
              <span className="little-dot" />
              Una parola. Una nuova possibilità.
            </div>
          </div>
        </div>
        <span className="auth-footer">Piccoli passi. Conoscenze che restano.</span>
      </section>
      <section className="auth-form-wrap">
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const data = new FormData(event.currentTarget);
            try {
              const result = await api<{ user: User }>(
                signup ? "/auth/signup" : "/auth/login",
                {
                  ...(signup ? { name: data.get("name") } : {}),
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
          <span className="eyebrow">IL TUO MOMENTO QUOTIDIANO PER CRESCERE</span>
          <h2>{signup ? "Inizia a imparare ogni giorno." : "Bentornato."}</h2>
          <p className="muted">
            {signup
              ? "Il tuo prossimo capitolo inizia con una parola."
              : "Le tue parole ti aspettano."}
          </p>
          {signup && (
            <label>
              Il tuo nome
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
            Indirizzo email
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {signup ? "Crea il tuo account" : "Accedi"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="auth-switch">
            {signup ? "Hai già un account?" : "È la tua prima volta su Lexiq?"}{" "}
            <button
              type="button"
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Accedi" : "Crea un account"}
            </button>
          </p>
          <div className="auth-note">
            <LockKeyhole size={15} />
            I tuoi progressi vengono salvati, giorno dopo giorno.
          </div>
        </form>
      </section>
    </main>
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryRating, setRetryRating] = useState<number | null>(null);
  const [today] = useState(() => new Date());
  const [celebrate, setCelebrate] = useState(false);
  const [mode, setMode] = useState<Mode>("flashcard");
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [reviewed, setReviewed] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Word | null>(null);
  const [discoveryIndex, setDiscoveryIndex] = useState(0);
  const pendingSubmission = useRef<{
    progressId: string;
    rating: number;
    submissionId: string;
  } | null>(null);
  const touchStart = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const [daily, metrics, reviews, words] = await Promise.all([
      api<Status>("/daily/status"),
      api<Stats>("/stats"),
      api<{ cards: Card[] }>("/reviews/due"),
      api<{ cards: Card[] }>("/vault"),
    ]);
    setStatus(daily);
    setStats(metrics);
    setDue(reviews.cards);
    setVault(words.cards);
  }, []);
  useEffect(() => {
    void api<{ user: User }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => {})
      .finally(() => setInitializing(false));
  }, []);
  useEffect(() => {
    if (user) {
      void Promise.resolve()
        .then(refresh)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [user, refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("lexiq-theme", theme);
    } catch {
      /* Theme still applies when storage is unavailable. */
    }
  }, [theme]);
  useEffect(() => {
    if (!selected && !celebrate) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = focusable();
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [selected, celebrate]);
  const current = due[0];
  const clozeOptions = current
    ? (() => {
        const hash = Array.from(current.word.word).reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        );
        const peers = [
          ...new Set([...vault, ...due].map((card) => card.word.word)),
        ]
          .filter((word) => word !== current.word.word)
          .sort();
        const alternatives = peers
          .slice(hash % Math.max(1, peers.length))
          .concat(peers)
          .slice(0, 3);
        const options = [...new Set(alternatives)];
        options.splice(hash % (options.length + 1), 0, current.word.word);
        return options;
      })()
    : [];
  const submitReview = useCallback(
    async (rating: number) => {
      if (!current || busy || !revealed) return;
      if (
        pendingSubmission.current?.progressId === current.id &&
        pendingSubmission.current.rating !== rating
      )
        return;
      setBusy(true);
      setError("");
      const submission =
        pendingSubmission.current?.progressId === current.id &&
        pendingSubmission.current.rating === rating
          ? pendingSubmission.current
          : { progressId: current.id, rating, submissionId: submissionId() };
      pendingSubmission.current = submission;
      setRetryRating(rating);
      try {
        const result = await api<{ status: Status }>(
          "/reviews/submit",
          submission,
        );
        await refresh();
        pendingSubmission.current = null;
        setRetryRating(null);
        setReviewed((count) => count + 1);
        setRevealed(false);
        setAnswer("");
        if (result.status.pendingReviews === 0) {
          setCelebrate(true);
          navigator.vibrate?.([30, 30, 60]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, revealed, refresh],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        view !== "review" ||
        !current ||
        celebrate ||
        busy ||
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setRevealed(true);
      } else if (["1", "2", "3", "4"].includes(event.key) && revealed) {
        event.preventDefault();
        void submitReview(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, current, celebrate, busy, revealed, submitReview]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setCelebrate(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const discover = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ words: Word[]; status: Status }>(
        "/words/daily-new",
      );
      setNewWords(result.words);
      setStatus(result.status);
      setDiscoveryIndex(0);
      setView("discover");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: View) => {
    setView(next);
    setRevealed(false);
    setAnswer("");
    setError("");
  };
  const logout = async () => {
    try {
      await api("/auth/logout", {});
      setUser(null);
      setStatus(null);
      setStats(null);
      setDue([]);
      setVault([]);
      setNewWords([]);
      setView("today");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  if (initializing)
    return (
      <div className="initial-loading">
        <div className="brand-symbol">
          <Layers size={28} />
        </div>
        <LoaderCircle className="spin" size={22} />
        <span>Prepariamo le tue parole…</span>
      </div>
    );
  if (!user)
    return (
      <>
        <button
          className="auth-theme icon-button"
          aria-label="Cambia tema"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <Auth
          onLogin={(loggedIn) => {
            setLoading(true);
            setUser(loggedIn);
          }}
        />
      </>
    );
  const navItems = [
    { view: "today" as View, icon: Focus, label: "Oggi" },
    { view: "review" as View, icon: Layers, label: "Ripasso" },
    { view: "discover" as View, icon: Sparkles, label: "Scopri" },
    { view: "vault" as View, icon: BookOpen, label: "Vocabolario" },
  ];
  const filteredVault = vault.filter(
    (card) =>
      (filter === "all" || card.mastery === filter) &&
      `${card.word.word} ${card.word.definition}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("today")}>
          <div className="brand-symbol">
            <Layers size={21} />
          </div>
          lexiq<span className="brand-dot">.</span>
        </button>
        <span className="nav-caption">IL TUO ALLENAMENTO</span>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => navigate(item.view)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.view === "review" && !!status?.pendingReviews && (
                <span className="nav-count">{status.pendingReviews}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="habit-note">
            <div className="habit-icon">
              <Sparkles size={18} />
            </div>
            <p>La costanza è un superpotere.</p>
            <span>Cinque minuti oggi. Un vocabolario più ricco domani.</span>
          </div>
          <button
            className="account"
            onClick={() => void logout()}
            aria-label="Esci"
          >
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>Continua a crescere</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Il tuo spazio <ChevronRight size={14} />
            <strong>
              {navItems.find((item) => item.view === view)?.label}
            </strong>
          </span>
          <div className="topbar-actions">
            <span className="streak-pill">
              <Flame size={16} />
              {status?.streak ?? 0}
              <span>giorni consecutivi</span>
            </span>
            <button
              className="icon-button"
              aria-label={`Passa al tema ${theme === "dark" ? "chiaro" : "scuro"}`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="mobile-logout icon-button"
              aria-label="Esci"
              onClick={() => void logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="Chiudi il messaggio di errore" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-panel">
              <LoaderCircle className="spin" />
              Caricamento del tuo allenamento…
            </div>
          ) : !status ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Focus size={32} />
              </div>
              <h2>Riprendiamo il tuo allenamento.</h2>
              <p>I tuoi progressi sono al sicuro. Al momento non riusciamo a caricarli.</p>
              <button
                className="button primary"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  void refresh()
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
              >
                Riprova
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              {view === "today" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {new Intl.DateTimeFormat("it-IT", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        }).format(today)}{" "}
                        · UTC
                      </span>
                      <h1>Un piccolo progresso, ogni giorno.</h1>
                      <p>
                        Ciao, {user.name.split(" ")[0]}. Facciamo in modo che
                        le parole restino nella tua memoria.
                      </p>
                    </div>
                    <span className="heading-decoration">
                      <Sparkles size={28} />
                    </span>
                  </div>
                  <section className="today-hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span className="little-dot" />
                        IL TUO ALLENAMENTO QUOTIDIANO
                      </span>
                      <h2>
                        {status?.pendingReviews
                          ? "Prima ripassa.\nPoi scopri."
                          : "La mente è pronta.\nSpazio a nuove parole."}
                      </h2>
                      <p>
                        {status?.pendingReviews
                          ? `Hai ${status.pendingReviews} parole da ripassare. Ripassale per sbloccare le scoperte di oggi.`
                          : "Hai completato i ripassi. Scopri quattro parole utili e falle tue."}
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          status?.pendingReviews
                            ? navigate("review")
                            : void discover()
                        }
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <>
                            {status?.pendingReviews
                              ? "Inizia il ripasso"
                              : status?.acquiredToday
                                ? "Rivedi le parole di oggi"
                                : "Scopri le parole di oggi"}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      <span className="hero-meta">
                        <Focus size={14} />Bastano pochi minuti di concentrazione per fare la
                        differenza
                      </span>
                    </div>
                    <div className="hero-visual" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="visual-card visual-card-back">
                        <Layers size={28} />
                      </div>
                      <div className="visual-card visual-card-front">
                        <span>PAROLA DOPO PAROLA</span>
                        <div className="visual-symbol">
                          Aa<span>↗</span>
                        </div>
                        <div className="visual-line" />
                        <small>Impara. Ricorda. Ripeti.</small>
                      </div>
                      <span className="floating-star">
                        <Sparkles size={24} />
                      </span>
                    </div>
                  </section>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">
                        <Flame size={17} />
                        Serie attuale
                      </div>
                      <strong>
                        {stats?.streak ?? 0}
                        <small>giorni</small>
                      </strong>
                      <span>Record: {stats?.longestStreak ?? 0} giorni</span>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        <BookOpen size={17} />
                        Parole raccolte
                      </div>
                      <strong>
                        {stats?.totalWords ?? 0}
                        <small>parole</small>
                      </strong>
                      <span>Un vocabolario che cresce con te</span>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        <Target size={17} />
                        Percentuale di ricordo
                      </div>
                      <strong>
                        {stats?.reviewCount
                          ? `${Math.round(stats.retention)}%`
                          : "—"}
                      </strong>
                      <span>
                        {stats?.reviewCount
                          ? `Su ${stats.reviewCount} ripassi`
                          : "Tutto inizia dal tuo primo ripasso"}
                      </span>
                    </div>
                  </div>
                  <RetentionChart history={stats?.retentionHistory || []} />
                  <div className="section-title">
                    <h2>La tua routine quotidiana</h2>
                    <span>Una piccola abitudine. Tre semplici passi.</span>
                  </div>
                  <div className="loop-grid">
                    <button
                      className="loop-card"
                      onClick={() => navigate("review")}
                    >
                      <span className="step-number">01</span>
                      <div className="loop-icon">
                        <Layers size={21} />
                      </div>
                      <h3>Ripassa e ricorda</h3>
                      <p>Un breve ripasso delle parole che hai già incontrato.</p>
                      <span
                        className={`loop-status ${!status?.pendingReviews ? "complete" : ""}`}
                      >
                        {status?.pendingReviews ? (
                          <>
                            {status.pendingReviews} parole da ripassare
                            <ArrowRight size={15} />
                          </>
                        ) : (
                          <>
                            <Check size={15} />
                            Ripassi completati
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      className="loop-card"
                      disabled={!!status?.pendingReviews || busy}
                      onClick={() => void discover()}
                    >
                      <span className="step-number">02</span>
                      <div className="loop-icon">
                        <Sparkles size={21} />
                      </div>
                      <h3>Scopri nuove parole</h3>
                      <p>Quattro parole utili per il tuo inglese di ogni giorno.</p>
                      <span className="loop-status">
                        {status?.pendingReviews ? (
                          <>
                            <LockKeyhole size={14} />
                            Completa il ripasso per sbloccare
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Tutto pronto per scoprire
                            <ArrowRight size={15} />
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      className="loop-card"
                      onClick={() => navigate("vault")}
                    >
                      <span className="step-number">03</span>
                      <div className="loop-icon">
                        <BookOpen size={21} />
                      </div>
                      <h3>Guarda i tuoi progressi</h3>
                      <p>
                        La tua raccolta personale, dal primo incontro alla
                        piena padronanza.
                      </p>
                      <span className="loop-status">
                        Esplora il tuo vocabolario
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  </div>
                  <div className="daily-footnote">
                    <span className="little-dot" />
                    Per imparare nel tempo, una parola alla volta.
                    <span>Il nuovo giorno di allenamento inizia a mezzanotte UTC</span>
                  </div>
                </>
              )}
              {view === "review" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        FASE 01 · RIPASSA E RICORDA
                      </span>
                      <h1>Il tuo ripasso quotidiano.</h1>
                      <p>Prenditi un momento per ricordare. Poi scoprirai nuove parole.</p>
                    </div>
                    <span className="badge">
                      {status?.pendingReviews ?? 0} da ripassare
                    </span>
                  </div>
                  {!current ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <CheckCheck size={34} />
                      </div>
                      <h2>Ripasso completato. Ottimo lavoro.</h2>
                      <p>
                        Le parole stanno entrando nella tua memoria. Le scoperte di oggi
                        sono sbloccate.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void discover()}
                      >
                        Scopri nuove parole
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="review-wrap">
                      <div className="review-toolbar">
                        <div className="segmented">
                          {(["flashcard", "recall", "cloze"] as Mode[]).map(
                            (item) => (
                              <button
                                key={item}
                                className={mode === item ? "active" : ""}
                                onClick={() => {
                                  setMode(item);
                                  setRevealed(false);
                                  setAnswer("");
                                }}
                              >
                                {item === "flashcard"
                                  ? "Schede"
                                  : item === "recall"
                                    ? "Scrivi la parola"
                                    : "Completa la frase"}
                              </button>
                            ),
                          )}
                        </div>
                        <span className="muted">
                          {reviewed} ripassi in questa sessione
                        </span>
                      </div>
                      <article
                        className={`review-card ${revealed ? "revealed" : ""}`}
                        key={`${current.id}-${mode}`}
                        onTouchStart={(event) => {
                          touchStart.current = event.touches[0].clientX;
                        }}
                        onTouchEnd={(event) => {
                          if (
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
                          <span className="badge">{current.word.level}</span>
                          <span className="eyebrow">
                            {revealed
                              ? "ECCO LA PAROLA"
                              : "PROVA A RICORDARE"}
                          </span>
                          <span className="card-dots">•••</span>
                        </div>
                        {revealed ? (
                          <div className="review-answer">
                            <WordDetail
                              word={current.word}
                              onError={setError}
                            />
                            {mode !== "flashcard" && (
                              <p
                                className={`answer-feedback ${answer.trim().toLowerCase() === current.word.word.toLowerCase() ? "correct" : ""}`}
                              >
                                {answer.trim().toLowerCase() ===
                                current.word.word.toLowerCase()
                                  ? "Esatto! Hai ricordato la parola."
                                  : `La tua risposta: ${answer || "Nessuna risposta inserita"}. Valuta quanto bene hai ricordato la parola.`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="review-prompt">
                            {mode === "flashcard" ? (
                              <>
                                <h2>{current.word.word}</h2>
                                <span className="ipa">{current.word.ipa}</span>
                                <p>Ricordi il significato di questa parola?</p>
                                <button
                                  className="button secondary"
                                  onClick={() => setRevealed(true)}
                                >
                                  Mostra il significato
                                  <ArrowDown size={16} />
                                </button>
                              </>
                            ) : (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  setRevealed(true);
                                }}
                              >
                                <span className="eyebrow">
                                  {mode === "recall"
                                    ? "QUALE PAROLA SIGNIFICA…"
                                    : "COMPLETA LA FRASE"}
                                </span>
                                <h2 className="recall-definition">
                                  {mode === "recall"
                                    ? current.word.definition
                                    : (
                                        current.word.examples[0] ||
                                        current.word.definition
                                      ).replace(
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
                                {mode === "cloze" ? (
                                  <div
                                    className="cloze-options"
                                    role="group"
                                    aria-label="Scegli la parola che completa la frase"
                                  >
                                    {clozeOptions.map((option) => (
                                      <button
                                        type="button"
                                        key={option}
                                        onClick={() => {
                                          setAnswer(option);
                                          setRevealed(true);
                                        }}
                                      >
                                        {option}
                                        <ArrowRight size={15} />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <>
                                    <input
                                      aria-label="La parola che ricordi"
                                      value={answer}
                                      onChange={(event) =>
                                        setAnswer(event.target.value)
                                      }
                                      placeholder="Scrivi la parola…"
                                      autoComplete="off"
                                      autoCapitalize="none"
                                      spellCheck={false}
                                      autoFocus
                                    />
                                    <button
                                      className="button secondary"
                                      type="submit"
                                    >
                                      Verifica la risposta
                                      <ArrowRight size={16} />
                                    </button>
                                  </>
                                )}
                              </form>
                            )}
                          </div>
                        )}
                      </article>
                      {revealed ? (
                        <div className="rating-section">
                          <p>Quanto bene hai ricordato?</p>
                          <div className="rating-grid">
                            {[
                              {
                                name: "Da ripetere",
                                note: "Ripassa ancora",
                                style: "again",
                              },
                              {
                                name: "Difficile",
                                note: "Serve un altro ripasso",
                                style: "hard",
                              },
                              { name: "Bene", note: "La ricordavo", style: "good" },
                              {
                                name: "Facile",
                                note: "Ricordata subito",
                                style: "easy",
                              },
                            ].map((rating, index) => (
                              <button
                                className={`rating ${rating.style}`}
                                disabled={
                                  busy ||
                                  (retryRating !== null &&
                                    retryRating !== index + 1)
                                }
                                key={rating.name}
                                onClick={() => void submitReview(index + 1)}
                              >
                                <kbd>{index + 1}</kbd>
                                <strong>{rating.name}</strong>
                                <small>{rating.note}</small>
                              </button>
                            ))}
                          </div>
                          <span className="muted rating-note">
                            Con «Da ripetere» e «Difficile» la parola resta nei ripassi di oggi.
                          </span>
                        </div>
                      ) : (
                        <p className="keyboard-hint">
                          <kbd>Spazio</kbd> per mostrare la risposta<span>·</span>Scorri la scheda
                          sul telefono
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
                      <span className="eyebrow">
                        FASE 02 · SCOPERTE QUOTIDIANE
                      </span>
                      <h1>Poche parole. Nuove possibilità.</h1>
                      <p>Ascolta, leggi e fai spazio a nuove conoscenze.</p>
                    </div>
                  </div>
                  {status?.pendingReviews ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <LockKeyhole size={32} />
                      </div>
                      <h2>Prima ripassa, poi scopri.</h2>
                      <p>
                        Ripassa le {status.pendingReviews} parole in attesa per
                        sbloccare le scoperte di oggi.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("review")}
                      >
                        Inizia il ripasso
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  ) : !newWords.length ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <Sparkles size={34} />
                      </div>
                      <h2>Le tue prossime parole ti aspettano.</h2>
                      <p>
                        Quattro parole utili nella vita quotidiana. Verranno aggiunte al tuo vocabolario
                        e saranno pronte per il ripasso di domani.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void discover()}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={18} />
                        ) : (
                          <>
                            Sblocca le parole di oggi
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="discovery-wrap">
                      <div className="discovery-progress">
                        {newWords.map((word, index) => (
                          <button
                            key={word.id}
                            aria-label={`Mostra la parola ${index + 1}: ${word.word}`}
                            className={index === discoveryIndex ? "active" : ""}
                            onClick={() => setDiscoveryIndex(index)}
                          />
                        ))}
                        <span>
                          {discoveryIndex + 1} di {newWords.length}
                        </span>
                      </div>
                      <article
                        className="discovery-card"
                        key={newWords[discoveryIndex].id}
                      >
                        <div className="discovery-card-label">
                          <Sparkles size={16} />
                          LA SCOPERTA DI OGGI
                          <span>
                            <Check size={14} />
                            Salvata nel tuo vocabolario
                          </span>
                        </div>
                        <WordDetail
                          word={newWords[discoveryIndex]}
                          onError={setError}
                        />
                      </article>
                      <div className="discovery-nav">
                        <button
                          className="button secondary"
                          disabled={discoveryIndex === 0}
                          onClick={() =>
                            setDiscoveryIndex((index) => index - 1)
                          }
                        >
                          <ArrowLeft size={17} />
                          Precedente
                        </button>
                        <button
                          className="button primary"
                          onClick={() =>
                            discoveryIndex < newWords.length - 1
                              ? setDiscoveryIndex((index) => index + 1)
                              : setCelebrate(true)
                          }
                        >
                          {discoveryIndex < newWords.length - 1
                            ? "Prossima parola"
                            : "Concludi per oggi"}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <p className="keyboard-hint">
                        <Check size={15} />
                        Queste parole entreranno nei ripassi di domani.
                      </p>
                    </div>
                  )}
                </>
              )}
              {view === "vault" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        FASE 03 · IL TUO VOCABOLARIO CRESCE
                      </span>
                      <h1>Ogni parola ha il suo posto.</h1>
                      <p>
                        Dal primo incontro a un ricordo naturale. Questo è il tuo
                        vocabolario.
                      </p>
                    </div>
                    <span className="badge">{vault.length} parole</span>
                  </div>
                  <div className="vault-tools">
                    <label className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Cerca nel tuo vocabolario"
                        placeholder="Cerca una parola o un significato…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <div className="segmented vault-filters">
                      {["all", "learning", "familiar", "mastered"].map(
                        (item) => (
                          <button
                            key={item}
                            className={filter === item ? "active" : ""}
                            onClick={() => setFilter(item)}
                          >
                            {masteryLabels[item]}
                            <span>
                              {item === "all"
                                ? vault.length
                                : vault.filter((card) => card.mastery === item)
                                    .length}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  {filteredVault.length ? (
                    <div className="vault-results">
                      <div className="vault-table-wrap">
                        <table className="vault-table">
                          <thead>
                            <tr>
                              <th>Parola</th>
                              <th>Significato</th>
                              <th>Livello</th>
                              <th>Padronanza</th>
                              <th>
                                <span className="sr-only">Dettagli</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVault.map((card) => (
                              <tr key={card.id}>
                                <td>
                                  <button
                                    className="vault-word-button"
                                    onClick={() => setSelected(card.word)}
                                  >
                                    {card.word.word}
                                    <span className="ipa">{card.word.ipa}</span>
                                  </button>
                                </td>
                                <td className="table-definition">
                                  {card.word.definition}
                                </td>
                                <td>
                                  <span className="badge">
                                    {card.word.level}
                                  </span>
                                </td>
                                <td>
                                  <span className={`mastery ${card.mastery}`}>
                                    <span />
                                    {masteryLabels[card.mastery]}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`Mostra il significato di ${card.word.word}`}
                                    onClick={() => setSelected(card.word)}
                                  >
                                    <ArrowRight size={17} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="vault-grid">
                        {filteredVault.map((card) => (
                          <button
                            className="vault-card"
                            key={card.id}
                            onClick={() => setSelected(card.word)}
                          >
                            <div className="vault-card-top">
                              <span className="badge">{card.word.level}</span>
                              <span className={`mastery ${card.mastery}`}>
                                <span />
                                {masteryLabels[card.mastery]}
                              </span>
                            </div>
                            <h2>{card.word.word}</h2>
                            <span className="ipa">{card.word.ipa}</span>
                            <p>{card.word.definition}</p>
                            <div className="vault-card-footer">
                              <span>{card.word.partOfSpeech}</span>
                              <ArrowRight size={17} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <BookOpen size={32} />
                      </div>
                      <h2>
                        {vault.length
                          ? "Nessuna parola trovata."
                          : "Una raccolta inizia con una parola."}
                      </h2>
                      <p>
                        {vault.length
                          ? "Prova un’altra ricerca o un altro filtro di padronanza."
                          : "Scopri le parole di oggi per iniziare il tuo vocabolario personale."}
                      </p>
                      {!vault.length && (
                        <button
                          className="button primary"
                          onClick={() => navigate("discover")}
                        >
                          Scopri parole
                          <ArrowRight size={17} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <button
            key={item.view}
            className={view === item.view ? "active" : ""}
            onClick={() => navigate(item.view)}
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="definition-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Significato di ${selected.word}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <button
              className="sheet-close icon-button"
              aria-label="Chiudi il significato"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <WordDetail word={selected} onError={setError} />
          </section>
        </div>
      )}
      {celebrate && (
        <div className="modal-backdrop" onClick={() => setCelebrate(false)}>
          <section
            className="celebration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebration-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 20 }, (_, index) => (
                <i
                  key={index}
                  style={{ "--i": index } as React.CSSProperties}
                />
              ))}
            </div>
            <button
              className="sheet-close icon-button"
              aria-label="Chiudi la celebrazione"
              onClick={() => setCelebrate(false)}
            >
              <X size={20} />
            </button>
            <div className="celebration-icon">
              <Trophy size={38} />
            </div>
            <span className="eyebrow">UN PICCOLO TRAGUARDO DA RICORDARE</span>
            <h2 id="celebration-title">Oggi hai fatto un passo avanti.</h2>
            <p>
              Oggi hai dedicato del tempo alle tue parole.
              <br />
              È così che nascono conoscenze durature.
            </p>
            <div className="celebration-streak">
              <Flame size={23} />
              <strong>{status?.streak ?? 0}</strong>
              <span>giorni consecutivi</span>
            </div>
            <button
              className="button primary full"
              onClick={() => {
                setCelebrate(false);
                if (!newWords.length) void discover();
                else navigate("vault");
              }}
            >
              {newWords.length
                ? "Esplora il tuo vocabolario"
                : "Scopri le nuove parole di oggi"}
              <ArrowRight size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setCelebrate(false);
                navigate("today");
              }}
            >
              Torna a oggi
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
export default App;
