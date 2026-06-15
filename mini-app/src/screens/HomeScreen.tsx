import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { PlanetCanvas } from "../components/PlanetCanvas";
import { PlanetsPanel } from "../components/PlanetsPanel";
import type { Profile } from "../types";

const EMOJI: Record<string, string> = {
  zephyr: "🟢",
  lunar: "🌙",
  nebula: "💜",
  cosmic: "✨",
};

const BREEDABLE_STAGES = ["juvenile", "adult", "evolved"];

type BreedCandidate = {
  id: number;
  name: string;
  rarity: string;
  stage: string;
  owner: { telegramId: string; firstName: string; username?: string | null };
};

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `breed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Props {
  profile: Profile;
  initData: string;
  userId: string;
  onRefresh: () => void;
  onNavigate: (tab: "collection" | "events") => void;
}

export function HomeScreen({ profile, initData, userId, onRefresh, onNavigate }: Props) {
  const [breedOpen, setBreedOpen] = useState(false);
  const [parentA, setParentA] = useState<number | null>(null);
  const [parentB, setParentB] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<BreedCandidate[]>([]);
  const [msg, setMsg] = useState("");

  const colony = profile.colonies[0];
  const mainCreature = profile.creatures[0];
  const readyEggs = profile.eggs?.filter((e) => e.status === "ready").length ?? 0;
  const breedableOwn = profile.creatures.filter((c) => BREEDABLE_STAGES.includes(c.stage));

  const loadCandidates = useCallback(
    async (excludeId?: number) => {
      const qs = excludeId ? `?exclude=${excludeId}` : "";
      const data = await api<{ candidates: BreedCandidate[] }>(
        `/api/breed/candidates${qs}`,
        initData,
      );
      setCandidates(data.candidates);
      return data.candidates;
    },
    [initData],
  );

  useEffect(() => {
    if (!breedOpen || !parentA) return;
    loadCandidates(parentA).then((list) => {
      if (list.some((c) => c.id === parentB)) return;
      setParentB(list[0]?.id ?? null);
    });
  }, [breedOpen, parentA, loadCandidates, parentB]);

  async function openBreed() {
    setBreedOpen(true);
    setMsg("");
    const first = breedableOwn[0]?.id ?? null;
    setParentA(first);
    setParentB(null);
    if (first) {
      const list = await loadCandidates(first);
      const partner = list.find((c) => c.id !== first);
      setParentB(partner?.id ?? list[0]?.id ?? null);
    } else {
      await loadCandidates();
    }
  }

  function breedHint(): string | null {
    const incubatingEggs =
      profile.eggs?.filter((e) => e.status !== "opened" && e.status !== "ready").length ?? 0;
    if (breedableOwn.length >= 2) return null;
    if (breedableOwn.length === 1) {
      return "Для скрещивания нужно второе выросшее существо. Покормите остальных или дождитесь партнёра из другой колонии.";
    }
    if (profile.creatures.some((c) => c.stage === "egg")) {
      return "Существа ещё в стадии egg — нажмите «Покормить существ» внизу экрана несколько раз, пока не станут juvenile.";
    }
    if (incubatingEggs > 0 || (profile.eggs?.length ?? 0) > 0) {
      return "Скрещивание использует существ, не яйца. Сначала вскройте яйца в Архиве, затем покормите существ.";
    }
    return "Нет существ для скрещивания. Вскройте яйца в Архиве или получите их на рулетке.";
  }

  async function confirmBreed() {
    if (!parentA || !parentB) {
      setMsg("Выберите обоих родителей");
      return;
    }
    try {
      await api("/api/breed", initData, {
        method: "POST",
        body: JSON.stringify({
          sessionId: newSessionId(),
          parentAId: parentA,
          parentBId: parentB,
        }),
      });
      setMsg("Космическое яйцо в инкубаторе! Смотрите в Архиве.");
      setBreedOpen(false);
      onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    }
  }

  function partnerLabel(c: BreedCandidate) {
    if (String(c.owner.telegramId) === userId) {
      return `${c.name} (ваше · ${c.stage})`;
    }
    const who = c.owner.username ? `@${c.owner.username}` : c.owner.firstName;
    return `${c.name} (${who})`;
  }

  return (
    <div className="screen home-screen">
      <section className="hero-card">
        <PlanetCanvas premium={colony?.isPremium} />
        <div className="hero-meta">
          <h2>{colony?.planetName ?? "Колония"}</h2>
          <span className="level-badge">Ур. {colony?.level ?? 1}</span>
        </div>
        {mainCreature && (
          <div className="main-creature">
            <span className="creature-avatar lg">
              {EMOJI[mainCreature.speciesId] ?? "👽"}
            </span>
            <strong>{mainCreature.name}</strong>
            <small>{mainCreature.stage} · {mainCreature.rarity}</small>
          </div>
        )}
      </section>

      <section className="action-grid">
        <button type="button" className="action-tile" onClick={() => onNavigate("collection")}>
          <span>🥚</span>
          <strong>Яйца</strong>
          <small>{readyEggs} готово</small>
        </button>
        <button type="button" className="action-tile" onClick={openBreed}>
          <span>🧬</span>
          <strong>Скрещивание</strong>
          <small>50 💰 · 2 существа</small>
        </button>
        <button type="button" className="action-tile" onClick={() => onNavigate("events")}>
          <span>🎡</span>
          <strong>Рулетка</strong>
          <small>100 🏅</small>
        </button>
        <button type="button" className="action-tile" onClick={() => onNavigate("events")}>
          <span>🎯</span>
          <strong>Охота</strong>
          <small>Легенда</small>
        </button>
      </section>

      <section className="stats-row">
        <div className="stat-tile" title="Добываются шахтой на планетах и рейдах">
          <span>⛏</span><strong>{colony?.minerals ?? 0}</strong><small>Минералы</small>
        </div>
        <div className="stat-tile" title="Добывается биолабом, тратится на прокачку">
          <span>🧬</span><strong>{colony?.bioMatter ?? 0}</strong><small>Биомасса</small>
        </div>
        <div className="stat-tile accent"><span>👽</span><strong>{profile.creatures.length}</strong><small>Существа</small></div>
      </section>

      <PlanetsPanel initData={initData} colonyId={colony?.id} onRefresh={onRefresh} />

      {msg && <p className="status toast">{msg}</p>}

      {breedOpen && (
        <div className="modal-sheet">
          <h3>Скрещивание существ</h3>
          <p className="muted economy-hint">
            Нужны два выросших существа (не яйца). Результат — новое яйцо в Архиве.
          </p>
          {breedHint() && <p className="win-banner error-banner">{breedHint()}</p>}
          <label className="form-block">
            Родитель 1 (ваш)
            <select
              value={parentA ?? ""}
              onChange={(e) => setParentA(Number(e.target.value) || null)}
            >
              {breedableOwn.length === 0 && (
                <option value="">Нет готовых существ</option>
              )}
              {breedableOwn.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stage})
                </option>
              ))}
            </select>
          </label>
          <label className="form-block">
            Родитель 2
            <select
              value={parentB ?? ""}
              onChange={(e) => setParentB(Number(e.target.value) || null)}
            >
              <option value="">Выберите...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {partnerLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primary-btn"
            disabled={!parentA || !parentB || parentA === parentB}
            onClick={confirmBreed}
          >
            Создать яйцо · 50 💰
          </button>
          <button type="button" className="secondary-btn" onClick={() => setBreedOpen(false)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
