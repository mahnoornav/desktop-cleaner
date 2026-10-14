import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { makeFileItem } from "./categorize";
import { CATEGORIES, type Category, type FileItem } from "./types";
import ReviewScreen from "./ReviewScreen";
import "./App.css";

function MainApp() {
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [view, setView] = useState<"queue" | "review">("queue");

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
    const unlistenPromise = listen<string[]>("files-dropped", (event) => {
      setQueue((prev) => {
        const known = new Set(prev.map((item) => item.path));
        const fresh = event.payload
          .filter((path) => !known.has(path))
          .map(makeFileItem);
        return [...prev, ...fresh];
      });
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

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
          : `${queue.length} file${queue.length === 1 ? "" : "s"} waiting. Nothing moves until you confirm.`}
      </p>
      <ul className="queue">
        {queue.map((item) => (
          <li key={item.path} className="row">
            <span className="name" title={item.path}>
              {item.name}
            </span>
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