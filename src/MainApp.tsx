import { useEffect, useRef, useState } from "react";
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
import idleImg from "./assets/idle.png";
// Header character. When you have the star-free version, change this path.
import heroImg from "./assets/happy.png";
import "./App.css";

const CATEGORY_STYLE: Record<Category, { color: string; bg: string }> = {
  "School Documents": { color: "#ff7fb0", bg: "#ffe0ec" },
  "Screenshots & Images": { color: "#6fb4ee", bg: "#dff1ff" },
  "Code & Project Files": { color: "#5fcf98", bg: "#def7e8" },
  "Archives & Downloads": { color: "#f2b83d", bg: "#fff3cf" },
  "Needs Review": { color: "#a98cf2", bg: "#eee4ff" },
};

// Little stars scattered behind the whole window (x and y are percentages)
const STARS = [
  { x: 4, y: 6, size: 20, color: "#6bd8e0", delay: 0 },
  { x: 14, y: 30, size: 13, color: "#ffd76a", delay: 0.6 },
  { x: 24, y: 8, size: 15, color: "#dd40d4", delay: 1.2 },
  { x: 36, y: 22, size: 11, color: "#b8d964", delay: 0.3 },
  { x: 47, y: 4, size: 18, color: "#f76e6e", delay: 1.7 },
  { x: 58, y: 26, size: 12, color: "#7b9cf5", delay: 0.9 },
  { x: 68, y: 6, size: 14, color: "#ffd76a", delay: 2.1 },
  { x: 78, y: 28, size: 20, color: "#6bd8e0", delay: 0.4 },
  { x: 90, y: 8, size: 16, color: "#f5b06b", delay: 1.4 },
  { x: 96, y: 34, size: 11, color: "#dd40d4", delay: 1.9 },
  { x: 2, y: 55, size: 14, color: "#7b9cf5", delay: 1.1 },
  { x: 97, y: 60, size: 18, color: "#b8d964", delay: 0.2 },
  { x: 3, y: 82, size: 19, color: "#f76e6e", delay: 1.6 },
  { x: 94, y: 86, size: 13, color: "#ffd76a", delay: 0.8 },
  { x: 30, y: 94, size: 12, color: "#6bd8e0", delay: 2.3 },
  { x: 62, y: 92, size: 16, color: "#dd40d4", delay: 1.3 },
];

// A custom dropdown, because the built-in one can't be styled to look cute.
function CategoryPicker({
  value,
  onChange,
}: {
  value: Category;
  onChange: (c: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 240);
    const menuHeight = CATEGORIES.length * 42 + 20;
    const flipUp =
      r.bottom + menuHeight > window.innerHeight && r.top > menuHeight;
    setPos({
      width,
      left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)),
      top: flipUp ? r.top - menuHeight - 6 : r.bottom + 6,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const current = CATEGORY_STYLE[value];
  return (
    <>
      <button
        ref={btnRef}
        className="picker-btn"
        style={{ background: current.bg }}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="swatch" style={{ color: current.color }}>
          ★
        </span>
        <span className="picker-label">{value}</span>
        <span className="picker-caret">⌄</span>
      </button>
      {open && (
        <>
          <div className="picker-backdrop" onClick={() => setOpen(false)} />
          <ul
            className="picker-menu"
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {CATEGORIES.map((c) => (
              <li
                key={c}
                role="option"
                aria-selected={c === value}
                className={c === value ? "picker-opt on" : "picker-opt"}
                style={{ ["--opt" as string]: CATEGORY_STYLE[c].bg }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              >
                <span className="swatch" style={{ color: CATEGORY_STYLE[c].color }}>
                  ★
                </span>
                <span className="picker-label">{c}</span>
                {c === value && <span className="picker-star">★</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function MainApp() {
  const [queue, setQueue] = useState<FileItem[]>([]);
  // Paths the person has ticked. Only these go to the review screen.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"queue" | "review">("queue");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  // Bumps each time new files arrive, which replays the one-time spin
  const [spinKey, setSpinKey] = useState(0);
  const prevTotal = useRef(0);
  // Bumps whenever the selection changes, which spins the star on the bar
  const [barKey, setBarKey] = useState(0);
  const prevPicked = useRef(0);

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

  // Spin the character when new files arrive
  useEffect(() => {
    if (queue.length > prevTotal.current) setSpinKey((k) => k + 1);
    prevTotal.current = queue.length;
  }, [queue.length]);

  function changeCategory(path: string, category: Category) {
    setQueue((prev) =>
      prev.map((item) => (item.path === path ? { ...item, category } : item)),
    );
  }

  function skipItem(path: string) {
    setQueue((prev) => prev.filter((item) => item.path !== path));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const selectedItems = queue.filter((item) => selected.has(item.path));
  const allSelected = queue.length > 0 && selectedItems.length === queue.length;

  useEffect(() => {
    if (selectedItems.length !== prevPicked.current) setBarKey((k) => k + 1);
    prevPicked.current = selectedItems.length;
  }, [selectedItems.length]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(queue.map((i) => i.path)));
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
    setSelected((prev) => new Set([...prev].filter((p) => !finished.has(p))));
    setView("queue");
  }

  if (view === "review") {
    return (
      <ReviewScreen
        items={selectedItems}
        onBack={() => setView("queue")}
        onDone={finishRun}
      />
    );
  }

  const total = queue.length;
  const picked = selectedItems.length;
  const percent = total === 0 ? 0 : Math.round((picked / total) * 100);

  return (
    <main className="app">
      <div className="starfield" aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              fontSize: s.size,
              color: s.color,
              animationDelay: `${s.delay}s`,
            }}
          >
            ★
          </span>
        ))}
      </div>
      <header className="hero">
        <div className="hero-left">
          <p className="big">
            {total === 0
              ? "No files waiting"
              : `${total} file${total === 1 ? "" : "s"} waiting`}
          </p>
          <p className="tidbit">Nothing moves until you confirm</p>
        </div>
        <div className="hero-stage" aria-hidden="true">
          <div className={total > 0 ? "hop" : "sway"}>
            <img
              key={spinKey}
              className={spinKey > 0 ? "hero-char spin" : "hero-char"}
              src={total > 0 ? heroImg : idleImg}
              alt=""
              draggable={false}
            />
          </div>
        </div>
        <div className="progress">
          <p className="big pale">
            {picked} of {total} selected
          </p>
          <div
            className="bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={picked}
          >
            <div className="fill" style={{ width: `${percent}%` }} />
            {picked > 0 && (
              <span className="bar-star" style={{ left: `${percent}%` }}>
                <span
                  key={barKey}
                  className={barKey > 0 ? "bs spin" : "bs"}
                >
                  ★
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      {notice && <p className="warn-text">{notice}</p>}

      <div className="listhead">
        <h1>Collected files</h1>
        <button className="chipbtn" onClick={toggleAll} disabled={total === 0}>
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="scroll">
        {total === 0 ? (
          <p className="empty">Drop files on the widget to get started.</p>
        ) : (
          <ul className="queue">
            {queue.map((item) => {
              const on = selected.has(item.path);
              return (
                <li key={item.path} className="row">
                  <button
                    className={on ? "dot on" : "dot"}
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Select ${item.name}`}
                    onClick={() => toggle(item.path)}
                  />
                  <span
                    className="name clickable"
                    title={item.path}
                    onClick={() => toggle(item.path)}
                  >
                    {item.name}
                  </span>
                  {item.kind === "folder" && <span className="tag">Folder</span>}
                  <CategoryPicker
                    value={item.category}
                    onChange={(c) => changeCategory(item.path, c)}
                  />
                  <button className="skip" onClick={() => skipItem(item.path)}>
                    Skip
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="actions">
        <button
          className="primary"
          disabled={picked === 0}
          onClick={() => setView("review")}
        >
          Review {picked} change{picked === 1 ? "" : "s"}
        </button>
      </div>
    </main>
  );
}

export default MainApp;
