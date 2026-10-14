import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Window } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import idleImg from "./assets/idle.png";
import openMouthImg from "./assets/open-mouth.png";
import happyImg from "./assets/happy.png";
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
  const [pop, setPop] = useState(false);
  const [happy, setHappy] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const happyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Load the other frames early so there is no flicker
    new Image().src = openMouthImg;
    new Image().src = happyImg;

    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setIsOver(true);
      } else if (payload.type === "leave") {
        setIsOver(false);
      } else if (payload.type === "drop") {
        setIsOver(false);
        setPop(true);
        setTimeout(() => setPop(false), 350);
        setHappy(true);
        window.clearTimeout(happyTimer.current);
        happyTimer.current = window.setTimeout(() => setHappy(false), 1500);
        setFiles((prev) => [...prev, ...payload.paths]);
        emit("files-dropped", payload.paths);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const frame = isOver ? openMouthImg : happy ? happyImg : idleImg;

  return (
    <main
      className={isOver ? "widget over" : "widget"}
      data-tauri-drag-region
    >
      <img
        className={pop ? "char pop" : "char"}
        src={frame}
        alt="Kirby"
        draggable={false}
        onClick={openApp}
      />
      {files.length > 0 && <div className="badge">{files.length}</div>}
    </main>
  );
}

export default Widget;