interface Props {
  message?: string;
}

export function SplashScreen({ message = "Загрузка колонии..." }: Props) {
  return (
    <div className="splash">
      <div className="splash-orbit" aria-hidden />
      <div className="splash-core">🪐</div>
      <h1 className="splash-title">Space Colony</h1>
      <p className="splash-sub">{message}</p>
      <div className="splash-loader" aria-label="Загрузка" />
    </div>
  );
}
