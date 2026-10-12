import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Window } from "@tauri-apps/api/window";
import "./App.css";

async function openApp() {
  const win = await Window.getByLabel("app");
  if (win) {
    await win.show();
    await win.setFocus();
  }
}

function Widget() {
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
      <div className="hole" onClick={openApp} />
      {files.length > 0 && <div className="badge">{files.length}</div>}
    </main>
  );
}

export default Widget;