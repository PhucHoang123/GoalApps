import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Data,
  Goal,
  completion,
  ensureWeek,
  fresh,
  id,
  log,
  progress,
  shift,
  validate,
  weekKey,
} from "./model";
const desktop = isTauri();
const read = async () => {
  const raw = desktop
    ? await invoke<string | null>("load_data")
    : localStorage.getItem("weekly-minimum");
  return raw ? validate(JSON.parse(raw)) : fresh();
};
let queue = Promise.resolve();
const write = (d: Data) => {
  const task = () =>
    desktop
      ? invoke<void>("save_data", { data: JSON.stringify(d) })
      : Promise.resolve(
          localStorage.setItem("weekly-minimum", JSON.stringify(d)),
        );
  queue = queue.catch(() => {}).then(task);
  return queue;
};
const fmt = (n: number) => Number(n.toFixed(2)).toString();
export default function App() {
  const [data, setData] = useState<Data | null>(null),
    [key, setKey] = useState(""),
    [tab, setTab] = useState("week"),
    [editor, setEditor] = useState<Goal | null>(null),
    [logging, setLogging] = useState<Goal | null>(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Loading…"),
    [undo, setUndo] = useState<Data | null>(null),
    [confirm, setConfirm] = useState<null | {
      text: string;
      action: () => void;
    }>(null);
  const latest = useRef<Data | null>(null);
  const commit = (next: Data, remember = true) => {
    if (remember) setUndo(latest.current);
    latest.current = next;
    setData(next);
    setSaved("Saving…");
    write(next)
      .then(() => {
        if (latest.current === next) setSaved("Saved on this device");
      })
      .catch((e) => {
        setSaved("Save failed");
        setError(String(e));
      });
  };
  useEffect(() => {
    read()
      .then((d) => {
        const k = weekKey(new Date(), d.settings.startDay);
        setKey(k);
        commit(ensureWeek(d, k), false);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const d = latest.current;
      if (!d) return;
      const k = weekKey(new Date(), d.settings.startDay);
      if (!d.weeks[k]) {
        commit(ensureWeek(d, k), false);
        setKey(k);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.settings.theme;
    if (desktop)
      getCurrentWindow()
        .setAlwaysOnTop(data.settings.top)
        .catch((e) => setError(String(e)));
  }, [data?.settings.theme, data?.settings.top]);
  const download = (content: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!data)
    return (
      <main>
        <h1>Weekly Minimum</h1>
        <p>{error || "Opening your week…"}</p>
      </main>
    );
  const current = weekKey(new Date(), data.settings.startDay),
    week = data.weeks[key],
    total = completion(week);
  const navigate = (k: string) => {
    commit(ensureWeek(data, k), false);
    setKey(k);
  };
  const update = (g: Goal, amount: number, note = "") => {
    try {
      commit(log(data, key, g.id, amount, note));
    } catch (e) {
      setError(String(e));
    }
  };
  const saveGoal = (g: Goal) => {
    const exists = data.goals.some((x) => x.id === g.id);
    const historical = key !== current;
    const next = {
      ...data,
      goals: historical
        ? data.goals
        : exists
          ? data.goals.map((x) => (x.id === g.id ? g : x))
          : [...data.goals, g],
      weeks: {
        ...data.weeks,
        [key]: {
          ...week,
          goals: week.goals.some((x) => x.id === g.id)
            ? week.goals.map((x) => (x.id === g.id ? g : x))
            : [...week.goals, g],
        },
      },
    };
    commit(next);
    setEditor(null);
  };
  const reorder = (gid: string, dir: number) => {
    const list = [...week.goals],
      i = list.findIndex((g) => g.id === gid),
      j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit({
      ...data,
      goals:
        key === current
          ? [...list, ...data.goals.filter((g) => g.archived)]
          : data.goals,
      weeks: { ...data.weeks, [key]: { ...week, goals: list } },
    });
  };
  return (
    <main>
      <header>
        <div className="brand">
          <span className="logo">w.</span>
          <div>
            <strong>Weekly Minimum</strong>
            <small>CONSISTENCY WITHOUT RIGIDITY</small>
          </div>
        </div>
        <button
          className={data.settings.top ? "active" : ""}
          title="Always on top"
          onClick={() =>
            commit({
              ...data,
              settings: { ...data.settings, top: !data.settings.top },
            })
          }
        >
          ⌖ <span>Pin</span>
        </button>
      </header>
      <nav>
        {[
          ["week", "Your week"],
          ["history", "History"],
          ["settings", "Settings"],
        ].map(([v, label]) => (
          <button
            key={v}
            className={tab === v ? "selected" : ""}
            onClick={() => setTab(v)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {tab === "week" && (
        <>
          <section className="heading">
            <div>
              <div className="eyebrow">
                {key === current
                  ? "A LITTLE, EACH WEEK"
                  : "PAST WEEK · EDITABLE"}
              </div>
              <h1>Make room for what matters.</h1>
              <p>Your minimums. Your rhythm. Plenty of room for life.</p>
            </div>
          </section>
          <div className="weeknav">
            <div>
              <button
                aria-label="Previous week"
                onClick={() => navigate(shift(key, -7))}
              >
                ‹
              </button>
              <strong>
                {new Date(key + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(shift(key, 6) + "T12:00:00").toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </strong>
              <button
                aria-label="Next week"
                disabled={key >= current}
                onClick={() => navigate(shift(key, 7))}
              >
                ›
              </button>
            </div>
            <button onClick={() => navigate(current)}>
              {key === current ? "This week" : "Back to this week"}
            </button>
          </div>
          <section className="overview">
            <div>
              <span className="eyebrow">WEEKLY PROGRESS</span>
              <h2>
                {fmt(total)}
                <span>%</span>
              </h2>
              <p>
                {
                  week.goals.filter((g) => progress(week, g.id) >= g.target)
                    .length
                }{" "}
                of {week.goals.length} minimums met
              </p>
            </div>
            <div className="overview-right">
              <p>
                {total >= 100
                  ? "Your minimums are met. Enjoy the breathing room."
                  : "Small steps count. There’s no daily quota."}
              </p>
              <div className="bar">
                <i style={{ width: `${Math.min(total, 100)}%` }} />
              </div>
            </div>
          </section>
          <div className="section-title">
            <h3>
              Your weekly minimums <span>{week.goals.length}</span>
            </h3>
            <button
              onClick={() =>
                setEditor({
                  id: id(),
                  name: "",
                  target: 1,
                  unit: "sessions",
                  step: data.settings.step,
                  color: "#708c79",
                  icon: "✧",
                  archived: false,
                })
              }
            >
              ＋ Add goal
            </button>
          </div>
          <div className="cards">
            {week.goals.map((g, i) => {
              const p = progress(week, g.id),
                pct = (p / g.target) * 100;
              return (
                <article
                  className="card"
                  key={g.id}
                  style={{ "--accent": g.color } as React.CSSProperties}
                >
                  <div className="card-top">
                    <span className="icon">{g.icon}</span>
                    <div>
                      <h3>{g.name}</h3>
                      <small>
                        {fmt(g.target)} {g.unit} / week
                      </small>
                    </div>
                    <button
                      aria-label={`Edit ${g.name}`}
                      onClick={() => setEditor({ ...g })}
                    >
                      ···
                    </button>
                  </div>
                  <div className="amount">
                    <button
                      className="exact"
                      onClick={() => setLogging(g)}
                      aria-label={`Log ${g.name}`}
                    >
                      {fmt(p)}
                    </button>
                    <span>
                      {" "}
                      / {fmt(g.target)} {g.unit}
                    </span>
                    <small>{fmt(pct)}%</small>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="card-bottom">
                    <span>
                      {pct >= 100
                        ? "Minimum met ✓"
                        : `${fmt(Math.max(0, g.target - p))} ${g.unit} to your minimum`}
                    </span>
                    <button
                      aria-label={`Move ${g.name} up`}
                      disabled={i === 0}
                      onClick={() => reorder(g.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${g.name} down`}
                      disabled={i === week.goals.length - 1}
                      onClick={() => reorder(g.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      aria-label={`Decrease ${g.name}`}
                      disabled={p === 0}
                      onClick={() => update(g, -Math.min(p, g.step))}
                    >
                      −
                    </button>
                    <button
                      className="plus"
                      aria-label={`Increase ${g.name}`}
                      onClick={() => update(g, g.step)}
                    >
                      ＋
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!week.goals.length && (
            <p className="empty">
              A little space to begin. Add a minimum that fits your life.
            </p>
          )}
          <p className="philosophy">
            A minimum is a foundation, not a ceiling.
          </p>
          <details>
            <summary>Recent entries & notes</summary>
            {[...week.entries]
              .reverse()
              .slice(0, 30)
              .map((e) => (
                <div className="entry" key={e.id}>
                  <span>
                    {week.goals.find((g) => g.id === e.goalId)?.name} ·{" "}
                    {e.delta > 0 ? "+" : ""}
                    {fmt(e.delta)}
                    <small>{e.note}</small>
                  </span>
                  <small>{new Date(e.at).toLocaleString()}</small>
                </div>
              ))}
          </details>
        </>
      )}
      {tab === "history" && (
        <>
          <h1>A wider view.</h1>
          <p>Every week has its own rhythm. Here’s yours.</p>
          <div className="history">
            {Object.keys(data.weeks)
              .sort()
              .reverse()
              .map((k) => {
                const w = data.weeks[k];
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setKey(k);
                      setTab("week");
                    }}
                  >
                    <strong>{k}</strong>
                    <div className="bar">
                      <i
                        style={{ width: `${Math.min(completion(w), 100)}%` }}
                      />
                    </div>
                    <span>{fmt(completion(w))}%</span>
                    <small>
                      {w.goals
                        .map(
                          (g) =>
                            `${g.name}: ${fmt(progress(w, g.id))}/${g.target} ${g.unit}`,
                        )
                        .join(" · ")}
                    </small>
                  </button>
                );
              })}
          </div>
        </>
      )}
      {tab === "settings" && (
        <>
          <h1>Make it yours.</h1>
          <p>A few preferences, a little more breathing room.</p>
          <section className="settings">
            <label>
              Appearance
              <select
                value={data.settings.theme}
                onChange={(e) =>
                  commit({
                    ...data,
                    settings: { ...data.settings, theme: e.target.value },
                  })
                }
              >
                {["system", "light", "dark"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Week starts on
              <select
                value={data.settings.startDay}
                onChange={(e) => {
                  const day = +e.target.value;
                  setConfirm({
                    text: "Change the week boundary? Existing weeks stay intact; new periods use the new start day and can overlap old periods.",
                    action: () => {
                      const d = {
                        ...data,
                        settings: { ...data.settings, startDay: day },
                      };
                      const k = weekKey(new Date(), day);
                      commit(ensureWeek(d, k));
                      setKey(k);
                    },
                  });
                }}
              >
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((d, i) => (
                  <option value={i} key={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Default increment for new goals
              <input
                type="number"
                min="0.01"
                step="any"
                value={data.settings.step}
                onChange={(e) => {
                  const n = +e.target.value;
                  if (n > 0 && Number.isFinite(n))
                    commit({
                      ...data,
                      settings: { ...data.settings, step: n },
                    });
                }}
              />
            </label>
            <label>
              Always on top
              <input
                type="checkbox"
                checked={data.settings.top}
                onChange={(e) =>
                  commit({
                    ...data,
                    settings: { ...data.settings, top: e.target.checked },
                  })
                }
              />
            </label>
            {!desktop && (
              <small>
                Browser preview: pinning takes effect in the desktop app.
              </small>
            )}
          </section>
          <h3>Goals</h3>
          <p>
            Use each card’s ··· menu to edit. Archive or delete retires a goal
            from future weeks and preserves this week and all historical
            records.
          </p>
          {data.goals
            .filter((g) => g.archived)
            .map((g) => (
              <div className="entry" key={g.id}>
                {g.icon} {g.name}
                <button
                  onClick={() => {
                    let d = {
                      ...data,
                      goals: data.goals.map((x) =>
                        x.id === g.id ? { ...x, archived: false } : x,
                      ),
                    };
                    d = ensureWeek(d, current);
                    if (!d.weeks[current].goals.some((x) => x.id === g.id))
                      d = {
                        ...d,
                        weeks: {
                          ...d.weeks,
                          [current]: {
                            ...d.weeks[current],
                            goals: [
                              ...d.weeks[current].goals,
                              { ...g, archived: false },
                            ],
                          },
                        },
                      };
                    commit(d);
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          <h3>Your data stays yours</h3>
          <div className="actions">
            <button
              onClick={() =>
                download(
                  JSON.stringify(data, null, 2),
                  "weekly-minimum-backup.json",
                  "application/json",
                )
              }
            >
              Export JSON backup
            </button>
            <button
              onClick={() => {
                const rows = [
                  ["week", "goal", "progress", "target", "unit"],
                  ...Object.values(data.weeks).flatMap((w) =>
                    w.goals.map((g) => [
                      w.start,
                      g.name,
                      progress(w, g.id),
                      g.target,
                      g.unit,
                    ]),
                  ),
                ];
                download(
                  rows
                    .map((r) =>
                      r
                        .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
                        .join(","),
                    )
                    .join("\r\n"),
                  "weekly-minimum.csv",
                  "text/csv",
                );
              }}
            >
              Export CSV
            </button>
            <label className="button">
              Import JSON
              <input
                hidden
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const imported = validate(JSON.parse(await file.text()));
                    setConfirm({
                      text: "Replace local data with this backup? Export your current data first if you want to keep it.",
                      action: () => {
                        const k = weekKey(
                          new Date(),
                          imported.settings.startDay,
                        );
                        commit(ensureWeek(imported, k));
                        setKey(k);
                      },
                    });
                  } catch (err) {
                    setError(String(err));
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </>
      )}
      <footer>
        <span className="saved">● {saved}</span>
        {undo && (
          <button
            onClick={() => {
              commit(undo, false);
              setUndo(null);
            }}
          >
            ↶ Undo last change
          </button>
        )}
        <span>One week at a time.</span>
      </footer>
      {editor && (
        <div className="overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              saveGoal({
                ...editor,
                name: editor.name.trim(),
                unit: editor.unit.trim(),
              });
            }}
          >
            <h2>
              {week.goals.some((g) => g.id === editor.id)
                ? "Adjust your minimum"
                : "A new minimum"}
            </h2>
            <p>
              {key === current
                ? "Changes apply to this week and future weeks."
                : "Changes apply only to this historical week."}
            </p>
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={80}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            <div className="formgrid">
              <label>
                Weekly target
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  value={editor.target}
                  onChange={(e) =>
                    setEditor({ ...editor, target: +e.target.value })
                  }
                />
              </label>
              <label>
                Unit
                <input
                  required
                  list="units"
                  maxLength={30}
                  value={editor.unit}
                  onChange={(e) =>
                    setEditor({ ...editor, unit: e.target.value })
                  }
                />
                <datalist id="units">
                  {["hours", "sessions", "tasks", "minutes"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </datalist>
              </label>
              <label>
                Increment
                <input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  value={editor.step}
                  onChange={(e) =>
                    setEditor({ ...editor, step: +e.target.value })
                  }
                />
              </label>
              <label>
                Color
                <input
                  type="color"
                  value={editor.color}
                  onChange={(e) =>
                    setEditor({ ...editor, color: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Icon
              <select
                value={editor.icon}
                onChange={(e) => setEditor({ ...editor, icon: e.target.value })}
              >
                {["◈", "✧", "↗", "☀", "☕", "♡", "♫", "⌘", "✿", "◎"].map(
                  (i) => (
                    <option key={i}>{i}</option>
                  ),
                )}
              </select>
            </label>
            {week.goals.some((g) => g.id === editor.id) && (
              <div className="actions">
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      text: "Reset this goal’s progress for the selected week? Other weeks stay intact.",
                      action: () => {
                        update(
                          editor,
                          -progress(week, editor.id),
                          "Progress reset",
                        );
                        setEditor(null);
                      },
                    })
                  }
                >
                  Reset progress
                </button>
                {key === current &&
                  ["Archive", "Delete"].map((action) => (
                    <button
                      type="button"
                      key={action}
                      onClick={() =>
                        setConfirm({
                          text: `${action} ${editor.name} from future weeks? The selected week's card and all historical records remain available. You can restore it in Settings.`,
                          action: () => {
                            commit({
                              ...data,
                              goals: data.goals.map((g) =>
                                g.id === editor.id
                                  ? { ...g, archived: true }
                                  : g,
                              ),
                            });
                            setEditor(null);
                          },
                        })
                      }
                    >
                      {action}
                    </button>
                  ))}
              </div>
            )}
            <div className="actions end">
              <button type="button" onClick={() => setEditor(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Save goal
              </button>
            </div>
          </form>
        </div>
      )}
      {logging && (
        <LogModal
          goal={logging}
          amount={progress(week, logging.id)}
          close={() => setLogging(null)}
          save={(amount, note) => {
            update(logging, amount - progress(week, logging.id), note);
            setLogging(null);
          }}
        />
      )}
      {confirm && (
        <div className="overlay">
          <div className="modal" role="alertdialog" aria-modal="true">
            <h2>Just checking.</h2>
            <p>{confirm.text}</p>
            <div className="actions end">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function LogModal({
  goal,
  amount,
  close,
  save,
}: {
  goal: Goal;
  amount: number;
  close: () => void;
  save: (amount: number, note: string) => void;
}) {
  const [n, setN] = useState(amount),
    [note, setNote] = useState("");
  return (
    <div className="overlay">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          save(n, note);
        }}
      >
        <h2>Log {goal.name}</h2>
        <p>Enter your total for this week. No timer needed.</p>
        <label>
          Total {goal.unit}
          <input
            autoFocus
            required
            type="number"
            min="0"
            step="any"
            value={n}
            onChange={(e) => setN(+e.target.value)}
          />
        </label>
        <label>
          A short note (optional)
          <input
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="actions end">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save progress</button>
        </div>
      </form>
    </div>
  );
}
