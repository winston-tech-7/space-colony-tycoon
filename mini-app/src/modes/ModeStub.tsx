import { useEffect, useState } from "react";
import { api } from "../api/client";
import { MODE_LABELS } from "../lib/labels";
import type { GameModeId } from "../types";

interface Stub {
  message: string;
  phase: number;
}

interface Props {
  mode: GameModeId;
  initData: string;
}

export function ModeStub({ mode, initData }: Props) {
  const [stub, setStub] = useState<Stub | null>(null);

  useEffect(() => {
    api<Stub>(`/api/modes/${mode}/stub`, initData)
      .then(setStub)
      .catch(() => {});
  }, [mode, initData]);

  const label = MODE_LABELS[mode];

  return (
    <div className="mode-panel stub">
      <h2>🚧 {label?.title ?? "Скоро"}</h2>
      <p>{stub?.message ?? label?.subtitle ?? "Режим в разработке"}</p>
      <p className="muted">Обновление запланировано на фазу {stub?.phase ?? "?"}</p>
    </div>
  );
}
