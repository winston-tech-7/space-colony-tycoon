import type { Profile } from "../types";

interface Props {
  profile: Profile;
  userId: string;
}

export function SettingsScreen({ profile, userId }: Props) {
  const refLink = profile.referralCode
    ? `https://t.me/spacecolonyT_bot?start=${profile.referralCode}`
    : `https://t.me/spacecolonyT_bot?start=ref_${userId}`;

  return (
    <div className="screen settings-screen">
      <section className="panel-section profile-card">
        <div className="profile-avatar">🧑‍🚀</div>
        <h3>Командир колонии</h3>
        <p className="muted">ID: {userId}</p>
        <div className="stats-row">
          <div className="stat-tile"><span>🍽</span><strong>{profile.totalFeeds ?? 0}</strong><small>Кормлений</small></div>
          <div className="stat-tile"><span>🏅</span><strong>{profile.medals}</strong><small>Медали</small></div>
          <div className="stat-tile"><span>💎</span><strong>{profile.tokens}</strong><small>Токены</small></div>
        </div>
      </section>

      <section className="panel-section">
        <h3 className="section-title">Пригласить друга</h3>
        <p className="muted">Скрещивайте существ с друзьями и получайте бонусы.</p>
        <code className="ref-link">{refLink}</code>
      </section>

      <section className="panel-section">
        <h3 className="section-title">Сообщество</h3>
        <a className="link-btn block" href="https://t.me/spacecolonyT_bot" target="_blank" rel="noreferrer">
          📢 Канал колонии
        </a>
        <a className="link-btn block" href="https://space-colony-tycoon-production.up.railway.app" target="_blank" rel="noreferrer">
          📜 Условия использования
        </a>
      </section>
    </div>
  );
}
