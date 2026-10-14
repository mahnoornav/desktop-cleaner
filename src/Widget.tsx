import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Window } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
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
  const [count, setCount] = useState(0);
  const happyTimer = useRef<number | undefined>(undefined);

  // Effect 1: listen for files being dragged onto the widget
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
        emit("files-dropped", payload.paths);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Effect 2: listen for the queue size from the main window
  useEffect(() => {
    const unlistenPromise = listen<number>("queue-count", (event) => {
      setCount(event.payload);
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
      {count > 0 && <div className="badge">{count}</div>}
    </main>
  );
}

export default Widget;