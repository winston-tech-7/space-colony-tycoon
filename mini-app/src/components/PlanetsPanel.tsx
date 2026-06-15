import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

type PlanetRow = {
  id: string;
  name: string;
  emoji: string;
  defense: number;
  owned: boolean;
  colonyId: number | null;
  mineLevel: number;
  bioLabLevel: number;
  minerals: number;
  bioMatter: number;
  unlockCredits: number;
  unlockMinerals: number;
  nextMineCost: number | null;
  nextBioCost: number | null;
};

type EconomyState = {
  playerPower: number;
  totalMinerals: number;
  totalBioMatter: number;
  credits: number;
  catalog: PlanetRow[];
};

interface Props {
  initData: string;
  colonyId?: number;
  onRefresh: () => void;
}

export function PlanetsPanel({ initData, colonyId, onRefresh }: Props) {
  const [economy, setEconomy] = useState<EconomyState | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const data = await api<EconomyState>("/api/planets", initData);
    setEconomy(data);
  }, [initData]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function act(
    key: string,
    path: string,
    body: Record<string, unknown>,
    onDone?: (data: unknown) => void,
  ) {
    setBusy(key);
    setMsg("");
    try {
      const data = await api(path, initData, { method: "POST", body: JSON.stringify(body) });
      if (onDone) onDone(data);
      else if ((data as EconomyState).catalog) setEconomy(data as EconomyState);
      else await load();
      onRefresh();
      const raidMsg = (data as { message?: string }).message;
      if (raidMsg) setMsg(raidMsg);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy("");
    }
  }

  const activeColonyId =
    colonyId ?? economy?.catalog.find((p) => p.owned)?.colonyId ?? null;
  const activePlanet = economy?.catalog.find((p) => p.colonyId === activeColonyId);

  return (
    <section className="panel-section planets-panel">
      <h3 className="section-title">Планеты и добыча</h3>
      <p className="muted economy-hint">
        ⛏ Минералы — шахта и рейды. 🧬 Биомасса — биолаб и прокачка яиц/существ.
        Ресурсы копятся пассивно на каждой планете.
      </p>

      {activePlanet && activeColonyId && (
        <div className="upgrade-row">
          <article className="upgrade-card">
            <strong>⛏ Шахта ур. {activePlanet.mineLevel}</strong>
            <small>+минералы/час</small>
            <button
              type="button"
              className="secondary-btn compact"
              disabled={busy !== ""}
              onClick={() =>
                act(`mine-${activeColonyId}`, "/api/colony/mine/upgrade", {
                  colonyId: activeColonyId,
                })
              }
            >
              {busy === `mine-${activeColonyId}`
                ? "..."
                : `Улучшить · ${activePlanet.nextMineCost} ⛏`}
            </button>
          </article>
          <article className="upgrade-card">
            <strong>🧬 Биолаб ур. {activePlanet.bioLabLevel}</strong>
            <small>+биомасса/час</small>
            <button
              type="button"
              className="secondary-btn compact"
              disabled={busy !== ""}
              onClick={() =>
                act(`bio-${activeColonyId}`, "/api/colony/biolab/upgrade", {
                  colonyId: activeColonyId,
                })
              }
            >
              {busy === `bio-${activeColonyId}`
                ? "..."
                : `Улучшить · ${activePlanet.nextBioCost} 🧬`}
            </button>
          </article>
        </div>
      )}

      {economy && (
        <p className="muted">
          Сила флота: <strong>{economy.playerPower}</strong> · Всего ⛏ {economy.totalMinerals} · 🧬{" "}
          {economy.totalBioMatter}
        </p>
      )}

      <div className="planet-list">
        {economy?.catalog.map((p) => (
          <article key={p.id} className={`planet-card ${p.owned ? "owned" : ""}`}>
            <span className="planet-emoji">{p.emoji}</span>
            <div className="planet-info">
              <strong>{p.name}</strong>
              {p.owned ? (
                <small>
                  Шахта {p.mineLevel} · Биолаб {p.bioLabLevel}
                </small>
              ) : (
                <small>
                  Защита {p.defense} · {p.unlockCredits} 💰 + {p.unlockMinerals} ⛏
                </small>
              )}
            </div>
            {!p.owned && (
              <div className="planet-actions">
                <button
                  type="button"
                  className="secondary-btn compact"
                  disabled={busy !== ""}
                  onClick={() =>
                    act(`raid-${p.id}`, "/api/planets/raid", { planetId: p.id }, (data) => {
                      const d = data as { economy?: EconomyState; message?: string };
                      if (d.economy) setEconomy(d.economy);
                      if (d.message) setMsg(d.message);
                    })
                  }
                >
                  {busy === `raid-${p.id}` ? "..." : "Рейд"}
                </button>
                <button
                  type="button"
                  className="primary-btn compact"
                  disabled={busy !== ""}
                  onClick={() =>
                    act(`unlock-${p.id}`, "/api/planets/unlock", { planetId: p.id })
                  }
                >
                  {busy === `unlock-${p.id}` ? "..." : "Колонизировать"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {msg && <p className={`status toast ${msg.includes("Поражение") ? "error-banner" : ""}`}>{msg}</p>}
    </section>
  );
}
