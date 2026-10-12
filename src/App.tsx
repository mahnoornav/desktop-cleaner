import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import "./App.css";

function App() {
  const [isOver, setIsOver] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setIsOver(true);
      } else if (payload.type === "leave") {
        setIsOver(false);
      } else if (payload.type === "drop") {
        setIsOver(false);
        console.log("Dropped:", payload.paths);
        setFiles((prev) => [...prev, ...payload.paths]);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <main
      className={isOver ? "widget over" : "widget"}
      data-tauri-drag-region
    >
      <div className="hole" />
      {files.length > 0 && <div className="badge">{files.length}</div>}
    </main>
  );
}

export default App;