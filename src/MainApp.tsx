import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { makeFileItem } from "./categorize";
import type { FileItem } from "./types";
import "./App.css";

function MainApp() {
  const [queue, setQueue] = useState<FileItem[]>([]);

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
            <span className="name">{item.name}</span>
            <span className="pill">{item.category}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default MainApp;