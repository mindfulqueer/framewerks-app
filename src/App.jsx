import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  addDoc, updateDoc, doc, onSnapshot, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ─── Firebase Config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDwCIb6OQ40TDNlNr1TjxO4kZVf2Ho62X8",
  authDomain: "framewerks-coach.firebaseapp.com",
  projectId: "framewerks-coach",
  storageBucket: "framewerks-coach.firebaseapp.com",
  messagingSenderId: "850336233136",
  appId: "1:850336233136:web:2bf59afb82672435c4ed75"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ─── Storage Keys ───────────────────────────────────────────────────────────
const KEYS = {
  WORKOUT_LOGS: "fw_workout_logs",
  ACTIVE_HABITS: "fw_active_habits",
  HABIT_COMPLETIONS: "fw_habit_completions",
  WELLBEING: "fw_wellbeing",
  WEEK_SCHEDULE: "fw_week_schedule",
};

const saveLocal = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};
const loadLocal = (key, def = null) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch { return def; }
};

// ─── Firebase Sync ──────────────────────────────────────────────────────────
const syncSetToFirebase = async (userId, workoutLogId, setData) => {
  try {
    await addDoc(collection(db, "setSyncs"), {
      userId, workoutLogId, ...setData, timestamp: serverTimestamp()
    });
  } catch (e) { console.warn("Set sync failed:", e); }
};

const syncWorkoutLogToFirebase = async (userId, logEntry) => {
  try {
    const ref = await addDoc(collection(db, "workoutLogs"), {
      userId, ...logEntry, completedAt: serverTimestamp()
    });
    return ref.id;
  } catch (e) { console.warn("Log sync failed:", e); return null; }
};

const loadAllWorkoutLogs = async (userId) => {
  try {
    const q = query(
      collection(db, "workoutLogs"),
      where("userId", "==", userId),
      orderBy("completedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};

// ─── Design Tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#0D0D0D",
  surface: "#141414",
  card: "#1A1A1A",
  border: "#2A2A2A",
  accent: "#E8FF00",       // electric yellow-green
  accentAlt: "#FF3D3D",    // hot red
  accentBlue: "#00C8FF",   // electric blue
  text: "#FFFFFF",
  textMuted: "#888888",
  textDim: "#555555",
};

const styles = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
    display: "flex",
    flexDirection: "column",
    maxWidth: 430,
    margin: "0 auto",
    position: "relative",
    overflowX: "hidden",
  },
  header: {
    padding: "20px 20px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: 28,
    letterSpacing: "0.08em",
    color: C.accent,
    lineHeight: 1,
  },
  logoSub: {
    fontSize: 10,
    letterSpacing: "0.3em",
    color: C.textMuted,
    fontFamily: "system-ui",
    fontWeight: 500,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: "0 16px",
    paddingBottom: 100,
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    background: C.surface,
    borderTop: `1px solid ${C.border}`,
    display: "flex",
    justifyContent: "space-around",
    padding: "10px 0 20px",
    zIndex: 100,
  },
  navBtn: (active) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px 16px",
    color: active ? C.accent : C.textDim,
    transition: "color 0.15s",
  }),
  navIcon: { fontSize: 22 },
  navLabel: {
    fontSize: 9,
    fontFamily: "system-ui",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 36,
    letterSpacing: "0.05em",
    margin: "24px 0 4px",
    lineHeight: 1,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "system-ui",
    color: C.textMuted,
    marginBottom: 20,
    letterSpacing: "0.05em",
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "16px",
    marginBottom: 12,
  },
  accentCard: (color = C.accent) => ({
    background: C.card,
    border: `1px solid ${color}`,
    borderRadius: 12,
    padding: "16px",
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  }),
  pill: (color = C.accent) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 10,
    fontFamily: "system-ui",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    background: color + "22",
    color: color,
    border: `1px solid ${color}44`,
  }),
  btn: (variant = "primary") => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "14px 24px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    letterSpacing: "0.1em",
    fontFamily: "'Bebas Neue', sans-serif",
    transition: "all 0.15s",
    ...(variant === "primary" ? {
      background: C.accent,
      color: "#000",
    } : variant === "danger" ? {
      background: C.accentAlt,
      color: "#fff",
    } : variant === "ghost" ? {
      background: "transparent",
      color: C.text,
      border: `1px solid ${C.border}`,
    } : {}),
  }),
  input: {
    width: "100%",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "12px 14px",
    color: C.text,
    fontSize: 14,
    fontFamily: "system-ui",
    outline: "none",
    boxSizing: "border-box",
  },
  label: {
    fontSize: 11,
    fontFamily: "system-ui",
    color: C.textMuted,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 6,
    display: "block",
  },
};

// ─── Sample Data ─────────────────────────────────────────────────────────────
const SAMPLE_PROGRAM = {
  id: "rebuild-method",
  name: "REBUILD METHOD",
  phase: "Phase 1: Reset",
  weeks: 8,
  workouts: [
    {
      id: "w1", day: "Monday", name: "Lower Body A",
      exercises: [
        { id: "e1", name: "Barbell Squat", sets: 3, reps: "8-10", notes: "Control the descent" },
        { id: "e2", name: "Romanian Deadlift", sets: 3, reps: "10-12", notes: "Hinge at hips" },
        { id: "e3", name: "Leg Press", sets: 3, reps: "12-15", notes: "" },
        { id: "e4", name: "Walking Lunges", sets: 3, reps: "12 each", notes: "" },
      ]
    },
    {
      id: "w2", day: "Wednesday", name: "Upper Body A",
      exercises: [
        { id: "e5", name: "Bench Press", sets: 4, reps: "8-10", notes: "Retract scapula" },
        { id: "e6", name: "Bent Over Row", sets: 4, reps: "8-10", notes: "" },
        { id: "e7", name: "Overhead Press", sets: 3, reps: "10-12", notes: "" },
        { id: "e8", name: "Pull-Ups", sets: 3, reps: "Max", notes: "" },
      ]
    },
    {
      id: "w3", day: "Friday", name: "Full Body",
      exercises: [
        { id: "e9", name: "Deadlift", sets: 3, reps: "5-6", notes: "Power movement" },
        { id: "e10", name: "Push-Ups", sets: 3, reps: "15-20", notes: "" },
        { id: "e11", name: "Dumbbell Row", sets: 3, reps: "12 each", notes: "" },
        { id: "e12", name: "Plank", sets: 3, reps: "45s", notes: "" },
      ]
    },
  ]
};

const DEFAULT_HABITS = [
  { id: "h1", name: "Morning Movement", icon: "🌅", streak: 0, target: "10 min" },
  { id: "h2", name: "Protein Goal", icon: "🥩", streak: 0, target: "150g" },
  { id: "h3", name: "Breathwork", icon: "🧘", streak: 0, target: "5 min" },
  { id: "h4", name: "Hydration", icon: "💧", streak: 0, target: "3L" },
  { id: "h5", name: "Sleep 7-9hrs", icon: "😴", streak: 0, target: "9pm wind down" },
];

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      setError("Sign in failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'Bebas Neue', sans-serif"
    }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, color: C.accent, letterSpacing: "0.05em", lineHeight: 1 }}>
          FRAME<span style={{ color: C.accentAlt }}>WERKS</span>
        </div>
        <div style={{ fontSize: 12, letterSpacing: "0.4em", color: C.textMuted, fontFamily: "system-ui", marginTop: 8 }}>
          BUILD YOUR FOUNDATION
        </div>
        <div style={{
          width: 60, height: 3, background: C.accent, margin: "16px auto 0",
          clipPath: "polygon(0 0, 100% 0, 92% 100%, 0% 100%)"
        }} />
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        {error && (
          <div style={{ background: C.accentAlt + "22", border: `1px solid ${C.accentAlt}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, fontFamily: "system-ui", color: C.accentAlt, textAlign: "center" }}>
            {error}
          </div>
        )}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            ...styles.btn("primary"),
            width: "100%",
            fontSize: 18,
            padding: "16px 24px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "SIGNING IN..." : "SIGN IN WITH GOOGLE"}
        </button>
        <p style={{ fontSize: 11, fontFamily: "system-ui", color: C.textDim, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Your data syncs across all your devices in real-time
        </p>
      </div>
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayTab({ user, workoutLogs, onStartWorkout }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayWorkout = SAMPLE_PROGRAM.workouts.find(w => w.day === today);
  const recentLogs = workoutLogs.slice(0, 3);
  const totalWorkouts = workoutLogs.length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "MORNING";
    if (h < 17) return "AFTERNOON";
    return "EVENING";
  };

  return (
    <div>
      <div style={{ paddingTop: 28 }}>
        <div style={{ fontSize: 13, fontFamily: "system-ui", color: C.textMuted, letterSpacing: "0.15em" }}>
          GOOD {greeting()}
        </div>
        <div style={{ fontSize: 44, letterSpacing: "0.03em", lineHeight: 1, marginTop: 4 }}>
          {user.displayName?.split(" ")[0]?.toUpperCase() || "ATHLETE"}
        </div>
        <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, marginTop: 6 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {[
          { label: "WORKOUTS", value: totalWorkouts },
          { label: "WEEK", value: `${SAMPLE_PROGRAM.phase.split(":")[0]}` },
          { label: "STREAK", value: "–" },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, background: i === 0 ? C.accent : C.card,
            borderRadius: 10, padding: "12px 10px", textAlign: "center",
            border: i === 0 ? "none" : `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 28, letterSpacing: "0.02em", color: i === 0 ? "#000" : C.text }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 9, fontFamily: "system-ui", fontWeight: 700, letterSpacing: "0.15em", color: i === 0 ? "#000" : C.textMuted, marginTop: 2 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Today's workout */}
      {todayWorkout ? (
        <div style={{ ...styles.accentCard(C.accent), marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={styles.pill(C.accent)}>TODAY</span>
              <div style={{ fontSize: 28, marginTop: 6 }}>{todayWorkout.name}</div>
              <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, marginTop: 2 }}>
                {todayWorkout.exercises.length} exercises · {SAMPLE_PROGRAM.phase}
              </div>
            </div>
            <div style={{ fontSize: 36, opacity: 0.15 }}>💪</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {todayWorkout.exercises.map(ex => (
              <div key={ex.id} style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, background: C.surface, borderRadius: 6, padding: "4px 8px" }}>
                {ex.name}
              </div>
            ))}
          </div>
          <button onClick={() => onStartWorkout(todayWorkout)} style={{ ...styles.btn("primary"), width: "100%", fontSize: 18 }}>
            START WORKOUT
          </button>
        </div>
      ) : (
        <div style={{ ...styles.card, marginTop: 24, textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔋</div>
          <div style={{ fontSize: 24, marginBottom: 4 }}>REST DAY</div>
          <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted }}>Recovery is where gains are made</div>
        </div>
      )}

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <>
          <div style={{ fontSize: 22, letterSpacing: "0.05em", marginTop: 28, marginBottom: 12 }}>RECENT ACTIVITY</div>
          {recentLogs.map((log, i) => (
            <div key={log.id || i} style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18 }}>{log.workoutName}</div>
                  <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, marginTop: 2 }}>
                    {log.completedAt?.toDate
                      ? log.completedAt.toDate().toLocaleDateString()
                      : log.completedAt
                        ? new Date(log.completedAt).toLocaleDateString()
                        : "Recently"}
                    {log.duration ? ` · ${Math.floor(log.duration / 60)}min` : ""}
                  </div>
                </div>
                {log.rating && (
                  <div style={{ fontSize: 22, color: C.accent }}>{log.rating}/5</div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Active Workout ───────────────────────────────────────────────────────────
function ActiveWorkout({ user, workout, onComplete, onCancel }) {
  const [setData, setSetData] = useState(() =>
    workout.exercises.reduce((acc, ex) => {
      acc[ex.id] = Array(ex.sets).fill(null).map(() => ({ reps: "", weight: "", done: false }));
      return acc;
    }, {})
  );
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [startTime] = useState(Date.now());
  const [showFinish, setShowFinish] = useState(false);
  const logIdRef = useRef(null);

  const updateSet = async (exId, setIdx, field, value) => {
    const updated = { ...setData };
    updated[exId][setIdx] = { ...updated[exId][setIdx], [field]: value };
    setSetData(updated);

    if (field === "done" && value === true && user) {
      const setPayload = {
        exerciseName: workout.exercises.find(e => e.id === exId)?.name,
        setNumber: setIdx + 1,
        reps: updated[exId][setIdx].reps,
        weight: updated[exId][setIdx].weight,
        workoutName: workout.name,
      };
      await syncSetToFirebase(user.uid, logIdRef.current || "pending", setPayload);
    }
  };

  const completedSets = Object.values(setData).flat().filter(s => s.done).length;
  const totalSets = Object.values(setData).flat().length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const handleFinish = async () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const logEntry = {
      workoutId: workout.id,
      workoutName: workout.name,
      phase: SAMPLE_PROGRAM.phase,
      exercises: workout.exercises.map(ex => ({
        name: ex.name,
        sets: setData[ex.id].map((s, i) => ({
          setNumber: i + 1,
          reps: s.reps,
          weight: s.weight,
          completed: s.done
        }))
      })),
      duration,
      rating,
      notes,
      completedAt: new Date().toISOString(),
    };

    // Save locally first
    const existing = loadLocal(KEYS.WORKOUT_LOGS, []);
    const newLogs = [{ id: Date.now().toString(), ...logEntry }, ...existing];
    saveLocal(KEYS.WORKOUT_LOGS, newLogs);

    // Sync to Firebase
    if (user) {
      await syncWorkoutLogToFirebase(user.uid, logEntry);
    }

    onComplete(newLogs);
  };

  const ex = workout.exercises[currentExIdx];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: C.surface, position: "fixed", top: 0, left: 0, right: 0, zIndex: 200 }}>
        <div style={{
          height: "100%", background: C.accent, width: `${progress}%`,
          transition: "width 0.3s ease",
          clipPath: "polygon(0 0, 100% 0, 97% 100%, 0% 100%)"
        }} />
      </div>

      <div style={{ padding: "20px 16px", paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, letterSpacing: "0.15em" }}>ACTIVE SESSION</div>
            <div style={{ fontSize: 28 }}>{workout.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, color: C.accent }}>{completedSets}/{totalSets}</div>
            <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted }}>SETS DONE</div>
          </div>
        </div>

        {/* Exercise nav */}
        <div style={{ display: "flex", gap: 6, marginTop: 20, overflowX: "auto", paddingBottom: 4 }}>
          {workout.exercises.map((e, i) => {
            const exSets = setData[e.id];
            const allDone = exSets.every(s => s.done);
            const someDone = exSets.some(s => s.done);
            return (
              <button key={e.id} onClick={() => setCurrentExIdx(i)}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1px solid ${i === currentExIdx ? C.accent : allDone ? C.accentBlue + "66" : C.border}`,
                  background: i === currentExIdx ? C.accent : allDone ? C.accentBlue + "22" : "transparent",
                  color: i === currentExIdx ? "#000" : allDone ? C.accentBlue : C.textMuted,
                  fontSize: 11,
                  fontFamily: "system-ui",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}>
                {allDone ? "✓ " : ""}{i + 1}
              </button>
            );
          })}
        </div>

        {/* Current exercise */}
        <div style={{ ...styles.accentCard(C.accent), marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 30 }}>{ex.name}</div>
              <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, marginTop: 2 }}>
                {ex.sets} sets · {ex.reps} reps
              </div>
            </div>
            <span style={styles.pill(C.accent)}>EX {currentExIdx + 1}/{workout.exercises.length}</span>
          </div>
          {ex.notes && (
            <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.accentBlue, marginTop: 8, fontStyle: "italic" }}>
              💡 {ex.notes}
            </div>
          )}
        </div>

        {/* Sets */}
        <div style={{ ...styles.card }}>
          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 44px", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>SET</div>
            <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>WEIGHT (lbs)</div>
            <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>REPS</div>
            <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>DONE</div>
          </div>
          {setData[ex.id].map((set, si) => (
            <div key={si} style={{
              display: "grid", gridTemplateColumns: "32px 1fr 1fr 44px", gap: 8, alignItems: "center",
              padding: "8px 0", borderTop: `1px solid ${C.border}`,
              opacity: set.done ? 0.6 : 1
            }}>
              <div style={{ fontSize: 18, color: set.done ? C.accentBlue : C.textMuted }}>{si + 1}</div>
              <input
                type="number"
                placeholder="0"
                value={set.weight}
                onChange={e => updateSet(ex.id, si, "weight", e.target.value)}
                style={{ ...styles.input, padding: "8px 10px", fontSize: 16, textAlign: "center" }}
              />
              <input
                type="number"
                placeholder="0"
                value={set.reps}
                onChange={e => updateSet(ex.id, si, "reps", e.target.value)}
                style={{ ...styles.input, padding: "8px 10px", fontSize: 16, textAlign: "center" }}
              />
              <button
                onClick={() => updateSet(ex.id, si, "done", !set.done)}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: `1px solid ${set.done ? C.accent : C.border}`,
                  background: set.done ? C.accent : "transparent",
                  color: set.done ? "#000" : C.textDim,
                  fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                ✓
              </button>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {currentExIdx > 0 && (
            <button onClick={() => setCurrentExIdx(i => i - 1)} style={{ ...styles.btn("ghost"), flex: 1 }}>
              ← PREV
            </button>
          )}
          {currentExIdx < workout.exercises.length - 1 ? (
            <button onClick={() => setCurrentExIdx(i => i + 1)} style={{ ...styles.btn("primary"), flex: 1 }}>
              NEXT →
            </button>
          ) : (
            <button onClick={() => setShowFinish(true)} style={{ ...styles.btn("primary"), flex: 1 }}>
              FINISH WORKOUT
            </button>
          )}
        </div>

        <button onClick={onCancel} style={{ ...styles.btn("ghost"), width: "100%", marginTop: 10, color: C.textMuted }}>
          CANCEL SESSION
        </button>
      </div>

      {/* Finish modal */}
      {showFinish && (
        <div style={{
          position: "fixed", inset: 0, background: "#000000CC", zIndex: 300,
          display: "flex", alignItems: "flex-end", justifyContent: "center"
        }}>
          <div style={{
            background: C.card, borderRadius: "20px 20px 0 0", padding: "28px 20px 40px",
            width: "100%", maxWidth: 430, border: `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 32, marginBottom: 20 }}>SESSION COMPLETE</div>

            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>HOW WAS IT? (1-5)</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setRating(n)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 8,
                    border: `1px solid ${n <= rating ? C.accent : C.border}`,
                    background: n <= rating ? C.accent + "22" : "transparent",
                    color: n <= rating ? C.accent : C.textMuted,
                    fontSize: 18, fontFamily: "'Bebas Neue'", cursor: "pointer"
                  }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>NOTES</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did it feel?"
                rows={3}
                style={{ ...styles.input, resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowFinish(false)} style={{ ...styles.btn("ghost"), flex: 1 }}>BACK</button>
              <button onClick={handleFinish} style={{ ...styles.btn("primary"), flex: 2, fontSize: 20 }}>SAVE & FINISH</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Program Tab ──────────────────────────────────────────────────────────────
function ProgramTab({ onStartWorkout }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={styles.sectionTitle}>PROGRAM</div>
      <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, marginBottom: 4 }}>
        {SAMPLE_PROGRAM.name}
      </div>
      <div style={{ ...styles.pill(C.accent), marginBottom: 20 }}>{SAMPLE_PROGRAM.phase}</div>

      {SAMPLE_PROGRAM.workouts.map((workout, i) => (
        <div key={workout.id} style={styles.card}>
          <div
            onClick={() => setExpanded(expanded === workout.id ? null : workout.id)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          >
            <div>
              <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700, letterSpacing: "0.1em" }}>
                {workout.day.toUpperCase()}
              </div>
              <div style={{ fontSize: 24, marginTop: 2 }}>{workout.name}</div>
              <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted }}>
                {workout.exercises.length} exercises
              </div>
            </div>
            <div style={{ fontSize: 24, color: C.textDim, transition: "transform 0.2s", transform: expanded === workout.id ? "rotate(180deg)" : "none" }}>
              ↓
            </div>
          </div>

          {expanded === workout.id && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              {workout.exercises.map((ex, ei) => (
                <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontFamily: "'Bebas Neue'" }}>{ex.name}</div>
                    {ex.notes && <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, fontStyle: "italic" }}>{ex.notes}</div>}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, textAlign: "right" }}>
                    <div>{ex.sets} sets</div>
                    <div>{ex.reps} reps</div>
                  </div>
                </div>
              ))}
              <button onClick={() => onStartWorkout(workout)} style={{ ...styles.btn("primary"), width: "100%", marginTop: 8 }}>
                START THIS WORKOUT
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Habits Tab ───────────────────────────────────────────────────────────────
function HabitsTab({ user }) {
  const [habits, setHabits] = useState(() => loadLocal(KEYS.ACTIVE_HABITS, DEFAULT_HABITS));
  const [completions, setCompletions] = useState(() => loadLocal(KEYS.HABIT_COMPLETIONS, {}));
  const todayKey = new Date().toISOString().slice(0, 10);

  const toggle = (habitId) => {
    const key = `${todayKey}_${habitId}`;
    const updated = { ...completions, [key]: !completions[key] };
    setCompletions(updated);
    saveLocal(KEYS.HABIT_COMPLETIONS, updated);

    // Update streak
    const updatedHabits = habits.map(h => {
      if (h.id !== habitId) return h;
      return { ...h, streak: updated[key] ? h.streak + 1 : Math.max(0, h.streak - 1) };
    });
    setHabits(updatedHabits);
    saveLocal(KEYS.ACTIVE_HABITS, updatedHabits);
  };

  const todayCompleted = habits.filter(h => completions[`${todayKey}_${h.id}`]).length;

  return (
    <div>
      <div style={styles.sectionTitle}>HABITS</div>
      <div style={styles.sectionSub}>
        {todayCompleted}/{habits.length} COMPLETED TODAY
      </div>

      <div style={{
        height: 6, background: C.surface, borderRadius: 3, marginBottom: 24, overflow: "hidden"
      }}>
        <div style={{
          height: "100%", background: C.accent, borderRadius: 3,
          width: `${habits.length > 0 ? (todayCompleted / habits.length) * 100 : 0}%`,
          transition: "width 0.4s ease"
        }} />
      </div>

      {habits.map(habit => {
        const done = !!completions[`${todayKey}_${habit.id}`];
        return (
          <div key={habit.id}
            onClick={() => toggle(habit.id)}
            style={{
              ...styles.card,
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              border: `1px solid ${done ? C.accent + "66" : C.border}`,
              background: done ? C.accent + "0A" : C.card,
              transition: "all 0.2s",
            }}>
            <div style={{ fontSize: 28 }}>{habit.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, color: done ? C.accent : C.text }}>{habit.name}</div>
              <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted }}>
                Target: {habit.target} · 🔥 {habit.streak} day streak
              </div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              border: `2px solid ${done ? C.accent : C.border}`,
              background: done ? C.accent : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: done ? "#000" : "transparent", fontSize: 16, flexShrink: 0
            }}>
              ✓
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ workoutLogs, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = workoutLogs.filter(log => {
    if (filter === "all") return true;
    if (filter === "week") {
      const d = log.completedAt?.toDate ? log.completedAt.toDate() : new Date(log.completedAt);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (filter === "month") {
      const d = log.completedAt?.toDate ? log.completedAt.toDate() : new Date(log.completedAt);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    }
    return true;
  });

  if (selected) {
    const log = selected;
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ ...styles.btn("ghost"), marginTop: 20, marginBottom: 16, fontSize: 14 }}>
          ← BACK
        </button>
        <div style={{ fontSize: 30, marginBottom: 4 }}>{log.workoutName}</div>
        <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted, marginBottom: 8 }}>
          {log.completedAt?.toDate
            ? log.completedAt.toDate().toLocaleString()
            : log.completedAt
              ? new Date(log.completedAt).toLocaleString()
              : "Unknown date"}
          {log.duration ? ` · ${Math.floor(log.duration / 60)} min` : ""}
        </div>
        {log.rating && <span style={styles.pill(C.accent)}>RATED {log.rating}/5</span>}
        {log.notes && (
          <div style={{ ...styles.card, marginTop: 16, fontFamily: "system-ui", fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>
            "{log.notes}"
          </div>
        )}
        {log.exercises?.map((ex, i) => (
          <div key={i} style={styles.card}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>{ex.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
              <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>SET</div>
              <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>WEIGHT</div>
              <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>REPS</div>
              <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700 }}>STATUS</div>
              {ex.sets?.map((s, si) => (
                <>
                  <div key={`s-${si}`} style={{ fontSize: 14, fontFamily: "'Bebas Neue'" }}>{s.setNumber}</div>
                  <div style={{ fontSize: 14, fontFamily: "'Bebas Neue'" }}>{s.weight || "–"}</div>
                  <div style={{ fontSize: 14, fontFamily: "'Bebas Neue'" }}>{s.reps || "–"}</div>
                  <div style={{ fontSize: 12, color: s.completed ? C.accent : C.textDim }}>{s.completed ? "✓" : "–"}</div>
                </>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24 }}>
        <div style={styles.sectionTitle}>HISTORY</div>
        <button onClick={onRefresh} style={{ ...styles.btn("ghost"), padding: "6px 12px", fontSize: 12 }}>↻ SYNC</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "week", "month"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 16px", borderRadius: 20, border: `1px solid ${f === filter ? C.accent : C.border}`,
            background: f === filter ? C.accent + "22" : "transparent",
            color: f === filter ? C.accent : C.textMuted,
            fontSize: 11, fontFamily: "system-ui", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em"
          }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 20 }}>NO WORKOUTS YET</div>
          <div style={{ fontSize: 12, fontFamily: "system-ui", marginTop: 8 }}>Complete a workout to see it here</div>
        </div>
      ) : (
        filtered.map((log, i) => (
          <div key={log.id || i}
            onClick={() => setSelected(log)}
            style={{ ...styles.card, cursor: "pointer", transition: "border-color 0.2s" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 22 }}>{log.workoutName}</div>
                <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, marginTop: 2 }}>
                  {log.completedAt?.toDate
                    ? log.completedAt.toDate().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                    : log.completedAt
                      ? new Date(log.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                      : "Recently"}
                  {log.duration ? ` · ${Math.floor(log.duration / 60)}min` : ""}
                  {log.exercises ? ` · ${log.exercises.length} exercises` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {log.rating && <div style={{ fontSize: 18, color: C.accent }}>{log.rating}★</div>}
                <div style={{ fontSize: 20, color: C.textDim }}>›</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────
function ProgressTab({ workoutLogs }) {
  const [selectedExercise, setSelectedExercise] = useState("");

  // Get all exercise names from history
  const allExercises = [...new Set(
    workoutLogs.flatMap(log => log.exercises?.map(ex => ex.name) || [])
  )];

  // Get data for selected exercise
  const exerciseHistory = workoutLogs
    .filter(log => log.exercises?.some(ex => ex.name === selectedExercise))
    .map(log => {
      const ex = log.exercises.find(e => e.name === selectedExercise);
      const topSet = ex?.sets?.reduce((best, s) => {
        const w = parseFloat(s.weight) || 0;
        return w > (parseFloat(best?.weight) || 0) ? s : best;
      }, null);
      return {
        date: log.completedAt?.toDate
          ? log.completedAt.toDate()
          : log.completedAt ? new Date(log.completedAt) : new Date(),
        topWeight: parseFloat(topSet?.weight) || 0,
        topReps: topSet?.reps || 0,
        totalSets: ex?.sets?.filter(s => s.completed).length || 0,
      };
    })
    .sort((a, b) => a.date - b.date);

  return (
    <div>
      <div style={styles.sectionTitle}>PROGRESS</div>
      <div style={styles.sectionSub}>TRACK YOUR STRENGTH GAINS</div>

      {allExercises.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 20 }}>NO DATA YET</div>
          <div style={{ fontSize: 12, fontFamily: "system-ui", marginTop: 8 }}>Complete workouts to track progress</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>SELECT EXERCISE</label>
            <select
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
              style={{ ...styles.input, fontFamily: "'Bebas Neue'", fontSize: 16 }}
            >
              <option value="">— Choose Exercise —</option>
              {allExercises.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {selectedExercise && exerciseHistory.length > 0 && (
            <>
              {/* Top stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <div style={styles.card}>
                  <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700, letterSpacing: "0.1em" }}>BEST WEIGHT</div>
                  <div style={{ fontSize: 36, color: C.accent, marginTop: 4 }}>
                    {Math.max(...exerciseHistory.map(d => d.topWeight))} <span style={{ fontSize: 16, color: C.textMuted }}>lbs</span>
                  </div>
                </div>
                <div style={styles.card}>
                  <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, fontWeight: 700, letterSpacing: "0.1em" }}>SESSIONS</div>
                  <div style={{ fontSize: 36, color: C.accentBlue, marginTop: 4 }}>{exerciseHistory.length}</div>
                </div>
              </div>

              {/* History list */}
              <div style={{ fontSize: 18, letterSpacing: "0.05em", marginBottom: 12 }}>SESSION HISTORY</div>
              {exerciseHistory.slice().reverse().map((entry, i) => (
                <div key={i} style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: "system-ui", color: C.textMuted }}>
                      {entry.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textDim }}>
                      {entry.totalSets} sets completed
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, color: i === 0 ? C.accent : C.text }}>
                      {entry.topWeight > 0 ? `${entry.topWeight} lbs` : "–"}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted }}>
                      {entry.topReps} reps
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {selectedExercise && exerciseHistory.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: C.textMuted, fontFamily: "system-ui", fontSize: 13 }}>
              No history found for this exercise yet
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, onSignOut }) {
  const [wellbeing, setWellbeing] = useState(() => loadLocal(KEYS.WELLBEING, {}));
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayWellbeing = wellbeing[todayKey] || {};

  const saveWellbeing = (field, value) => {
    const updated = { ...wellbeing, [todayKey]: { ...(wellbeing[todayKey] || {}), [field]: value } };
    setWellbeing(updated);
    saveLocal(KEYS.WELLBEING, updated);
  };

  const metrics = [
    { key: "energy", label: "ENERGY", icon: "⚡" },
    { key: "sleep", label: "SLEEP", icon: "😴" },
    { key: "soreness", label: "SORENESS", icon: "💪" },
    { key: "stress", label: "STRESS", icon: "🧠" },
  ];

  return (
    <div>
      <div style={{ paddingTop: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{ width: 56, height: 56, borderRadius: "50%", border: `2px solid ${C.accent}` }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: C.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: "#000"
            }}>
              {user.displayName?.[0] || "A"}
            </div>
          )}
          <div>
            <div style={{ fontSize: 28 }}>{user.displayName?.toUpperCase() || "ATHLETE"}</div>
            <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted }}>{user.email}</div>
          </div>
        </div>
      </div>

      {/* Daily check-in */}
      <div style={{ fontSize: 22, letterSpacing: "0.05em", marginBottom: 4 }}>DAILY CHECK-IN</div>
      <div style={{ fontSize: 11, fontFamily: "system-ui", color: C.textMuted, marginBottom: 16 }}>How are you feeling today?</div>

      {metrics.map(m => (
        <div key={m.key} style={{ ...styles.card, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <div style={{ fontSize: 18 }}>{m.label}</div>
            {todayWellbeing[m.key] && (
              <span style={{ ...styles.pill(C.accent), marginLeft: "auto" }}>{todayWellbeing[m.key]}/5</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => saveWellbeing(m.key, n)} style={{
                flex: 1, padding: "10px 0", borderRadius: 8,
                border: `1px solid ${n <= (todayWellbeing[m.key] || 0) ? C.accent : C.border}`,
                background: n <= (todayWellbeing[m.key] || 0) ? C.accent + "22" : "transparent",
                color: n <= (todayWellbeing[m.key] || 0) ? C.accent : C.textMuted,
                fontSize: 16, fontFamily: "'Bebas Neue'", cursor: "pointer"
              }}>{n}</button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontFamily: "system-ui", color: C.textMuted, marginBottom: 4 }}>CURRENT PROGRAM</div>
        <div style={{ fontSize: 20, marginBottom: 2 }}>{SAMPLE_PROGRAM.name}</div>
        <div style={{ fontSize: 12, fontFamily: "system-ui", color: C.textMuted }}>{SAMPLE_PROGRAM.phase}</div>
      </div>

      <button onClick={onSignOut} style={{ ...styles.btn("ghost"), width: "100%", marginTop: 24, color: C.accentAlt, borderColor: C.accentAlt + "44" }}>
        SIGN OUT
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState(() => loadLocal(KEYS.WORKOUT_LOGS, []));

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, []);

  // Load Firebase logs when user logs in
  useEffect(() => {
    if (!user) return;
    loadAllWorkoutLogs(user.uid).then(logs => {
      if (logs.length > 0) {
        const merged = [...logs, ...loadLocal(KEYS.WORKOUT_LOGS, [])];
        const deduped = [...new Map(merged.map(l => [l.id || l.completedAt, l])).values()];
        deduped.sort((a, b) => {
          const da = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt || 0);
          const db2 = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt || 0);
          return db2 - da;
        });
        setWorkoutLogs(deduped);
        saveLocal(KEYS.WORKOUT_LOGS, deduped);
      }
    });
  }, [user]);

  const handleWorkoutComplete = (updatedLogs) => {
    setWorkoutLogs(updatedLogs);
    setActiveWorkout(null);
    setTab("history");
  };

  const handleRefreshHistory = async () => {
    if (!user) return;
    const logs = await loadAllWorkoutLogs(user.uid);
    if (logs.length > 0) {
      setWorkoutLogs(logs);
      saveLocal(KEYS.WORKOUT_LOGS, logs);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setTab("today");
  };

  if (!authLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 36, color: C.accent, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.1em" }}>
          LOADING...
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={() => {}} />;

  if (activeWorkout) {
    return (
      <ActiveWorkout
        user={user}
        workout={activeWorkout}
        onComplete={handleWorkoutComplete}
        onCancel={() => setActiveWorkout(null)}
      />
    );
  }

  const navItems = [
    { id: "today", icon: "🏠", label: "Today" },
    { id: "program", icon: "📋", label: "Program" },
    { id: "habits", icon: "🔥", label: "Habits" },
    { id: "history", icon: "📊", label: "History" },
    { id: "progress", icon: "📈", label: "Progress" },
    { id: "profile", icon: "👤", label: "Me" },
  ];

  return (
    <div style={styles.app}>
      {/* Bebas Neue font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        select option { background: ${C.card}; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.logo}>FRAME<span style={{ color: C.accentAlt }}>WERKS</span></div>
          <div style={styles.logoSub}>FITNESS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: C.accent,
            boxShadow: `0 0 6px ${C.accent}`
          }} />
          <div style={{ fontSize: 10, fontFamily: "system-ui", color: C.textMuted, letterSpacing: "0.1em" }}>LIVE SYNC</div>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === "today" && <TodayTab user={user} workoutLogs={workoutLogs} onStartWorkout={setActiveWorkout} />}
        {tab === "program" && <ProgramTab onStartWorkout={setActiveWorkout} />}
        {tab === "habits" && <HabitsTab user={user} />}
        {tab === "history" && <HistoryTab workoutLogs={workoutLogs} onRefresh={handleRefreshHistory} />}
        {tab === "progress" && <ProgressTab workoutLogs={workoutLogs} />}
        {tab === "profile" && <ProfileTab user={user} onSignOut={handleSignOut} />}
      </div>

      {/* Bottom nav */}
      <nav style={styles.nav}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={styles.navBtn(tab === item.id)}>
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
