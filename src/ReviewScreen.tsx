import { useEffect, useState } from "react";
import { desktopDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { planMoves } from "./plan";
import type { FileItem, MoveOutcome, ReportEntry } from "./types";
import "./App.css";

interface Props {
  items: FileItem[];
  onBack: () => void;
  onDone: (report: ReportEntry[]) => void;
}

function describe(outcome: MoveOutcome): string {
  switch (outcome.status) {
    case "moved":
      return `Moved to ${outcome.to}`;
    case "already-there":
      return "Already in the right folder";
    case "exists":
      return "A file with that name is already there, so nothing was changed";
    case "failed":
      return outcome.reason;
  }
}

function Group({
  title,
  entries,
}: {
  title: string;
  entries: ReportEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2 className="group">
        {title} ({entries.length})
      </h2>
      <ul className="queue">
        {entries.map((e) => (
          <li key={e.item.path} className="row">
            <span className="name" title={e.item.path}>
              {e.item.name}
            </span>
            <span className="status">{describe(e.outcome)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewScreen({ items, onBack, onDone }: Props) {
  const [baseDir, setBaseDir] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ReportEntry[] | null>(null);

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

  if (report) {
    const moved = report.filter((e) => e.outcome.status === "moved");
    const skipped = report.filter(
      (e) =>
        e.outcome.status === "already-there" || e.outcome.status === "exists",
    );
    const failed = report.filter((e) => e.outcome.status === "failed");
    return (
      <main className="app">
        <h1>All done</h1>
        <p className="sub">
          {moved.length} moved, {skipped.length} skipped, {failed.length}{" "}
          failed. Items that were skipped or failed stay in your queue.
        </p>
        <Group title="Moved" entries={moved} />
        <Group title="Skipped" entries={skipped} />
        <Group title="Failed" entries={failed} />
        <div className="actions">
          <button className="primary" onClick={() => onDone(report)}>
            Done
          </button>
        </div>
      </main>
    );
  }

  const plan = planMoves(items, baseDir);
  const clashes = plan.filter((m) => m.status === "name-clash").length;
  const toMove = plan.filter((m) => m.status === "ok").length;
  const canConfirm = clashes === 0 && toMove > 0 && !running;

  async function confirm() {
    setRunning(true);
    const entries: ReportEntry[] = [];
    for (const move of plan) {
      let outcome: MoveOutcome;
      if (move.status === "already-there") {
        outcome = { status: "already-there" };
      } else if (move.status === "name-clash") {
        outcome = { status: "failed", reason: "Name clash in this batch" };
      } else {
        try {
          outcome = await invoke<MoveOutcome>("move_item", {
            source: move.item.path,
            destFolder: move.destinationFolder,
          });
        } catch (e) {
          outcome = { status: "failed", reason: String(e) };
        }
      }
      entries.push({ item: move.item, outcome });
    }
    setReport(entries);
    setRunning(false);
  }

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

      <div className="actions">
        <button className="secondary" onClick={onBack} disabled={running}>
          Back
        </button>
        <button className="primary" disabled={!canConfirm} onClick={confirm}>
          {running
            ? "Moving..."
            : `Confirm ${toMove} move${toMove === 1 ? "" : "s"}`}
        </button>
      </div>
    </main>
  );
}

export default ReviewScreen;