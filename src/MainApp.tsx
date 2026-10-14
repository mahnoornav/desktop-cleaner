import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { makeFileItem } from "./categorize";
import {
  CATEGORIES,
  type Category,
  type FileItem,
  type PathKind,
} from "./types";
import ReviewScreen from "./ReviewScreen";
import "./App.css";

function MainApp() {
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [view, setView] = useState<"queue" | "review">("queue");
  const [notice, setNotice] = useState("");

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

  useEffect(() => {
    const unlistenPromise = listen<string[]>("files-dropped", async (event) => {
      // Ask Rust what each dropped item really is
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
            category: "Other / Needs Review",
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

  if (view === "review") {
    return <ReviewScreen items={queue} onBack={() => setView("queue")} />;
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