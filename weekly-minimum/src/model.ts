export type Goal = {
  id: string;
  name: string;
  target: number;
  unit: string;
  step: number;
  color: string;
  icon: string;
  archived: boolean;
};
export type Entry = {
  id: string;
  goalId: string;
  delta: number;
  note: string;
  at: string;
};
export type Week = { start: string; goals: Goal[]; entries: Entry[] };
export type Data = {
  version: 1;
  goals: Goal[];
  weeks: Record<string, Week>;
  settings: { startDay: number; theme: string; top: boolean; step: number };
};
export const id = () => crypto.randomUUID();
export function weekKey(date = new Date(), startDay = 1) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shift(key: string, days: number) {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + days);
  return weekKey(d, d.getDay());
}
export function fresh(): Data {
  return {
    version: 1,
    goals: [
      ["Paid Work", 25, "hours", "◈", "#708c79", 0.5],
      ["Side Project", 4, "hours", "✧", "#a08ac0", 0.5],
      ["Gym", 3, "sessions", "↗", "#cc9469", 1],
    ].map(([name, target, unit, icon, color, step]) => ({
      id: id(),
      name: name as string,
      target: target as number,
      unit: unit as string,
      icon: icon as string,
      color: color as string,
      step: step as number,
      archived: false,
    })),
    weeks: {},
    settings: { startDay: 1, theme: "system", top: false, step: 1 },
  };
}
export function ensureWeek(data: Data, key: string): Data {
  if (data.weeks[key]) return data;
  return {
    ...data,
    weeks: {
      ...data.weeks,
      [key]: {
        start: key,
        goals: data.goals.filter((g) => !g.archived).map((g) => ({ ...g })),
        entries: [],
      },
    },
  };
}
export const progress = (week: Week, goalId: string) =>
  Math.round(
    week.entries
      .filter((e) => e.goalId === goalId)
      .reduce((s, e) => s + e.delta, 0) * 1000000,
  ) / 1000000;
export const completion = (week: Week) =>
  week.goals.length
    ? (week.goals.reduce(
        (s, g) => s + Math.max(0, progress(week, g.id)) / g.target,
        0,
      ) /
        week.goals.length) *
      100
    : 0;
export function log(
  data: Data,
  key: string,
  goalId: string,
  delta: number,
  note = "",
): Data {
  if (!Number.isFinite(delta)) throw Error("Enter a finite amount.");
  const w = data.weeks[key];
  if (!w.goals.some((g) => g.id === goalId)) throw Error("Goal not found");
  if (progress(w, goalId) + delta < 0)
    throw Error("Progress cannot be below zero.");
  return {
    ...data,
    weeks: {
      ...data.weeks,
      [key]: {
        ...w,
        entries: [
          ...w.entries,
          { id: id(), goalId, delta, note, at: new Date().toISOString() },
        ],
      },
    },
  };
}
export function validate(value: unknown): Data {
  const d = value as Data;
  const goal = (g: Goal) =>
    g &&
    typeof g.id === "string" &&
    typeof g.name === "string" &&
    g.name.trim() &&
    Number.isFinite(g.target) &&
    g.target > 0 &&
    Number.isFinite(g.step) &&
    g.step > 0 &&
    typeof g.unit === "string" &&
    typeof g.icon === "string" &&
    /^#[0-9a-f]{6}$/i.test(g.color) &&
    typeof g.archived === "boolean";
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.goals) ||
    !d.goals.every(goal) ||
    new Set(d.goals.map((g) => g.id)).size !== d.goals.length ||
    !d.settings ||
    ![0, 1, 2, 3, 4, 5, 6].includes(d.settings.startDay) ||
    !["system", "light", "dark"].includes(d.settings.theme) ||
    typeof d.settings.top !== "boolean" ||
    !Number.isFinite(d.settings.step) ||
    d.settings.step <= 0 ||
    !d.weeks ||
    typeof d.weeks !== "object"
  )
    throw Error("Invalid Weekly Minimum backup.");
  for (const [k, w] of Object.entries(d.weeks)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(k) ||
      w.start !== k ||
      !Array.isArray(w.goals) ||
      !w.goals.every(goal) ||
      !Array.isArray(w.entries) ||
      new Set(w.goals.map((g) => g.id)).size !== w.goals.length
    )
      throw Error("Invalid weekly history.");
    for (const e of w.entries)
      if (
        typeof e.id !== "string" ||
        !w.goals.some((g) => g.id === e.goalId) ||
        !Number.isFinite(e.delta) ||
        typeof e.note !== "string" ||
        typeof e.at !== "string"
      )
        throw Error("Invalid progress entry.");
    for (const g of w.goals)
      if (progress(w, g.id) < 0) throw Error("Negative progress in backup.");
  }
  return d;
}
