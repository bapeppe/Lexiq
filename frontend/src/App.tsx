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
type Mode = "flashcard" | "recall" | "cloze";
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message ||
        result.message ||
        "Something went wrong. Please try again.",
    );
  return result as T;
}
function pronounce(word: string, onError: (message: string) => void) {
  if (!("speechSynthesis" in window)) {
    onError("Audio pronunciation is unavailable in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(word);
  speech.lang = "en-GB";
  speech.rate = 0.85;
  speech.onerror = () =>
    onError("Pronunciation could not play. Please try again.");
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
          aria-label={`Pronounce ${word.word}`}
          onClick={() => pronounce(word.word, onError)}
        >
          <AudioLines size={22} />
        </button>
      </div>
      <p className="definition">{word.definition}</p>
      <span className="eyebrow">IN CONTEXT</span>
      <Context word={word} />
      <span className="eyebrow">WORDS THAT GO TOGETHER</span>
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
          <h2>A habit taking shape.</h2>
          <p>Your recall accuracy over the last seven days</p>
        </div>
        <span className="badge">LAST 7 DAYS · UTC</span>
      </div>
      {!observed && (
        <p className="chart-empty">
          Your first review will bring this chart to life.
        </p>
      )}
      <div className="chart-bars" aria-label="Observed daily recall accuracy">
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
              {new Intl.DateTimeFormat("en", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(point.date + "T12:00:00Z"))}
            </span>
            <span className="chart-reviews">
              {point.reviews ? `${point.reviews} reviews` : "No reviews"}
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
          <span className="eyebrow">A LITTLE EVERY DAY. A LOT OVER TIME.</span>
          <h1>
            Make words
            <br />
            part of your world.
          </h1>
          <p>
            A calmer way to grow your English. Remember what you learn, discover
            something new, and build a habit that stays.
          </p>
          <div className="auth-preview">
            <div className="preview-head">
              <span className="badge">B2</span>
              <Sparkles size={19} />
            </div>
            <h2>serendipity</h2>
            <span className="ipa">/ˌser.ənˈdɪp.ə.ti/</span>
            <p>The happy discovery of something you weren’t looking for.</p>
            <div className="preview-foot">
              <span className="little-dot" />
              One word. A new possibility.
            </div>
          </div>
        </div>
        <span className="auth-footer">Small steps. Lasting knowledge.</span>
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
          <span className="eyebrow">YOUR DAILY MOMENT OF GROWTH</span>
          <h2>{signup ? "Start your word habit." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Your next chapter starts with a single word."
              : "Your words are waiting for you."}
          </p>
          {signup && (
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="Alex"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? "At least 10 characters" : "Your password"}
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
                {signup ? "Create your account" : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to Lexiq?"}{" "}
            <button
              type="button"
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-note">
            <LockKeyhole size={15} />
            Your progress is saved, one day at a time.
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
        <span>Making room for your words…</span>
      </div>
    );
  if (!user)
    return (
      <>
        <button
          className="auth-theme icon-button"
          aria-label="Switch color theme"
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
    { view: "today" as View, icon: Focus, label: "Today" },
    { view: "review" as View, icon: Layers, label: "Review" },
    { view: "discover" as View, icon: Sparkles, label: "Discover" },
    { view: "vault" as View, icon: BookOpen, label: "Word vault" },
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
        <span className="nav-caption">YOUR PRACTICE</span>
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
            <p>Consistency is a superpower.</p>
            <span>Five minutes today. A richer vocabulary tomorrow.</span>
          </div>
          <button
            className="account"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>Keep growing</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Your workspace <ChevronRight size={14} />
            <strong>
              {navItems.find((item) => item.view === view)?.label}
            </strong>
          </span>
          <div className="topbar-actions">
            <span className="streak-pill">
              <Flame size={16} />
              {status?.streak ?? 0}
              <span>day streak</span>
            </span>
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="mobile-logout icon-button"
              aria-label="Sign out"
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
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-panel">
              <LoaderCircle className="spin" />
              Loading your practice…
            </div>
          ) : !status ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Focus size={32} />
              </div>
              <h2>Let’s reconnect to your practice.</h2>
              <p>Your progress is safe. We couldn’t load it just now.</p>
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
                Try again
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
                        {new Intl.DateTimeFormat("en", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        }).format(today)}{" "}
                        · UTC
                      </span>
                      <h1>A little progress, every day.</h1>
                      <p>
                        Welcome back, {user.name.split(" ")[0]}. Let’s make a
                        few words stick.
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
                        YOUR DAILY PRACTICE
                      </span>
                      <h2>
                        {status?.pendingReviews
                          ? "Remember first.\nDiscover next."
                          : "A clear mind.\nRoom for new words."}
                      </h2>
                      <p>
                        {status?.pendingReviews
                          ? `${status.pendingReviews} words are ready for a little attention. Review them to unlock today’s discoveries.`
                          : "Your review queue is clear. Discover four useful words and make them yours."}
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
                              ? "Start daily review"
                              : status?.acquiredToday
                                ? "Revisit today’s words"
                                : "Discover today’s words"}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      <span className="hero-meta">
                        <Focus size={14} />A few focused minutes make a
                        difference
                      </span>
                    </div>
                    <div className="hero-visual" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="visual-card visual-card-back">
                        <Layers size={28} />
                      </div>
                      <div className="visual-card visual-card-front">
                        <span>WORD BY WORD</span>
                        <div className="visual-symbol">
                          Aa<span>↗</span>
                        </div>
                        <div className="visual-line" />
                        <small>Learn. Recall. Repeat.</small>
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
                        Current streak
                      </div>
                      <strong>
                        {stats?.streak ?? 0}
                        <small>days</small>
                      </strong>
                      <span>Longest: {stats?.longestStreak ?? 0} days</span>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        <BookOpen size={17} />
                        Words collected
                      </div>
                      <strong>
                        {stats?.totalWords ?? 0}
                        <small>words</small>
                      </strong>
                      <span>A vocabulary that grows with you</span>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        <Target size={17} />
                        Recall rate
                      </div>
                      <strong>
                        {stats?.reviewCount
                          ? `${Math.round(stats.retention)}%`
                          : "—"}
                      </strong>
                      <span>
                        {stats?.reviewCount
                          ? `Across ${stats.reviewCount} reviews`
                          : "Your first review starts the story"}
                      </span>
                    </div>
                  </div>
                  <RetentionChart history={stats?.retentionHistory || []} />
                  <div className="section-title">
                    <h2>Your daily loop</h2>
                    <span>One small habit. Three simple steps.</span>
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
                      <h3>Recall & retain</h3>
                      <p>A quick check-in with words you’ve already met.</p>
                      <span
                        className={`loop-status ${!status?.pendingReviews ? "complete" : ""}`}
                      >
                        {status?.pendingReviews ? (
                          <>
                            {status.pendingReviews} words to review
                            <ArrowRight size={15} />
                          </>
                        ) : (
                          <>
                            <Check size={15} />
                            Queue clear
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
                      <h3>Meet new words</h3>
                      <p>Four thoughtful additions to your everyday English.</p>
                      <span className="loop-status">
                        {status?.pendingReviews ? (
                          <>
                            <LockKeyhole size={14} />
                            Complete your review to unlock
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Ready to discover
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
                      <h3>Watch it grow</h3>
                      <p>
                        Your personal collection, from first encounter to
                        mastery.
                      </p>
                      <span className="loop-status">
                        Explore your word vault
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  </div>
                  <div className="daily-footnote">
                    <span className="little-dot" />
                    Built for the long run, one word at a time.
                    <span>Daily practice resets at midnight UTC</span>
                  </div>
                </>
              )}
              {view === "review" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        PHASE 01 · RECALL & RETAIN
                      </span>
                      <h1>Your daily review.</h1>
                      <p>Make space to remember. New discoveries come next.</p>
                    </div>
                    <span className="badge">
                      {status?.pendingReviews ?? 0} remaining
                    </span>
                  </div>
                  {!current ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <CheckCheck size={34} />
                      </div>
                      <h2>All clear. Nicely done.</h2>
                      <p>
                        Your words are taking root. Today’s discoveries are
                        unlocked.
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void discover()}
                      >
                        Discover new words
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
                                  ? "Flashcard"
                                  : item === "recall"
                                    ? "Type to recall"
                                    : "Fill the gap"}
                              </button>
                            ),
                          )}
                        </div>
                        <span className="muted">
                          {reviewed} reviewed this session
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
                              ? "THE WORD, REVEALED"
                              : "TAKE A MOMENT TO RECALL"}
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
                                  ? "That’s it. You remembered."
                                  : `Your answer: ${answer || "No answer entered"}. Grade how well you recalled it.`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="review-prompt">
                            {mode === "flashcard" ? (
                              <>
                                <h2>{current.word.word}</h2>
                                <span className="ipa">{current.word.ipa}</span>
                                <p>Can you remember what this word means?</p>
                                <button
                                  className="button secondary"
                                  onClick={() => setRevealed(true)}
                                >
                                  Reveal meaning
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
                                    ? "WHICH WORD MEANS…"
                                    : "COMPLETE THE SENTENCE"}
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
                                    aria-label="Choose the word that completes the sentence"
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
                                      aria-label="Your recalled word"
                                      value={answer}
                                      onChange={(event) =>
                                        setAnswer(event.target.value)
                                      }
                                      placeholder="Type the word…"
                                      autoComplete="off"
                                      autoCapitalize="none"
                                      spellCheck={false}
                                      autoFocus
                                    />
                                    <button
                                      className="button secondary"
                                      type="submit"
                                    >
                                      Check my answer
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
                          <p>How well did you remember?</p>
                          <div className="rating-grid">
                            {[
                              {
                                name: "Again",
                                note: "Practice again",
                                style: "again",
                              },
                              {
                                name: "Hard",
                                note: "One more look",
                                style: "hard",
                              },
                              { name: "Good", note: "Got it", style: "good" },
                              {
                                name: "Easy",
                                note: "Knew it instantly",
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
                            Again and Hard keep the word in today’s queue.
                          </span>
                        </div>
                      ) : (
                        <p className="keyboard-hint">
                          <kbd>Space</kbd> to reveal<span>·</span>Swipe the card
                          on mobile
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
                        PHASE 02 · DAILY DISCOVERIES
                      </span>
                      <h1>A few words. New possibilities.</h1>
                      <p>Listen, read, and let something new sink in.</p>
                    </div>
                  </div>
                  {status?.pendingReviews ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <LockKeyhole size={32} />
                      </div>
                      <h2>Remember first, discover next.</h2>
                      <p>
                        Review your {status.pendingReviews} waiting words to
                        unlock today’s discoveries.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("review")}
                      >
                        Start daily review
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  ) : !newWords.length ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <Sparkles size={34} />
                      </div>
                      <h2>Your next words are waiting.</h2>
                      <p>
                        Four words, chosen for real life. Added to your vault
                        and ready for review tomorrow.
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
                            Unlock today’s words
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
                            aria-label={`Show word ${index + 1}: ${word.word}`}
                            className={index === discoveryIndex ? "active" : ""}
                            onClick={() => setDiscoveryIndex(index)}
                          />
                        ))}
                        <span>
                          {discoveryIndex + 1} of {newWords.length}
                        </span>
                      </div>
                      <article
                        className="discovery-card"
                        key={newWords[discoveryIndex].id}
                      >
                        <div className="discovery-card-label">
                          <Sparkles size={16} />
                          TODAY’S DISCOVERY
                          <span>
                            <Check size={14} />
                            Saved to your vault
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
                          Previous
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
                            ? "Next word"
                            : "Finish today"}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <p className="keyboard-hint">
                        <Check size={15} />
                        These words join your review queue tomorrow.
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
                        PHASE 03 · YOUR GROWING COLLECTION
                      </span>
                      <h1>Every word has a place.</h1>
                      <p>
                        From first encounter to second nature. This is your word
                        vault.
                      </p>
                    </div>
                    <span className="badge">{vault.length} words</span>
                  </div>
                  <div className="vault-tools">
                    <label className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Search your vocabulary"
                        placeholder="Find a word or meaning…"
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
                            {item.charAt(0).toUpperCase() + item.slice(1)}
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
                              <th>Word</th>
                              <th>Meaning</th>
                              <th>Level</th>
                              <th>Mastery</th>
                              <th>
                                <span className="sr-only">Details</span>
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
                                    {card.mastery}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`View ${card.word.word} definition`}
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
                                {card.mastery}
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
                          ? "No words found."
                          : "A collection begins with one word."}
                      </h2>
                      <p>
                        {vault.length
                          ? "Try another search or mastery filter."
                          : "Discover today’s words to start your personal vocabulary vault."}
                      </p>
                      {!vault.length && (
                        <button
                          className="button primary"
                          onClick={() => navigate("discover")}
                        >
                          Discover words
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
            <span>{item.label === "Word vault" ? "Vault" : item.label}</span>
          </button>
        ))}
      </nav>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="definition-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Definition of ${selected.word}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <button
              className="sheet-close icon-button"
              aria-label="Close definition"
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
              aria-label="Close celebration"
              onClick={() => setCelebrate(false)}
            >
              <X size={20} />
            </button>
            <div className="celebration-icon">
              <Trophy size={38} />
            </div>
            <span className="eyebrow">A LITTLE WIN WORTH KEEPING</span>
            <h2 id="celebration-title">Look at you, showing up.</h2>
            <p>
              You made time for your words today.
              <br />
              That’s how lasting knowledge grows.
            </p>
            <div className="celebration-streak">
              <Flame size={23} />
              <strong>{status?.streak ?? 0}</strong>
              <span>day streak</span>
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
                ? "Explore your word vault"
                : "Meet today’s new words"}
              <ArrowRight size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setCelebrate(false);
                navigate("today");
              }}
            >
              Back to today
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
export default App;
