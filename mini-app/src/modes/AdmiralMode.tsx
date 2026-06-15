import { useEffect, useState } from "react";
import { api } from "../api/client";
import { GameArt } from "../components/GameArt";

interface AdviceResult {
  advice: string;
  source: "gpt" | "rules" | "limit";
  remaining: number | null;
  unlimited: boolean;
  cached?: boolean;
}

interface HistoryItem {
  id: number;
  adviceGiven: string;
  createdAt: string;
}

interface Props {
  initData: string;
}

export function AdmiralMode({ initData }: Props) {
  const [result, setResult] = useState<AdviceResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    const data = await api<{ history: HistoryItem[] }>("/api/admiral/history", initData);
    setHistory(data.history);
  }

  async function requestAdvice() {
    setLoading(true);
    setError("");
    try {
      const data = await api<AdviceResult>("/api/admiral", initData, { method: "POST" });
      setResult(data);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    requestAdvice().catch(() => {});
  }, []);

  const sourceLabel =
    result?.source === "gpt"
      ? "Нейросеть"
      : result?.source === "rules"
        ? "Тактический ИИ"
        : "Лимит исчерпан";

  return (
    <div className="mode-panel admiral">
      <div className="panel-head-art">
        <GameArt kind="admiral" size={64} />
        <div>
          <h2>Адмирал ИИ</h2>
          <p className="muted">Персональные советы по развитию колонии</p>
        </div>
      </div>

      {result && (
        <div className="advice-box">
          <div className="advice-meta">
            <span className="source-badge">{sourceLabel}</span>
            {result.cached && <span className="cached-badge">из кэша</span>}
            {!result.unlimited && result.remaining !== null && (
              <span className="limit-badge">осталось {result.remaining}/3</span>
            )}
            {result.unlimited && <span className="limit-badge">без лимита</span>}
          </div>
          <div className="advice-text">
            {result.advice.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="primary-btn"
        onClick={requestAdvice}
        disabled={loading || result?.source === "limit"}
      >
        {loading ? "Анализ колонии..." : "Новый совет"}
      </button>

      {history.length > 1 && (
        <>
          <h3>Недавние советы</h3>
          <ul className="admiral-history">
            {history.slice(1, 4).map((h) => (
              <li key={h.id}>
                <small>{new Date(h.createdAt).toLocaleString("ru")}</small>
                <p>{h.adviceGiven.slice(0, 120)}…</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
