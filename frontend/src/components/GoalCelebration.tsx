import { useEffect, type CSSProperties } from "react";
import { Check, X } from "lucide-react";

type Props = { words: number; onDismiss: () => void };
const pieces = Array.from({ length: 48 }, (_, index) => ({
  left: `${(index * 37) % 101}%`,
  "--delay": `${(index % 8) * 0.06}s`,
  "--duration": `${2.6 + (index % 7) * 0.12}s`,
  "--drift": `${((index * 53) % 121) - 60}px`,
  "--rotation": `${180 + ((index * 73) % 540)}deg`,
}));

export default function GoalCelebration({ words, onDismiss }: Props) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div className="goal-celebration">
      <div className="goal-confetti" aria-hidden="true">
        {pieces.map((style, index) => (
          <i key={index} style={style as CSSProperties} />
        ))}
      </div>
      <div className="goal-toast">
        <span className="goal-success-icon" aria-hidden="true">
          <Check size={22} />
        </span>
        <div role="status" aria-live="polite" aria-atomic="true">
          <strong>Obiettivo raggiunto!</strong>
          <p>
            {words}{" "}
            {words === 1 ? "nuova parola imparata" : "nuove parole imparate"}{" "}
            oggi.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Chiudi il messaggio di completamento"
          onClick={onDismiss}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
