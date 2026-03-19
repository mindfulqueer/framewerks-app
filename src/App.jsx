import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onAuth, signInWithGoogle, logOut, getUserProfile, updateUserProfile, loadProgram, loadAllPrograms, saveWorkoutLog, loadWorkoutLogs, saveHabitEntry, loadHabitEntries } from "./firebase";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split("T")[0];
const ACCENT = "#FF4D1C";
const FEELING_OPTIONS = [
  { label: "Crushed It", icon: "\u{1F4AA}", value: 5, color: "#00C2A8" },
  { label: "Strong", icon: "\u{1F525}", value: 4, color: "#4CAF50" },
  { label: "Solid", icon: "\u{1F44A}", value: 3, color: "#F5B301" },
  { label: "Tough", icon: "\u{1F624}", value: 2, color: "#FF9800" },
  { label: "Rough", icon: "\u{1F613}", value: 1, color: "#FF4D1C" },
];
const HABIT_POOL = [
  { id: "h-water", pillar: "nutrition", name: "Drink 8 glasses of water", icon: "\u{1F4A7}", desc: "Stay hydrated throughout the day" },
  { id: "h-protein", pillar: "nutrition", name: "Hit your protein goal", icon: "\u{1F969}", desc: "Aim for 0.8-1g per lb bodyweight" },
  { id: "h-veggies", pillar: "nutrition", name: "Eat 3+ servings of veggies", icon: "\u{1F966}", desc: "Color on your plate = nutrients in your body" },
  { id: "h-mealprep", pillar: "nutrition", name: "Prep tomorrow's meals", icon: "\u{1F371}", desc: "10 min tonight saves 30 min tomorrow" },
  { id: "h-mindful-eat", pillar: "nutrition", name: "One mindful meal", icon: "\u{1F9D8}", desc: "No phone, no screen - just eat and taste" },
  { id: "h-breathwork", pillar: "mindfulness", name: "5 min breathwork", icon: "\u{1FAC1}", desc: "Box breathing or 1:2 ratio - calm your system" },
  { id: "h-meditate", pillar: "mindfulness", name: "10 min meditation", icon: "\u{1F9D8}", desc: "Sit, breathe, observe - no agenda" },
  { id: "h-journal", pillar: "mindfulness", name: "Journal 3 thoughts", icon: "\u{1F4DD}", desc: "Write what's on your mind - no filter" },
  { id: "h-gratitude", pillar: "mindfulness", name: "Name 3 things you're grateful for", icon: "\u{1F64F}", desc: "Rewire your brain toward the positive" },
  { id: "h-screenoff", pillar: "mindfulness", name: "30 min screen-free before bed", icon: "\u{1F4F5}", desc: "Better sleep starts before you close your eyes" },
  { id: "h-mobility", pillar: "movement", name: "10 min morning mobility", icon: "\u{1F938}", desc: "Wake your body up - hips, spine, shoulders" },
  { id: "h-posture", pillar: "movement", name: "3 posture check-ins", icon: "\u{1F9CD}", desc: "Tall spine, shoulders back, breathe deep" },
  { id: "h-steps", pillar: "movement", name: "8,000+ steps", icon: "\u{1F45F}", desc: "Walk more - it's the most underrated exercise" },
  { id: "h-stretch", pillar: "movement", name: "5 min evening stretch", icon: "\u{1F646}", desc: "Decompress your body before sleep" },
  { id: "h-recovery", pillar: "movement", name: "Active recovery session", icon: "\u267B\uFE0F", desc: "Foam roll, light walk, or easy yoga" },
];
const PILLAR_COLORS = { nutrition: "#00C2A8", mindfulness: "#9B6DFF", movement: "#FF4D1C" };
const PILLAR_LABELS = { nutrition: "Nutrition", mindfulness: "Mindfulness", movement: "Movement" };
const COACH_LESSONS = [
  { type: "knowledge", pillar: "nutrition", title: "Did you know?", text: "Protein synthesis peaks within 24-48 hours of training. Spreading protein across 3-4 meals is more effective than loading it all at once." },
  { type: "action", pillar: "nutrition", title: "Try this today", text: "Before your next meal, drink a full glass of water and wait 5 minutes. You'll eat more mindfully and often eat less." },
  { type: "knowledge", pillar: "mindfulness", title: "Did you know?", text: "Just 5 minutes of controlled breathing activates your parasympathetic nervous system, lowering cortisol and improving recovery." },
  { type: "action", pillar: "mindfulness", title: "Try this today", text: "Set 3 phone alarms today. When they go off, take 4 slow breaths: 4 seconds in, hold 4, out 4, hold 4." },
  { type: "knowledge", pillar: "movement", title: "Did you know?", text: "Your thoracic spine should rotate about 35 degrees per side. Most desk workers have lost half that range." },
  { type: "action", pillar: "movement", title: "Try this today", text: "Every hour, stand up and do 5 slow cat-cows. Your spine will thank you and your focus will sharpen." },
  { type: "knowledge", pillar: "nutrition", title: "Did you know?", text: "Dehydration of just 2% reduces strength by up to 20%. Most people show up to the gym already dehydrated." },
  { type: "action", pillar: "mindfulness", title: "Try this today", text: "Write down 3 things you're grateful for before bed tonight. This simple practice rewires your brain toward positivity over time." },
  { type: "action", pillar: "nutrition", title: "Try this today", text: "Add one extra serving of vegetables to your biggest meal. Start small - consistency compounds." },
];
const S = { label: { fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555" }, body: { fontFamily: "'DM Sans',sans-serif" }, backBtn: { background: "none", border: "none", color: "#555", fontFamily: "'DM Sans',sans-serif", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 14 } };

function RestTimer({ seconds, accentColor, onDone, onCancel }) {
  const [remaining, setRemaining] = useState(seconds);
  const [phase, setPhase] = useState("inhale");
  const [breathElapsed, setBreathElapsed] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const breathStartRef = useRef(null);
  const inhaleTime = 3, exhaleTime = 6, cycleTime = 9;
  useEffect(() => {
    startRef.current = Date.now(); breathStartRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      const bPos = ((Date.now() - breathStartRef.current) / 1000) % cycleTime;
      if (bPos < inhaleTime) { setPhase("inhale"); setBreathElapsed(bPos / inhaleTime); }
      else { setPhase("exhale"); setBreathElapsed((bPos - inhaleTime) / exhaleTime); }
      if (left <= 0) { onDone(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [seconds, onDone]);
  const progress = 1 - remaining / seconds;
  const R = 130, C = 2 * Math.PI * R;
  const breathY = phase === "inhale" ? breathElapsed : 1 - breathElapsed;
  const yOffset = R - breathY * R * 2;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 1500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.3s ease" }}>
      <p style={{ ...S.label, marginBottom: 28 }}>Rest & Breathe</p>
      <div style={{ position: "relative", width: 340, height: 340, marginBottom: 28 }}>
        <svg width="340" height="340" style={{ position: "absolute", inset: 0 }}>
          <circle cx="170" cy="170" r={R} fill="none" stroke="#1A1A1A" strokeWidth="6" />
          <circle cx="170" cy="170" r={R} fill="none" stroke={accentColor} strokeWidth="6" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} strokeLinecap="round" transform="rotate(-90 170 170)" style={{ transition: "stroke-dashoffset 0.3s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: accentColor, boxShadow: `0 0 ${20 + breathY * 25}px ${accentColor}${Math.round(30 + breathY * 50).toString(16).padStart(2, '0')}`, position: "absolute", top: `calc(50% + ${yOffset}px - 15px)`, left: "calc(50% - 15px)" }} />
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1px solid ${accentColor}33`, position: "absolute", top: 170 - R }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1px solid ${accentColor}33`, position: "absolute", bottom: 170 - R }} />
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 80, letterSpacing: 4, color: "#F0EDE8" }}>{Math.floor(remaining / 60)}:{String(Math.floor(remaining % 60)).padStart(2, "0")}</p>
        </div>
      </div>
      <div style={{ fontSize: 24, marginBottom: 6, transition: "transform 0.3s ease", transform: phase === "inhale" ? "rotate(0deg)" : "rotate(180deg)" }}><span style={{ color: phase === "inhale" ? accentColor : "#F0EDE8" }}>{"\u2191"}</span></div>
      <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 3, color: phase === "inhale" ? accentColor : "#F0EDE8", marginBottom: 6 }}>{phase === "inhale" ? "INHALE" : "EXHALE"}</p>
      <p style={{ ...S.body, fontSize: 12, color: "#555", marginBottom: 32 }}>{phase === "inhale" ? `${inhaleTime}s in through your nose` : `${exhaleTime}s slow release`}</p>
      <p style={{ ...S.body, fontSize: 10, color: "#333", marginBottom: 18 }}>1 : 2 breath ratio</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onCancel} style={{ padding: "10px 28px", background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12, color: "#888", ...S.body, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Skip</button>
        <button onClick={onDone} style={{ padding: "10px 28px", background: accentColor, border: "none", borderRadius: 12, color: "#fff", ...S.body, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
      </div>
    </div>
  );
}

function VideoModal({ url, title, onClose }) {
  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.2s ease" }}><div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, color: "#F0EDE8" }}>{title}</p><button onClick={onClose} style={{ background: "#222", border: "none", color: "#888", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16 }}>{"\u2715"}</button></div><div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 14, overflow: "hidden", background: "#111" }}><iframe src={url} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} /></div></div></div>);
}

function ExCard({ ex, idx, variant, logData, onUpdateSet, onToggleSet }) {
  const [expanded, setExpanded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const videoId = ex.videoUrl ? ex.videoUrl.split("v=")[1]?.split("&")[0] || ex.videoUrl.split("/").pop() : null;
  return (<>
    {videoOpen && videoId && <VideoModal url={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} title={ex.name} onClose={() => setVideoOpen(false)} />}
    <div style={{ background: "#111", borderRadius: 16, border: "1px solid #1E1E1E", overflow: "hidden", marginBottom: 10 }}>
      <div style={{ padding: "13px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        {videoId ? (
          <div onClick={() => setVideoOpen(true)} style={{ position: "relative", width: 62, height: 62, borderRadius: 11, overflow: "hidden", flexShrink: 0, cursor: "pointer", background: "#1A1A1A" }}>
            <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt={ex.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 9, marginLeft: 2 }}>{"\u25B6"}</span></div></div>
          </div>
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 11, background: variant === "warmup" ? "#FF980022" : variant === "cooldown" ? "#00C2A822" : ACCENT + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: variant === "warmup" ? "#FF9800" : variant === "cooldown" ? "#00C2A8" : ACCENT }}>{idx + 1}</span></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1 }}>{ex.name || "Exercise"}</p>
          <p style={{ ...S.body, fontSize: 11, color: "#555", marginTop: 3 }}>{ex.sets?.length || 0} sets</p>
          {(ex.sets?.[0]?.tempo || ex.sets?.[0]?.rpe) && (
            <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
              {ex.sets[0].tempo && <span style={{ ...S.body, fontSize: 10, fontWeight: 700, background: ACCENT + "18", color: ACCENT, borderRadius: 5, padding: "2px 7px" }}>{"\u23F1"} {ex.sets[0].tempo}</span>}
              {ex.sets[0].rpe && <span style={{ ...S.body, fontSize: 10, fontWeight: 700, background: "#1E1E1E", color: "#888", borderRadius: 5, padding: "2px 7px" }}>{"\u{1F3AF}"} RPE {ex.sets[0].rpe}</span>}
            </div>
          )}
        </div>
        <button onClick={() => setExpanded(p => !p)} style={{ background: "#1A1A1A", border: "none", color: "#666", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "transform 0.25s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u2193"}</button>
      </div>
      {expanded && ex.coachNotes && (
        <div style={{ borderTop: "1px solid #1A1A1A", padding: "12px 14px", animation: "slideUp 0.22s ease" }}>
          <p style={{ ...S.label, color: ACCENT, marginBottom: 8 }}>Coach Cues</p>
          <p style={{ ...S.body, fontSize: 13, color: "#BDBAB5", lineHeight: 1.5 }}>{ex.coachNotes}</p>
          {videoId && <button onClick={() => setVideoOpen(true)} style={{ width: "100%", padding: "10px", background: ACCENT + "18", border: `1px solid ${ACCENT}44`, borderRadius: 10, color: ACCENT, ...S.body, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>{"\u25B6"} Watch Full Demo</button>}
        </div>
      )}
      <div style={{ borderTop: "1px solid #1A1A1A", padding: "11px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 26px", gap: 5, marginBottom: 5 }}>
          {["", "WEIGHT", "REPS", ""].map((h, i) => <p key={i} style={{ ...S.label, fontSize: 9, color: "#3A3A3A", textAlign: i > 0 ? "center" : "left" }}>{h}</p>)}
        </div>
        {(logData || []).map((setLog, sIdx) => {
          const target = ex.sets?.[sIdx];
          return (
            <div key={sIdx} style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 26px", gap: 5, marginBottom: 5 }}>
              <div style={{ width: 26, height: 38, borderRadius: 7, background: setLog.done ? ACCENT : "#181818", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ ...S.body, fontSize: setLog.done ? 12 : 11, fontWeight: 700, color: setLog.done ? "#fff" : "#555" }}>{setLog.done ? "\u2713" : sIdx + 1}</span>
              </div>
              <input type="number" placeholder={target?.weight || "\u2014"} value={setLog.weight} onChange={e => onUpdateSet(sIdx, "weight", e.target.value)} style={{ background: "#161616", border: "1px solid #242424", borderRadius: 8, color: "#F0EDE8", textAlign: "center", height: 38, width: "100%", fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1, outline: "none" }} />
              <input type="number" placeholder={target?.reps || "\u2014"} value={setLog.reps} onChange={e => onUpdateSet(sIdx, "reps", e.target.value)} style={{ background: "#161616", border: "1px solid #242424", borderRadius: 8, color: "#F0EDE8", textAlign: "center", height: 38, width: "100%", fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1, outline: "none" }} />
              <button onClick={() => onToggleSet(sIdx)} style={{ width: 26, height: 38, borderRadius: 7, background: setLog.done ? "#00C2A8" : "#181818", border: setLog.done ? "none" : "1px solid #2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: setLog.done ? "#fff" : "#333", fontSize: 12 }}>{setLog.done ? "\u2713" : ""}</button>
            </div>
          );
        })}
      </div>
    </div>
  </>);
}

export default function FramewerksApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("home");
  const [toast, setToast] = useState(null);
  const [activePhase, setActivePhase] = useState(null);
  const [activeDay, setActiveDay] = useState(null);
  const [workoutLog, setWorkoutLog] = useState({});
  const [workoutFeeling, setWorkoutFeeling] = useState(null);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [detailLog, setDetailLog] = useState(null);
  const [activeHabits, setActiveHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState({});
  const [showHabitPicker, setShowHabitPicker] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [wellbeingCheckin, setWellbeingCheckin] = useState({ energy: null, stress: null, sleep: null, mood: null });
  const [wellbeingHistory, setWellbeingHistory] = useState([]);
  const [weekSchedule, setWeekSchedule] = useState({}); // { Mon: { phaseIdx, dayIdx } | "rest", Tue: ... }
  const [assigningDay, setAssigningDay] = useState(null); // which calendar day is being assigned
  const [expandedPhase, setExpandedPhase] = useState(0); // which phase is expanded in program view
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const WEEK_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
  const todayDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];

  useEffect(() => {
    const unsub = onAuth(async (fu) => {
      if (fu) {
        setUser(fu);
        try {
          const prof = await getUserProfile(fu.uid); setProfile(prof);
          if (prof?.assignedProgramId) { const prog = await loadProgram(prof.assignedProgramId); setProgram(prog); }
          if (prof?.weekSchedule) setWeekSchedule(prof.weekSchedule);
          if (prof?.activeHabits) setActiveHabits(prof.activeHabits);
          if (prof?.wellbeingHistory) setWellbeingHistory(prof.wellbeingHistory);
          const logs = await loadWorkoutLogs(fu.uid); setWorkoutLogs(logs);
          // Load habit completions from habits collection
          const habs = await loadHabitEntries(fu.uid);
          const comps = {};
          habs.forEach(h => { if (h.completedHabits) comps[h.date] = h.completedHabits; });
          setHabitCompletions(comps);
        } catch (err) { console.error("Load error:", err); }
      } else { setUser(null); setProfile(null); setProgram(null); }
      setLoading(false);
    }); return unsub;
  }, []);

  // ─── Loaded ref pattern: skip saves on initial load ───
  const loaded = useRef(false);
  useEffect(() => {
    if (!loading && user) loaded.current = true;
  }, [loading, user]);

  // Save weekSchedule to user profile
  useEffect(() => {
    if (!loaded.current || !user) return;
    updateUserProfile(user.uid, { weekSchedule }).catch(err => console.error("Schedule save:", err));
  }, [weekSchedule]);

  // Save activeHabits to user profile
  useEffect(() => {
    if (!loaded.current || !user) return;
    updateUserProfile(user.uid, { activeHabits }).catch(err => console.error("Habits save:", err));
  }, [activeHabits]);

  // Save wellbeing history to user profile
  useEffect(() => {
    if (!loaded.current || !user) return;
    updateUserProfile(user.uid, { wellbeingHistory: wellbeingHistory.slice(0, 30) }).catch(err => console.error("Wellbeing save:", err));
  }, [wellbeingHistory]);

  const initLog = (day) => { const log = {}; const init = (exs) => (exs || []).forEach(ex => { log[ex.id] = { sets: ex.sets.map(() => ({ weight: "", reps: "", done: false })) }; }); init(day.warmup); init(day.exercises); init(day.cooldown); return log; };
  const updateSet = (eid, si, f, v) => setWorkoutLog(p => { const ex = p[eid] || { sets: [] }; const sets = [...ex.sets]; if (!sets[si]) sets[si] = {}; sets[si] = { ...sets[si], [f]: v }; return { ...p, [eid]: { ...ex, sets } }; });
  const toggleSet = (eid, si, rest) => { setWorkoutLog(p => { const ex = p[eid] || { sets: [] }; const sets = [...ex.sets]; if (!sets[si]) sets[si] = {}; const was = sets[si].done; sets[si] = { ...sets[si], done: !was }; return { ...p, [eid]: { ...ex, sets } }; }); if (!workoutLog[eid]?.sets?.[si]?.done) { setRestSeconds(parseInt(rest) || 60); setShowRestTimer(true); } };
  const startWorkout = (phase, day) => { setActivePhase(phase); setActiveDay(day); setWorkoutLog(initLog(day)); setWorkoutFeeling(null); setWorkoutNotes(""); setView("workout"); };

  const finishWorkout = async () => {
    if (!workoutFeeling) return showToast("Rate how you felt first!");
    const allEx = [...(activeDay.warmup || []), ...(activeDay.exercises || []), ...(activeDay.cooldown || [])];
    const totalSets = allEx.reduce((s, ex) => s + (ex.sets?.length || 0), 0);
    const doneSets = allEx.reduce((s, ex) => s + (workoutLog[ex.id]?.sets || []).filter(st => st.done).length, 0);
    const log = { id: uid(), userId: user.uid, programId: program?.id, programName: program?.name || "Custom", phaseId: activePhase?.id, phaseName: activePhase?.name || "", dayId: activeDay.id, dayLabel: activeDay.label, date: todayStr(), feeling: workoutFeeling, notes: workoutNotes, duration: 0, totalSets, completedSets: doneSets, exercises: allEx.map(ex => ({ name: ex.name, sets: (workoutLog[ex.id]?.sets || []).map(s => ({ reps: s.reps, weight: s.weight, done: s.done })) })) };
    try { await saveWorkoutLog(log); } catch (err) { console.error(err); }
    setWorkoutLogs(p => [log, ...p]); showToast("Session saved! \u{1F525}"); setView("home");
  };

  const todayKey = todayStr();
  const todayCompletions = habitCompletions[todayKey] || [];
  const toggleHabit = async (hid) => {
    const updated = todayCompletions.includes(hid) ? todayCompletions.filter(id => id !== hid) : [...todayCompletions, hid];
    setHabitCompletions(p => ({ ...p, [todayKey]: updated }));
    if (user) {
      try { await saveHabitEntry({ date: todayKey, userId: user.uid, completedHabits: updated, activeHabits, entries: {} }); }
      catch (err) { console.error("Habit toggle save:", err); }
    }
  };

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const todayLesson = COACH_LESSONS[dayOfYear % COACH_LESSONS.length];
  const firstName = (profile?.name || user?.displayName || "").split(" ")[0] || "there";

  const CSS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:0}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes toastIn{from{transform:translateX(-50%) translateY(16px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}.su{animation:slideUp .35s ease forwards}.fi{animation:fadeIn .3s ease forwards}.pr{cursor:pointer;transition:transform .15s,opacity .15s}.pr:active{transform:scale(.97);opacity:.8}`;

  if (loading) return (<div style={{ fontFamily: "'Bebas Neue',sans-serif", background: "#0A0A0A", minHeight: "100vh", color: "#F0EDE8", maxWidth: 430, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><style>{CSS}</style><p style={{ fontSize: 22, letterSpacing: 3, opacity: 0.4 }}>Loading...</p></div>);

  if (!user) return (<div style={{ fontFamily: "'Bebas Neue',sans-serif", background: "#0A0A0A", minHeight: "100vh", color: "#F0EDE8", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}><style>{CSS}</style><h1 style={{ fontSize: 52, letterSpacing: 4, lineHeight: 0.92 }}>FRAMEWERKS<br /><span style={{ color: ACCENT }}>FITNESS</span></h1><p style={{ ...S.body, fontSize: 12, color: "#555", letterSpacing: 3, textTransform: "uppercase", marginTop: 8, marginBottom: 48 }}>Train Your Body. Strengthen Your Mind.</p><button onClick={async () => { try { await signInWithGoogle(); } catch (err) { console.error(err); } }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 32px", background: "white", color: "#333", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}><svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Continue with Google</button></div>);

  return (<div style={{ fontFamily: "'Bebas Neue',sans-serif", background: "#0A0A0A", minHeight: "100vh", color: "#F0EDE8", maxWidth: 430, margin: "0 auto" }}><style>{CSS}</style>
    {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "#1C1C1C", border: "1px solid #2A2A2A", padding: "12px 22px", borderRadius: 14, zIndex: 3000, whiteSpace: "nowrap", ...S.body, fontSize: 14, fontWeight: 600, animation: "toastIn 0.3s ease forwards", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>{toast}</div>}
    {showRestTimer && <RestTimer seconds={restSeconds} accentColor={ACCENT} onDone={() => { setShowRestTimer(false); showToast("Rest complete \u{1F4AA}"); }} onCancel={() => setShowRestTimer(false)} />}

    {view === "home" && (<div style={{ paddingBottom: 90 }}>
      <div style={{ padding: "52px 24px 20px" }}><p style={{ ...S.label, marginBottom: 4 }}>Today {"\u00B7"} {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1 style={{ fontSize: 44, lineHeight: 0.92, letterSpacing: 3 }}>FRAMEWERKS<br /><span style={{ color: ACCENT }}>FITNESS</span></h1><p style={{ ...S.body, fontSize: 14, color: "#555", marginTop: 10 }}>Hey {firstName}</p></div>
      <div style={{ padding: "0 24px 18px" }}><div style={{ background: "#111", borderRadius: 16, border: `1px solid ${PILLAR_COLORS[todayLesson.pillar]}33`, padding: "16px", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: PILLAR_COLORS[todayLesson.pillar] }} /><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ ...S.body, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: PILLAR_COLORS[todayLesson.pillar] + "22", color: PILLAR_COLORS[todayLesson.pillar], borderRadius: 5, padding: "2px 8px" }}>{PILLAR_LABELS[todayLesson.pillar]}</span><span style={{ ...S.body, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444" }}>{todayLesson.type === "knowledge" ? "\u{1F4A1} Knowledge" : "\u26A1 Action"}</span></div><p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>{todayLesson.title}</p><p style={{ ...S.body, fontSize: 13, color: "#999", lineHeight: 1.55 }}>{todayLesson.text}</p></div></div>
      {/* Weekly Calendar */}
      <div style={{ padding: "0 24px 18px" }}>
        <p style={{ ...S.label, marginBottom: 10 }}>This Week</p>
        <div style={{ display: "flex", gap: 5 }}>
          {WEEK_DAYS.map(d => {
            const sched = weekSchedule[d];
            const isToday = d === todayDayName;
            const isRest = sched === "rest";
            const hasWorkout = sched && sched !== "rest";
            const dayData = hasWorkout && program ? program.phases[sched.phaseIdx]?.days[sched.dayIdx] : null;
            return (
              <div key={d} onClick={() => {
                if (hasWorkout && dayData) startWorkout(program.phases[sched.phaseIdx], dayData);
              }} style={{ flex: 1, background: isToday ? ACCENT + "18" : "#111", border: `1px solid ${isToday ? ACCENT : "#1E1E1E"}`, borderRadius: 12, padding: "8px 2px", textAlign: "center", cursor: hasWorkout ? "pointer" : "default", minHeight: 68 }}>
                <p style={{ ...S.body, fontSize: 10, fontWeight: 700, color: isToday ? ACCENT : "#555", marginBottom: 4 }}>{d}</p>
                {isRest ? (
                  <p style={{ fontSize: 14 }}>{"\u{1F9D8}"}</p>
                ) : hasWorkout && dayData ? (
                  <div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, margin: "0 auto 3px" }} />
                    <p style={{ ...S.body, fontSize: 8, color: "#888", lineHeight: 1.2 }}>{dayData.label.replace(/^Wk\d+\s*[-–]\s*/, "").substring(0, 8)}</p>
                  </div>
                ) : (
                  <p style={{ ...S.body, fontSize: 10, color: "#2A2A2A" }}>{"\u2014"}</p>
                )}
              </div>
            );
          })}
        </div>
        {Object.keys(weekSchedule).length === 0 && program && (
          <p className="pr" onClick={() => setView("program")} style={{ ...S.body, fontSize: 12, color: ACCENT, textAlign: "center", marginTop: 10, cursor: "pointer" }}>Tap your program below to set up your week {"\u2192"}</p>
        )}
      </div>

      {/* Program Card (compact) */}
      <div style={{ padding: "0 24px 18px" }}><p style={{ ...S.label, marginBottom: 10 }}>Your Program</p>{program ? (
        <div className="pr" onClick={() => setView("program")} style={{ background: "#111", borderRadius: 16, border: "1px solid #1E1E1E", overflow: "hidden", cursor: "pointer" }}>
          {/* Placeholder image */}
          <div style={{ width: "100%", height: 140, background: `linear-gradient(135deg, ${ACCENT}33, #0A0A0A)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #111 0%, transparent 60%)" }} />
            <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, letterSpacing: 6, color: ACCENT + "33", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)" }}>FW</p>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 1.5 }}>{program.name}</p>
            {program.tags?.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{program.tags.map(t => <span key={t} style={{ ...S.body, fontSize: 10, fontWeight: 700, background: ACCENT + "18", color: ACCENT, borderRadius: 5, padding: "2px 8px" }}>{t}</span>)}</div>}
            <p style={{ ...S.body, fontSize: 12, color: "#555", marginTop: 6, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{program.description}</p>
            <p style={{ ...S.body, fontSize: 11, color: ACCENT, marginTop: 8, fontWeight: 700 }}>View Program {"\u2192"}</p>
          </div>
        </div>
      ) : (
        <div style={{ background: "#111", borderRadius: 14, padding: "24px 16px", border: "1px dashed #2A2A2A", textAlign: "center" }}><p style={{ fontSize: 28 }}>{"\u26A1"}</p><p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 8 }}>No program assigned yet. Your coach will send one to you.</p></div>
      )}</div>
      <div style={{ padding: "0 24px 18px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><p style={{ ...S.label }}>Daily Habits {activeHabits.length > 0 ? `(${todayCompletions.filter(id => activeHabits.includes(id)).length}/${activeHabits.length})` : ""}</p><button onClick={() => setShowHabitPicker(true)} style={{ background: "none", border: "none", color: ACCENT, ...S.body, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{activeHabits.length > 0 ? "Edit" : "Choose Habits"}</button></div>{activeHabits.length === 0 ? (<div className="pr" onClick={() => setShowHabitPicker(true)} style={{ background: "#111", borderRadius: 14, padding: "24px 16px", border: "1px dashed #2A2A2A", textAlign: "center", cursor: "pointer" }}><p style={{ fontSize: 24 }}>{"\u{1F331}"}</p><p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 8 }}>Choose habits to build your daily practice</p></div>) : (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{activeHabits.map(hid => { const h = HABIT_POOL.find(hp => hp.id === hid); if (!h) return null; const done = todayCompletions.includes(hid); return (<div key={hid} className="pr" onClick={() => toggleHabit(hid)} style={{ background: done ? PILLAR_COLORS[h.pillar] + "12" : "#111", borderRadius: 14, border: `1px solid ${done ? PILLAR_COLORS[h.pillar] + "44" : "#1E1E1E"}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}><div style={{ width: 32, height: 32, borderRadius: 10, background: done ? PILLAR_COLORS[h.pillar] : "#1A1A1A", border: done ? "none" : "1px solid #2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{done ? <span style={{ fontSize: 14, color: "#fff" }}>{"\u2713"}</span> : <span style={{ fontSize: 16 }}>{h.icon}</span>}</div><div style={{ flex: 1 }}><p style={{ ...S.body, fontSize: 13, fontWeight: 600, color: done ? "#666" : "#F0EDE8", textDecoration: done ? "line-through" : "none" }}>{h.name}</p><p style={{ ...S.body, fontSize: 10, color: "#444", marginTop: 1 }}>{h.desc}</p></div></div>); })}</div>)}</div>
      <div style={{ padding: "0 24px 18px" }}><button className="pr" onClick={() => { setWellbeingCheckin({ energy: null, stress: null, sleep: null, mood: null }); setShowCheckin(true); }} style={{ width: "100%", padding: "14px 16px", background: "#111", border: "1px solid #1E1E1E", borderRadius: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}><span style={{ fontSize: 24 }}>{"\u{1F4AC}"}</span><div style={{ textAlign: "left" }}><p style={{ ...S.body, fontSize: 14, fontWeight: 600, color: "#F0EDE8" }}>Wellbeing Check-In</p><p style={{ ...S.body, fontSize: 11, color: "#555" }}>How are you feeling today?</p></div></button></div>
      {workoutLogs.length > 0 && <div style={{ padding: "0 24px 18px" }}><p style={{ ...S.label, marginBottom: 10 }}>Last Session</p><div className="pr" onClick={() => { setDetailLog(workoutLogs[0]); setView("log-detail"); }} style={{ background: "#111", borderRadius: 14, padding: "13px 16px", border: "1px solid #1E1E1E", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}><div><p style={{ fontSize: 20, letterSpacing: 1 }}>{workoutLogs[0].dayLabel}</p><p style={{ ...S.body, fontSize: 11, color: "#555", marginTop: 2 }}>{workoutLogs[0].date} {"\u00B7"} {workoutLogs[0].programName}</p></div><span style={{ fontSize: 26 }}>{FEELING_OPTIONS.find(f => f.value === workoutLogs[0].feeling)?.icon || "\u{1F4AA}"}</span></div></div>}
    </div>)}

    {/* ═══ PROGRAM DETAIL VIEW ═══ */}
    {view === "program" && program && (<div style={{ paddingBottom: 90 }}>
      <div style={{ padding: "52px 24px 18px" }}>
        <button onClick={() => setView("home")} style={S.backBtn}>{"\u2190"} Back</button>
        <h2 style={{ fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>{program.name}</h2>
        {program.tags?.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>{program.tags.map(t => <span key={t} style={{ ...S.body, fontSize: 10, fontWeight: 700, background: ACCENT + "18", color: ACCENT, borderRadius: 5, padding: "2px 8px" }}>{t}</span>)}</div>}
        <p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 8, lineHeight: 1.5 }}>{program.description}</p>
      </div>

      {/* Weekly Schedule Builder */}
      <div style={{ padding: "0 24px 20px" }}>
        <p style={{ ...S.label, marginBottom: 10 }}>Weekly Schedule</p>
        <p style={{ ...S.body, fontSize: 12, color: "#555", marginBottom: 14 }}>Tap a day to assign a workout or rest day</p>
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {WEEK_DAYS.map(d => {
            const sched = weekSchedule[d];
            const isRest = sched === "rest";
            const hasWorkout = sched && sched !== "rest";
            const dayData = hasWorkout && program ? program.phases[sched.phaseIdx]?.days[sched.dayIdx] : null;
            const isAssigning = assigningDay === d;
            return (
              <div key={d} style={{ flex: 1 }}>
                <button onClick={() => setAssigningDay(isAssigning ? null : d)} style={{ width: "100%", background: isAssigning ? ACCENT + "22" : "#111", border: `1px solid ${isAssigning ? ACCENT : "#1E1E1E"}`, borderRadius: 12, padding: "10px 2px", textAlign: "center", cursor: "pointer", minHeight: 72 }}>
                  <p style={{ ...S.body, fontSize: 11, fontWeight: 700, color: isAssigning ? ACCENT : "#555", marginBottom: 4 }}>{d}</p>
                  {isRest ? <p style={{ fontSize: 16 }}>{"\u{1F9D8}"}</p>
                  : hasWorkout ? <><div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, margin: "0 auto 2px" }} /><p style={{ ...S.body, fontSize: 7, color: "#888", lineHeight: 1.1 }}>{dayData?.label?.replace(/^Wk\d+\s*[-\u2013]\s*/, "").substring(0, 10)}</p></>
                  : <p style={{ ...S.body, fontSize: 12, color: "#2A2A2A" }}>{"\u2014"}</p>}
                </button>
              </div>
            );
          })}
        </div>
        {/* Assignment picker */}
        {assigningDay && (
          <div className="fi" style={{ background: "#111", borderRadius: 14, border: "1px solid #1E1E1E", padding: "14px", marginBottom: 10 }}>
            <p style={{ ...S.body, fontSize: 13, fontWeight: 600, color: "#F0EDE8", marginBottom: 10 }}>Assign to {WEEK_FULL[assigningDay]}:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {program.phases.map((phase, pi) => phase.days.map((day, di) => {
                const totalEx = (day.warmup?.length || 0) + (day.exercises?.length || 0) + (day.cooldown?.length || 0);
                const isSelected = weekSchedule[assigningDay]?.phaseIdx === pi && weekSchedule[assigningDay]?.dayIdx === di;
                return (
                  <button key={`${pi}-${di}`} className="pr" onClick={() => { setWeekSchedule(p => ({ ...p, [assigningDay]: { phaseIdx: pi, dayIdx: di } })); setAssigningDay(null); showToast(`${day.label} assigned to ${WEEK_FULL[assigningDay]}`); }}
                    style={{ width: "100%", padding: "10px 12px", background: isSelected ? ACCENT + "15" : "#0A0A0A", border: `1px solid ${isSelected ? ACCENT : "#1A1A1A"}`, borderRadius: 10, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ ...S.body, fontSize: 13, fontWeight: 600, color: isSelected ? ACCENT : "#F0EDE8" }}>{day.label}</p>
                      <p style={{ ...S.body, fontSize: 10, color: "#555" }}>{phase.name} {"\u00B7"} {totalEx} exercises</p>
                    </div>
                    {isSelected && <span style={{ color: ACCENT }}>{"\u2713"}</span>}
                  </button>
                );
              }))}
              {/* Rest day option */}
              <button className="pr" onClick={() => { setWeekSchedule(p => ({ ...p, [assigningDay]: "rest" })); setAssigningDay(null); showToast(`${WEEK_FULL[assigningDay]} set as rest day`); }}
                style={{ width: "100%", padding: "10px 12px", background: weekSchedule[assigningDay] === "rest" ? "#00C2A815" : "#0A0A0A", border: `1px solid ${weekSchedule[assigningDay] === "rest" ? "#00C2A8" : "#1A1A1A"}`, borderRadius: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{"\u{1F9D8}"}</span>
                <p style={{ ...S.body, fontSize: 13, fontWeight: 600, color: weekSchedule[assigningDay] === "rest" ? "#00C2A8" : "#888" }}>Rest Day</p>
              </button>
              {/* Clear option */}
              {weekSchedule[assigningDay] && (
                <button className="pr" onClick={() => { setWeekSchedule(p => { const n = { ...p }; delete n[assigningDay]; return n; }); setAssigningDay(null); }}
                  style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "1px solid #1E1E1E", borderRadius: 10, cursor: "pointer", textAlign: "center" }}>
                  <p style={{ ...S.body, fontSize: 12, color: "#555" }}>Clear</p>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phases (collapsible) */}
      <div style={{ padding: "0 24px" }}>
        <p style={{ ...S.label, marginBottom: 10 }}>Phases</p>
        {program.phases.map((phase, pi) => {
          const isOpen = expandedPhase === pi;
          return (
            <div key={phase.id} style={{ background: "#111", borderRadius: 14, border: "1px solid #1E1E1E", overflow: "hidden", marginBottom: 10 }}>
              <button onClick={() => setExpandedPhase(isOpen ? -1 : pi)} style={{ width: "100%", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer" }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1, color: isOpen ? ACCENT : "#F0EDE8" }}>{phase.name}</p>
                  <p style={{ ...S.body, fontSize: 11, color: "#555", marginTop: 2 }}>{phase.weeks} weeks {"\u00B7"} {phase.days.length} workouts{phase.progression?.type !== "none" ? ` \u00B7 +${phase.progression.amount}${phase.progression.unit}` : ""}</p>
                </div>
                <span style={{ fontSize: 14, color: "#555", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>{"\u2193"}</span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 16px 16px", animation: "slideUp 0.2s ease" }}>
                  {phase.days.map((day, di) => {
                    const totalEx = (day.warmup?.length || 0) + (day.exercises?.length || 0) + (day.cooldown?.length || 0);
                    return (
                      <div key={day.id} className="su pr" style={{ animationDelay: `${di * 0.04}s`, background: "#0A0A0A", borderRadius: 12, border: "1px solid #1A1A1A", marginBottom: 6, cursor: "pointer" }} onClick={() => startWorkout(phase, day)}>
                        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, letterSpacing: 1 }}>{day.label}</p>
                            <p style={{ ...S.body, fontSize: 10, color: "#555", marginTop: 2 }}>{totalEx} exercises</p>
                          </div>
                          <div style={{ background: ACCENT, borderRadius: 8, padding: "7px 14px" }}><span style={{ ...S.body, fontSize: 12, fontWeight: 700, color: "#fff" }}>Start</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>)}

    {showHabitPicker && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}><div style={{ width: "100%", maxWidth: 400, background: "#111", borderRadius: 20, border: "1px solid #1E1E1E", padding: "28px 20px", maxHeight: "85vh", overflowY: "auto" }}><p style={{ fontSize: 28, letterSpacing: 2, marginBottom: 4 }}>BUILD YOUR PRACTICE</p><p style={{ ...S.body, fontSize: 13, color: "#555", marginBottom: 20 }}>Choose habits across all three pillars</p>{["nutrition", "mindfulness", "movement"].map(pillar => (<div key={pillar} style={{ marginBottom: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: PILLAR_COLORS[pillar] }} /><p style={{ ...S.body, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PILLAR_COLORS[pillar] }}>{PILLAR_LABELS[pillar]}</p></div>{HABIT_POOL.filter(h => h.pillar === pillar).map(h => { const isA = activeHabits.includes(h.id); return (<button key={h.id} className="pr" onClick={() => setActiveHabits(p => isA ? p.filter(id => id !== h.id) : [...p, h.id])} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: isA ? PILLAR_COLORS[pillar] + "15" : "#0A0A0A", border: `1px solid ${isA ? PILLAR_COLORS[pillar] + "55" : "#1A1A1A"}`, borderRadius: 12, cursor: "pointer", marginBottom: 6, textAlign: "left" }}><span style={{ fontSize: 20 }}>{h.icon}</span><div style={{ flex: 1 }}><p style={{ ...S.body, fontSize: 13, fontWeight: 600, color: isA ? PILLAR_COLORS[pillar] : "#888" }}>{h.name}</p><p style={{ ...S.body, fontSize: 10, color: "#444" }}>{h.desc}</p></div>{isA && <span style={{ fontSize: 14, color: PILLAR_COLORS[pillar] }}>{"\u2713"}</span>}</button>); })}</div>))}<button onClick={() => setShowHabitPicker(false)} style={{ width: "100%", padding: 14, background: ACCENT, border: "none", borderRadius: 14, color: "#fff", ...S.body, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Done</button></div></div>)}

    {showCheckin && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}><div style={{ width: "100%", maxWidth: 380, background: "#111", borderRadius: 20, border: "1px solid #1E1E1E", padding: "28px 22px", maxHeight: "85vh", overflowY: "auto" }}><p style={{ fontSize: 28, letterSpacing: 2, marginBottom: 6 }}>CHECK-IN</p><p style={{ ...S.body, fontSize: 13, color: "#555", marginBottom: 20 }}>How are you feeling today?</p>{[{ key: "energy", label: "Energy Level", options: [{ v: 1, l: "Low", e: "\u{1F634}" }, { v: 2, l: "Moderate", e: "\u{1F610}" }, { v: 3, l: "Good", e: "\u{1F60A}" }, { v: 4, l: "High", e: "\u26A1" }] }, { key: "stress", label: "Stress Level", options: [{ v: 1, l: "High", e: "\u{1F630}" }, { v: 2, l: "Moderate", e: "\u{1F624}" }, { v: 3, l: "Low", e: "\u{1F60C}" }, { v: 4, l: "Minimal", e: "\u{1F9D8}" }] }, { key: "sleep", label: "Sleep Quality", options: [{ v: 1, l: "Poor", e: "\u{1F635}" }, { v: 2, l: "Fair", e: "\u{1F611}" }, { v: 3, l: "Good", e: "\u{1F634}" }, { v: 4, l: "Great", e: "\u{1F4A4}" }] }, { key: "mood", label: "Overall Mood", options: [{ v: 1, l: "Rough", e: "\u{1F61E}" }, { v: 2, l: "Okay", e: "\u{1F610}" }, { v: 3, l: "Good", e: "\u{1F642}" }, { v: 4, l: "Great", e: "\u{1F601}" }] }].map(cat => (<div key={cat.key} style={{ marginBottom: 18 }}><p style={{ ...S.label, marginBottom: 8 }}>{cat.label}</p><div style={{ display: "flex", gap: 6 }}>{cat.options.map(opt => (<button key={opt.v} onClick={() => setWellbeingCheckin(p => ({ ...p, [cat.key]: opt.v }))} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, background: wellbeingCheckin[cat.key] === opt.v ? ACCENT + "22" : "#0A0A0A", border: `1px solid ${wellbeingCheckin[cat.key] === opt.v ? ACCENT : "#1E1E1E"}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><span style={{ fontSize: 20 }}>{opt.e}</span><span style={{ ...S.body, fontSize: 9, fontWeight: 600, color: wellbeingCheckin[cat.key] === opt.v ? ACCENT : "#444" }}>{opt.l}</span></button>))}</div></div>))}<div style={{ display: "flex", gap: 10, marginTop: 6 }}><button onClick={() => setShowCheckin(false)} style={{ flex: 1, padding: 14, background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 14, color: "#888", ...S.body, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button><button onClick={() => { if (!wellbeingCheckin.energy || !wellbeingCheckin.stress || !wellbeingCheckin.sleep || !wellbeingCheckin.mood) return showToast("Complete all 4 categories"); setWellbeingHistory(p => [{ ...wellbeingCheckin, date: todayStr(), id: Date.now() }, ...p]); setShowCheckin(false); showToast("Check-in saved! \u{1F64F}"); }} style={{ flex: 1, padding: 14, background: ACCENT, border: "none", borderRadius: 14, color: "#fff", ...S.body, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save</button></div></div></div>)}

    {view === "workout" && activeDay && (<div style={{ paddingBottom: 90 }}><div style={{ padding: "52px 24px 18px", background: "#0D0D0D", borderBottom: "1px solid #1A1A1A" }}><button onClick={() => setView("home")} style={S.backBtn}>{"\u2715"} Cancel Workout</button><h2 style={{ fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>{activeDay.label}</h2><p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 4 }}>{activePhase?.name} {"\u00B7"} {program?.name}</p></div><div style={{ padding: "20px 24px" }}>
      {activeDay.warmup?.length > 0 && (<><p style={{ ...S.label, color: "#FF9800", marginBottom: 10 }}>{"\u{1F305}"} Warm-up</p>{activeDay.warmup.map((ex, i) => <ExCard key={ex.id} ex={ex} idx={i} variant="warmup" logData={workoutLog[ex.id]?.sets || []} onUpdateSet={(si, f, v) => updateSet(ex.id, si, f, v)} onToggleSet={(si) => toggleSet(ex.id, si, ex.restSeconds)} />)}</>)}
      {activeDay.exercises?.length > 0 && (<><p style={{ ...S.label, color: ACCENT, marginBottom: 10, marginTop: activeDay.warmup?.length ? 16 : 0 }}>{"\u{1F3CB}\uFE0F"} Main Work</p>{activeDay.exercises.map((ex, i) => <ExCard key={ex.id} ex={ex} idx={i} variant="main" logData={workoutLog[ex.id]?.sets || []} onUpdateSet={(si, f, v) => updateSet(ex.id, si, f, v)} onToggleSet={(si) => toggleSet(ex.id, si, ex.restSeconds)} />)}</>)}
      {activeDay.cooldown?.length > 0 && (<><p style={{ ...S.label, color: "#00C2A8", marginBottom: 10, marginTop: 16 }}>{"\u{1F319}"} Cool-down</p>{activeDay.cooldown.map((ex, i) => <ExCard key={ex.id} ex={ex} idx={i} variant="cooldown" logData={workoutLog[ex.id]?.sets || []} onUpdateSet={(si, f, v) => updateSet(ex.id, si, f, v)} onToggleSet={(si) => toggleSet(ex.id, si, ex.restSeconds)} />)}</>)}
      <div style={{ background: "#111", borderRadius: 16, border: "1px solid #1E1E1E", padding: "18px 16px", marginTop: 20 }}><p style={{ ...S.label, marginBottom: 12 }}>How did that feel?</p><div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{FEELING_OPTIONS.map(f => (<button key={f.value} className="pr" onClick={() => setWorkoutFeeling(f.value)} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, background: workoutFeeling === f.value ? f.color + "25" : "#0A0A0A", border: `2px solid ${workoutFeeling === f.value ? f.color : "#1E1E1E"}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><span style={{ fontSize: 22 }}>{f.icon}</span><span style={{ ...S.body, fontSize: 9, fontWeight: 700, color: workoutFeeling === f.value ? f.color : "#444" }}>{f.label}</span></button>))}</div><textarea placeholder="Notes (optional)..." value={workoutNotes} onChange={e => setWorkoutNotes(e.target.value)} style={{ width: "100%", background: "#0A0A0A", border: "1px solid #1E1E1E", borderRadius: 10, color: "#F0EDE8", padding: "10px 14px", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "none", minHeight: 60 }} /></div>
      <button className="pr" onClick={finishWorkout} style={{ width: "100%", padding: 16, background: ACCENT, border: "none", borderRadius: 14, color: "#fff", fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2, cursor: "pointer", marginTop: 16 }}>FINISH WORKOUT</button>
    </div></div>)}

    {view === "history" && (<div style={{ paddingBottom: 90 }}><div style={{ padding: "52px 24px 20px" }}><h2 style={{ fontSize: 38, letterSpacing: 2 }}>HISTORY</h2><p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 4 }}>{workoutLogs.length} sessions logged</p></div><div style={{ padding: "0 24px" }}>{workoutLogs.length === 0 ? (<div style={{ textAlign: "center", padding: "60px 0", color: "#2E2E2E" }}><p style={{ fontSize: 48 }}>{"\u{1F4CA}"}</p><p style={{ ...S.body, marginTop: 14, fontSize: 14 }}>Complete your first workout to see it here</p></div>) : (<>{<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>{[["Sessions", workoutLogs.length], ["Total Sets", workoutLogs.reduce((a, l) => a + l.completedSets, 0)]].map(([label, val]) => (<div key={label} style={{ background: "#111", borderRadius: 12, padding: "12px 14px", border: "1px solid #1E1E1E" }}><p style={{ ...S.label, fontSize: 8, marginBottom: 4 }}>{label}</p><p style={{ fontSize: 28, letterSpacing: 1 }}>{val}</p></div>))}</div>}{workoutLogs.map((log, i) => (<div key={log.id} className="su pr" style={{ animationDelay: `${i * 0.04}s`, background: "#111", borderRadius: 14, border: "1px solid #1E1E1E", padding: "13px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => { setDetailLog(log); setView("log-detail"); }}><div><p style={{ fontSize: 20, letterSpacing: 1 }}>{log.dayLabel}</p><p style={{ ...S.body, fontSize: 11, color: "#555", marginTop: 2 }}>{log.date} {"\u00B7"} {log.programName}</p></div><div style={{ textAlign: "right" }}><span style={{ fontSize: 22 }}>{FEELING_OPTIONS.find(f => f.value === log.feeling)?.icon || "\u{1F4AA}"}</span><p style={{ ...S.body, fontSize: 10, color: "#555" }}>{log.completedSets}/{log.totalSets} sets</p></div></div>))}</>)}</div></div>)}

    {view === "log-detail" && detailLog && (<div style={{ paddingBottom: 90 }}><div style={{ padding: "52px 24px 20px" }}><button onClick={() => setView("history")} style={S.backBtn}>{"\u2190"} Back</button><h2 style={{ fontSize: 32, letterSpacing: 2 }}>{detailLog.dayLabel}</h2><p style={{ ...S.body, fontSize: 13, color: "#555", marginTop: 4 }}>{detailLog.date} {"\u00B7"} {detailLog.phaseName}</p></div><div style={{ padding: "0 24px" }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}><div style={{ background: "#111", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid #1E1E1E" }}><p style={{ fontSize: 28 }}>{detailLog.completedSets}</p><p style={{ ...S.label, fontSize: 8 }}>Sets Done</p></div><div style={{ background: "#111", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid #1E1E1E" }}><span style={{ fontSize: 28 }}>{FEELING_OPTIONS.find(f => f.value === detailLog.feeling)?.icon || "\u{1F4AA}"}</span><p style={{ ...S.label, fontSize: 8 }}>Feeling</p></div><div style={{ background: "#111", borderRadius: 12, padding: "12px", textAlign: "center", border: "1px solid #1E1E1E" }}><p style={{ fontSize: 28 }}>{detailLog.totalSets}</p><p style={{ ...S.label, fontSize: 8 }}>Total</p></div></div>{detailLog.notes && <div style={{ background: "#111", borderRadius: 12, padding: "12px 16px", border: "1px solid #1E1E1E", marginBottom: 16 }}><p style={{ ...S.label, marginBottom: 6 }}>Notes</p><p style={{ ...S.body, fontSize: 13, color: "#999", lineHeight: 1.5 }}>{detailLog.notes}</p></div>}<div style={{ background: "#111", borderRadius: 16, border: "1px solid #1E1E1E", overflow: "hidden" }}>{detailLog.exercises.map((ex, i) => (<div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid #1A1A1A" }}><p style={{ fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>{ex.name}</p>{ex.sets.map((s, si) => (<p key={si} style={{ ...S.body, fontSize: 12, color: s.done ? "#888" : "#444", padding: "2px 0" }}>Set {si + 1}: {s.reps || "\u2014"} reps {s.weight ? `\u00D7 ${s.weight}` : ""} {s.done ? "\u2713" : "\u2014"}</p>))}</div>))}</div></div></div>)}

    {view === "settings" && (<div style={{ paddingBottom: 90 }}><div style={{ padding: "52px 24px 20px" }}><h2 style={{ fontSize: 38, letterSpacing: 2 }}>SETTINGS</h2></div><div style={{ padding: "0 24px" }}><div style={{ background: "#111", borderRadius: 16, border: "1px solid #1E1E1E", padding: "18px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, #FF8A65)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>{user.photoURL ? <img src={user.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22, fontWeight: 700 }}>{(user.displayName || "?")[0]}</span>}</div><div><p style={{ fontSize: 22, letterSpacing: 1 }}>{user.displayName}</p><p style={{ ...S.body, fontSize: 12, color: "#555" }}>{user.email}</p></div></div><button className="pr" onClick={async () => { await logOut(); setUser(null); }} style={{ width: "100%", padding: 14, background: ACCENT + "18", border: `1px solid ${ACCENT}44`, borderRadius: 14, color: ACCENT, ...S.body, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Sign Out</button></div></div>)}

    {view !== "workout" && (<div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0C0C0C", borderTop: "1px solid #181818", display: "flex", padding: "10px 0 22px", zIndex: 50 }}>{[{ label: "Today", icon: "\u{1F3E0}", v: "home" }, { label: "History", icon: "\u{1F4CA}", v: "history" }, { label: "Settings", icon: "\u2699\uFE0F", v: "settings" }].map(item => (<button key={item.v} onClick={() => { setView(item.v); setDetailLog(null); }} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 0", cursor: "pointer" }}><span style={{ fontSize: 20 }}>{item.icon}</span><span style={{ ...S.body, fontSize: 10, fontWeight: 700, color: view === item.v || (item.v === "history" && view === "log-detail") ? ACCENT : "#333", letterSpacing: "0.06em", textTransform: "uppercase" }}>{item.label}</span>{(view === item.v || (item.v === "history" && view === "log-detail")) && <div style={{ width: 18, height: 2, background: ACCENT, borderRadius: 1 }} />}</button>))}</div>)}
  </div>);
}
