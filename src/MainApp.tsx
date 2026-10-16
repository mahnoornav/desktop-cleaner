import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { makeFileItem } from "./categorize";
import { parseQueue, serializeQueue } from "./queueStorage";
import {
  CATEGORIES,
  type Category,
  type FileItem,
  type PathKind,
  type ReportEntry,
} from "./types";
import ReviewScreen from "./ReviewScreen";
import "./App.css";

function MainApp() {
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [view, setView] = useState<"queue" | "review">("queue");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Hide instead of closing, so the widget can reopen this window
  useEffect(() => {
    const win = getCurrentWindow();
    const unlistenPromise = win.onCloseRequested((event) => {
      event.preventDefault();
      win.hide();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Load the saved queue once, when the app starts
  useEffect(() => {
    async function restore() {
      try {
        const json = await invoke<string | null>("load_queue");
        if (json) {
          const saved = parseQueue(json);
          const checked = await Promise.all(
            saved.map(async (item) => ({
              item,
              kind: await invoke<PathKind>("inspect_path", { path: item.path }),
            })),
          );
          const present = checked
            .filter((c) => c.kind === "file" || c.kind === "folder")
            .map((c) => c.item);
          const gone = saved.length - present.length;
          if (gone > 0) {
            setNotice(
              `${gone} item${gone === 1 ? "" : "s"} from last time no longer exist and ${gone === 1 ? "was" : "were"} removed.`,
            );
          }
          setQueue((prev) => {
            const known = new Set(prev.map((i) => i.path));
            return [...present.filter((i) => !known.has(i.path)), ...prev];
          });
        }
        setLoaded(true);
      } catch (e) {
        console.error("Could not load the saved queue:", e);
        setNotice(
          "The saved queue couldn't be loaded, so saving is turned off for this session.",
        );
      }
    }
    restore();
  }, []);

  // Save the queue whenever it changes, but only after loading has finished
  useEffect(() => {
    if (!loaded) return;
    invoke("save_queue", { json: serializeQueue(queue) }).catch((e) =>
      console.error("Could not save the queue:", e),
    );
  }, [queue, loaded]);

  // Collect files dropped on the widget
  useEffect(() => {
    const unlistenPromise = listen<string[]>("files-dropped", async (event) => {
      const results = await Promise.all(
        event.payload.map(async (path) => ({
          path,
          kind: await invoke<PathKind>("inspect_path", { path }),
        })),
      );

      const incoming: FileItem[] = [];
      let unreadable = 0;
      for (const { path, kind } of results) {
        if (kind === "file") {
          incoming.push({ ...makeFileItem(path), kind: "file" });
        } else if (kind === "folder") {
          incoming.push({
            ...makeFileItem(path),
            category: "Needs Review",
            kind: "folder",
          });
        } else {
          unreadable += 1;
        }
      }

      setNotice(
        unreadable > 0
          ? `${unreadable} item${unreadable === 1 ? "" : "s"} couldn't be read and ${unreadable === 1 ? "was" : "were"} skipped.`
          : "",
      );

      setQueue((prev) => {
        const known = new Set(prev.map((item) => item.path));
        const fresh = incoming.filter((item) => !known.has(item.path));
        return [...prev, ...fresh];
      });
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Tell the widget how many files are in the queue
  useEffect(() => {
    emit("queue-count", queue.length);
  }, [queue]);

  function changeCategory(path: string, category: Category) {
    setQueue((prev) =>
      prev.map((item) => (item.path === path ? { ...item, category } : item)),
    );
  }

  function skipItem(path: string) {
    setQueue((prev) => prev.filter((item) => item.path !== path));
  }

  function finishRun(report: ReportEntry[]) {
    const finished = new Set(
      report
        .filter(
          (e) =>
            e.outcome.status === "moved" ||
            e.outcome.status === "already-there",
        )
        .map((e) => e.item.path),
    );
    setQueue((prev) => prev.filter((item) => !finished.has(item.path)));
    setView("queue");
  }

  if (view === "review") {
    return (
      <ReviewScreen
        items={queue}
        onBack={() => setView("queue")}
        onDone={finishRun}
      />
    );
  }

  return (
    <main className="app">
      <h1>Collected files</h1>
      <p className="sub">
        {queue.length === 0
          ? "Nothing collected yet. Drop files on the widget."
          : `${queue.length} item${queue.length === 1 ? "" : "s"} waiting. Nothing moves until you confirm.`}
      </p>
      {notice && <p className="warn-text">{notice}</p>}
      <ul className="queue">
        {queue.map((item) => (
          <li key={item.path} className="row">
            <span className="name" title={item.path}>
              {item.name}
            </span>
            {item.kind === "folder" && <span className="tag">Folder</span>}
            <select
              className="cat"
              value={item.category}
              onChange={(e) =>
                changeCategory(item.path, e.target.value as Category)
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="skip" onClick={() => skipItem(item.path)}>
              Skip
            </button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button
          className="primary"
          disabled={queue.length === 0}
          onClick={() => setView("review")}
        >
          Review {queue.length} change{queue.length === 1 ? "" : "s"}
        </button>
      </div>
    </main>
  );
}

export default MainApp;