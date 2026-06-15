interface Props {
  credits: number;
  medals: number;
  tokens: number;
  energy?: number;
  connected: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU");
}

export function CurrencyBar({ credits, medals, tokens, energy, connected }: Props) {
  return (
    <div className="currency-bar">
      <div className="currency-pill accent">
        <span className="currency-icon">💰</span>
        <span className="currency-value">{fmt(credits)}</span>
      </div>
      <div className="currency-pill medal">
        <span className="currency-icon">🏅</span>
        <span className="currency-value">{fmt(medals)}</span>
      </div>
      <div className="currency-pill token">
        <span className="currency-icon">💎</span>
        <span className="currency-value">{fmt(tokens)}</span>
      </div>
      {energy !== undefined && (
        <div className="currency-pill">
          <span className="currency-icon">⚡</span>
          <span className="currency-value">{fmt(energy)}</span>
        </div>
      )}
      <div className={`live-badge ${connected ? "on" : ""}`}>
        {connected ? "Live" : "Offline"}
      </div>
    </div>
  );
}
