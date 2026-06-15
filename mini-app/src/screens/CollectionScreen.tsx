import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Egg, Profile } from "../types";

const EMOJI: Record<string, string> = {
  zephyr: "🟢",
  lunar: "🌙",
  nebula: "💜",
  cosmic: "✨",
};

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `crack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
          crackRequestId: newRequestId(),
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
                  <small>{eggStatus(egg)}</small>
                </div>
                <button
                  type="button"
                  className="primary-btn compact"
                  disabled={cracking === egg.id}
                  onClick={() => crackEgg(egg)}
                >
                  {cracking === egg.id ? "..." : ready ? "Вскрыть" : "Ждём"}
                </button>
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
              <span className="creature-avatar">{EMOJI[c.speciesId] ?? "👽"}</span>
              <strong>{c.name}</strong>
              <small>{c.rarity}</small>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${c.evolutionProgress}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
