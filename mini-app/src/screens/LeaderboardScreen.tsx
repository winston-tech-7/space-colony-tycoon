import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LeaderboardRow } from "../types";

interface Props {
  initData: string;
}

export function LeaderboardScreen({ initData }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    api<{ leaderboard: LeaderboardRow[] }>("/api/leaderboard", initData)
      .then((d) => setRows(d.leaderboard))
      .catch(() => {});
  }, [initData]);

  return (
    <div className="screen leaderboard-screen">
      <section className="panel-section">
        <h3 className="section-title">Топ колонизаторов</h3>
        <div className="rank-list">
          {rows.map((row) => (
            <article key={row.userId} className={`rank-row ${row.rank <= 3 ? "top" : ""}`}>
              <span className="rank-num">#{row.rank}</span>
              <div className="rank-body">
                <strong>{row.name}</strong>
                <small>Кормлений: {row.totalFeeds} · 🏅 {row.medals}</small>
              </div>
              <span className="rank-score">{row.score}</span>
            </article>
          ))}
          {rows.length === 0 && <p className="muted">Загрузка рейтинга...</p>}
        </div>
      </section>
    </div>
  );
}
