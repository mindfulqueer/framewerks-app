import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  addDoc, updateDoc, doc, onSnapshot, serverTimestamp, setDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ─── Firebase ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDwCIb6OQ40TDNlNr1TjxO4kZVf2Ho62X8",
  authDomain: "framewerks-coach.firebaseapp.com",
  projectId: "framewerks-coach",
  storageBucket: "framewerks-coach.firebasestorage.app",
  messagingSenderId: "850336233136",
  appId: "1:850336233136:web:2bf59afb82672435c4ed75"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0D0D0D", surface: "#141414", card: "#1A1A1A", border: "#2A2A2A",
  accent: "#E8FF00", accentRed: "#FF3D3D", accentBlue: "#00C8FF",
  accentGreen: "#00FF88", accentOrange: "#FF8C00",
  text: "#FFFFFF", textMuted: "#888888", textDim: "#444444",
};
const F = { display: "'Bebas Neue', 'Impact', sans-serif", body: "system-ui, -apple-system, sans-serif" };

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = {
  LOGS: "fw_logs", HABITS: "fw_habits", HABIT_DONE: "fw_habit_done",
  WELLBEING: "fw_wellbeing", PROFILE: "fw_profile", GOALS: "fw_goals",
  PERF_GOALS: "fw_perf_goals", WEIGHT_LOG: "fw_weight_log",
  ACTIVE_WORKOUT: "fw_active_workout",
};
const save  = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load  = (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

// ─── Firebase helpers ─────────────────────────────────────────────────────────
const syncLog = async (uid, entry) => {
  try {
    const r = await addDoc(collection(db, "workoutLogs"), { userId: uid, ...entry, completedAt: serverTimestamp() });
    return r.id;
  } catch { return null; }
};
const syncSet = async (uid, logId, setData) => {
  try { await addDoc(collection(db, "setSyncs"), { userId: uid, workoutLogId: logId, ...setData, timestamp: serverTimestamp() }); } catch {}
};
const loadLogs = async (uid) => {
  try {
    const q = query(collection(db, "workoutLogs"), where("userId", "==", uid), orderBy("completedAt", "desc"));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
const saveUserDoc = async (uid, data) => {
  try { await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true }); } catch {}
};
const loadUserDoc = async (uid) => {
  try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; } catch { return null; }
};
const saveWeightEntry = async (uid, entry) => {
  try { await addDoc(collection(db, "weightLog"), { userId: uid, ...entry, loggedAt: serverTimestamp() }); } catch {}
};
const loadWeightLog = async (uid) => {
  try {
    const q = query(collection(db, "weightLog"), where("userId", "==", uid), orderBy("loggedAt", "desc"));
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
};
const uploadPhoto = async (uid, file, path) => {
  try {
    const r = storageRef(storage, `${path}/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  } catch (e) { console.warn("Upload failed:", e); return null; }
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const pill = (color = C.accent, text) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:20, fontSize:10, fontFamily:F.body, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", background:color+"20", color, border:`1px solid ${color}33` }}>{text}</span>
);
const btn = (label, onClick, variant="primary", style={}) => {
  const base = { display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 20px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:F.display, fontSize:16, letterSpacing:"0.08em", transition:"opacity 0.15s", ...style };
  const vars = { primary:{background:C.accent,color:"#000"}, ghost:{background:"transparent",color:C.text,border:`1px solid ${C.border}`}, danger:{background:C.accentRed,color:"#fff"}, dim:{background:"transparent",color:C.textMuted,border:`1px solid ${C.border}`} };
  return <button onClick={onClick} style={{...base,...(vars[variant]||vars.primary)}}>{label}</button>;
};
const input = (val, onChange, placeholder, type="text", style={}) => (
  <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",boxSizing:"border-box",...style}} />
);
const label = (text) => <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:6}}>{text}</div>;
const card = (children, style={}) => <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",marginBottom:12,...style}}>{children}</div>;

// ─── Goal options ─────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  "Lose weight / fat", "Improve physical fitness", "Get control of eating habits",
  "Gain weight", "Look better", "Get stronger",
  "Maintain weight", "Feel better", "Physique competition / modeling",
  "Add muscle", "Improve overall health", "Have more energy and vitality",
  "Improve athletic performance", "Healthy aging", "Get off or decrease medications",
];

// ─── Day converter ────────────────────────────────────────────────────────────
const dayToWorkout = (day) => ({
  id: day.id, name: day.name,
  exercises: (day.blocks||[]).flatMap((block,bi) =>
    (block.exercises||[]).map((ex,ei) => ({
      id: ex.id||`${bi}_${ei}`, name: ex.name,
      sets: parseInt(ex.sets)||3, reps: ex.reps||"8-10",
      tempo: ex.tempo||"", rpe: ex.rpe||"", rest: ex.rest||"60s",
      startWeight: ex.startWeight||"", notes: ex.notes||"",
      blockName: block.name, blockType: block.type,
    }))
  ),
  warmup: day.warmup||[], cooldown: day.cooldown||{},
});

// ─── Parse reps ───────────────────────────────────────────────────────────────
const parseReps = (repsStr, sets) => {
  if (!repsStr) return Array(sets).fill("");
  if (repsStr.includes("/")) { const p=repsStr.split("/"); return Array(sets).fill("").map((_,i)=>p[i]||p[p.length-1]); }
  return Array(sets).fill(repsStr);
};

// ─── DEFAULT HABITS ───────────────────────────────────────────────────────────
const DEFAULT_HABITS = [
  { id:"h1", name:"Morning Movement", icon:"🌅", streak:0, target:"10 min" },
  { id:"h2", name:"Protein Goal",     icon:"🥩", streak:0, target:"150g"   },
  { id:"h3", name:"Breathwork",       icon:"🧘", streak:0, target:"5 min"  },
  { id:"h4", name:"Hydration",        icon:"💧", streak:0, target:"3L"     },
  { id:"h5", name:"Sleep 7-9hrs",     icon:"😴", streak:0, target:"9pm"    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const login = async () => {
    setLoading(true); setErr("");
    try { await signInWithPopup(auth, provider); }
    catch { setErr("Sign in failed. Try again."); setLoading(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:F.display}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{fontSize:64,color:C.accent,letterSpacing:"0.05em",lineHeight:1}}>
          FRAME<span style={{color:C.accentRed}}>WERKS</span>
        </div>
        <div style={{fontSize:12,letterSpacing:"0.4em",color:C.textMuted,fontFamily:F.body,marginTop:8}}>BUILD YOUR FOUNDATION</div>
        <div style={{width:60,height:3,background:C.accent,margin:"16px auto 0",clipPath:"polygon(0 0,100% 0,92% 100%,0% 100%)"}} />
      </div>
      <div style={{width:"100%",maxWidth:320}}>
        {err && <div style={{background:C.accentRed+"22",border:`1px solid ${C.accentRed}44`,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,fontFamily:F.body,color:C.accentRed,textAlign:"center"}}>{err}</div>}
        <button onClick={login} disabled={loading}
          style={{width:"100%",padding:"16px 24px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:F.display,fontSize:18,letterSpacing:"0.1em",background:C.accent,color:"#000",opacity:loading?0.6:1}}>
          {loading?"SIGNING IN...":"SIGN IN WITH GOOGLE"}
        </button>
        <p style={{fontSize:11,fontFamily:F.body,color:C.textDim,textAlign:"center",marginTop:16,lineHeight:1.6}}>Your data syncs across all your devices</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TodayTab({ user, workoutLogs, program, perfGoals, goals, onStartWorkout }) {
  const dayOfWeek = new Date().getDay();
  const days = program?.days || [];
  const todayDay = dayOfWeek !== 0 && days.length > 0 ? days[(dayOfWeek - 1) % days.length] : null;
  const todayWorkout = todayDay ? dayToWorkout(todayDay) : null;
  const totalWorkouts = workoutLogs.length;

  const greeting = () => { const h=new Date().getHours(); return h<12?"MORNING":h<17?"AFTERNOON":"EVENING"; };
  const today = new Date().toISOString().slice(0,10);

  // Performance goals — show top 2-3 with progress
  const activePerf = (perfGoals||[]).filter(g => g.exercise && g.goalWeight).slice(0,3);

  // Get best weight for an exercise from logs
  const getBestWeight = (exerciseName) => {
    let best = 0;
    workoutLogs.forEach(log => {
      log.exercises?.forEach(ex => {
        if (ex.name?.toLowerCase() === exerciseName?.toLowerCase()) {
          ex.sets?.forEach(s => { const w = parseFloat(s.weight)||0; if (w>best) best=w; });
        }
      });
    });
    return best;
  };

  // Active personal goals with deadline
  const personalGoals = (goals||[]).filter(g => g.selected && g.deadline).slice(0,2);
  const daysUntil = (dateStr) => { const d = Math.ceil((new Date(dateStr)-new Date())/(1000*60*60*24)); return d > 0 ? d : 0; };

  return (
    <div style={{paddingTop:24}}>
      {/* Greeting */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.15em"}}>GOOD {greeting()}</div>
        <div style={{fontSize:44,letterSpacing:"0.03em",lineHeight:1,marginTop:4,fontFamily:F.display}}>
          {user.displayName?.split(" ")[0]?.toUpperCase()||"ATHLETE"}
        </div>
        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:6}}>
          {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:24}}>
        {[
          {label:"WORKOUTS",value:totalWorkouts,color:C.accent,bg:C.accent},
          {label:"PROGRAM", value:program?program.name.split(" ")[0]:"–",color:C.text,bg:null},
          {label:"STREAK",  value:"–",color:C.text,bg:null},
        ].map((s,i)=>(
          <div key={i} style={{flex:1,background:i===0?C.accent:C.card,borderRadius:10,padding:"12px 10px",textAlign:"center",border:i===0?"none":`1px solid ${C.border}`}}>
            <div style={{fontSize:i===1&&s.value.length>4?14:28,fontFamily:F.display,color:i===0?"#000":C.text,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:9,fontFamily:F.body,fontWeight:700,letterSpacing:"0.15em",color:i===0?"#000":C.textMuted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Performance goals spotlight */}
      {activePerf.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:18,fontFamily:F.display,letterSpacing:"0.05em",marginBottom:10}}>PERFORMANCE GOALS</div>
          {activePerf.map((g,i) => {
            const best = getBestWeight(g.exercise);
            const goal = parseFloat(g.goalWeight)||0;
            const pct = goal > 0 ? Math.min((best/goal)*100, 100) : 0;
            const daysLeft = g.deadline ? daysUntil(g.deadline) : null;
            return (
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:16,fontFamily:F.display}}>{g.exercise}</div>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
                      Current: <span style={{color:best>0?C.text:C.textDim}}>{best>0?`${best} lbs`:"No data yet"}</span>
                      {" · "}Goal: <span style={{color:C.accent}}>{goal} lbs</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontFamily:F.display,color:pct>=100?C.accentGreen:C.accent}}>{Math.round(pct)}%</div>
                    {daysLeft !== null && <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>{daysLeft}d left</div>}
                  </div>
                </div>
                <div style={{height:6,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct>=100?C.accentGreen:C.accent,borderRadius:3,width:`${pct}%`,transition:"width 0.5s ease"}} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Personal goals spotlight */}
      {personalGoals.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:18,fontFamily:F.display,letterSpacing:"0.05em",marginBottom:10}}>MY GOALS</div>
          {personalGoals.map((g,i) => {
            const daysLeft = daysUntil(g.deadline);
            const totalDays = Math.ceil((new Date(g.deadline)-new Date(g.createdAt||Date.now()))/(1000*60*60*24));
            const pct = totalDays > 0 ? Math.max(0, Math.min(100, ((totalDays-daysLeft)/totalDays)*100)) : 0;
            return (
              <div key={i} style={{background:C.card,border:`1px solid ${C.accentBlue}44`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:15,fontFamily:F.display}}>{g.name}</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontFamily:F.display,color:daysLeft<=7?C.accentRed:C.accentBlue}}>{daysLeft}d</div>
                    <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted}}>REMAINING</div>
                  </div>
                </div>
                <div style={{height:4,background:C.surface,borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",background:C.accentBlue,borderRadius:2,width:`${pct}%`,transition:"width 0.5s ease"}} />
                </div>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,marginTop:6}}>
                  Deadline: {new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's workout */}
      {todayWorkout ? (
        <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:12,padding:"16px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              {pill(C.accent,"TODAY")}
              <div style={{fontSize:28,fontFamily:F.display,marginTop:6}}>{todayWorkout.name}</div>
              <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
                {todayWorkout.exercises.length} exercises · {program?.name}
              </div>
            </div>
            <div style={{fontSize:36,opacity:0.15}}>💪</div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
            {todayWorkout.exercises.map(ex=>(
              <div key={ex.id} style={{fontSize:11,fontFamily:F.body,color:C.textMuted,background:C.surface,borderRadius:6,padding:"4px 8px"}}>{ex.name}</div>
            ))}
          </div>
          <button onClick={()=>onStartWorkout(todayWorkout)}
            style={{width:"100%",padding:"14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:F.display,fontSize:18,letterSpacing:"0.1em",background:C.accent,color:"#000"}}>
            START WORKOUT
          </button>
        </div>
      ) : (
        <div style={{...{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"32px 16px",marginBottom:16,textAlign:"center"}}}>
          <div style={{fontSize:32,marginBottom:8}}>🔋</div>
          <div style={{fontSize:24,fontFamily:F.display,marginBottom:4}}>REST DAY</div>
          <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>Recovery is where gains are made</div>
        </div>
      )}

      {/* Recent */}
      {workoutLogs.slice(0,3).length > 0 && (
        <>
          <div style={{fontSize:18,fontFamily:F.display,letterSpacing:"0.05em",marginBottom:10}}>RECENT ACTIVITY</div>
          {workoutLogs.slice(0,3).map((log,i)=>(
            <div key={log.id||i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:16,fontFamily:F.display}}>{log.workoutName}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
                  {log.completedAt?.toDate?log.completedAt.toDate().toLocaleDateString():log.completedAt?new Date(log.completedAt).toLocaleDateString():"Recently"}
                  {log.duration?` · ${Math.floor(log.duration/60)}min`:""}
                </div>
              </div>
              {log.rating&&<div style={{fontSize:18,fontFamily:F.display,color:C.accent}}>{log.rating}★</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveWorkout({ user, workout, onComplete, onCancel }) {
  const SAVE_KEY = KEYS.ACTIVE_WORKOUT;

  const [setData, setSetData] = useState(() => {
    // Try to restore saved session
    const saved = load(SAVE_KEY);
    if (saved && saved.workoutId === workout.id) return saved.setData;
    return workout.exercises.reduce((acc, ex) => {
      const repsArr = parseReps(ex.reps, ex.sets);
      acc[ex.id] = Array(ex.sets).fill(null).map((_,si) => ({
        reps: repsArr[si] || "", weight: ex.startWeight || "", done: false
      }));
      return acc;
    }, {});
  });

  const [currentExIdx, setCurrentExIdx] = useState(() => {
    const saved = load(SAVE_KEY);
    return (saved && saved.workoutId === workout.id) ? (saved.currentExIdx||0) : 0;
  });
  const [notes,     setNotes]     = useState("");
  const [rating,    setRating]    = useState(0);
  const [startTime] = useState(() => { const s=load(SAVE_KEY); return (s&&s.workoutId===workout.id&&s.startTime)?s.startTime:Date.now(); });
  const [showFinish, setShowFinish] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const logIdRef = useRef(null);

  // Save session to localStorage on every change
  useEffect(() => {
    save(SAVE_KEY, { workoutId: workout.id, setData, currentExIdx, startTime });
  }, [setData, currentExIdx]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now()-startTime)/1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const fmtElapsed = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const updateSet = async (exId, si, field, value) => {
    const updated = { ...setData };
    updated[exId] = [...updated[exId]];
    updated[exId][si] = { ...updated[exId][si], [field]: value };
    setSetData(updated);
    if (field === "done" && value === true && user) {
      const setPayload = {
        exerciseName: workout.exercises.find(e=>e.id===exId)?.name,
        setNumber: si+1, reps: updated[exId][si].reps,
        weight: updated[exId][si].weight, workoutName: workout.name,
      };
      await syncSet(user.uid, logIdRef.current||"pending", setPayload);
    }
  };

  const completedSets = Object.values(setData).flat().filter(s=>s.done).length;
  const totalSets = Object.values(setData).flat().length;
  const progress = totalSets > 0 ? (completedSets/totalSets)*100 : 0;

  const handleFinish = async () => {
    const duration = Math.floor((Date.now()-startTime)/1000);
    const logEntry = {
      workoutId: workout.id, workoutName: workout.name,
      exercises: workout.exercises.map(ex=>({
        name: ex.name,
        sets: setData[ex.id].map((s,i)=>({setNumber:i+1,reps:s.reps,weight:s.weight,completed:s.done}))
      })),
      duration, rating, notes, completedAt: new Date().toISOString(),
    };
    const existing = load(KEYS.LOGS, []);
    const newLogs = [{ id: Date.now().toString(), ...logEntry }, ...existing];
    save(KEYS.LOGS, newLogs);
    // Clear active session
    localStorage.removeItem(SAVE_KEY);
    if (user) await syncLog(user.uid, logEntry);
    onComplete(newLogs);
  };

  const ex = workout.exercises[currentExIdx];
  const repsArr = parseReps(ex.reps, ex.sets);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.display}}>
      {/* Progress bar */}
      <div style={{height:4,background:C.surface,position:"fixed",top:0,left:0,right:0,zIndex:200}}>
        <div style={{height:"100%",background:C.accent,width:`${progress}%`,transition:"width 0.3s ease"}} />
      </div>

      <div style={{padding:"20px 16px 100px"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,marginBottom:16}}>
          <div>
            <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.15em"}}>ACTIVE SESSION</div>
            <div style={{fontSize:26}}>{workout.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,color:C.accent}}>{fmtElapsed(elapsed)}</div>
            <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>{completedSets}/{totalSets} SETS</div>
          </div>
        </div>

        {/* Exercise nav pills */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16}}>
          {workout.exercises.map((e,i)=>{
            const allDone = setData[e.id]?.every(s=>s.done);
            return (
              <button key={e.id} onClick={()=>setCurrentExIdx(i)}
                style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1px solid ${i===currentExIdx?C.accent:allDone?C.accentBlue+"66":C.border}`,background:i===currentExIdx?C.accent:allDone?C.accentBlue+"22":"transparent",color:i===currentExIdx?"#000":allDone?C.accentBlue:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer"}}>
                {allDone?"✓ ":""}{i+1}
              </button>
            );
          })}
        </div>

        {/* Current exercise card */}
        <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:12,padding:"14px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:28}}>{ex.name}</div>
              <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:2}}>{ex.sets} sets · {ex.reps}</div>
            </div>
            <span style={{fontSize:10,fontFamily:F.body,fontWeight:700,letterSpacing:"0.1em",background:C.accent+"20",color:C.accent,border:`1px solid ${C.accent}33`,padding:"3px 10px",borderRadius:20}}>
              {currentExIdx+1}/{workout.exercises.length}
            </span>
          </div>
          {/* Coach details */}
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            {ex.tempo&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.textMuted}}>⏱ {ex.tempo}</span>}
            {ex.rpe&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.accentOrange}}>RPE {ex.rpe}</span>}
            {ex.rest&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.textMuted}}>Rest {ex.rest}</span>}
            {ex.startWeight&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.accentBlue}}>Start: {ex.startWeight}</span>}
          </div>
          {ex.notes&&<div style={{fontSize:12,fontFamily:F.body,color:C.accentBlue,marginTop:8,fontStyle:"italic"}}>💡 {ex.notes}</div>}
        </div>

        {/* Sets table */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:8,marginBottom:8}}>
            {["SET","WEIGHT","REPS","✓"].map(h=><div key={h} style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700}}>{h}</div>)}
          </div>
          {setData[ex.id]?.map((set,si)=>(
            <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:8,alignItems:"center",padding:"8px 0",borderTop:`1px solid ${C.border}`,opacity:set.done?0.6:1}}>
              <div style={{fontSize:16,fontFamily:F.display,color:set.done?C.accentBlue:C.textMuted}}>{si+1}</div>
              <input type="number" placeholder={ex.startWeight||"0"} value={set.weight}
                onChange={e=>updateSet(ex.id,si,"weight",e.target.value)}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px",color:C.text,fontSize:16,textAlign:"center",outline:"none",fontFamily:F.display}} />
              <input type="number" placeholder={repsArr[si]||"0"} value={set.reps}
                onChange={e=>updateSet(ex.id,si,"reps",e.target.value)}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px",color:C.text,fontSize:16,textAlign:"center",outline:"none",fontFamily:F.display}} />
              <button onClick={()=>updateSet(ex.id,si,"done",!set.done)}
                style={{width:36,height:36,borderRadius:8,border:`1px solid ${set.done?C.accent:C.border}`,background:set.done?C.accent:"transparent",color:set.done?"#000":C.textDim,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                ✓
              </button>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{display:"flex",gap:10,marginBottom:10}}>
          {currentExIdx>0&&<button onClick={()=>setCurrentExIdx(i=>i-1)} style={{flex:1,padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>← PREV</button>}
          {currentExIdx<workout.exercises.length-1
            ?<button onClick={()=>setCurrentExIdx(i=>i+1)} style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:15,cursor:"pointer"}}>NEXT →</button>
            :<button onClick={()=>setShowFinish(true)} style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:15,cursor:"pointer"}}>FINISH WORKOUT</button>
          }
        </div>
        <button onClick={onCancel} style={{width:"100%",padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:14,cursor:"pointer"}}>
          SAVE & EXIT
        </button>
      </div>

      {/* Finish modal */}
      {showFinish&&(
        <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",padding:"28px 20px 40px",width:"100%",maxWidth:430,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:32,fontFamily:F.display,marginBottom:20}}>SESSION COMPLETE</div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:8}}>HOW WAS IT? (1-5)</div>
              <div style={{display:"flex",gap:10}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setRating(n)}
                    style={{flex:1,padding:"12px 0",borderRadius:8,border:`1px solid ${n<=rating?C.accent:C.border}`,background:n<=rating?C.accent+"22":"transparent",color:n<=rating?C.accent:C.textMuted,fontSize:18,fontFamily:F.display,cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:6}}>NOTES</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="How did it feel?" rows={3}
                style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",resize:"none",boxSizing:"border-box"}} />
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowFinish(false)} style={{flex:1,padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>BACK</button>
              <button onClick={handleFinish} style={{flex:2,padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:20,cursor:"pointer"}}>SAVE & FINISH</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAM TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ProgramTab({ program, onStartWorkout }) {
  const [expanded, setExpanded] = useState(null);
  if (!program) return (
    <div style={{paddingTop:24}}>
      <div style={{fontSize:36,fontFamily:F.display,marginBottom:20}}>PROGRAM</div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"48px 16px",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>📋</div>
        <div style={{fontSize:22,fontFamily:F.display,marginBottom:8}}>NO PROGRAM YET</div>
        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>Your coach hasn't assigned a program yet. Check back soon.</div>
      </div>
    </div>
  );
  return (
    <div style={{paddingTop:24}}>
      <div style={{fontSize:36,fontFamily:F.display,marginBottom:4}}>PROGRAM</div>
      <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginBottom:8}}>{program.name}</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {pill(C.accent,`${program.weeks} WEEKS`)}
        {pill(C.accentBlue,`${program.days?.length||0} DAYS`)}
      </div>
      {(program.days||[]).map((day,i)=>{
        const w = dayToWorkout(day);
        const isExp = expanded===day.id;
        return (
          <div key={day.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",marginBottom:12}}>
            <div onClick={()=>setExpanded(isExp?null:day.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.1em"}}>DAY {i+1}</div>
                <div style={{fontSize:24,fontFamily:F.display,marginTop:2}}>{day.name}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{w.exercises.length} exercises{day.blocks?.length>0?` · ${day.blocks.length} blocks`:""}</div>
              </div>
              <div style={{fontSize:24,color:C.textDim,transform:isExp?"rotate(180deg)":"none",transition:"transform 0.2s"}}>↓</div>
            </div>
            {isExp&&(
              <div style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                {day.warmup?.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.accentOrange,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>🔥 WARM UP</div>
                    {day.warmup.map((ex,wi)=>(
                      <div key={wi} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{fontSize:14,fontFamily:F.body}}>{ex.name}</div>
                        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>{ex.duration}</div>
                      </div>
                    ))}
                  </div>
                )}
                {day.blocks?.map((block,bi)=>(
                  <div key={bi} style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>💪 {block.name?.toUpperCase()} — {block.type?.toUpperCase()}</div>
                    {block.exercises?.map((ex,ei)=>(
                      <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingLeft:8,borderLeft:`2px solid ${C.border}`}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:12,fontFamily:F.body,color:C.accent,fontWeight:700}}>{String.fromCharCode(65+bi)}{ei+1}</span>
                            <span style={{fontSize:15,fontFamily:F.display}}>{ex.name}</span>
                          </div>
                          <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                            {ex.tempo&&<span style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>⏱ {ex.tempo}</span>}
                            {ex.rpe&&<span style={{fontSize:10,fontFamily:F.body,color:C.accentOrange}}>RPE {ex.rpe}</span>}
                            {ex.rest&&<span style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>Rest {ex.rest}</span>}
                            {ex.startWeight&&<span style={{fontSize:10,fontFamily:F.body,color:C.accentBlue}}>Start: {ex.startWeight}</span>}
                          </div>
                          {ex.notes&&<div style={{fontSize:11,fontFamily:F.body,color:C.accentBlue,fontStyle:"italic",marginTop:2}}>💡 {ex.notes}</div>}
                        </div>
                        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,textAlign:"right",flexShrink:0,marginLeft:12}}>
                          <div>{ex.sets} sets</div><div>{ex.reps}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {day.cooldown?.breathing?.pattern&&(
                  <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:12}}>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.accentBlue,fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>🧘 BREATHING</div>
                    <div style={{fontSize:18,fontFamily:F.display,color:C.accentBlue,letterSpacing:"0.2em"}}>{day.cooldown.breathing.pattern}</div>
                    {day.cooldown.breathing.notes&&<div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:4}}>{day.cooldown.breathing.notes}</div>}
                  </div>
                )}
                <button onClick={()=>onStartWorkout(w)}
                  style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:16,cursor:"pointer",marginTop:4}}>
                  START DAY {i+1}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HABITS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function HabitsTab({ user }) {
  const [habits, setHabits] = useState(()=>load(KEYS.HABITS,DEFAULT_HABITS));
  const [done,   setDone]   = useState(()=>load(KEYS.HABIT_DONE,{}));
  const today = new Date().toISOString().slice(0,10);
  const toggle = (id) => {
    const key=`${today}_${id}`, updated={...done,[key]:!done[key]};
    setDone(updated); save(KEYS.HABIT_DONE,updated);
    const h=habits.map(h=>h.id!==id?h:{...h,streak:updated[key]?h.streak+1:Math.max(0,h.streak-1)});
    setHabits(h); save(KEYS.HABITS,h);
  };
  const comp = habits.filter(h=>done[`${today}_${h.id}`]).length;
  return (
    <div style={{paddingTop:24}}>
      <div style={{fontSize:36,fontFamily:F.display,marginBottom:4}}>HABITS</div>
      <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginBottom:12}}>{comp}/{habits.length} COMPLETED TODAY</div>
      <div style={{height:6,background:C.surface,borderRadius:3,marginBottom:20,overflow:"hidden"}}>
        <div style={{height:"100%",background:C.accent,borderRadius:3,width:`${habits.length>0?(comp/habits.length)*100:0}%`,transition:"width 0.4s ease"}} />
      </div>
      {habits.map(h=>{
        const isDone=!!done[`${today}_${h.id}`];
        return (
          <div key={h.id} onClick={()=>toggle(h.id)}
            style={{background:isDone?C.accent+"0A":C.card,border:`1px solid ${isDone?C.accent+"66":C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{fontSize:28}}>{h.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontFamily:F.display,color:isDone?C.accent:C.text}}>{h.name}</div>
              <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>Target: {h.target} · 🔥 {h.streak} day streak</div>
            </div>
            <div style={{width:28,height:28,borderRadius:6,border:`2px solid ${isDone?C.accent:C.border}`,background:isDone?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:isDone?"#000":"transparent",fontSize:16,flexShrink:0}}>✓</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY + PROGRESS (merged)
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryProgressTab({ workoutLogs, onRefresh }) {
  const [view,     setView]     = useState("history"); // history | progress
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [selEx,    setSelEx]    = useState("");

  // ── History ──
  const filteredLogs = workoutLogs.filter(log => {
    if (filter==="all") return true;
    const d = log.completedAt?.toDate?log.completedAt.toDate():new Date(log.completedAt||0);
    const days = filter==="week"?7:30;
    return (Date.now()-d.getTime()) < days*24*60*60*1000;
  });

  // ── Progress ──
  const allExercises = [...new Set(workoutLogs.flatMap(l=>l.exercises?.map(e=>e.name)||[]))];
  const exHistory = workoutLogs
    .filter(l=>l.exercises?.some(e=>e.name===selEx))
    .map(l=>{
      const ex=l.exercises.find(e=>e.name===selEx);
      const done=ex?.sets?.filter(s=>s.completed)||[];
      const top=done.reduce((b,s)=>parseFloat(s.weight||0)>parseFloat(b?.weight||0)?s:b,null);
      return {
        logId:l.id,
        date:l.completedAt?.toDate?l.completedAt.toDate():new Date(l.completedAt||0),
        workoutName:l.workoutName, topWeight:parseFloat(top?.weight)||0,
        topReps:top?.reps||0, doneSets:done.length,
      };
    })
    .sort((a,b)=>a.date-b.date);
  const maxW = exHistory.length>0?Math.max(...exHistory.map(d=>d.topWeight)):0;

  if (selected) {
    const log = workoutLogs.find(l=>l.id===selected);
    if (!log) { setSelected(null); return null; }
    return (
      <div style={{paddingTop:24}}>
        <button onClick={()=>setSelected(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",color:C.text,cursor:"pointer",fontFamily:F.display,fontSize:13,marginBottom:20}}>← BACK</button>
        <div style={{fontSize:28,fontFamily:F.display,marginBottom:4}}>{log.workoutName}</div>
        <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:16}}>
          {log.completedAt?.toDate?log.completedAt.toDate().toLocaleString():log.completedAt?new Date(log.completedAt).toLocaleString():"–"}
          {log.duration?` · ${Math.floor(log.duration/60)} min`:""}
        </div>
        {log.notes&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",fontFamily:F.body,fontSize:13,color:C.textMuted,fontStyle:"italic",marginBottom:16}}>"{log.notes}"</div>}
        {log.exercises?.map((ex,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:10}}>
            <div style={{fontSize:18,fontFamily:F.display,marginBottom:10}}>{ex.name}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4}}>
              {["SET","WEIGHT","REPS","DONE"].map(h=><div key={h} style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.1em"}}>{h}</div>)}
              {ex.sets?.map((s,si)=>[
                <div key={`n${si}`} style={{fontSize:14,fontFamily:F.display}}>{s.setNumber}</div>,
                <div key={`w${si}`} style={{fontSize:14,fontFamily:F.display,color:s.completed?C.text:C.textMuted}}>{s.weight||"–"}</div>,
                <div key={`r${si}`} style={{fontSize:14,fontFamily:F.display,color:s.completed?C.text:C.textMuted}}>{s.reps||"–"}</div>,
                <div key={`d${si}`} style={{fontSize:13,color:s.completed?C.accentGreen:C.textDim}}>{s.completed?"✓":"–"}</div>,
              ])}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{paddingTop:24}}>
      {/* Tab switcher */}
      <div style={{display:"flex",gap:0,marginBottom:20,background:C.surface,borderRadius:10,padding:4}}>
        {[["history","HISTORY"],["progress","PROGRESS"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:view===v?C.card:"transparent",color:view===v?C.accent:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:15,letterSpacing:"0.08em",transition:"all 0.15s"}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── HISTORY view ── */}
      {view==="history"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",gap:8}}>
              {["all","week","month"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${f===filter?C.accent:C.border}`,background:f===filter?C.accent+"22":"transparent",color:f===filter?C.accent:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em"}}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={onRefresh} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:12}}>↻ SYNC</button>
          </div>
          {filteredLogs.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:20,fontFamily:F.display}}>NO WORKOUTS YET</div>
            </div>
          ):filteredLogs.map((log,i)=>(
            <div key={log.id||i} onClick={()=>setSelected(log.id)}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:18,fontFamily:F.display}}>{log.workoutName}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
                  {log.completedAt?.toDate?log.completedAt.toDate().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):log.completedAt?new Date(log.completedAt).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):"–"}
                  {log.duration?` · ${Math.floor(log.duration/60)}min`:""}
                  {log.exercises?` · ${log.exercises.length} exercises`:""}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {log.rating&&<div style={{fontSize:16,fontFamily:F.display,color:C.accent}}>{log.rating}★</div>}
                <div style={{color:C.textDim,fontSize:20}}>›</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── PROGRESS view ── */}
      {view==="progress"&&(
        <>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:6}}>SELECT EXERCISE</div>
            <select value={selEx} onChange={e=>setSelEx(e.target.value)}
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none"}}>
              <option value="">— Choose an exercise —</option>
              {allExercises.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {selEx&&exHistory.length>0&&(
            <>
              <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"16px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em"}}>BEST — {selEx.toUpperCase()}</div>
                    <div style={{fontSize:52,fontFamily:F.display,color:C.accent,lineHeight:1,marginTop:4}}>
                      {maxW>0?maxW:"–"} <span style={{fontSize:20,color:C.textMuted}}>LBS</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>SESSIONS</div>
                    <div style={{fontSize:36,fontFamily:F.display,color:C.accentBlue}}>{exHistory.length}</div>
                  </div>
                </div>
                {exHistory.slice(-6).map((e,i,arr)=>{
                  const pct=maxW>0?(e.topWeight/maxW)*100:0;
                  const isLast=i===arr.length-1;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,minWidth:50}}>{e.date.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      <div style={{flex:1,height:6,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:isLast?C.accent:C.accentBlue+"88",width:`${pct}%`,transition:"width 0.5s ease"}} />
                      </div>
                      <div style={{fontSize:12,fontFamily:F.display,color:isLast?C.accent:C.text,minWidth:60,textAlign:"right"}}>{e.topWeight>0?`${e.topWeight}lbs`:"–"}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px"}}>
                <div style={{fontSize:15,fontFamily:F.display,marginBottom:10}}>SESSION BREAKDOWN</div>
                {exHistory.slice().reverse().map((e,i)=>(
                  <div key={i} onClick={()=>setSelected(e.logId)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:`1px solid ${C.border}`,cursor:"pointer"}}>
                    <div>
                      <div style={{fontSize:14,fontFamily:F.display}}>{e.workoutName}</div>
                      <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{e.date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,fontFamily:F.display,color:i===0?C.accent:C.text}}>{e.topWeight>0?`${e.topWeight} lbs`:"–"}</div>
                      <div style={{fontSize:10,fontFamily:F.body,color:C.accentGreen}}>{e.doneSets} sets done</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {selEx&&exHistory.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted,fontFamily:F.body,fontSize:13}}>No data yet for this exercise</div>
          )}
          {!selEx&&(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:12}}>📈</div>
              <div style={{fontSize:18,fontFamily:F.display}}>SELECT AN EXERCISE ABOVE</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ME TAB
// ═══════════════════════════════════════════════════════════════════════════════
function MeTab({ user, onSignOut, onGoalsChange, onPerfGoalsChange }) {
  const [profile,    setProfile]    = useState(()=>load(KEYS.PROFILE,{}));
  const [goals,      setGoals]      = useState(()=>load(KEYS.GOALS,[]));
  const [perfGoals,  setPerfGoals]  = useState(()=>load(KEYS.PERF_GOALS,[]));
  const [weightLog,  setWeightLog]  = useState(()=>load(KEYS.WEIGHT_LOG,[]));
  const [editProfile,setEditProfile]= useState(false);
  const [newWeight,  setNewWeight]  = useState("");
  const [newGoalDate,setNewGoalDate]= useState("");
  const [section,    setSection]    = useState("goals"); // goals | perf | weight | checkin
  const [saving,     setSaving]     = useState(false);
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const today = new Date().toISOString().slice(0,10);

  // Wellbeing
  const [wellbeing, setWellbeing] = useState(()=>load(KEYS.WELLBEING,{}));
  const todayWB = wellbeing[today]||{};
  const saveWB = (field,val) => {
    const u={...wellbeing,[today]:{...todayWB,[field]:val}};
    setWellbeing(u); save(KEYS.WELLBEING,u);
    if (user) saveUserDoc(user.uid,{wellbeing:u});
  };

  const saveProfile = async (p) => {
    setProfile(p); save(KEYS.PROFILE,p);
    if (user) await saveUserDoc(user.uid,{profile:p});
  };

  const toggleGoal = (name) => {
    const existing = goals.find(g=>g.name===name);
    let updated;
    if (existing) {
      updated = goals.map(g=>g.name===name?{...g,selected:!g.selected}:g);
    } else {
      updated = [...goals,{name,selected:true,deadline:"",createdAt:Date.now()}];
    }
    setGoals(updated); save(KEYS.GOALS,updated); onGoalsChange(updated);
    if (user) saveUserDoc(user.uid,{goals:updated});
  };

  const setGoalDeadline = (name,deadline) => {
    const updated = goals.map(g=>g.name===name?{...g,deadline}:g);
    setGoals(updated); save(KEYS.GOALS,updated); onGoalsChange(updated);
    if (user) saveUserDoc(user.uid,{goals:updated});
  };

  const addPerfGoal = () => {
    const updated = [...perfGoals,{id:Date.now().toString(),exercise:"",goalWeight:"",deadline:"",createdAt:Date.now()}];
    setPerfGoals(updated); save(KEYS.PERF_GOALS,updated); onPerfGoalsChange(updated);
  };
  const updatePerfGoal = (id,field,val) => {
    const updated = perfGoals.map(g=>g.id===id?{...g,[field]:val}:g);
    setPerfGoals(updated); save(KEYS.PERF_GOALS,updated); onPerfGoalsChange(updated);
    if (user) saveUserDoc(user.uid,{perfGoals:updated});
  };
  const removePerfGoal = (id) => {
    const updated = perfGoals.filter(g=>g.id!==id);
    setPerfGoals(updated); save(KEYS.PERF_GOALS,updated); onPerfGoalsChange(updated);
  };

  const logWeight = async () => {
    if (!newWeight) return;
    setSaving(true);
    const entry = { weight: parseFloat(newWeight), date: today, loggedAt: Date.now(), photoUrl: null };
    const updated = [entry, ...weightLog];
    setWeightLog(updated); save(KEYS.WEIGHT_LOG,updated);
    if (user) await saveWeightEntry(user.uid,entry);
    setNewWeight(""); setSaving(false);
  };

  const handleWeightPhoto = async (file) => {
    if (!file||!user) return;
    setSaving(true);
    const url = await uploadPhoto(user.uid,file,"weightPhotos");
    if (url) {
      const updated = weightLog.map((e,i)=>i===0?{...e,photoUrl:url}:e);
      setWeightLog(updated); save(KEYS.WEIGHT_LOG,updated);
    }
    setSaving(false);
  };

  const handleProfilePhoto = async (file) => {
    if (!file||!user) return;
    setSaving(true);
    const url = await uploadPhoto(user.uid,file,"profilePhotos");
    if (url) { await saveProfile({...profile,photoUrl:url}); }
    setSaving(false);
  };

  const latestWeight = weightLog[0]?.weight;
  const goalWeight = profile.goalWeight ? parseFloat(profile.goalWeight) : null;

  const sections = [
    {id:"goals",label:"GOALS"},
    {id:"perf",label:"PERFORMANCE"},
    {id:"weight",label:"WEIGHT"},
    {id:"checkin",label:"CHECK-IN"},
  ];

  return (
    <div style={{paddingTop:24}}>
      {/* Profile header */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
        <div onClick={()=>setEditProfile(!editProfile)} style={{cursor:"pointer",position:"relative",flexShrink:0}}>
          {profile.photoUrl||user.photoURL?(
            <img src={profile.photoUrl||user.photoURL} alt="Profile"
              style={{width:64,height:64,borderRadius:"50%",border:`2px solid ${C.accent}`,objectFit:"cover"}} />
          ):(
            <div style={{width:64,height:64,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontFamily:F.display,color:"#000"}}>
              {(profile.name||user.displayName||"A")[0].toUpperCase()}
            </div>
          )}
          <div style={{position:"absolute",bottom:0,right:0,width:20,height:20,borderRadius:"50%",background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>✏️</div>
        </div>
        <div style={{flex:1}} onClick={()=>setEditProfile(!editProfile)} >
          <div style={{fontSize:28,fontFamily:F.display,cursor:"pointer"}}>{profile.name||user.displayName?.toUpperCase()||"ATHLETE"}</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{user.email}</div>
          {(profile.height||profile.age)&&(
            <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
              {profile.height?`${profile.height} · `:""}
              {profile.age?`${profile.age} yrs`:""}
            </div>
          )}
        </div>
      </div>

      {/* Profile editor */}
      {editProfile&&(
        <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"16px",marginBottom:20}}>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:14}}>EDIT PROFILE</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            {[
              {label:"NAME",       field:"name",        ph:"Your name",   type:"text"},
              {label:"AGE",        field:"age",         ph:"Age",         type:"number"},
              {label:"HEIGHT",     field:"height",      ph:"e.g. 6'2\"",  type:"text"},
              {label:"WEIGHT (lbs)",field:"currentWeight",ph:"lbs",       type:"number"},
              {label:"GOAL WEIGHT",field:"goalWeight",  ph:"lbs",         type:"number"},
            ].map(({label:lbl,field,ph,type})=>(
              <div key={field}>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:5}}>{lbl}</div>
                <input type={type} value={profile[field]||""} onChange={e=>saveProfile({...profile,[field]:e.target.value})} placeholder={ph}
                  style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:5}}>PROFILE PHOTO (OPTIONAL)</div>
            <input type="file" accept="image/*" ref={photoRef} style={{display:"none"}} onChange={e=>handleProfilePhoto(e.target.files[0])} />
            <button onClick={()=>photoRef.current?.click()}
              style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:13}}>
              {saving?"UPLOADING...":"UPLOAD PHOTO"}
            </button>
          </div>
          <button onClick={()=>setEditProfile(false)}
            style={{width:"100%",marginTop:14,padding:"10px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:15,cursor:"pointer"}}>
            DONE
          </button>
        </div>
      )}

      {/* Section nav */}
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:2}}>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)}
            style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:`1px solid ${s.id===section?C.accent:C.border}`,background:s.id===section?C.accent+"22":"transparent",color:s.id===section?C.accent:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em"}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── GOALS ── */}
      {section==="goals"&&(
        <div>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:4}}>MY GOALS</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>Select your goals and set a deadline</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {GOAL_OPTIONS.map(name=>{
              const g = goals.find(x=>x.name===name);
              const sel = !!g?.selected;
              return (
                <div key={name}>
                  <div onClick={()=>toggleGoal(name)}
                    style={{background:sel?C.accent+"0A":C.card,border:`1px solid ${sel?C.accent+"66":C.border}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}>
                    <div style={{fontSize:14,fontFamily:F.body,color:sel?C.accent:C.text}}>{name}</div>
                    <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${sel?C.accent:C.border}`,background:sel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:14,flexShrink:0}}>{sel?"✓":""}</div>
                  </div>
                  {sel&&(
                    <div style={{padding:"8px 14px 4px",background:C.surface,borderRadius:"0 0 10px 10px",border:`1px solid ${C.accent}44`,borderTop:"none",marginTop:-4}}>
                      <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:4}}>DEADLINE</div>
                      <input type="date" value={g?.deadline||""} onChange={e=>setGoalDeadline(name,e.target.value)}
                        style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontSize:13,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PERFORMANCE GOALS ── */}
      {section==="perf"&&(
        <div>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:4}}>PERFORMANCE GOALS</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>Set exercise-specific strength targets with deadlines</div>
          {perfGoals.map(g=>(
            <div key={g.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:5}}>EXERCISE</div>
                  <input value={g.exercise} onChange={e=>updatePerfGoal(g.id,"exercise",e.target.value)} placeholder="e.g. Bench Press"
                    style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                </div>
                <div>
                  <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:5}}>GOAL WEIGHT (lbs)</div>
                  <input type="number" value={g.goalWeight} onChange={e=>updatePerfGoal(g.id,"goalWeight",e.target.value)} placeholder="e.g. 315"
                    style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                </div>
              </div>
              <div>
                <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:5}}>DEADLINE</div>
                <input type="date" value={g.deadline} onChange={e=>updatePerfGoal(g.id,"deadline",e.target.value)}
                  style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",boxSizing:"border-box",marginBottom:10}} />
              </div>
              <button onClick={()=>removePerfGoal(g.id)}
                style={{background:"transparent",border:`1px solid ${C.accentRed}44`,borderRadius:8,padding:"6px 14px",color:C.accentRed,cursor:"pointer",fontFamily:F.display,fontSize:12}}>
                REMOVE
              </button>
            </div>
          ))}
          <button onClick={addPerfGoal}
            style={{width:"100%",padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontFamily:F.display,fontSize:15,cursor:"pointer",borderStyle:"dashed"}}>
            + ADD PERFORMANCE GOAL
          </button>
        </div>
      )}

      {/* ── WEIGHT TRACKER ── */}
      {section==="weight"&&(
        <div>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:4}}>WEIGHT TRACKER</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>Log your bodyweight daily — visible to your coach</div>

          {/* Goal weight progress */}
          {goalWeight&&latestWeight&&(
            <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"14px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em"}}>CURRENT WEIGHT</div>
                  <div style={{fontSize:44,fontFamily:F.display,color:C.accent,lineHeight:1}}>{latestWeight} <span style={{fontSize:20,color:C.textMuted}}>lbs</span></div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>GOAL</div>
                  <div style={{fontSize:28,fontFamily:F.display,color:C.accentBlue}}>{goalWeight} lbs</div>
                </div>
              </div>
              <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>
                {Math.abs(latestWeight-goalWeight).toFixed(1)} lbs {latestWeight>goalWeight?"to lose":"to gain"}
              </div>
            </div>
          )}

          {/* Daily weigh-in */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:14}}>
            <div style={{fontSize:15,fontFamily:F.display,marginBottom:12}}>TODAY'S WEIGH-IN</div>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <input type="number" value={newWeight} onChange={e=>setNewWeight(e.target.value)} placeholder="Enter weight in lbs" step="0.1"
                style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:16,fontFamily:F.display,outline:"none"}} />
              <button onClick={logWeight} disabled={saving||!newWeight}
                style={{padding:"10px 18px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:14,cursor:"pointer",opacity:!newWeight?0.4:1}}>
                LOG
              </button>
            </div>
            {/* Photo upload */}
            <input type="file" accept="image/*" ref={fileRef} style={{display:"none"}} onChange={e=>handleWeightPhoto(e.target.files[0])} />
            <button onClick={()=>fileRef.current?.click()}
              style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:12}}>
              📸 {saving?"UPLOADING...":"ADD PROGRESS PHOTO"}
            </button>
          </div>

          {/* Weight log history */}
          {weightLog.length>0&&(
            <div>
              <div style={{fontSize:15,fontFamily:F.display,marginBottom:10}}>LOG HISTORY</div>
              {weightLog.slice(0,10).map((e,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {e.photoUrl&&<img src={e.photoUrl} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover"}} />}
                    <div>
                      <div style={{fontSize:22,fontFamily:F.display,color:i===0?C.accent:C.text}}>{e.weight} <span style={{fontSize:14,color:C.textMuted}}>lbs</span></div>
                      <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{e.date}</div>
                    </div>
                  </div>
                  {i>0&&weightLog[i-1]&&(
                    <div style={{fontSize:13,fontFamily:F.display,color:e.weight<weightLog[i-1].weight?C.accentGreen:C.accentRed}}>
                      {e.weight<weightLog[i-1].weight?`-${(weightLog[i-1].weight-e.weight).toFixed(1)}`:`+${(e.weight-weightLog[i-1].weight).toFixed(1)}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DAILY CHECK-IN ── */}
      {section==="checkin"&&(
        <div>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:4}}>DAILY CHECK-IN</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>How are you feeling today?</div>
          {[
            {key:"energy",  label:"ENERGY",   icon:"⚡"},
            {key:"sleep",   label:"SLEEP",    icon:"😴"},
            {key:"soreness",label:"SORENESS", icon:"💪"},
            {key:"stress",  label:"STRESS",   icon:"🧠"},
          ].map(m=>(
            <div key={m.key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>{m.icon}</span>
                <div style={{fontSize:18,fontFamily:F.display}}>{m.label}</div>
                {todayWB[m.key]&&<span style={{marginLeft:"auto",fontSize:10,fontFamily:F.body,fontWeight:700,background:C.accent+"20",color:C.accent,border:`1px solid ${C.accent}33`,padding:"2px 9px",borderRadius:20}}>{todayWB[m.key]}/5</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>saveWB(m.key,n)}
                    style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${n<=(todayWB[m.key]||0)?C.accent:C.border}`,background:n<=(todayWB[m.key]||0)?C.accent+"22":"transparent",color:n<=(todayWB[m.key]||0)?C.accent:C.textMuted,fontSize:16,fontFamily:F.display,cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sign out */}
      <button onClick={onSignOut}
        style={{width:"100%",marginTop:28,padding:"12px",borderRadius:8,border:`1px solid ${C.accentRed}44`,background:"transparent",color:C.accentRed,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>
        SIGN OUT
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,           setUser]           = useState(null);
  const [authLoaded,     setAuthLoaded]     = useState(false);
  const [tab,            setTab]            = useState("today");
  const [activeWorkout,  setActiveWorkout]  = useState(null);
  const [workoutLogs,    setWorkoutLogs]    = useState(()=>load(KEYS.LOGS,[]));
  const [program,        setProgram]        = useState(null);
  const [goals,          setGoals]          = useState(()=>load(KEYS.GOALS,[]));
  const [perfGoals,      setPerfGoals]      = useState(()=>load(KEYS.PERF_GOALS,[]));

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoaded(true); });
    return unsub;
  }, []);

  // Load data on login
  useEffect(() => {
    if (!user) return;

    // Workout logs
    loadLogs(user.uid).then(logs => {
      if (logs.length > 0) {
        const merged = [...logs, ...load(KEYS.LOGS,[])];
        const deduped = [...new Map(merged.map(l=>[l.id||l.completedAt,l])).values()];
        deduped.sort((a,b) => {
          const da = a.completedAt?.toDate?a.completedAt.toDate():new Date(a.completedAt||0);
          const db2= b.completedAt?.toDate?b.completedAt.toDate():new Date(b.completedAt||0);
          return db2-da;
        });
        setWorkoutLogs(deduped); save(KEYS.LOGS,deduped);
      }
    });

    // User doc (profile, goals, weight)
    loadUserDoc(user.uid).then(data => {
      if (!data) return;
      if (data.profile) { save(KEYS.PROFILE,data.profile); }
      if (data.goals)   { setGoals(data.goals); save(KEYS.GOALS,data.goals); }
      if (data.perfGoals){ setPerfGoals(data.perfGoals); save(KEYS.PERF_GOALS,data.perfGoals); }
      if (data.wellbeing){ save(KEYS.WELLBEING,data.wellbeing); }
    });

    // Weight log
    loadWeightLog(user.uid).then(wl => {
      if (wl.length > 0) { save(KEYS.WEIGHT_LOG, wl); }
    });

    // Assigned program
    const loadProgram = async () => {
      try {
        const { getDocs: gd, query: q, where: w, collection: col, getDoc: gdc, doc: d, updateDoc: ud } =
          await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        let snap = await gd(q(col(db,"clients"), w("userId","==",user.uid)));
        if (snap.empty && user.email) {
          snap = await gd(q(col(db,"clients"), w("linkedEmail","==",user.email)));
          if (!snap.empty) await ud(d(db,"clients",snap.docs[0].id),{userId:user.uid});
        }
        if (!snap.empty) {
          const clientData = snap.docs[0].data();
          if (clientData.assignedProgramId) {
            const ps = await gdc(d(db,"programs",clientData.assignedProgramId));
            if (ps.exists()) setProgram({id:ps.id,...ps.data()});
          }
        }
      } catch(e) { console.warn("Program load failed:",e); }
    };
    loadProgram();
  }, [user]);

  const handleWorkoutComplete = (updatedLogs) => {
    setWorkoutLogs(updatedLogs);
    setActiveWorkout(null);
    setTab("track");
  };

  const handleRefresh = async () => {
    if (!user) return;
    const logs = await loadLogs(user.uid);
    if (logs.length > 0) { setWorkoutLogs(logs); save(KEYS.LOGS,logs); }
  };

  const handleSignOut = async () => {
    await signOut(auth); setUser(null); setTab("today");
  };

  if (!authLoaded) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:36,fontFamily:F.display,color:C.accent,letterSpacing:"0.1em"}}>LOADING...</div>
    </div>
  );
  if (!user) return <LoginScreen />;
  if (activeWorkout) return (
    <ActiveWorkout user={user} workout={activeWorkout} onComplete={handleWorkoutComplete} onCancel={()=>setActiveWorkout(null)} />
  );

  const navItems = [
    {id:"today",   icon:"🏠", label:"Today"},
    {id:"program", icon:"📋", label:"Program"},
    {id:"habits",  icon:"🔥", label:"Habits"},
    {id:"track",   icon:"📊", label:"Track"},
    {id:"me",      icon:"👤", label:"Me"},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.display,maxWidth:430,margin:"0 auto",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        select option{background:${C.card};}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1);}
      `}</style>

      {/* Header */}
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:28,letterSpacing:"0.08em",color:C.accent,lineHeight:1,fontFamily:F.display}}>
            FRAME<span style={{color:C.accentRed}}>WERKS</span>
          </div>
          <div style={{fontSize:10,letterSpacing:"0.3em",color:C.textMuted,fontFamily:F.body,fontWeight:500,marginTop:2}}>FITNESS</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,boxShadow:`0 0 6px ${C.accent}`}} />
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.1em"}}>LIVE SYNC</div>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"0 16px",paddingBottom:100}}>
        {tab==="today"   && <TodayTab user={user} workoutLogs={workoutLogs} program={program} perfGoals={perfGoals} goals={goals} onStartWorkout={setActiveWorkout} />}
        {tab==="program" && <ProgramTab program={program} onStartWorkout={setActiveWorkout} />}
        {tab==="habits"  && <HabitsTab user={user} />}
        {tab==="track"   && <HistoryProgressTab workoutLogs={workoutLogs} onRefresh={handleRefresh} />}
        {tab==="me"      && <MeTab user={user} onSignOut={handleSignOut} onGoalsChange={setGoals} onPerfGoalsChange={setPerfGoals} />}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 20px",zIndex:100}}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 16px",color:tab===item.id?C.accent:C.textDim,transition:"color 0.15s"}}>
            <span style={{fontSize:22}}>{item.icon}</span>
            <span style={{fontSize:9,fontFamily:F.body,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
