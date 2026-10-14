import { useEffect, useState } from "react";
import { desktopDir } from "@tauri-apps/api/path";
import { planMoves } from "./plan";
import type { FileItem } from "./types";
import "./App.css";

interface Props {
  items: FileItem[];
  onBack: () => void;
}

function ReviewScreen({ items, onBack }: Props) {
  const [baseDir, setBaseDir] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    desktopDir().then(setBaseDir);
  }, []);

  if (baseDir === null) {
    return (
      <main className="app">
        <p className="sub">Loading...</p>
      </main>
    );
  }

  const plan = planMoves(items, baseDir);
  const clashes = plan.filter((m) => m.status === "name-clash").length;
  const toMove = plan.filter((m) => m.status === "ok").length;
  const canConfirm = clashes === 0 && toMove > 0;

  return (
    <main className="app">
      <h1>Review changes</h1>
      <p className="sub">
        Nothing has moved yet. Check the plan, then confirm.
      </p>

      <ul className="queue">
        {plan.map((move) => (
          <li key={move.item.path} className="row">
            <span className="name" title={move.item.path}>
              {move.item.name}
            </span>
            <span className="dest">Desktop / {move.item.category}</span>
            {move.status === "already-there" && (
              <span className="status">Already in place, skipped</span>
            )}
            {move.status === "name-clash" && (
              <span className="status warn">Name clash</span>
            )}
          </li>
        ))}
      </ul>

      {clashes > 0 && (
        <p className="warn-text">
          {clashes} file{clashes === 1 ? "" : "s"} would end up with the same
          name in the same folder. Go back and skip or change one so nothing
          gets overwritten.
        </p>
      )}
      {note && <p className="sub">{note}</p>}

      <div className="actions">
        <button className="secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="primary"
          disabled={!canConfirm}
          onClick={() =>
            setNote(
              "Moving files is built in the next milestone. Nothing was moved.",
            )
          }
        >
          Confirm {toMove} move{toMove === 1 ? "" : "s"}
        </button>
      </div>
    </main>
  );
}

export default ReviewScreen;