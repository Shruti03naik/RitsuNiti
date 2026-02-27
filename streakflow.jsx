import { useState, useEffect, useCallback } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const BADGE_DEFS = [
  { id: "first_task",    icon: "🌱", name: "First Step",      desc: "Complete your very first task",          check: (s) => s.totalDone >= 1 },
  { id: "five_tasks",   icon: "⚡", name: "Getting Warmed Up", desc: "Complete 5 tasks total",               check: (s) => s.totalDone >= 5 },
  { id: "ten_tasks",    icon: "🔥", name: "On Fire",          desc: "Complete 10 tasks total",               check: (s) => s.totalDone >= 10 },
  { id: "fifty_tasks",  icon: "💎", name: "Diamond Grinder",  desc: "Complete 50 tasks total",               check: (s) => s.totalDone >= 50 },
  { id: "streak3",      icon: "📅", name: "3-Day Warrior",    desc: "Maintain a 3-day streak",               check: (s) => s.streak >= 3 },
  { id: "streak7",      icon: "🌟", name: "Week Champion",    desc: "Maintain a 7-day streak",               check: (s) => s.streak >= 7 },
  { id: "streak30",     icon: "👑", name: "Streak Royalty",   desc: "Maintain a 30-day streak",              check: (s) => s.streak >= 30 },
  { id: "early_bird",   icon: "🌅", name: "Early Bird",       desc: "Add a task before 8 AM",                check: (s) => s.earlyBird },
  { id: "night_owl",    icon: "🦉", name: "Night Owl",        desc: "Complete a task after 10 PM",           check: (s) => s.nightOwl },
  { id: "perfectday",   icon: "✨", name: "Perfect Day",      desc: "Complete all tasks in a day",           check: (s) => s.hadPerfectDay },
  { id: "multitag",     icon: "🎯", name: "Multi-Tasker",     desc: "Use 3 different categories",            check: (s) => s.uniqueCategories >= 3 },
  { id: "highprio",     icon: "🚀", name: "Priority Pro",     desc: "Complete 5 high-priority tasks",        check: (s) => s.highPrioDone >= 5 },
];

const CATS = [
  { label: "Study",    color: "#4ade80", bg: "#052e16" },
  { label: "Work",     color: "#60a5fa", bg: "#0c1a2e" },
  { label: "Personal", color: "#f472b6", bg: "#2d0b1f" },
  { label: "Health",   color: "#fb923c", bg: "#2c1000" },
  { label: "Other",    color: "#a78bfa", bg: "#150d2e" },
];

const PRIOS = [
  { label: "High",   color: "#f87171" },
  { label: "Medium", color: "#fbbf24" },
  { label: "Low",    color: "#6ee7b7" },
];

const catOf   = (l) => CATS.find((c) => c.label === l) || CATS[4];
const prioOf  = (l) => PRIOS.find((p) => p.label === l) || PRIOS[1];

// ── default state ─────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  tasks: [],
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  totalDone: 0,
  earnedBadges: [],
  earlyBird: false,
  nightOwl: false,
  hadPerfectDay: false,
  uniqueCategories: 0,
  highPrioDone: 0,
  usedCategories: [],
  history: [], // { date, count }
};

// ── storage helpers ───────────────────────────────────────────────────────────
async function loadState() {
  try {
    const r = await window.storage.get("ritsuniti_state");
    return r ? JSON.parse(r.value) : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}
async function saveState(s) {
  try { await window.storage.set("ritsuniti_state", JSON.stringify(s)); } catch {}
}

// ── main component ─────────────────────────────────────────────────────────────
export default function StreakFlow() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("tasks"); // tasks | badges | history
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", category: "Study", priority: "Medium", due: today() });
  const [newBadge, setNewBadge] = useState(null);
  const [filter, setFilter] = useState("All");
  const [saving, setSaving] = useState(false);

  // load on mount
  useEffect(() => {
    loadState().then((s) => setState(s));
  }, []);

  // persist whenever state changes
  useEffect(() => {
    if (!state) return;
    setSaving(true);
    saveState(state).finally(() => setSaving(false));
  }, [state]);

  // ── streak updater ───────────────────────────────────────────────────────────
  const updateStreak = useCallback((s, completedToday) => {
    const todayStr = today();
    let { streak, longestStreak, lastActiveDate, history } = s;
    if (!completedToday) return s;

    if (lastActiveDate === todayStr) return s; // already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];

    streak = (lastActiveDate === yStr) ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    lastActiveDate = todayStr;

    // update history
    const hist = [...(history || [])];
    const idx = hist.findIndex((h) => h.date === todayStr);
    if (idx === -1) hist.push({ date: todayStr, count: 1 });
    else hist[idx].count += 1;

    return { ...s, streak, longestStreak, lastActiveDate, history: hist };
  }, []);

  // ── badge checker ────────────────────────────────────────────────────────────
  const checkBadges = useCallback((s) => {
    const earned = [...(s.earnedBadges || [])];
    let justEarned = null;
    for (const b of BADGE_DEFS) {
      if (!earned.includes(b.id) && b.check(s)) {
        earned.push(b.id);
        justEarned = b;
      }
    }
    return { updated: { ...s, earnedBadges: earned }, justEarned };
  }, []);

  // ── add task ─────────────────────────────────────────────────────────────────
  const addTask = () => {
    if (!newTask.title.trim()) return;
    const hour = new Date().getHours();
    const task = {
      id: Date.now(),
      ...newTask,
      done: false,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => {
      let s = { ...prev, tasks: [...prev.tasks, task] };
      if (hour < 8) s = { ...s, earlyBird: true };
      const cats = [...new Set([...(s.usedCategories || []), task.category])];
      s.uniqueCategories = cats.length;
      s.usedCategories = cats;
      const { updated, justEarned } = checkBadges(s);
      if (justEarned) setTimeout(() => { setNewBadge(justEarned); setTimeout(() => setNewBadge(null), 3000); }, 100);
      return updated;
    });
    setNewTask({ title: "", category: "Study", priority: "Medium", due: today() });
    setShowForm(false);
  };

  // ── toggle done ──────────────────────────────────────────────────────────────
  const toggleDone = (id) => {
    setState((prev) => {
      const tasks = prev.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t
      );
      const task = tasks.find((t) => t.id === id);
      let s = { ...prev, tasks };

      if (task.done) {
        // completing
        const hour = new Date().getHours();
        s.totalDone = (s.totalDone || 0) + 1;
        if (hour >= 22) s.nightOwl = true;
        if (task.priority === "High") s.highPrioDone = (s.highPrioDone || 0) + 1;

        // check perfect day
        const todayTasks = tasks.filter((t) => t.due === today());
        if (todayTasks.length > 0 && todayTasks.every((t) => t.done)) s.hadPerfectDay = true;

        s = updateStreak(s, true);
      } else {
        // un-completing
        s.totalDone = Math.max(0, (s.totalDone || 0) - 1);
        if (task.priority === "High") s.highPrioDone = Math.max(0, (s.highPrioDone || 0) - 1);
      }

      const { updated, justEarned } = checkBadges(s);
      if (justEarned) setTimeout(() => { setNewBadge(justEarned); setTimeout(() => setNewBadge(null), 3500); }, 100);
      return updated;
    });
  };

  // ── delete task ──────────────────────────────────────────────────────────────
  const deleteTask = (id) => setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));

  if (!state) return (
    <div style={{ minHeight: "100vh", background: "#060810", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", fontFamily: "monospace", fontSize: "18px" }}>
      Loading RitsuNiti...
    </div>
  );

  const todayTasks = state.tasks.filter((t) => t.due === today());
  const filteredTasks = filter === "All" ? state.tasks : state.tasks.filter((t) => t.category === filter);
  const doneTodayCount = todayTasks.filter((t) => t.done).length;
  const progress = todayTasks.length > 0 ? Math.round((doneTodayCount / todayTasks.length) * 100) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060810",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e2e8f0",
      position: "relative",
    }}>
      {/* bg glow */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-200px", left: "-200px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(74,222,128,0.05) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-200px", right: "-200px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)" }} />
      </div>

      {/* Badge toast */}
      {newBadge && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 1000,
          background: "linear-gradient(135deg, #1a2e1a, #0f2b0f)",
          border: "1.5px solid #4ade80",
          borderRadius: "16px", padding: "16px 22px",
          boxShadow: "0 0 40px rgba(74,222,128,0.3)",
          animation: "slideIn 0.4s ease",
          display: "flex", alignItems: "center", gap: "14px",
          minWidth: "260px",
        }}>
          <div style={{ fontSize: "36px" }}>{newBadge.icon}</div>
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#4ade80", textTransform: "uppercase", marginBottom: "3px" }}>Badge Unlocked!</div>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "#fff" }}>{newBadge.name}</div>
            <div style={{ fontSize: "12px", color: "#86efac" }}>{newBadge.desc}</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(120px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 20px 100px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "36px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
              <span style={{ fontSize: "11px", letterSpacing: "3px", color: "#4ade80", textTransform: "uppercase" }}>Productivity Tracker · RitsuNiti</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(32px, 6vw, 52px)", fontWeight: "800", letterSpacing: "-1.5px", color: "#fff", lineHeight: 1 }}>
              Ritsu<span style={{ color: "#4ade80" }}>Niti</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            {saving && <span style={{ fontSize: "11px", color: "#4a5568" }}>saving…</span>}
            {/* Streak pill */}
            <div style={{
              background: state.streak > 0 ? "linear-gradient(135deg, #451a03, #7c2d12)" : "#111827",
              border: state.streak > 0 ? "1.5px solid #fb923c" : "1.5px solid #1f2937",
              borderRadius: "100px", padding: "10px 20px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "20px" }}>🔥</span>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: state.streak > 0 ? "#fb923c" : "#374151", lineHeight: 1 }}>{state.streak}</div>
                <div style={{ fontSize: "9px", letterSpacing: "1.5px", color: "#92400e" }}>DAY STREAK</div>
              </div>
            </div>
            {/* Total done */}
            <div style={{
              background: "#0d1117", border: "1.5px solid #1e293b",
              borderRadius: "100px", padding: "10px 20px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "20px" }}>✅</span>
              <div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "#4ade80", lineHeight: 1 }}>{state.totalDone}</div>
                <div style={{ fontSize: "9px", letterSpacing: "1.5px", color: "#4a5568" }}>TOTAL DONE</div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's progress bar */}
        <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: "20px", padding: "20px 24px", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "2px" }}>Today's Progress — {fmt(today())}</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>{doneTodayCount} / {todayTasks.length} tasks completed</div>
            </div>
            <div style={{
              fontSize: "28px", fontWeight: "800",
              color: progress === 100 ? "#4ade80" : progress >= 50 ? "#fbbf24" : "#f87171",
            }}>{progress}%</div>
          </div>
          <div style={{ background: "#1e293b", borderRadius: "100px", height: "8px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "100px",
              width: `${progress}%`,
              background: progress === 100
                ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                : progress >= 50 ? "linear-gradient(90deg, #fbbf24, #fb923c)"
                : "linear-gradient(90deg, #f87171, #fb923c)",
              transition: "width 0.6s ease",
            }} />
          </div>
          {progress === 100 && todayTasks.length > 0 && (
            <div style={{ marginTop: "10px", textAlign: "center", fontSize: "14px", color: "#4ade80" }}>
              🎉 Perfect day! All tasks completed!
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "6px", background: "#0d1117", border: "1px solid #1e293b", borderRadius: "14px", padding: "5px", marginBottom: "24px" }}>
          {[["tasks", "📋 Tasks"], ["badges", `🏅 Badges (${state.earnedBadges.length})`], ["history", "📈 History"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "10px", borderRadius: "10px", border: "none", cursor: "pointer",
              background: tab === key ? "#1e293b" : "transparent",
              color: tab === key ? "#fff" : "#64748b",
              fontWeight: tab === key ? "700" : "400",
              fontSize: "13px", transition: "all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {/* ── TASKS TAB ─────────────────────────────────────────────── */}
        {tab === "tasks" && (
          <>
            {/* Category filter + Add button */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "6px", flex: 1, flexWrap: "wrap" }}>
                {["All", ...CATS.map((c) => c.label)].map((f) => {
                  const cat = catOf(f);
                  return (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      padding: "7px 16px", borderRadius: "100px", border: "1.5px solid",
                      borderColor: filter === f ? (f === "All" ? "#4ade80" : cat.color) : "#1e293b",
                      background: filter === f ? (f === "All" ? "rgba(74,222,128,0.1)" : cat.bg) : "transparent",
                      color: filter === f ? (f === "All" ? "#4ade80" : cat.color) : "#64748b",
                      fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s",
                    }}>{f}</button>
                  );
                })}
              </div>
              <button onClick={() => setShowForm((v) => !v)} style={{
                padding: "8px 20px", borderRadius: "100px", border: "none",
                background: showForm ? "#1e293b" : "linear-gradient(135deg, #4ade80, #22d3ee)",
                color: showForm ? "#fff" : "#000",
                fontWeight: "700", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
              }}>{showForm ? "✕ Cancel" : "+ Add Task"}</button>
            </div>

            {/* Add Task Form */}
            {showForm && (
              <div style={{
                background: "#0d1117", border: "1px solid #4ade80",
                borderRadius: "20px", padding: "24px", marginBottom: "20px",
                boxShadow: "0 0 30px rgba(74,222,128,0.1)",
              }}>
                <h3 style={{ margin: "0 0 20px", color: "#4ade80", fontSize: "14px", letterSpacing: "2px", textTransform: "uppercase" }}>New Task</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <input
                    placeholder="Task title..."
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    style={{
                      background: "#111827", border: "1px solid #1e293b", borderRadius: "12px",
                      padding: "14px 16px", color: "#fff", fontSize: "15px", outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "6px", letterSpacing: "1px" }}>CATEGORY</label>
                      <select value={newTask.category} onChange={(e) => setNewTask((p) => ({ ...p, category: e.target.value }))}
                        style={{ width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit" }}>
                        {CATS.map((c) => <option key={c.label}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "6px", letterSpacing: "1px" }}>PRIORITY</label>
                      <select value={newTask.priority} onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                        style={{ width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit" }}>
                        {PRIOS.map((p) => <option key={p.label}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "6px", letterSpacing: "1px" }}>DUE DATE</label>
                      <input type="date" value={newTask.due} onChange={(e) => setNewTask((p) => ({ ...p, due: e.target.value }))}
                        style={{ width: "100%", background: "#111827", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <button onClick={addTask} style={{
                    padding: "14px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #4ade80, #22d3ee)",
                    color: "#000", fontWeight: "800", fontSize: "15px", cursor: "pointer",
                  }}>Add Task ✓</button>
                </div>
              </div>
            )}

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#374151" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                <div style={{ fontSize: "16px", fontWeight: "600" }}>No tasks yet</div>
                <div style={{ fontSize: "13px", marginTop: "6px" }}>Add your first task to start your streak!</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Today section */}
                {filteredTasks.filter((t) => t.due === today()).length > 0 && (
                  <>
                    <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#4ade80", textTransform: "uppercase", marginBottom: "4px", marginTop: "4px" }}>📅 Today</div>
                    {filteredTasks.filter((t) => t.due === today()).map((task) => <TaskCard key={task.id} task={task} onToggle={toggleDone} onDelete={deleteTask} />)}
                    {filteredTasks.filter((t) => t.due !== today()).length > 0 && (
                      <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#64748b", textTransform: "uppercase", marginBottom: "4px", marginTop: "12px" }}>🗂 Other Days</div>
                    )}
                  </>
                )}
                {filteredTasks.filter((t) => t.due !== today()).map((task) => <TaskCard key={task.id} task={task} onToggle={toggleDone} onDelete={deleteTask} />)}
              </div>
            )}
          </>
        )}

        {/* ── BADGES TAB ────────────────────────────────────────────── */}
        {tab === "badges" && (
          <div>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "14px", color: "#64748b" }}>
                <span style={{ color: "#4ade80", fontWeight: "700", fontSize: "20px" }}>{state.earnedBadges.length}</span> / {BADGE_DEFS.length} earned
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {BADGE_DEFS.map((b) => (
                  <div key={b.id} style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: state.earnedBadges.includes(b.id) ? "#4ade80" : "#1e293b",
                  }} />
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
              {BADGE_DEFS.map((b) => {
                const earned = state.earnedBadges.includes(b.id);
                return (
                  <div key={b.id} style={{
                    background: earned ? "linear-gradient(135deg, #052e16, #0a3d20)" : "#0d1117",
                    border: `1.5px solid ${earned ? "#4ade80" : "#1e293b"}`,
                    borderRadius: "18px", padding: "20px",
                    opacity: earned ? 1 : 0.5,
                    transition: "all 0.2s",
                    boxShadow: earned ? "0 0 20px rgba(74,222,128,0.1)" : "none",
                  }}>
                    <div style={{ fontSize: "36px", marginBottom: "10px", filter: earned ? "none" : "grayscale(1)" }}>{b.icon}</div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: earned ? "#fff" : "#4a5568", marginBottom: "4px" }}>{b.name}</div>
                    <div style={{ fontSize: "12px", color: earned ? "#86efac" : "#374151", lineHeight: 1.4 }}>{b.desc}</div>
                    {earned && <div style={{ marginTop: "10px", fontSize: "10px", letterSpacing: "1.5px", color: "#4ade80", textTransform: "uppercase" }}>✓ Earned</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ───────────────────────────────────────────── */}
        {tab === "history" && (
          <div>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "Current Streak", value: `${state.streak} 🔥`, sub: "days" },
                { label: "Longest Streak", value: `${state.longestStreak} 🏆`, sub: "days" },
                { label: "Total Completed", value: `${state.totalDone} ✅`, sub: "tasks" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "#0d1117", border: "1px solid #1e293b",
                  borderRadius: "16px", padding: "18px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff" }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Activity chart */}
            <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: "20px", padding: "24px" }}>
              <div style={{ fontSize: "12px", letterSpacing: "2px", color: "#64748b", textTransform: "uppercase", marginBottom: "20px" }}>Activity — Last 14 Days</div>
              {(() => {
                const days = [];
                for (let i = 13; i >= 0; i--) {
                  const d = new Date(); d.setDate(d.getDate() - i);
                  const dStr = d.toISOString().split("T")[0];
                  const hist = (state.history || []).find((h) => h.date === dStr);
                  days.push({ date: dStr, count: hist?.count || 0 });
                }
                const max = Math.max(...days.map((d) => d.count), 1);
                return (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "100px" }}>
                    {days.map((d) => (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div style={{
                          width: "100%", borderRadius: "6px",
                          height: `${Math.max((d.count / max) * 80, d.count > 0 ? 8 : 3)}px`,
                          background: d.count > 0
                            ? `rgba(74,222,128,${0.3 + (d.count / max) * 0.7})`
                            : "#1e293b",
                          transition: "height 0.4s ease",
                          position: "relative",
                        }}>
                          {d.count > 0 && (
                            <div style={{
                              position: "absolute", bottom: "calc(100% + 4px)", left: "50%",
                              transform: "translateX(-50%)",
                              fontSize: "10px", color: "#4ade80", fontWeight: "700",
                              whiteSpace: "nowrap",
                            }}>{d.count}</div>
                          )}
                        </div>
                        <div style={{ fontSize: "9px", color: "#374151", whiteSpace: "nowrap" }}>
                          {d.date === today() ? "Today" : new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Category breakdown */}
            <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: "20px", padding: "24px", marginTop: "16px" }}>
              <div style={{ fontSize: "12px", letterSpacing: "2px", color: "#64748b", textTransform: "uppercase", marginBottom: "18px" }}>Category Breakdown</div>
              {CATS.map((cat) => {
                const total = state.tasks.filter((t) => t.category === cat.label).length;
                const done = state.tasks.filter((t) => t.category === cat.label && t.done).length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={cat.label} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", color: cat.color, fontWeight: "600" }}>{cat.label}</span>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>{done}/{total}</span>
                    </div>
                    <div style={{ background: "#1e293b", borderRadius: "100px", height: "6px" }}>
                      <div style={{ height: "100%", borderRadius: "100px", width: `${pct}%`, background: cat.color, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TaskCard ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onDelete }) {
  const cat = catOf(task.category);
  const prio = prioOf(task.priority);
  const isOverdue = !task.done && task.due < today();

  return (
    <div style={{
      background: task.done ? "#080d0f" : "#0d1117",
      border: `1px solid ${task.done ? "#1a2e1a" : isOverdue ? "#7f1d1d" : "#1e293b"}`,
      borderRadius: "16px", padding: "16px 20px",
      display: "flex", alignItems: "center", gap: "14px",
      opacity: task.done ? 0.6 : 1,
      transition: "all 0.2s",
    }}>
      {/* Checkbox */}
      <button onClick={() => onToggle(task.id)} style={{
        width: "26px", height: "26px", borderRadius: "8px", border: `2px solid ${task.done ? "#4ade80" : "#374151"}`,
        background: task.done ? "#4ade80" : "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "all 0.2s",
      }}>
        {task.done && <span style={{ color: "#000", fontSize: "14px", fontWeight: "900" }}>✓</span>}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: "600", fontSize: "15px", color: task.done ? "#4a5568" : "#f1f5f9",
          textDecoration: task.done ? "line-through" : "none",
          marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{task.title}</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "100px", background: cat.bg, color: cat.color, fontWeight: "600" }}>{task.category}</span>
          <span style={{ fontSize: "11px", color: prio.color, fontWeight: "600" }}>● {task.priority}</span>
          <span style={{ fontSize: "11px", color: isOverdue ? "#f87171" : "#64748b" }}>
            {isOverdue ? "⚠ Overdue · " : ""}{fmt(task.due)}
          </span>
        </div>
      </div>

      {/* Delete */}
      <button onClick={() => onDelete(task.id)} style={{
        background: "transparent", border: "none", color: "#374151", cursor: "pointer",
        fontSize: "16px", padding: "4px", borderRadius: "6px", flexShrink: 0,
        transition: "color 0.2s",
      }}
        onMouseEnter={(e) => e.currentTarget.style.color = "#f87171"}
        onMouseLeave={(e) => e.currentTarget.style.color = "#374151"}
      >✕</button>
    </div>
  );
}
