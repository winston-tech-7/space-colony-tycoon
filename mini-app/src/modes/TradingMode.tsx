import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { GameArt, creatureArtKind } from "../components/GameArt";
import { rarityLabel } from "../lib/labels";
import type { MarketListing, Profile } from "../types";

interface Props {
  initData: string;
  profile: Profile;
  onRefresh: () => void;
}

export function TradingMode({ initData, profile, onRefresh }: Props) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [mine, setMine] = useState<MarketListing[]>([]);
  const [price, setPrice] = useState(25);
  const [creatureId, setCreatureId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sellable = profile.creatures;

  const load = useCallback(async () => {
    const [market, my] = await Promise.all([
      api<{ listings: MarketListing[] }>("/api/market", initData),
      api<{ listings: MarketListing[] }>("/api/market/mine", initData),
    ]);
    setListings(market.listings);
    setMine(my.listings);
  }, [initData]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

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
      setCreatureId("");
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

  async function cancel(listingId: number) {
    setLoading(true);
    setError("");
    try {
      await api(`/api/market/${listingId}`, initData, { method: "DELETE" });
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
      <div className="panel-head-art">
        <GameArt kind="market" size={52} />
        <div>
          <h2>Космический рынок</h2>
          <p className="muted">Покупка и продажа существ · 💰 {profile.credits} кредитов</p>
        </div>
      </div>

      <div className="form-block">
        <h3>Выставить на продажу</h3>
        <select
          value={creatureId}
          onChange={(e) => setCreatureId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Выберите существо</option>
          {sellable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({rarityLabel(c.rarity)})
            </option>
          ))}
        </select>
        {sellable.length === 0 && (
          <p className="muted">Нет свободных существ для продажи</p>
        )}
        <input
          type="number"
          value={price}
          min={1}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="Цена в кредитах"
        />
        <button
          type="button"
          className="primary-btn"
          onClick={listCreature}
          disabled={loading || !creatureId}
        >
          Выставить лот
        </button>
      </div>

      {mine.length > 0 && (
        <>
          <h3>Мои лоты</h3>
          <div className="market-list">
            {mine.map((l) => (
              <div key={l.id} className="market-card mine">
                <GameArt kind={creatureArtKind(l.creature.speciesId)} size={40} />
                <div>
                  <strong>{l.creature.name}</strong>
                  <small>{rarityLabel(l.creature.rarity)}</small>
                </div>
                <div className="market-actions">
                  <span>{l.priceCredits} 💰</span>
                  <button type="button" onClick={() => cancel(l.id)} disabled={loading}>
                    Снять
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Активные лоты</h3>
      <div className="market-list">
        {listings.map((l) => (
          <div key={l.id} className="market-card">
            <GameArt kind={creatureArtKind(l.creature.speciesId)} size={40} />
            <div>
              <strong>{l.creature.name}</strong>
              <small>
                {rarityLabel(l.creature.rarity)} · продавец {l.seller.firstName}
              </small>
            </div>
            <div className="market-actions">
              <span>{l.priceCredits} 💰</span>
              <button type="button" onClick={() => buy(l.id)} disabled={loading}>
                Купить
              </button>
            </div>
          </div>
        ))}
        {listings.length === 0 && <p className="muted">Пока нет лотов на рынке</p>}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
