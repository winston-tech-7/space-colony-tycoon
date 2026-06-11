import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { GameModeId } from "../types";

interface Stub {
  message: string;
  integrationHint: string;
  phase: number;
}

interface Props {
  mode: GameModeId;
  initData: string;
}

export function ModeStub({ mode, initData }: Props) {
  const [stub, setStub] = useState<Stub | null>(null);

  useEffect(() => {
    api<Stub>(`/api/modes/${mode}/stub`, initData).then(setStub).catch(console.error);
  }, [mode, initData]);

  return (
    <div className="mode-panel stub">
      <h2>🚧 Скоро</h2>
      <p>{stub?.message ?? "Режим в разработке"}</p>
      <div className="hint-box">
        <strong>Как добавить модуль:</strong>
        <code>{stub?.integrationHint}</code>
      </div>
      <span className="phase-badge">Phase {stub?.phase ?? "?"}</span>
    </div>
  );
}
