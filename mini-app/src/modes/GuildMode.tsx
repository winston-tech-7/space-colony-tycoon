import { useState } from "react";
import { api } from "../api/client";
import type { Profile } from "../types";

interface Guild {
  id: number;
  name: string;
  tag: string;
  memberCount: number;
  powerRating: number;
}

interface Props {
  initData: string;
  profile: Profile;
  onRefresh: () => void;
}

export function GuildMode({ initData, profile, onRefresh }: Props) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [joinTag, setJoinTag] = useState("");
  const [topGuilds, setTopGuilds] = useState<Guild[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const membership = profile.guildMemberships[0];
  const war = membership?.guild.warsAs1[0] ?? membership?.guild.warsAs2[0];

  async function loadTop() {
    const data = await api<{ guilds: Guild[] }>("/api/guild/top", initData);
    setTopGuilds(data.guilds);
  }

  async function createGuild() {
    setLoading(true);
    setError("");
    try {
      await api("/api/guild/create", initData, {
        method: "POST",
        body: JSON.stringify({ name, tag }),
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function joinGuild() {
    setLoading(true);
    setError("");
    try {
      await api("/api/guild/join", initData, {
        method: "POST",
        body: JSON.stringify({ tag: joinTag }),
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function startWar() {
    setLoading(true);
    setError("");
    try {
      await api("/api/guild/war", initData, { method: "POST" });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  if (membership) {
    const g = membership.guild;
    return (
      <div className="mode-panel">
        <h2>⚔️ [{g.tag}] {g.name}</h2>
        <p>👥 {g.memberCount}/50 · ⚡ Power {g.powerRating}</p>
        {war && (
          <div className="war-banner">
            🔥 Сезонная война: {war.guild1Score} vs {war.guild2Score}
          </div>
        )}
        <button type="button" className="primary-btn" onClick={startWar} disabled={loading}>
          Начать Guild War
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mode-panel">
      <h2>⚔️ Guild Wars</h2>
      <p>Альянсы 20–50 игроков. Еженедельные сезоны.</p>

      <div className="form-block">
        <h3>Создать гильдию</h3>
        <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Тег (ALPHA)" value={tag} onChange={(e) => setTag(e.target.value)} />
        <button type="button" className="primary-btn" onClick={createGuild} disabled={loading}>
          Создать
        </button>
      </div>

      <div className="form-block">
        <h3>Вступить</h3>
        <input placeholder="Тег гильдии" value={joinTag} onChange={(e) => setJoinTag(e.target.value)} />
        <button type="button" className="secondary-btn" onClick={joinGuild} disabled={loading}>
          Вступить
        </button>
      </div>

      <button type="button" className="link-btn" onClick={loadTop}>
        Топ гильдий
      </button>
      {topGuilds.length > 0 && (
        <ul className="guild-list">
          {topGuilds.map((g) => (
            <li key={g.id}>[{g.tag}] {g.name} · ⚡{g.powerRating}</li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
