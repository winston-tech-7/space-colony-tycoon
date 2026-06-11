import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { BattleState, Profile } from "../types";

interface Props {
  initData: string;
  profile: Profile;
  userId: string;
  challengeTarget?: string;
  socket: import("socket.io-client").Socket | null;
}

export function BattleMode({
  initData,
  profile,
  userId,
  challengeTarget,
  socket,
}: Props) {
  const [data, setData] = useState<{
    battles: BattleState[];
    pending: BattleState[];
    leaderboard: Array<{ userId: string; wins: number; name: string }>;
  } | null>(null);
  const [activeBattle, setActiveBattle] = useState<BattleState | null>(null);
  const [creatureId, setCreatureId] = useState<number | "">("");
  const [defenderId, setDefenderId] = useState(challengeTarget ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{
      battles: BattleState[];
      pending: BattleState[];
      leaderboard: Array<{ userId: string; wins: number; name: string }>;
    }>("/api/battle", initData);
    setData(res);
    if (activeBattle) {
      const updated =
        res.battles.find((b) => b.id === activeBattle.id) ??
        res.pending.find((b) => b.id === activeBattle.id);
      if (updated) setActiveBattle(updated);
    }
  }, [initData, activeBattle]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (battle: BattleState) => {
      setActiveBattle((prev) => (prev?.id === battle.id ? battle : prev));
      load().catch(console.error);
    };
    const onChallenge = () => load().catch(console.error);
    socket.on("battle:update", onUpdate);
    socket.on("battle:challenge", onChallenge);
    return () => {
      socket.off("battle:update", onUpdate);
      socket.off("battle:challenge", onChallenge);
    };
  }, [socket, load]);

  useEffect(() => {
    if (activeBattle) socket?.emit("join:battle", activeBattle.id);
  }, [activeBattle, socket]);

  async function challenge() {
    if (!creatureId || !defenderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{ battle: BattleState }>("/api/battle/challenge", initData, {
        method: "POST",
        body: JSON.stringify({ defenderId, creatureId }),
      });
      setActiveBattle(res.battle);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function accept(battleId: number) {
    if (!creatureId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{ battle: BattleState }>(
        `/api/battle/${battleId}/accept`,
        initData,
        { method: "POST", body: JSON.stringify({ creatureId }) },
      );
      setActiveBattle(res.battle);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function turn(action: "attack" | "defend") {
    if (!activeBattle) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<{ battle: BattleState }>(
        `/api/battle/${activeBattle.id}/turn`,
        initData,
        { method: "POST", body: JSON.stringify({ action }) },
      );
      setActiveBattle(res.battle);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const isMyTurn =
    activeBattle?.status === "active" &&
    activeBattle.currentTurn === userId;

  return (
    <div className="mode-panel">
      <h2>🥊 Battle Arena</h2>
      <p>Turn-based PvP · победа +25💰</p>

      {!activeBattle && (
        <>
          <div className="form-block">
            <h3>Вызвать игрока</h3>
            <input
              placeholder="Telegram ID противника"
              value={defenderId}
              onChange={(e) => setDefenderId(e.target.value)}
            />
            <select
              value={creatureId}
              onChange={(e) => setCreatureId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Ваш боец</option>
              {profile.creatures.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.rarity})
                </option>
              ))}
            </select>
            <button type="button" className="primary-btn" onClick={challenge} disabled={loading}>
              Бросить вызов
            </button>
          </div>

          {data && data.pending.length > 0 && (
            <div className="form-block">
              <h3>Входящие вызовы</h3>
              {data.pending.map((b) => (
                <div key={b.id} className="battle-card">
                  <p>
                    {b.player1.name} → {b.creature1?.name ?? "?"}
                  </p>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setActiveBattle(b);
                      if (creatureId) accept(b.id);
                    }}
                    disabled={loading || !creatureId}
                  >
                    Принять
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeBattle && (
        <div className="battle-arena">
          <div className="battle-header">
            <span>{activeBattle.player1.name}</span>
            <span>vs</span>
            <span>{activeBattle.player2.name}</span>
          </div>

          <div className="battle-hp">
            <div>
              <small>{activeBattle.creature1?.name}</small>
              <div className="hp-bar">
                <div
                  className="hp-fill p1"
                  style={{
                    width: `${Math.max(0, (activeBattle.p1Hp / 150) * 100)}%`,
                  }}
                />
              </div>
              <span>{activeBattle.p1Hp} HP</span>
            </div>
            <div>
              <small>{activeBattle.creature2?.name ?? "ожидание..."}</small>
              <div className="hp-bar">
                <div
                  className="hp-fill p2"
                  style={{
                    width: `${Math.max(0, (activeBattle.p2Hp / 150) * 100)}%`,
                  }}
                />
              </div>
              <span>{activeBattle.p2Hp} HP</span>
            </div>
          </div>

          {activeBattle.status === "pending" && activeBattle.player2.id === userId && (
            <div className="form-block">
              <select
                value={creatureId}
                onChange={(e) => setCreatureId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Выберите бойца</option>
                {profile.creatures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-btn"
                onClick={() => accept(activeBattle.id)}
                disabled={loading || !creatureId}
              >
                Принять вызов
              </button>
            </div>
          )}

          {isMyTurn && (
            <div className="battle-actions">
              <button type="button" className="primary-btn" onClick={() => turn("attack")} disabled={loading}>
                ⚔️ Атака
              </button>
              <button type="button" className="secondary-btn" onClick={() => turn("defend")} disabled={loading}>
                🛡 Защита + контратака
              </button>
            </div>
          )}

          {activeBattle.status === "completed" && (
            <p className="win-banner">
              🏆 Победитель:{" "}
              {activeBattle.winnerId === activeBattle.player1.id
                ? activeBattle.player1.name
                : activeBattle.player2.name}
            </p>
          )}

          <ul className="battle-log">
            {activeBattle.log.slice(-6).map((l, i) => (
              <li key={i}>{l.text}</li>
            ))}
          </ul>

          <button type="button" className="link-btn" onClick={() => setActiveBattle(null)}>
            ← К списку боёв
          </button>
        </div>
      )}

      {data && data.leaderboard.length > 0 && (
        <>
          <h3>🏆 Рейтинг</h3>
          <ul className="guild-list">
            {data.leaderboard.map((e) => (
              <li key={e.userId}>
                {e.name} — {e.wins} побед
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
