import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { MarketListing, Profile } from "../types";

interface Props {
  initData: string;
  profile: Profile;
  onRefresh: () => void;
}

export function TradingMode({ initData, profile, onRefresh }: Props) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [price, setPrice] = useState(25);
  const [creatureId, setCreatureId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api<{ listings: MarketListing[] }>("/api/market", initData);
    setListings(data.listings);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function listCreature() {
    if (!creatureId) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/market/list", initData, {
        method: "POST",
        body: JSON.stringify({ creatureId, priceCredits: price }),
      });
      onRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function buy(listingId: number) {
    setLoading(true);
    setError("");
    try {
      await api("/api/market/buy", initData, {
        method: "POST",
        body: JSON.stringify({ listingId }),
      });
      onRefresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mode-panel">
      <h2>🏪 Trading Hub</h2>
      <p>P2P маркетплейс существ · 💰 {profile.credits} кредитов</p>

      <div className="form-block">
        <h3>Выставить на продажу</h3>
        <select
          value={creatureId}
          onChange={(e) => setCreatureId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Выберите существо</option>
          {profile.creatures.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.rarity})
            </option>
          ))}
        </select>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="Цена в кредитах"
        />
        <button type="button" className="primary-btn" onClick={listCreature} disabled={loading}>
          Создать листинг
        </button>
      </div>

      <h3>Активные лоты</h3>
      <div className="market-list">
        {listings.map((l) => (
          <div key={l.id} className="market-card">
            <div>
              <strong>{l.creature.name}</strong>
              <small> {l.creature.rarity} · от {l.seller.firstName}</small>
            </div>
            <div className="market-actions">
              <span>{l.priceCredits}💰</span>
              <button type="button" onClick={() => buy(l.id)} disabled={loading}>
                Купить
              </button>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="muted">Пока нет листингов</p>}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
