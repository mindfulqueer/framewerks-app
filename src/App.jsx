import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  onAuth, signInWithGoogle, logOut, getUserProfile,
  loadProgram, loadAllPrograms, saveWorkoutLog, loadWorkoutLogs,
  saveHabitEntry, loadHabitEntries
} from "./firebase";

// ─── Helpers ────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtDateLong = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const HABIT_LIST = [
  { key: "water", label: "Water", icon: "droplet", unit: "glasses", target: 8 },
  { key: "sleep", label: "Sleep", icon: "moon", unit: "hours", target: 8 },
  { key: "nutrition", label: "Nutrition", icon: "leaf", unit: "/10", target: 10 },
  { key: "movement", label: "Movement", icon: "activity", unit: "min", target: 30 },
  { key: "mindfulness", label: "Mindfulness", icon: "brain", unit: "min", target: 10 },
  { key: "stress", label: "Stress Level", icon: "gauge", unit: "/10", target: 3 },
];

// ─── Icons ──────────────────────────────────────────────────────
const Icon = ({ name, size = 20 }) => {
  const icons = {
    dumbbell: <><rect x="2" y="10" width="4" height="4" rx="1" /><rect x="18" y="10" width="4" height="4" rx="1" /><line x1="6" y1="12" x2="18" y2="12" /><rect x="1" y="9" width="2" height="6" rx="0.5" /><rect x="21" y="9" width="2" height="6" rx="0.5" /></>,
    play: <polygon points="5 3 19 12 5 21 5 3" />,
    check: <polyline points="20 6 9 17 4 12" />,
    back: <path d="M19 12H5M12 19l-7-7 7-7" />,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    logOut: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    chevRight: <polyline points="9 18 15 12 9 6" />,
    chevDown: <polyline points="6 9 12 15 18 9" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    droplet: <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />,
    moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
    leaf: <><path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-3.8 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    brain: <><path d="M9.5 2A5.5 5.5 0 005 7.5c0 .96.25 1.87.7 2.66" /><path d="M14.5 2A5.5 5.5 0 0120 7.5c0 .96-.25 1.87-.7 2.66" /><path d="M4.28 14.09A7 7 0 003 18c0 1.1.9 2 2 2h14a2 2 0 002-2 7 7 0 00-1.28-3.91" /><circle cx="12" cy="12" r="3" /></>,
    gauge: <><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path d="M12 6v6l4 2" /></>,
    sunrise: <><path d="M17 18a5 5 0 00-10 0" /><line x1="12" y1="2" x2="12" y2="9" /><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" /><line x1="1" y1="18" x2="3" y2="18" /><line x1="21" y1="18" x2="23" y2="18" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" /><line x1="23" y1="22" x2="1" y2="22" /><polyline points="8 6 12 2 16 6" /></>,
    award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
    trendUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || null}
    </svg>
  );
};

// ─── Styles ─────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #08080c; --bg2: #101018; --bg3: #181824; --bg4: #20202e;
  --border: #252538; --border2: #303048;
  --text: #ededf4; --text2: #9898b4; --text3: #5c5c78;
  --accent: #7c6cf0; --accent2: #9d8ff7; --accent-glow: rgba(124,108,240,0.25);
  --green: #34d399; --green-bg: rgba(52,211,153,0.12);
  --orange: #fb923c; --orange-bg: rgba(251,146,60,0.12);
  --red: #f87171; --red-bg: rgba(248,113,113,0.12);
  --blue: #60a5fa; --blue-bg: rgba(96,165,250,0.12);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; }
body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }

.app { min-height: 100vh; max-width: 480px; margin: 0 auto; position: relative; padding-bottom: 80px; }

/* ── Nav ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px; display: flex; background: var(--bg2);
  border-top: 1px solid var(--border); padding: 8px 0 env(safe-area-inset-bottom, 8px);
  z-index: 50;
}
.nav-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 0; background: none; border: none; color: var(--text3);
  font-size: 10px; font-family: inherit; font-weight: 500; cursor: pointer;
  transition: color 0.15s;
}
.nav-btn.active { color: var(--accent2); }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 24px; border-radius: 12px; font-size: 15px; font-weight: 600;
  border: none; cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.btn-primary { background: var(--accent); color: white; box-shadow: 0 4px 20px var(--accent-glow); }
.btn-primary:active { transform: scale(0.97); }
.btn-ghost { background: var(--bg3); color: var(--text2); }
.btn-ghost:active { background: var(--bg4); }
.btn-sm { padding: 10px 16px; font-size: 13px; border-radius: 10px; }
.btn-full { width: 100%; }
.btn-icon { width: 44px; height: 44px; padding: 0; border-radius: 10px; background: var(--bg3); border: 1px solid var(--border); color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.btn-icon:active { background: var(--bg4); }

/* ── Cards ── */
.card { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 12px; }
.card-sm { padding: 16px; border-radius: 12px; }

/* ── Login ── */
.login-screen {
  min-height: 100vh; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 40px 24px; text-align: center;
}
.login-logo { font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px;
  background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.login-tagline { font-size: 14px; color: var(--text3); margin-bottom: 48px; letter-spacing: 2px; text-transform: uppercase; }
.google-btn {
  display: flex; align-items: center; gap: 12px; padding: 16px 32px;
  background: white; color: #333; border: none; border-radius: 14px;
  font-size: 16px; font-weight: 600; font-family: inherit; cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: transform 0.1s;
}
.google-btn:active { transform: scale(0.97); }
.google-btn svg { width: 20px; height: 20px; }

/* ── Pages ── */
.page { padding: 20px; animation: pageIn 0.2s ease; }
@keyframes pageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.page-title { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
.page-subtitle { font-size: 14px; color: var(--text3); margin-bottom: 24px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.page-header .page-title { margin-bottom: 0; }

/* ── Program View ── */
.phase-card { margin-bottom: 16px; }
.phase-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.phase-meta { font-size: 12px; color: var(--text3); margin-bottom: 12px; }
.day-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s;
}
.day-card:active { background: var(--bg4); transform: scale(0.99); }
.day-card-left { display: flex; align-items: center; gap: 12px; }
.day-num {
  width: 36px; height: 36px; border-radius: 10px; background: var(--accent);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
}
.day-label { font-size: 15px; font-weight: 600; }
.day-ex-count { font-size: 12px; color: var(--text3); margin-top: 2px; }

/* ── Workout Session ── */
.session-header {
  display: flex; align-items: center; gap: 12px; padding: 16px 20px;
  background: var(--bg2); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 10;
}
.session-title { font-size: 16px; font-weight: 700; flex: 1; }

.section-label {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 8px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1.5px; margin: 16px 0 10px;
}
.section-label.warmup { background: var(--orange-bg); color: var(--orange); }
.section-label.main { background: rgba(124,108,240,0.1); color: var(--accent2); }
.section-label.cooldown { background: var(--green-bg); color: var(--green); }

.ex-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; padding: 16px; margin-bottom: 10px; }
.ex-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.ex-num {
  min-width: 28px; height: 28px; border-radius: 8px; background: var(--accent);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
}
.ex-num.warmup { background: var(--orange); }
.ex-num.cooldown { background: var(--green); }
.ex-name { font-size: 15px; font-weight: 600; flex: 1; }
.ex-notes { font-size: 12px; color: var(--text3); margin-bottom: 10px; font-style: italic; padding-left: 38px; }
.ex-video-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
  background: var(--red-bg); color: var(--red); border-radius: 6px;
  font-size: 10px; font-weight: 700; border: none; cursor: pointer;
  font-family: inherit; letter-spacing: 0.5px;
}

/* ── Set Logging ── */
.set-log-table { width: 100%; margin-top: 8px; }
.set-log-header {
  display: grid; grid-template-columns: 36px 1fr 1fr 40px;
  gap: 6px; padding: 0 4px 6px;
}
.set-log-header span { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text3); }
.set-log-row {
  display: grid; grid-template-columns: 36px 1fr 1fr 40px;
  gap: 6px; padding: 4px; align-items: center; border-radius: 8px;
  margin-bottom: 4px;
}
.set-log-num { font-size: 13px; font-weight: 700; color: var(--text3); text-align: center; font-family: 'JetBrains Mono', monospace; }
.set-log-input {
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  padding: 10px; color: var(--text); font-size: 14px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace; outline: none; text-align: center;
  width: 100%; transition: border-color 0.15s;
}
.set-log-input:focus { border-color: var(--accent); }
.set-log-input.target { color: var(--text3); font-weight: 400; }
.set-check {
  width: 36px; height: 36px; border-radius: 8px; border: 2px solid var(--border);
  background: transparent; color: transparent; display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: all 0.15s;
}
.set-check.done { background: var(--green); border-color: var(--green); color: white; }

.set-target-row { display: flex; gap: 6px; padding: 2px 4px 6px 40px; }
.set-target { font-size: 11px; color: var(--text3); font-family: 'JetBrains Mono', monospace; }

/* ── Rest Timer ── */
.timer-overlay {
  position: fixed; inset: 0; background: var(--bg); z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.timer-circle {
  width: 220px; height: 220px; border-radius: 50%; position: relative;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 32px;
}
.timer-circle svg { position: absolute; transform: rotate(-90deg); }
.timer-time { font-size: 56px; font-weight: 800; font-family: 'JetBrains Mono', monospace; letter-spacing: -2px; }
.timer-label { font-size: 14px; color: var(--text3); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
.breathe-text { font-size: 18px; font-weight: 600; color: var(--accent2); margin-bottom: 32px; min-height: 28px; }
.timer-btns { display: flex; gap: 12px; }

/* ── Habits ── */
.habit-card {
  display: flex; align-items: center; gap: 14px; padding: 16px;
  background: var(--bg2); border: 1px solid var(--border); border-radius: 14px;
  margin-bottom: 10px;
}
.habit-icon {
  width: 42px; height: 42px; border-radius: 12px; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.habit-info { flex: 1; }
.habit-label { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.habit-bar-bg { width: 100%; height: 6px; background: var(--bg4); border-radius: 3px; overflow: hidden; }
.habit-bar { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.habit-value {
  font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
  min-width: 48px; text-align: right;
}
.habit-controls { display: flex; flex-direction: column; gap: 4px; }
.habit-ctrl-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg3); color: var(--text2); display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: all 0.1s;
}
.habit-ctrl-btn:active { background: var(--bg4); transform: scale(0.9); }

/* ── History ── */
.history-item {
  display: flex; align-items: center; gap: 14px; padding: 16px;
  background: var(--bg2); border: 1px solid var(--border); border-radius: 14px;
  margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.history-item:active { background: var(--bg3); }
.history-date-badge {
  width: 50px; text-align: center; flex-shrink: 0;
}
.history-date-badge .day { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
.history-date-badge .month { font-size: 10px; color: var(--text3); text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
.history-info { flex: 1; }
.history-info h4 { font-size: 14px; font-weight: 600; }
.history-info p { font-size: 12px; color: var(--text3); margin-top: 2px; }
.history-stat { text-align: right; }
.history-stat .val { font-size: 16px; font-weight: 700; color: var(--accent2); font-family: 'JetBrains Mono', monospace; }
.history-stat .lbl { font-size: 10px; color: var(--text3); text-transform: uppercase; }

/* ── Detail Log ── */
.log-detail-ex { padding: 12px 0; border-bottom: 1px solid var(--border); }
.log-detail-ex:last-child { border-bottom: none; }
.log-detail-name { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.log-detail-set { font-size: 13px; color: var(--text2); font-family: 'JetBrains Mono', monospace; padding: 2px 0; }

/* ── Streak Badge ── */
.streak-banner {
  display: flex; align-items: center; gap: 12px; padding: 16px;
  background: linear-gradient(135deg, rgba(124,108,240,0.15), rgba(52,211,153,0.1));
  border: 1px solid rgba(124,108,240,0.2); border-radius: 14px; margin-bottom: 20px;
}
.streak-num { font-size: 32px; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: var(--accent2); }
.streak-text { font-size: 13px; color: var(--text2); }
.streak-text strong { color: var(--text); }

/* ── No program ── */
.no-program {
  text-align: center; padding: 60px 24px; color: var(--text3);
}
.no-program h3 { font-size: 20px; color: var(--text2); margin-bottom: 8px; }
.no-program p { font-size: 14px; line-height: 1.6; }

/* ── Superset indicator ── */
.group-bar { border-left: 3px solid var(--accent); padding-left: 10px; margin: 4px 0; }
.group-bar.circuit { border-left-color: var(--orange); }
.group-tag {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
  color: var(--accent2); margin-bottom: 6px;
}
.group-tag.circuit { color: var(--orange); }

/* ── Loading ── */
.loading-screen {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  color: var(--text3); font-size: 16px;
}

/* ── Profile ── */
.profile-header {
  display: flex; flex-direction: column; align-items: center; padding: 20px; text-align: center;
}
.profile-avatar {
  width: 72px; height: 72px; border-radius: 50%; margin-bottom: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 800; color: white; overflow: hidden;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-name { font-size: 20px; font-weight: 700; }
.profile-email { font-size: 13px; color: var(--text3); margin-top: 2px; }
`;

// ─── Rest Timer Component ───────────────────────────────────────
function RestTimer({ seconds, onDone }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  useEffect(() => { if (remaining === 0 && running) { setRunning(false); } }, [remaining, running]);

  const progress = 1 - remaining / seconds;
  const r = 100; const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // Breathwork: 4s in, 4s out cycle
  const breathCycle = 8;
  const breathPhase = (seconds - remaining) % breathCycle;
  const breathText = remaining === 0 ? "Rest Complete!" : breathPhase < 4 ? "Breathe In..." : "Breathe Out...";

  return (
    <div className="timer-overlay">
      <div className="timer-label">Rest</div>
      <div className="timer-circle">
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={r} fill="none" stroke="var(--bg3)" strokeWidth="8" />
          <circle cx="110" cy="110" r={r} fill="none" stroke={remaining === 0 ? "var(--green)" : "var(--accent)"}
            strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="timer-time">{mins}:{secs.toString().padStart(2, "0")}</div>
      </div>
      <div className="breathe-text">{breathText}</div>
      <div className="timer-btns">
        {remaining > 0 ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setRemaining(r => Math.max(0, r - 15))}>-15s</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRunning(false); setRemaining(0); }}>Skip</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRemaining(r => r + 15)}>+15s</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onDone}><Icon name="check" size={18} /> Continue</button>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ───────────────────────────────────────────────
function LoginScreen({ onSignIn }) {
  const [loading, setLoading] = useState(false);
  const handleSignIn = async () => {
    setLoading(true);
    try { await onSignIn(); } catch (err) { console.error(err); setLoading(false); }
  };
  return (
    <div className="login-screen">
      <div className="login-logo">Framewerks</div>
      <div className="login-tagline">Train Your Body. Strengthen Your Mind.</div>
      <button className="google-btn" onClick={handleSignIn} disabled={loading}>
        <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        {loading ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );
}

// ─── Home / Today View ──────────────────────────────────────────
function HomeView({ user, profile, program, onStartDay, workoutLogs }) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };
  const firstName = (profile?.name || user?.displayName || "").split(" ")[0] || "there";
  const weekLogs = workoutLogs.filter(l => {
    const d = new Date(l.date); const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  return (
    <div className="page">
      <div className="page-title">{greeting()}, {firstName}</div>
      <div className="page-subtitle">{fmtDateLong(today())}</div>

      {weekLogs.length > 0 && (
        <div className="streak-banner">
          <div className="streak-num">{weekLogs.length}</div>
          <div><div className="streak-text"><strong>workouts this week</strong></div><div className="streak-text">Keep the momentum going</div></div>
        </div>
      )}

      {program ? (
        <>
          <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5 }}>Your Program</div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{program.name}</div>
            {program.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                {program.tags.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: "var(--bg4)", color: "var(--text2)", fontWeight: 600 }}>{t}</span>)}
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5 }}>{program.description}</div>
          </div>

          {program.phases.map((phase, pi) => (
            <div key={phase.id} className="phase-card">
              <div className="phase-title">{phase.name}</div>
              <div className="phase-meta">
                {phase.weeks} weeks
                {phase.progression?.type !== "none" && ` · +${phase.progression.amount}${phase.progression.unit} ${phase.progression.frequency}`}
              </div>
              {phase.days.map((day, di) => {
                const totalEx = (day.warmup?.length || 0) + (day.exercises?.length || 0) + (day.cooldown?.length || 0);
                return (
                  <div key={day.id} className="day-card" onClick={() => onStartDay(phase, day, pi, di)}>
                    <div className="day-card-left">
                      <div className="day-num">{di + 1}</div>
                      <div>
                        <div className="day-label">{day.label}</div>
                        <div className="day-ex-count">{totalEx} exercises</div>
                      </div>
                    </div>
                    <Icon name="chevRight" size={18} />
                  </div>
                );
              })}
            </div>
          ))}
        </>
      ) : (
        <div className="no-program">
          <Icon name="dumbbell" size={48} />
          <h3 style={{ marginTop: 16 }}>No Program Assigned</h3>
          <p>Your coach hasn't assigned a program yet. Once they do, it'll show up here automatically.</p>
        </div>
      )}
    </div>
  );
}

// ─── Workout Session ────────────────────────────────────────────
function WorkoutSession({ phase, day, phaseIdx, dayIdx, user, program, onBack, onFinish }) {
  const [logData, setLogData] = useState(() => {
    const buildSets = (exercises) => (exercises || []).map(ex => ({
      exerciseId: ex.id, name: ex.name,
      sets: ex.sets.map(s => ({ id: s.id, targetReps: s.reps, targetWeight: s.weight, reps: "", weight: "", done: false })),
    }));
    return {
      warmup: buildSets(day.warmup),
      exercises: buildSets(day.exercises),
      cooldown: buildSets(day.cooldown),
    };
  });
  const [restTimer, setRestTimer] = useState(null);
  const [startTime] = useState(Date.now());

  const updateSet = (section, exIdx, setIdx, field, value) => {
    setLogData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[section][exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  const toggleSet = (section, exIdx, setIdx, restSeconds) => {
    setLogData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const set = next[section][exIdx].sets[setIdx];
      set.done = !set.done;
      return next;
    });
    if (!logData[section][exIdx].sets[setIdx].done && restSeconds > 0) {
      setRestTimer(restSeconds);
    }
  };

  const totalSets = [...logData.warmup, ...logData.exercises, ...logData.cooldown].reduce((s, ex) => s + ex.sets.length, 0);
  const doneSets = [...logData.warmup, ...logData.exercises, ...logData.cooldown].reduce((s, ex) => s + ex.sets.filter(s => s.done).length, 0);

  const handleFinish = async () => {
    const duration = Math.round((Date.now() - startTime) / 60000);
    const log = {
      id: uid(),
      userId: user.uid,
      programId: program.id,
      programName: program.name,
      phaseId: phase.id,
      phaseName: phase.name,
      dayId: day.id,
      dayLabel: day.label,
      date: today(),
      duration,
      totalSets,
      completedSets: doneSets,
      exercises: [...logData.warmup, ...logData.exercises, ...logData.cooldown].map(ex => ({
        name: ex.name,
        sets: ex.sets.map(s => ({ reps: s.reps || s.targetReps, weight: s.weight || s.targetWeight, done: s.done })),
      })),
    };
    try { await saveWorkoutLog(log); } catch (err) { console.error("Save log error:", err); }
    onFinish(log);
  };

  const renderExSection = (exercises, logSection, sectionName, variant) => {
    if (!exercises?.length) return null;
    // Group by groupId
    const groups = []; let i = 0;
    while (i < exercises.length) {
      const ex = exercises[i];
      if (ex.groupType && ex.groupType !== "none" && ex.groupId) {
        const gId = ex.groupId, members = [];
        while (i < exercises.length && exercises[i].groupId === gId) { members.push({ ex: exercises[i], idx: i }); i++; }
        groups.push({ type: ex.groupType, members });
      } else { groups.push({ type: "single", members: [{ ex, idx: i }] }); i++; }
    }

    return (
      <>
        <div className={`section-label ${variant}`}><Icon name={variant === "warmup" ? "sunrise" : variant === "cooldown" ? "moon" : "dumbbell"} size={14} /> {sectionName}</div>
        {groups.map((g, gi) => {
          const renderEx = (ex, idx) => (
            <div key={ex.id} className="ex-card">
              <div className="ex-header">
                <div className={`ex-num ${variant}`}>{idx + 1}</div>
                <div className="ex-name">{ex.name}</div>
                {ex.videoUrl && <button className="ex-video-btn" onClick={() => window.open(ex.videoUrl, "_blank")}><Icon name="video" size={10} /> Video</button>}
              </div>
              {ex.coachNotes && <div className="ex-notes">{ex.coachNotes}</div>}
              <div className="set-log-table">
                <div className="set-log-header"><span>Set</span><span>Reps</span><span>Weight</span><span></span></div>
                {logSection[idx].sets.map((set, si) => (
                  <div key={set.id}>
                    <div className="set-log-row">
                      <div className="set-log-num">{si + 1}</div>
                      <input className="set-log-input" value={set.reps} placeholder={set.targetReps || "-"}
                        onChange={e => updateSet(sectionName === "Warm-up" ? "warmup" : sectionName === "Cool-down" ? "cooldown" : "exercises", idx, si, "reps", e.target.value)}
                        inputMode="numeric" />
                      <input className="set-log-input" value={set.weight} placeholder={set.targetWeight || "-"}
                        onChange={e => updateSet(sectionName === "Warm-up" ? "warmup" : sectionName === "Cool-down" ? "cooldown" : "exercises", idx, si, "weight", e.target.value)}
                        inputMode="decimal" />
                      <button className={`set-check ${set.done ? "done" : ""}`}
                        onClick={() => toggleSet(sectionName === "Warm-up" ? "warmup" : sectionName === "Cool-down" ? "cooldown" : "exercises", idx, si, parseInt(ex.restSeconds) || 0)}>
                        <Icon name="check" size={16} />
                      </button>
                    </div>
                    {(set.targetReps || set.targetWeight) && !set.done && (
                      <div className="set-target-row">
                        <span className="set-target">Target: {set.targetReps || "?"} reps {set.targetWeight ? `x ${set.targetWeight}` : ""}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

          if (g.type === "single") return renderEx(g.members[0].ex, g.members[0].idx);
          return (
            <div key={gi} className={`group-bar ${g.type === "circuit" ? "circuit" : ""}`}>
              <div className={`group-tag ${g.type === "circuit" ? "circuit" : ""}`}>{g.type}</div>
              {g.members.map(({ ex, idx }) => renderEx(ex, idx))}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div>
      <div className="session-header">
        <button className="btn-icon" onClick={onBack}><Icon name="back" size={18} /></button>
        <div className="session-title">{day.label}</div>
        <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "'JetBrains Mono', monospace" }}>{doneSets}/{totalSets}</div>
      </div>
      <div style={{ padding: 20 }}>
        {/* Progress bar */}
        <div style={{ width: "100%", height: 4, background: "var(--bg4)", borderRadius: 2, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ width: `${totalSets > 0 ? (doneSets / totalSets) * 100 : 0}%`, height: "100%", background: "var(--accent)", borderRadius: 2, transition: "width 0.3s" }} />
        </div>

        {renderExSection(day.warmup, logData.warmup, "Warm-up", "warmup")}
        {renderExSection(day.exercises, logData.exercises, "Main Work", "main")}
        {renderExSection(day.cooldown, logData.cooldown, "Cool-down", "cooldown")}

        <button className="btn btn-primary btn-full" onClick={handleFinish} style={{ marginTop: 24 }}>
          <Icon name="check" size={18} /> Finish Workout
        </button>
      </div>

      {restTimer && <RestTimer seconds={restTimer} onDone={() => setRestTimer(null)} />}
    </div>
  );
}

// ─── Habits View ────────────────────────────────────────────────
function HabitsView({ user, habits, onSaveHabit }) {
  const todayStr = today();
  const todayEntry = habits.find(h => h.date === todayStr) || { date: todayStr, userId: user.uid, entries: {} };
  const [entries, setEntries] = useState(todayEntry.entries || {});

  const updateHabit = (key, delta) => {
    const cur = parseFloat(entries[key]) || 0;
    const newVal = Math.max(0, cur + delta);
    const updated = { ...entries, [key]: newVal };
    setEntries(updated);
    onSaveHabit({ date: todayStr, userId: user.uid, entries: updated });
  };

  // Calculate streak
  const streak = useMemo(() => {
    let count = 0;
    const sorted = [...habits].sort((a, b) => b.date.localeCompare(a.date));
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const dateStr = d.toISOString().split("T")[0];
      const entry = sorted.find(h => h.date === dateStr);
      if (entry && Object.values(entry.entries || {}).some(v => v > 0)) { count++; }
      else if (i > 0) break; // allow today to be incomplete
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [habits]);

  return (
    <div className="page">
      <div className="page-title">Daily Habits</div>
      <div className="page-subtitle">{fmtDate(todayStr)}</div>

      {streak > 1 && (
        <div className="streak-banner">
          <Icon name="award" size={28} />
          <div><div className="streak-text"><strong>{streak}-day streak!</strong></div><div className="streak-text">Consistency builds results</div></div>
        </div>
      )}

      {HABIT_LIST.map(h => {
        const val = parseFloat(entries[h.key]) || 0;
        const pct = Math.min(100, (val / h.target) * 100);
        const color = pct >= 100 ? "var(--green)" : pct >= 50 ? "var(--accent)" : "var(--text3)";
        const bgColor = h.key === "water" ? "var(--blue-bg)" : h.key === "sleep" ? "rgba(124,108,240,0.12)" :
          h.key === "nutrition" ? "var(--green-bg)" : h.key === "movement" ? "var(--orange-bg)" :
          h.key === "mindfulness" ? "rgba(124,108,240,0.12)" : "var(--red-bg)";
        const iconColor = h.key === "water" ? "var(--blue)" : h.key === "sleep" ? "var(--accent2)" :
          h.key === "nutrition" ? "var(--green)" : h.key === "movement" ? "var(--orange)" :
          h.key === "mindfulness" ? "var(--accent2)" : "var(--red)";

        return (
          <div key={h.key} className="habit-card">
            <div className="habit-icon" style={{ background: bgColor, color: iconColor }}><Icon name={h.icon} size={20} /></div>
            <div className="habit-info">
              <div className="habit-label">{h.label}</div>
              <div className="habit-bar-bg"><div className="habit-bar" style={{ width: `${pct}%`, background: color }} /></div>
            </div>
            <div className="habit-value" style={{ color }}>{val}<span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>{h.unit}</span></div>
            <div className="habit-controls">
              <button className="habit-ctrl-btn" onClick={() => updateHabit(h.key, h.key === "stress" ? -1 : 1)}><Icon name="plus" size={14} /></button>
              <button className="habit-ctrl-btn" onClick={() => updateHabit(h.key, h.key === "stress" ? 1 : -1)}><Icon name="minus" size={14} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History View ───────────────────────────────────────────────
function HistoryView({ workoutLogs, onViewLog }) {
  if (workoutLogs.length === 0) {
    return (
      <div className="page">
        <div className="page-title">History</div>
        <div className="page-subtitle">Your workout journal</div>
        <div className="no-program">
          <Icon name="calendar" size={48} />
          <h3 style={{ marginTop: 16 }}>No Workouts Yet</h3>
          <p>Complete your first workout and it'll show up here.</p>
        </div>
      </div>
    );
  }

  // Stats
  const totalWorkouts = workoutLogs.length;
  const totalVolume = workoutLogs.reduce((sum, log) => {
    return sum + log.exercises.reduce((es, ex) => {
      return es + ex.sets.reduce((ss, set) => ss + (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0), 0);
    }, 0);
  }, 0);

  return (
    <div className="page">
      <div className="page-title">History</div>
      <div className="page-subtitle">Your workout journal</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div className="card card-sm" style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent2)" }}>{totalWorkouts}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>Workouts</div>
        </div>
        <div className="card card-sm" style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}>{totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>Total lbs</div>
        </div>
      </div>

      {workoutLogs.map(log => {
        const d = new Date(log.date + "T12:00:00");
        return (
          <div key={log.id} className="history-item" onClick={() => onViewLog(log)}>
            <div className="history-date-badge">
              <div className="day">{d.getDate()}</div>
              <div className="month">{d.toLocaleDateString("en-US", { month: "short" })}</div>
            </div>
            <div className="history-info">
              <h4>{log.dayLabel}</h4>
              <p>{log.phaseName} · {log.programName}</p>
            </div>
            <div className="history-stat">
              <div className="val">{log.completedSets}/{log.totalSets}</div>
              <div className="lbl">Sets</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Log Detail View ────────────────────────────────────────────
function LogDetailView({ log, onBack }) {
  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={onBack}><Icon name="back" size={18} /></button>
        <div>
          <div className="page-title" style={{ fontSize: 20 }}>{log.dayLabel}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDateLong(log.date)} · {log.duration} min</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div className="card card-sm" style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--accent2)" }}>{log.completedSets}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase" }}>Sets Done</div>
        </div>
        <div className="card card-sm" style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--green)" }}>{log.duration}m</div>
          <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase" }}>Duration</div>
        </div>
      </div>

      <div className="card">
        {log.exercises.map((ex, i) => (
          <div key={i} className="log-detail-ex">
            <div className="log-detail-name">{i + 1}. {ex.name}</div>
            {ex.sets.map((s, si) => (
              <div key={si} className="log-detail-set">
                Set {si + 1}: {s.reps} reps {s.weight ? `x ${s.weight}` : ""} {s.done ? "✓" : "—"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile View ───────────────────────────────────────────────
function ProfileView({ user, profile, onLogOut }) {
  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar">
          {user.photoURL ? <img src={user.photoURL} alt="" /> : (user.displayName || "?")[0]}
        </div>
        <div className="profile-name">{user.displayName}</div>
        <div className="profile-email">{user.email}</div>
      </div>
      <div style={{ padding: "20px 0" }}>
        <button className="btn btn-ghost btn-full" onClick={onLogOut} style={{ color: "var(--red)" }}>
          <Icon name="logOut" size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Workout Complete Screen ────────────────────────────────────
function WorkoutComplete({ log, onDone }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Icon name="check" size={36} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "var(--green)" }}>Workout Complete!</div>
      <div style={{ fontSize: 15, color: "var(--text2)", marginBottom: 32, lineHeight: 1.6 }}>
        {log.dayLabel}<br />
        {log.completedSets}/{log.totalSets} sets · {log.duration} min
      </div>
      <button className="btn btn-primary" onClick={onDone}><Icon name="home" size={18} /> Back to Home</button>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────
export default function FramewerksApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [view, setView] = useState("home"); // home | session | complete | log-detail
  const [sessionData, setSessionData] = useState(null);
  const [completedLog, setCompletedLog] = useState(null);
  const [detailLog, setDetailLog] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [habits, setHabits] = useState([]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuth(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const prof = await getUserProfile(firebaseUser.uid);
          setProfile(prof);
          if (prof?.assignedProgramId) {
            const prog = await loadProgram(prof.assignedProgramId);
            setProgram(prog);
          }
          const logs = await loadWorkoutLogs(firebaseUser.uid);
          setWorkoutLogs(logs);
          const habs = await loadHabitEntries(firebaseUser.uid);
          setHabits(habs);
        } catch (err) { console.error("Load error:", err); }
      } else {
        setUser(null); setProfile(null); setProgram(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSignIn = async () => {
    const u = await signInWithGoogle();
    setUser(u);
  };

  const handleStartDay = (phase, day, phaseIdx, dayIdx) => {
    setSessionData({ phase, day, phaseIdx, dayIdx });
    setView("session");
  };

  const handleFinishWorkout = (log) => {
    setWorkoutLogs(prev => [log, ...prev]);
    setCompletedLog(log);
    setView("complete");
    setSessionData(null);
  };

  const handleSaveHabit = async (entry) => {
    try {
      await saveHabitEntry(entry);
      setHabits(prev => {
        const existing = prev.findIndex(h => h.date === entry.date);
        if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; }
        return [entry, ...prev];
      });
    } catch (err) { console.error("Habit save error:", err); }
  };

  const navigateTab = (t) => {
    setTab(t); setView("home"); setSessionData(null); setCompletedLog(null); setDetailLog(null);
  };

  if (loading) return (<><style>{CSS}</style><div className="loading-screen">Loading Framewerks...</div></>);
  if (!user) return (<><style>{CSS}</style><LoginScreen onSignIn={handleSignIn} /></>);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {view === "session" && sessionData ? (
          <WorkoutSession
            phase={sessionData.phase} day={sessionData.day}
            phaseIdx={sessionData.phaseIdx} dayIdx={sessionData.dayIdx}
            user={user} program={program}
            onBack={() => { setView("home"); setSessionData(null); }}
            onFinish={handleFinishWorkout}
          />
        ) : view === "complete" && completedLog ? (
          <WorkoutComplete log={completedLog} onDone={() => { setView("home"); setCompletedLog(null); setTab("home"); }} />
        ) : view === "log-detail" && detailLog ? (
          <LogDetailView log={detailLog} onBack={() => { setView("home"); setDetailLog(null); }} />
        ) : (
          <>
            {tab === "home" && <HomeView user={user} profile={profile} program={program} onStartDay={handleStartDay} workoutLogs={workoutLogs} />}
            {tab === "habits" && <HabitsView user={user} habits={habits} onSaveHabit={handleSaveHabit} />}
            {tab === "history" && <HistoryView workoutLogs={workoutLogs} onViewLog={(log) => { setDetailLog(log); setView("log-detail"); }} />}
            {tab === "profile" && <ProfileView user={user} profile={profile} onLogOut={async () => { await logOut(); setUser(null); }} />}
          </>
        )}

        {view !== "session" && view !== "complete" && (
          <div className="bottom-nav">
            <button className={`nav-btn ${tab === "home" ? "active" : ""}`} onClick={() => navigateTab("home")}><Icon name="home" size={20} /> Home</button>
            <button className={`nav-btn ${tab === "habits" ? "active" : ""}`} onClick={() => navigateTab("habits")}><Icon name="heart" size={20} /> Habits</button>
            <button className={`nav-btn ${tab === "history" ? "active" : ""}`} onClick={() => navigateTab("history")}><Icon name="calendar" size={20} /> History</button>
            <button className={`nav-btn ${tab === "profile" ? "active" : ""}`} onClick={() => navigateTab("profile")}><Icon name="user" size={20} /> Profile</button>
          </div>
        )}
      </div>
    </>
  );
}
