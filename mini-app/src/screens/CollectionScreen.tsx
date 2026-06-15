import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { GameArt, creatureArtKind } from "../components/GameArt";
import { rarityLabel, stageLabel, newRequestId } from "../lib/labels";
import type { Egg, Profile } from "../types";

function isEggReady(egg: Egg): boolean {
  return egg.status === "ready" || new Date(egg.readyAt).getTime() <= Date.now();
}

interface Props {
  profile: Profile;
  initData: string;
  onRefresh: () => void;
  onHaptic?: () => void;
}

export function CollectionScreen({ profile, initData, onRefresh, onHaptic }: Props) {
  const [eggs, setEggs] = useState<Egg[]>(profile.eggs ?? []);
  const [cracking, setCracking] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [, tick] = useState(0);

  const loadEggs = useCallback(async () => {
    const data = await api<{ eggs: Egg[] }>("/api/eggs", initData);
    setEggs(data.eggs);
  }, [initData]);

  useEffect(() => {
    setEggs(profile.eggs ?? []);
  }, [profile.eggs]);

  useEffect(() => {
    loadEggs().catch(() => {});
    const timer = setInterval(() => {
      tick((n) => n + 1);
      loadEggs().catch(() => {});
    }, 10_000);
    return () => clearInterval(timer);
  }, [loadEggs]);

  async function upgradeEgg(egg: Egg) {
    setUpgrading(`egg-${egg.id}`);
    setReveal(null);
    try {
      await api("/api/eggs/upgrade", initData, {
        method: "POST",
        body: JSON.stringify({ eggId: egg.id }),
      });
      setReveal("Инкубация ускорена! +шанс редкости при вскрытии");
      await loadEggs();
      onRefresh();
    } catch (e) {
      setReveal(e instanceof Error ? e.message : "Ошибка прокачки");
    } finally {
      setUpgrading(null);
    }
  }

  async function upgradeCreature(creatureId: number) {
    setUpgrading(`creature-${creatureId}`);
    setReveal(null);
    try {
      await api("/api/creatures/upgrade", initData, {
        method: "POST",
        body: JSON.stringify({ creatureId }),
      });
      setReveal("Сила существа повышена!");
      onRefresh();
    } catch (e) {
      setReveal(e instanceof Error ? e.message : "Ошибка прокачки");
    } finally {
      setUpgrading(null);
    }
  }
  async function crackEgg(egg: Egg) {
    if (!isEggReady(egg)) {
      setReveal("Яйцо ещё инкубируется — подождите");
      return;
    }
    setCracking(egg.id);
    setReveal(null);
    onHaptic?.();
    try {
      const result = await api<{
        creature: { name: string; rarity: string };
        species?: { emoji?: string };
      }>("/api/eggs/crack", initData, {
        method: "POST",
        body: JSON.stringify({
          eggId: egg.id,
          crackRequestId: newRequestId("crack"),
        }),
      });
      setReveal(`Получено: ${result.creature.name} · ${result.creature.rarity}`);
      await loadEggs();
      await onRefresh();
      onHaptic?.();
    } catch (e) {
      setReveal(e instanceof Error ? e.message : "Ошибка вскрытия");
    } finally {
      setCracking(null);
    }
  }

  function eggStatus(egg: Egg) {
    if (isEggReady(egg)) {
      return egg.rarityTier
        ? `Готово! Редкость: ${egg.rarityTier}`
        : "Готово к вскрытию!";
    }
    const ms = new Date(egg.readyAt).getTime() - Date.now();
    const min = Math.ceil(ms / 60000);
    const sec = Math.ceil((ms % 60000) / 1000);
    if (min > 0) return `Инкубация: ${min} мин`;
    return `Инкубация: ${sec} сек`;
  }

  return (
    <div className="screen collection-screen">
      <section className="panel-section">
        <h3 className="section-title">Космические яйца</h3>
        {reveal && <p className={`win-banner ${reveal.startsWith("Получено") ? "" : "error-banner"}`}>{reveal}</p>}
        <div className="egg-list">
          {eggs.length === 0 && (
            <p className="muted">Нет яиц. Скрестите существ на базе.</p>
          )}
          {eggs.map((egg) => {
            const ready = isEggReady(egg);
            return (
              <article key={egg.id} className={`egg-card ${ready ? "ready" : ""}`}>
                <span className="egg-icon">{ready ? "✨" : "🥚"}</span>
                <div>
                  <strong>Яйцо #{egg.id}</strong>
                  <small>
                    {eggStatus(egg)}
                    {(egg.boostLevel ?? 0) > 0 && ` · Буст ${egg.boostLevel}`}
                  </small>
                </div>
                <div className="egg-actions">
                  {!ready && (egg.boostLevel ?? 0) < 5 && (
                    <button
                      type="button"
                      className="secondary-btn compact"
                      disabled={upgrading !== null}
                      onClick={() => upgradeEgg(egg)}
                    >
                      {upgrading === `egg-${egg.id}` ? "..." : "🧬 Ускорить"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary-btn compact"
                    disabled={cracking === egg.id}
                    onClick={() => crackEgg(egg)}
                  >
                    {cracking === egg.id ? "..." : ready ? "Вскрыть" : "Ждём"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <h3 className="section-title">Архив существ ({profile.creatures.length})</h3>
        <div className="creature-grid">
          {profile.creatures.length === 0 && (
            <p className="muted">Вскройте яйцо, чтобы получить первое существо.</p>
          )}
          {profile.creatures.map((c) => (
              <article key={c.id} className="creature-card compact">
              <GameArt kind={creatureArtKind(c.speciesId)} size={44} />
              <strong>{c.name}</strong>
              <small>
                {rarityLabel(c.rarity)} · {stageLabel(c.stage)} · сила {(c.powerLevel ?? 1)}
              </small>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${c.evolutionProgress}%` }} />
              </div>
              <button
                type="button"
                className="secondary-btn compact"
                disabled={upgrading !== null}
                onClick={() => upgradeCreature(c.id)}
              >
                {upgrading === `creature-${c.id}` ? "..." : "⛏🧬 Усилить"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
