import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  addDoc, serverTimestamp, setDoc, getDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDwCIb6OQ40TDNlNr1TjxO4kZVf2Ho62X8",
  authDomain: "framewerks-coach.firebaseapp.com",
  projectId: "framewerks-coach",
  storageBucket: "framewerks-coach.firebasestorage.app",
  messagingSenderId: "850336233136",
  appId: "1:850336233136:web:2bf59afb82672435c4ed75"
};
const fbApp   = initializeApp(firebaseConfig);
const db      = getFirestore(fbApp);
const auth    = getAuth(fbApp);
const storage = getStorage(fbApp);
const gProvider = new GoogleAuthProvider();

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#0D0D0D", surface:"#141414", card:"#1A1A1A", border:"#2A2A2A",
  accent:"#E8FF00", accentRed:"#FF3D3D", accentBlue:"#00C8FF",
  accentGreen:"#00FF88", accentOrange:"#FF8C00",
  text:"#FFFFFF", textMuted:"#888888", textDim:"#444444",
};
const F = { display:"'Bebas Neue','Impact',sans-serif", body:"system-ui,-apple-system,sans-serif" };

// ─── LocalStorage ─────────────────────────────────────────────────────────────
const KEYS = {
  LOGS:"fw_logs", HABITS:"fw_habits", HABIT_DONE:"fw_habit_done",
  WELLBEING:"fw_wellbeing", PROFILE:"fw_profile", GOALS:"fw_goals",
  PERF_GOALS:"fw_perf_goals", WEIGHT_LOG:"fw_weight_log",
  ACTIVE_WORKOUT:"fw_active_workout",
};
const ls  = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch{} };
const ll  = (k,d=null) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch{ return d; } };

// ─── Firebase helpers ─────────────────────────────────────────────────────────
const syncLog = async (uid,entry) => {
  try { const r=await addDoc(collection(db,"workoutLogs"),{userId:uid,...entry,completedAt:serverTimestamp()}); return r.id; } catch{ return null; }
};
const syncSet = async (uid,logId,sd) => {
  try { await addDoc(collection(db,"setSyncs"),{userId:uid,workoutLogId:logId,...sd,timestamp:serverTimestamp()}); } catch{}
};
const loadLogs = async uid => {
  try {
    const q=query(collection(db,"workoutLogs"),where("userId","==",uid),orderBy("completedAt","desc"));
    return (await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  } catch{ return []; }
};
const saveUserDoc = async (uid,data) => {
  try { await setDoc(doc(db,"users",uid),{...data,updatedAt:serverTimestamp()},{merge:true}); } catch{}
};
const loadUserDoc = async uid => {
  try { const s=await getDoc(doc(db,"users",uid)); return s.exists()?s.data():null; } catch{ return null; }
};
const saveWeightEntry = async (uid,entry) => {
  try {
    // Upsert by date — one doc per day per user
    const docId = `${uid}_${entry.date}`;
    await setDoc(doc(db,"weightLog",docId),{userId:uid,...entry,updatedAt:serverTimestamp()},{merge:true});
    return docId;
  } catch(e){ console.warn("saveWeightEntry:",e); return null; }
};
const loadWeightLog = async uid => {
  try {
    const q=query(collection(db,"weightLog"),where("userId","==",uid),orderBy("updatedAt","desc"));
    return (await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  } catch{ return []; }
};
const uploadFile = async (uid,file,path) => {
  try {
    const r=sRef(storage,`${path}/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(r,file);
    return await getDownloadURL(r);
  } catch(e){ console.warn("Upload error:",e); return null; }
};

// ─── Goal options ─────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  "Lose weight / fat","Improve physical fitness","Get control of eating habits",
  "Gain weight","Look better","Get stronger",
  "Maintain weight","Feel better","Physique competition / modeling",
  "Add muscle","Improve overall health","Have more energy and vitality",
  "Improve athletic performance","Healthy aging","Get off or decrease medications",
];

const ALL_HABITS = [
  {id:"h1",name:"Morning Movement",icon:"🌅",target:"10 min"},
  {id:"h2",name:"Protein Goal",icon:"🥩",target:"150g"},
  {id:"h3",name:"Breathwork",icon:"🧘",target:"5 min"},
  {id:"h4",name:"Hydration",icon:"💧",target:"3L"},
  {id:"h5",name:"Sleep 7-9hrs",icon:"😴",target:"9pm"},
  {id:"h6",name:"Meal Prep",icon:"🥗",target:"Weekly"},
  {id:"h7",name:"No alcohol",icon:"🚫",target:"Daily"},
  {id:"h8",name:"Cold shower",icon:"🚿",target:"Daily"},
  {id:"h9",name:"Journaling",icon:"📓",target:"10 min"},
  {id:"h10",name:"Steps goal",icon:"👟",target:"8,000 steps"},
];

// ─── Converters ───────────────────────────────────────────────────────────────
const dayToWorkout = day => ({
  id:day.id, name:day.name,
  warmup:day.warmup||[],
  cooldown:day.cooldown||{exercises:[],breathing:{pattern:"4-4-4-4",notes:""}},
  exercises:(day.blocks||[]).flatMap((block,bi)=>
    (block.exercises||[]).map((ex,ei)=>({
      id:ex.id||`${bi}_${ei}`, name:ex.name,
      sets:parseInt(ex.sets)||3, reps:ex.reps||"8-10",
      tempo:ex.tempo||"", rpe:ex.rpe||"", rest:ex.rest||"60s",
      startWeight:ex.startWeight||"", notes:ex.notes||"",
      blockName:block.name, blockType:block.type,
    }))
  ),
});

const parseReps = (repsStr,sets) => {
  if(!repsStr) return Array(sets).fill("");
  if(repsStr.includes("/")){ const p=repsStr.split("/"); return Array(sets).fill("").map((_,i)=>p[i]||p[p.length-1]); }
  return Array(sets).fill(repsStr);
};

const fmtDate = ts => {
  if(!ts) return "–";
  const d=ts?.toDate?ts.toDate():new Date(ts);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"});
};

// ═══════════════════════════════════════════════════════════════════════════════
// BREATHING COOL DOWN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
// ─── Meditation chime system (Web Audio API) ─────────────────────────────────
// Creates a rich bell/chime sound by layering harmonics with a long natural decay
function playChime(type="breathe") {
  // type: "breathe" (inhale + exhale) | "hold" | "final" | "prep"
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();

    const playPartial = (freq, vol, decaySec, delayMs=0) => {
      setTimeout(()=>{
        try {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          // Soft reverb via convolver would need audio buffer — use gain shaping instead
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          // Sharp attack, long exponential decay — classic bell envelope
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decaySec);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + decaySec + 0.05);
        } catch{}
      }, delayMs);
    };

    if(type === "breathe") {
      // Warm singing-bowl style: root + octave + fifth harmonic
      // Two gentle strikes 80ms apart for a shimmer effect
      playPartial(432,  0.18, 3.5, 0);    // root — A4 (slightly detuned for warmth)
      playPartial(864,  0.08, 2.2, 0);    // octave
      playPartial(648,  0.05, 1.8, 0);    // fifth
      playPartial(440,  0.06, 2.5, 80);   // slight shimmer second strike
    } else if(type === "hold") {
      // Softer, lower, single muted strike — signals to pause, not move
      playPartial(288,  0.10, 2.0, 0);    // low D — grounding
      playPartial(576,  0.04, 1.2, 0);    // octave, quiet
      playPartial(360,  0.03, 1.0, 60);   // soft shimmer
    } else if(type === "final") {
      // Brighter and longer for the final breath sequence
      playPartial(528,  0.20, 4.5, 0);    // 528hz "love frequency"
      playPartial(1056, 0.07, 2.8, 0);    // octave
      playPartial(792,  0.05, 2.2, 0);    // fifth
      playPartial(528,  0.08, 3.5, 100);  // shimmer
    } else if(type === "prep") {
      // Very soft, high, tick-like — gentle pacing during prep
      playPartial(880,  0.04, 0.6, 0);
    }

    // Auto-close after longest possible decay
    setTimeout(()=>{ try{ctx.close();}catch{} }, 5000);
  } catch{}
}

// Legacy shim so existing calls still work if any remain
function playTone(freq=220, duration=0.4, vol=0.08, type="sine") {
  playChime("prep");
}

function BreathingScreen({ breathing, onFinish }) {
  const pattern = (breathing?.pattern||"4-4-4-4").split("-").map(Number);
  const [inhale, holdIn, exhale, holdOut] = [pattern[0]||4, pattern[1]||4, pattern[2]||4, pattern[3]||4];
  const totalCycle = inhale + holdIn + exhale + holdOut;
  const PREP_DURATION = 30; // seconds
  const MAIN_DURATION = 3 * 60; // 3 minutes

  // stage: "start" | "prep" | "main" | "ending1" | "ending2" | "done"
  const [stage,    setStage]    = useState("start");
  const [elapsed,  setElapsed]  = useState(0);
  const [prepLeft, setPrepLeft] = useState(PREP_DURATION);
  const [phase,    setPhase]    = useState("inhale");
  const [ballY,    setBallY]    = useState(1);   // 1=BOTTOM (rest), 0=TOP
  const [ballSize, setBallSize] = useState(1);
  const [endTimer, setEndTimer] = useState(5);
  const prevPhaseRef = useRef("");

  // Play a meditation chime when phase changes
  useEffect(()=>{
    if(phase===prevPhaseRef.current) return;
    prevPhaseRef.current = phase;
    // Breathe chime: same warm bowl tone for inhale and exhale
    // Hold chime: distinct softer lower tone for both holds
    if(phase==="inhale")       playChime("breathe");
    else if(phase==="holdIn")  playChime("hold");
    else if(phase==="exhale")  playChime("breathe");
    else if(phase==="holdOut") playChime("hold");
    else if(phase==="ending1") playChime("final");
    else if(phase==="ending2") playChime("final");
  },[phase]);

  // ── Prep countdown ──
  useEffect(()=>{
    if(stage!=="prep") return;
    // Gentle prep tick each second
    playChime("prep");
    const t = setInterval(()=>{
      setPrepLeft(n=>{
        if(n<=1){ setStage("main"); setElapsed(0); clearInterval(t); return 0; }
        playChime("prep");
        return n-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[stage]);

  // ── Main timer ──
  useEffect(()=>{
    if(stage!=="main") return;
    const t = setInterval(()=>setElapsed(e=>e+0.05), 50);
    return()=>clearInterval(t);
  },[stage]);

  // ── Trigger ending after 3 min ──
  useEffect(()=>{
    if(stage==="main" && elapsed>=MAIN_DURATION){
      setStage("ending1"); setEndTimer(5);
    }
  },[elapsed, stage]);

  // ── Ending countdown ──
  useEffect(()=>{
    if(stage!=="ending1"&&stage!=="ending2") return;
    const t = setInterval(()=>{
      setEndTimer(n=>{
        if(n<=1){
          if(stage==="ending1"){ setStage("ending2"); return 5; }
          else{ setStage("done"); onFinish(); return 0; }
        }
        return n-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[stage]);

  // ── Ball animation during main ──
  useEffect(()=>{
    if(stage==="ending1"){ setBallY(0); setBallSize(1.7); setPhase("ending1"); return; }
    if(stage==="ending2"){ setBallY(1); setBallSize(0.7); setPhase("ending2"); return; }
    if(stage!=="main") return;

    const pos = elapsed % totalCycle;
    if(pos < inhale){
      // INHALE — ball rises from bottom (Y=1) to top (Y=0)
      const t = pos/inhale;
      setPhase("inhale"); setBallY(1-t); setBallSize(1 + t*0.5);
    } else if(pos < inhale+holdIn){
      // HOLD IN — ball stays at top, big
      setPhase("holdIn"); setBallY(0); setBallSize(1.5);
    } else if(pos < inhale+holdIn+exhale){
      // EXHALE — ball drops from top (Y=0) to bottom (Y=1)
      const t = (pos-inhale-holdIn)/exhale;
      setPhase("exhale"); setBallY(t); setBallSize(1.5 - t*0.5);
    } else {
      // HOLD OUT — ball stays at bottom, small
      setPhase("holdOut"); setBallY(1); setBallSize(1);
    }
  },[elapsed, stage, totalCycle, inhale, holdIn, exhale]);

  const phaseLabel = {
    inhale:"INHALE", holdIn:"HOLD", exhale:"EXHALE", holdOut:"HOLD",
    ending1:"DEEP INHALE", ending2:"LONG EXHALE"
  }[phase] || "BREATHE";

  const phaseColor = (phase==="inhale"||phase==="ending1") ? C.accentBlue
    : (phase==="exhale"||phase==="ending2") ? C.accentGreen
    : C.accent;

  const timeLeft = Math.max(0, MAIN_DURATION - elapsed);
  const mainProgress = stage==="main" ? Math.min(elapsed/MAIN_DURATION,1) : stage==="ending1"||stage==="ending2"||stage==="done" ? 1 : 0;

  // SVG geometry
  const CX=160, CY=210, R=145;
  const TRACK_TOP = CY - 105;
  const TRACK_BOT = CY + 105;
  const TRACK_H = TRACK_BOT - TRACK_TOP;
  const ballCY = TRACK_TOP + ballY * TRACK_H;
  const ballR  = 26 * ballSize;
  const arc = 2*Math.PI*R;

  // ── START SCREEN ──
  if(stage==="start") return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:F.display,textAlign:"center"}}>
      <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.2em",marginBottom:12}}>COOL DOWN</div>
      <div style={{fontSize:40,color:C.text,marginBottom:6}}>BREATHING</div>
      <div style={{width:80,height:80,borderRadius:"50%",background:C.accentBlue+"22",border:`2px solid ${C.accentBlue}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"24px auto"}}>🧘</div>
      <div style={{fontSize:14,fontFamily:F.body,color:C.text,lineHeight:1.8,maxWidth:280,marginBottom:8}}>
        Find a comfortable seat or lie down.
      </div>
      <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,lineHeight:1.8,maxWidth:280,marginBottom:6}}>
        Take slow, deep breaths into your belly.
      </div>
      <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,lineHeight:1.8,maxWidth:280,marginBottom:32}}>
        <span style={{color:C.accentBlue}}>Inhale through your nose.</span>
        {"  "}
        <span style={{color:C.accentGreen}}>Exhale through your mouth.</span>
      </div>
      <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,marginBottom:6}}>Pattern: <span style={{color:C.accent}}>{breathing?.pattern||"4-4-4-4"}</span></div>
      {breathing?.notes&&<div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginBottom:24,fontStyle:"italic",maxWidth:260}}>{breathing.notes}</div>}
      <button onClick={()=>setStage("prep")}
        style={{padding:"16px 48px",borderRadius:12,border:"none",background:C.accentBlue,color:"#000",fontFamily:F.display,fontSize:22,cursor:"pointer",letterSpacing:"0.1em",marginBottom:16}}>
        BEGIN
      </button>
      <button onClick={onFinish}
        style={{padding:"10px 24px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:13,cursor:"pointer"}}>
        SKIP
      </button>
    </div>
  );

  // ── PREP SCREEN (30s countdown) ──
  if(stage==="prep") return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:F.display,textAlign:"center"}}>
      <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.2em",marginBottom:20}}>SETTLING IN</div>
      <div style={{width:160,height:160,borderRadius:"50%",background:"transparent",border:`3px solid ${C.accentBlue}44`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:32,position:"relative"}}>
        {/* Countdown arc */}
        <svg width={160} height={160} style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}>
          <circle cx={80} cy={80} r={76} fill="none" stroke={C.accentBlue} strokeWidth={3}
            strokeDasharray={`${2*Math.PI*76*(prepLeft/PREP_DURATION)} ${2*Math.PI*76*(1-prepLeft/PREP_DURATION)}`} />
        </svg>
        <div style={{fontSize:64,fontFamily:F.display,color:C.accentBlue,lineHeight:1}}>{prepLeft}</div>
      </div>
      <div style={{fontSize:18,fontFamily:F.body,color:C.textMuted,lineHeight:1.9,maxWidth:280}}>
        Slow your breathing.<br/>
        <span style={{color:C.accentBlue}}>Nose in</span> · <span style={{color:C.accentGreen}}>mouth out</span><br/>
        Deep into your belly.
      </div>
      <button onClick={onFinish}
        style={{marginTop:48,padding:"10px 24px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:13,cursor:"pointer"}}>
        SKIP
      </button>
    </div>
  );

  // ── MAIN + ENDING SCREENS ──
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:F.display}}>
      <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.2em",marginBottom:4}}>COOL DOWN · BREATHING</div>
      <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,marginBottom:16,textAlign:"center"}}>
        {(stage==="ending1"||stage==="ending2")?"Final breath":"Follow the ball · nose in · mouth out"}
      </div>

      <svg width={320} height={430}>
        {/* Outer timer ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.border} strokeWidth={2}/>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={phaseColor} strokeWidth={2}
          strokeDasharray={`${arc*mainProgress} ${arc*(1-mainProgress)}`}
          strokeDashoffset={arc*0.25}
          style={{transition:"stroke 0.6s",transform:`rotate(-90deg)`,transformOrigin:`${CX}px ${CY}px`}}/>
        {/* INHALE label at top */}
        <text x={CX} y={TRACK_TOP-14} textAnchor="middle" fill={C.accentBlue} fontSize={10} fontFamily={F.body} fontWeight="700" letterSpacing="0.15em">↑ INHALE</text>
        {/* EXHALE label at bottom */}
        <text x={CX} y={TRACK_BOT+20} textAnchor="middle" fill={C.accentGreen} fontSize={10} fontFamily={F.body} fontWeight="700" letterSpacing="0.15em">↓ EXHALE</text>
        {/* Track */}
        <line x1={CX} y1={TRACK_TOP} x2={CX} y2={TRACK_BOT} stroke={C.border} strokeWidth={1.5} strokeDasharray="5,5"/>
        {/* Glow trail */}
        <ellipse cx={CX} cy={ballCY} rx={ballR*0.5} ry={ballR*1.4} fill={phaseColor} opacity={0.12}
          style={{transition:"all 0.12s linear,fill 0.5s"}}/>
        {/* Ball */}
        <circle cx={CX} cy={ballCY} r={ballR} fill={phaseColor} opacity={0.95}
          style={{transition:"cy 0.12s linear,r 0.12s linear,fill 0.5s",filter:`drop-shadow(0 0 ${ballR*0.7}px ${phaseColor})`}}/>
        {/* Phase label inside ball */}
        <text x={CX} y={ballCY+5} textAnchor="middle" fill="#000" fontSize={9} fontFamily={F.body} fontWeight="700"
          style={{userSelect:"none"}}>
          {phase==="inhale"?"▲":phase==="exhale"?"▼":"●"}
        </text>
        {/* Timer */}
        <text x={CX} y={400} textAnchor="middle" fill={C.textMuted} fontSize={13} fontFamily={F.body}>
          {stage==="main"?`${Math.floor(timeLeft/60)}:${String(Math.floor(timeLeft%60)).padStart(2,"0")}`:""}
        </text>
      </svg>

      {/* Phase label */}
      <div style={{fontSize:40,color:phaseColor,letterSpacing:"0.15em",marginBottom:6,transition:"color 0.5s",marginTop:8}}>{phaseLabel}</div>

      {/* Ending sequence */}
      {(stage==="ending1"||stage==="ending2")&&(
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontFamily:F.body,color:C.textMuted,marginBottom:6}}>
            {stage==="ending1"?"Take one big deep breath in through your nose...":"Now slowly exhale everything out through your mouth..."}
          </div>
          <div style={{fontSize:52,fontFamily:F.display,color:phaseColor}}>{endTimer}</div>
        </div>
      )}

      {stage==="main"&&(
        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,textAlign:"center",marginTop:4}}>
          Pattern: <span style={{color:C.accent}}>{breathing?.pattern||"4-4-4-4"}</span>
        </div>
      )}

      <button onClick={onFinish}
        style={{marginTop:20,padding:"10px 28px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:13,cursor:"pointer"}}>
        SKIP
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPIN DIAL weight input
// ═══════════════════════════════════════════════════════════════════════════════
function WeightDial({ value, onChange, placeholder="0" }) {
  const [dragging, setDragging] = useState(false);
  const [startY,   setStartY]   = useState(0);
  const [startVal, setStartVal] = useState(0);
  const ref = useRef(null);

  const numVal = parseFloat(value)||0;

  const handleStart = (clientY) => {
    setDragging(true); setStartY(clientY); setStartVal(numVal);
  };
  const handleMove = useCallback((clientY)=>{
    if(!dragging) return;
    const delta = (startY-clientY)/3; // pixels per lb
    const newVal = Math.max(0,Math.round((startVal+delta)*2)/2); // 0.5 increments
    onChange(String(newVal));
  },[dragging,startY,startVal]);
  const handleEnd = ()=>setDragging(false);

  useEffect(()=>{
    if(!dragging) return;
    const mm=(e)=>handleMove(e.touches?e.touches[0].clientY:e.clientY);
    const mu=()=>handleEnd();
    window.addEventListener("mousemove",mm);
    window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});
    window.addEventListener("touchend",mu);
    return()=>{ window.removeEventListener("mousemove",mm); window.removeEventListener("mouseup",mu); window.removeEventListener("touchmove",mm); window.removeEventListener("touchend",mu); };
  },[dragging,handleMove]);

  return (
    <div style={{position:"relative",userSelect:"none"}}>
      <input
        type="number" value={value} placeholder={placeholder} readOnly
        style={{width:"100%",background:C.surface,border:`1px solid ${dragging?C.accent:C.border}`,borderRadius:8,padding:"8px",color:dragging?C.accent:C.text,fontSize:16,textAlign:"center",outline:"none",fontFamily:F.display,cursor:"ns-resize",boxSizing:"border-box",transition:"border-color 0.15s,color 0.15s"}}
        onChange={e=>onChange(e.target.value)}
      />
      {/* Drag zone overlay */}
      <div
        ref={ref}
        onMouseDown={e=>handleStart(e.clientY)}
        onTouchStart={e=>handleStart(e.touches[0].clientY)}
        style={{position:"absolute",inset:0,cursor:"ns-resize",borderRadius:8}}
      />
      <div style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",gap:1,pointerEvents:"none"}}>
        <div style={{width:0,height:0,borderLeft:"4px solid transparent",borderRight:"4px solid transparent",borderBottom:`5px solid ${C.textDim}`}}/>
        <div style={{width:0,height:0,borderLeft:"4px solid transparent",borderRight:"4px solid transparent",borderTop:`5px solid ${C.textDim}`}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveWorkout({ user, workout, onComplete, onCancel }) {
  // Restore or init set data
  const initSetData = () => {
    const saved = ll(KEYS.ACTIVE_WORKOUT);
    if(saved && saved.workoutId===workout.id) return saved.setData;
    return workout.exercises.reduce((acc,ex)=>{
      const reps=parseReps(ex.reps,ex.sets);
      acc[ex.id]=Array(ex.sets).fill(null).map((_,si)=>({
        reps:reps[si]||"", weight:ex.startWeight||"", done:false
      }));
      return acc;
    },{});
  };

  const [phase,       setPhase]       = useState("warmup"); // warmup|workout|cooldown|done
  const [setData,     setSetData]     = useState(initSetData);
  const [currentExIdx,setCurEx]       = useState(()=>{ const s=ll(KEYS.ACTIVE_WORKOUT); return (s&&s.workoutId===workout.id)?s.currentExIdx||0:0; });
  const [notes,       setNotes]       = useState("");
  const [rating,      setRating]      = useState(0);
  const [startTime]                   = useState(()=>{ const s=ll(KEYS.ACTIVE_WORKOUT); return (s&&s.workoutId===workout.id&&s.startTime)?s.startTime:Date.now(); });
  const [showFinish,  setShowFinish]  = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const logIdRef = useRef(null);

  // Persist on change
  useEffect(()=>{ ls(KEYS.ACTIVE_WORKOUT,{workoutId:workout.id,setData,currentExIdx,startTime}); },[setData,currentExIdx]);

  // Timer
  useEffect(()=>{ const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime)/1000)),1000); return()=>clearInterval(t); },[startTime]);

  const fmt=(s)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const updateSet = async (exId,si,field,value) => {
    setSetData(prev=>{
      const next={...prev,[exId]:[...prev[exId]]};
      next[exId][si]={...next[exId][si],[field]:value};
      // Auto-fill weight for next sets from first set
      if(field==="weight" && si===0){
        next[exId]=next[exId].map((s,i)=>i===0?s:s.done?s:{...s,weight:value});
      }
      // Sync set completion
      if(field==="done"&&value===true&&user){
        syncSet(user.uid,logIdRef.current||"pending",{
          exerciseName:workout.exercises.find(e=>e.id===exId)?.name,
          setNumber:si+1,reps:next[exId][si].reps,weight:next[exId][si].weight,workoutName:workout.name
        });
      }
      return next;
    });
  };

  const completedSets = Object.values(setData).flat().filter(s=>s.done).length;
  const totalSets = Object.values(setData).flat().length;
  const progress = totalSets>0?(completedSets/totalSets)*100:0;

  const handleFinish = async () => {
    const duration=Math.floor((Date.now()-startTime)/1000);
    const entry={workoutId:workout.id,workoutName:workout.name,
      exercises:workout.exercises.map(ex=>({name:ex.name,sets:setData[ex.id].map((s,i)=>({setNumber:i+1,reps:s.reps,weight:s.weight,completed:s.done}))})),
      duration,rating,notes,completedAt:new Date().toISOString()
    };
    const existing=ll(KEYS.LOGS,[]);
    const newLogs=[{id:Date.now().toString(),...entry},...existing];
    ls(KEYS.LOGS,newLogs);
    localStorage.removeItem(KEYS.ACTIVE_WORKOUT);
    if(user) await syncLog(user.uid,entry);
    onComplete(newLogs);
  };

  // ── Warmup phase ──
  if(phase==="warmup"){
    const hasWarmup = workout.warmup?.length>0;
    return (
      <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.display,padding:"24px 16px 100px"}}>
        <div style={{fontSize:11,fontFamily:F.body,color:C.accentOrange,letterSpacing:"0.2em",marginBottom:4}}>WARM UP</div>
        <div style={{fontSize:32,marginBottom:20}}>{workout.name}</div>
        {hasWarmup?(
          <>
            <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>Complete these before starting</div>
            {workout.warmup.map((ex,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
                <div style={{fontSize:16}}>{ex.name}</div>
                <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted}}>{ex.duration}</div>
              </div>
            ))}
          </>
        ):(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"24px",textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:24,marginBottom:8}}>🔥</div>
            <div style={{fontSize:16,fontFamily:F.body,color:C.textMuted}}>No warm up prescribed today</div>
          </div>
        )}
        <button onClick={()=>setPhase("workout")}
          style={{width:"100%",padding:"16px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:20,cursor:"pointer"}}>
          START TRAINING
        </button>
        <button onClick={onCancel} style={{width:"100%",padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:14,cursor:"pointer",marginTop:10}}>CANCEL</button>
      </div>
    );
  }

  // ── Cooldown phase ──
  if(phase==="cooldown"){
    return <BreathingScreen breathing={workout.cooldown?.breathing} onFinish={()=>setPhase("done")} />;
  }

  // ── Done phase ──
  if(phase==="done"){
    return (
      <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.display,padding:"40px 20px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:64,marginBottom:16}}>🏆</div>
        <div style={{fontSize:40,marginBottom:8}}>DONE!</div>
        <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,marginBottom:32}}>Session complete · {fmt(elapsed)}</div>
        <div style={{width:"100%",maxWidth:320}}>
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:8}}>HOW WAS IT?</div>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setRating(n)}
                style={{flex:1,padding:"12px 0",borderRadius:8,border:`1px solid ${n<=rating?C.accent:C.border}`,background:n<=rating?C.accent+"22":"transparent",color:n<=rating?C.accent:C.textMuted,fontSize:18,fontFamily:F.display,cursor:"pointer"}}>
                {n}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:6}}>NOTES</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="How did it feel?" rows={3}
            style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none",resize:"none",boxSizing:"border-box",marginBottom:16}} />
          <button onClick={handleFinish}
            style={{width:"100%",padding:"16px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:20,cursor:"pointer"}}>
            SAVE SESSION
          </button>
        </div>
      </div>
    );
  }

  // ── Main workout phase ──
  const ex = workout.exercises[currentExIdx];
  const repsArr = parseReps(ex.reps,ex.sets);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F.display}}>
      {/* Progress bar */}
      <div style={{height:4,background:C.surface,position:"fixed",top:0,left:0,right:0,zIndex:200}}>
        <div style={{height:"100%",background:C.accent,width:`${progress}%`,transition:"width 0.3s"}} />
      </div>

      <div style={{padding:"20px 16px 100px"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,marginBottom:14}}>
          <div>
            <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.15em"}}>TRAINING</div>
            <div style={{fontSize:24}}>{workout.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,color:C.accent,fontFamily:F.display}}>{fmt(elapsed)}</div>
            <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>{completedSets}/{totalSets} SETS</div>
          </div>
        </div>

        {/* Exercise pills */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
          {workout.exercises.map((e,i)=>{
            const allDone=setData[e.id]?.every(s=>s.done);
            return (
              <button key={e.id} onClick={()=>setCurEx(i)}
                style={{flexShrink:0,padding:"4px 12px",borderRadius:20,border:`1px solid ${i===currentExIdx?C.accent:allDone?C.accentBlue+"66":C.border}`,background:i===currentExIdx?C.accent:allDone?C.accentBlue+"22":"transparent",color:i===currentExIdx?"#000":allDone?C.accentBlue:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer"}}>
                {allDone?"✓ ":""}{i+1}
              </button>
            );
          })}
        </div>

        {/* Exercise card */}
        <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:12,padding:"14px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontSize:28}}>{ex.name}</div>
              <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>{ex.sets} sets · {ex.reps}</div>
            </div>
            <span style={{fontSize:10,fontFamily:F.body,fontWeight:700,background:C.accent+"20",color:C.accent,border:`1px solid ${C.accent}33`,padding:"3px 10px",borderRadius:20}}>
              {currentExIdx+1}/{workout.exercises.length}
            </span>
          </div>
          {/* Coach tags */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ex.tempo&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.textMuted}}>⏱ TEMPO: {ex.tempo}</span>}
            {ex.rpe&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.accentOrange}}>RPE {ex.rpe}</span>}
            {ex.rest&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.textMuted}}>Rest {ex.rest}</span>}
            {ex.startWeight&&<span style={{fontSize:11,fontFamily:F.body,background:C.surface,borderRadius:6,padding:"3px 9px",color:C.accentBlue}}>Start: {ex.startWeight}</span>}
          </div>
          {ex.notes&&<div style={{fontSize:12,fontFamily:F.body,color:C.accentBlue,marginTop:8,fontStyle:"italic"}}>💡 {ex.notes}</div>}
        </div>

        {/* Sets table with spin dials */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:8,marginBottom:8}}>
            {["SET","WEIGHT (↕ drag)","REPS","✓"].map(h=><div key={h} style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700}}>{h}</div>)}
          </div>
          {setData[ex.id]?.map((set,si)=>(
            <div key={si} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:8,alignItems:"center",padding:"8px 0",borderTop:`1px solid ${C.border}`,opacity:set.done?0.6:1}}>
              <div style={{fontSize:16,fontFamily:F.display,color:set.done?C.accentBlue:C.textMuted}}>{si+1}</div>
              <WeightDial value={set.weight} onChange={v=>updateSet(ex.id,si,"weight",v)} placeholder={repsArr[si]||"0"} />
              <input type="number" placeholder={repsArr[si]||"0"} value={set.reps}
                onChange={e=>updateSet(ex.id,si,"reps",e.target.value)}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px",color:C.text,fontSize:16,textAlign:"center",outline:"none",fontFamily:F.display,width:"100%",boxSizing:"border-box"}} />
              <button onClick={()=>updateSet(ex.id,si,"done",!set.done)}
                style={{width:36,height:36,borderRadius:8,border:`1px solid ${set.done?C.accent:C.border}`,background:set.done?C.accent:"transparent",color:set.done?"#000":C.textDim,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                ✓
              </button>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{display:"flex",gap:10,marginBottom:10}}>
          {currentExIdx>0&&<button onClick={()=>setCurEx(i=>i-1)} style={{flex:1,padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontFamily:F.display,fontSize:14,cursor:"pointer"}}>← PREV</button>}
          {currentExIdx<workout.exercises.length-1
            ?<button onClick={()=>setCurEx(i=>i+1)} style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:14,cursor:"pointer"}}>NEXT →</button>
            :<button onClick={()=>setPhase("cooldown")} style={{flex:1,padding:"12px",borderRadius:8,border:"none",background:C.accentBlue,color:"#000",fontFamily:F.display,fontSize:14,cursor:"pointer"}}>COOL DOWN 🧘</button>
          }
        </div>
        <button onClick={onCancel} style={{width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontFamily:F.display,fontSize:13,cursor:"pointer"}}>SAVE & EXIT</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen() {
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const login=async()=>{ setLoading(true);setErr(""); try{await signInWithPopup(auth,gProvider);}catch{setErr("Sign in failed.");setLoading(false);} };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:F.display}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <div style={{fontSize:64,color:C.accent,letterSpacing:"0.05em",lineHeight:1}}>FRAME<span style={{color:C.accentRed}}>WERKS</span></div>
        <div style={{fontSize:12,letterSpacing:"0.4em",color:C.textMuted,fontFamily:F.body,marginTop:8}}>BUILD YOUR FOUNDATION</div>
      </div>
      <div style={{width:"100%",maxWidth:320}}>
        {err&&<div style={{background:C.accentRed+"22",border:`1px solid ${C.accentRed}44`,borderRadius:8,padding:"10px",marginBottom:14,fontSize:12,fontFamily:F.body,color:C.accentRed,textAlign:"center"}}>{err}</div>}
        <button onClick={login} disabled={loading}
          style={{width:"100%",padding:"16px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:F.display,fontSize:18,letterSpacing:"0.1em",background:C.accent,color:"#000",opacity:loading?0.6:1}}>
          {loading?"SIGNING IN...":"SIGN IN WITH GOOGLE"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TodayTab({ user, workoutLogs, program, perfGoals, goals, habits, habitDone, onStartWorkout }) {
  const dayOfWeek=new Date().getDay();
  const days=program?.days||[];
  const todayDay=dayOfWeek!==0&&days.length>0?days[(dayOfWeek-1)%days.length]:null;
  const todayWorkout=todayDay?dayToWorkout(todayDay):null;
  const greeting=()=>{ const h=new Date().getHours(); return h<12?"MORNING":h<17?"AFTERNOON":"EVENING"; };
  const today=new Date().toISOString().slice(0,10);
  const daysUntil=d=>Math.max(0,Math.ceil((new Date(d)-new Date())/(1000*60*60*24)));

  const getBest=name=>{ let b=0; workoutLogs.forEach(l=>l.exercises?.forEach(ex=>{ if(ex.name?.toLowerCase()===name?.toLowerCase()) ex.sets?.forEach(s=>{ const w=parseFloat(s.weight)||0; if(w>b)b=w; }); })); return b; };

  const activePerf=(perfGoals||[]).filter(g=>g.exercise&&g.goalWeight).slice(0,3);
  const activeGoals=(goals||[]).filter(g=>g.selected&&g.deadline).slice(0,2);
  const activeHabits=(habits||[]).slice(0,2);
  const todayStreaks=activeHabits.filter(h=>habitDone[`${today}_${h.id}`]);

  return (
    <div style={{paddingTop:24}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.15em"}}>GOOD {greeting()}</div>
        <div style={{fontSize:44,letterSpacing:"0.03em",lineHeight:1,marginTop:4,fontFamily:F.display}}>{user.displayName?.split(" ")[0]?.toUpperCase()||"ATHLETE"}</div>
        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:6}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[
          {label:"WORKOUTS",value:workoutLogs.length,big:true},
          {label:"PROGRAM",value:program?program.name.split(" ")[0]:"–",big:false},
          {label:"HABITS",value:`${todayStreaks.length}/${activeHabits.length}`,big:false},
        ].map((s,i)=>(
          <div key={i} style={{flex:1,background:i===0?C.accent:C.card,borderRadius:10,padding:"12px 8px",textAlign:"center",border:i===0?"none":`1px solid ${C.border}`}}>
            <div style={{fontSize:i===0?28:16,fontFamily:F.display,color:i===0?"#000":C.text,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:9,fontFamily:F.body,fontWeight:700,letterSpacing:"0.12em",color:i===0?"#000":C.textMuted,marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's workout */}
      {todayWorkout?(
        <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:12,padding:"14px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <span style={{fontSize:10,fontFamily:F.body,fontWeight:700,background:C.accent+"20",color:C.accent,border:`1px solid ${C.accent}33`,padding:"3px 10px",borderRadius:20}}>TODAY</span>
              <div style={{fontSize:26,fontFamily:F.display,marginTop:6}}>{todayWorkout.name}</div>
              <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{todayWorkout.exercises.length} exercises · {program?.name}</div>
            </div>
          </div>
          <button onClick={()=>onStartWorkout(todayWorkout)}
            style={{width:"100%",padding:"14px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:18,cursor:"pointer"}}>
            START WORKOUT
          </button>
        </div>
      ):(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"32px 16px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🔋</div>
          <div style={{fontSize:22,fontFamily:F.display}}>REST DAY</div>
          <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:4}}>Recovery is where gains are made</div>
        </div>
      )}

      {/* Performance goals */}
      {activePerf.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:10}}>PERFORMANCE GOALS</div>
          {activePerf.map((g,i)=>{
            const best=getBest(g.exercise), goal=parseFloat(g.goalWeight)||0;
            const pct=goal>0?Math.min((best/goal)*100,100):0;
            return (
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:15,fontFamily:F.display}}>{g.exercise}</div>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>
                      {best>0?`${best} lbs`:"No data"} → <span style={{color:C.accent}}>{goal} lbs</span>
                      {g.deadline&&` · ${daysUntil(g.deadline)}d left`}
                    </div>
                  </div>
                  <div style={{fontSize:20,fontFamily:F.display,color:pct>=100?C.accentGreen:C.accent}}>{Math.round(pct)}%</div>
                </div>
                <div style={{height:5,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct>=100?C.accentGreen:C.accent,width:`${pct}%`,transition:"width 0.5s"}} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Personal goals */}
      {activeGoals.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:10}}>MY GOALS</div>
          {activeGoals.map((g,i)=>{
            const dl=daysUntil(g.deadline);
            return (
              <div key={i} style={{background:C.card,border:`1px solid ${C.accentBlue}44`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:14,fontFamily:F.body}}>{g.name}</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontFamily:F.display,color:dl<=7?C.accentRed:C.accentBlue}}>{dl}d</div>
                    <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted}}>LEFT</div>
                  </div>
                </div>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,marginTop:4}}>
                  Deadline: {new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent */}
      {workoutLogs.slice(0,2).length>0&&(
        <>
          <div style={{fontSize:18,fontFamily:F.display,marginBottom:10}}>RECENT</div>
          {workoutLogs.slice(0,2).map((log,i)=>(
            <div key={log.id||i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:16,fontFamily:F.display}}>{log.workoutName}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>
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
// PROGRAM TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ProgramTab({ program, onStartWorkout }) {
  const [expanded,setExpanded]=useState(null);
  if(!program) return (
    <div style={{paddingTop:24}}>
      <div style={{fontSize:36,fontFamily:F.display,marginBottom:20}}>PROGRAM</div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"48px 16px",textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>📋</div>
        <div style={{fontSize:22,fontFamily:F.display}}>NO PROGRAM YET</div>
        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginTop:8}}>Your coach hasn't assigned a program yet.</div>
      </div>
    </div>
  );
  return (
    <div style={{paddingTop:24}}>
      <div style={{fontSize:36,fontFamily:F.display,marginBottom:4}}>PROGRAM</div>
      <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginBottom:20}}>{program.name} · {program.weeks} weeks</div>
      {(program.days||[]).map((day,i)=>{
        const w=dayToWorkout(day); const isExp=expanded===day.id;
        return (
          <div key={day.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:10}}>
            <div onClick={()=>setExpanded(isExp?null:day.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700}}>DAY {i+1}</div>
                <div style={{fontSize:22,fontFamily:F.display,marginTop:2}}>{day.name}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{w.exercises.length} exercises</div>
              </div>
              <div style={{fontSize:22,color:C.textDim,transform:isExp?"rotate(180deg)":"none",transition:"transform 0.2s"}}>↓</div>
            </div>
            {isExp&&(
              <div style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                {/* Warm up */}
                {day.warmup?.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.accentOrange,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>🔥 WARM UP</div>
                    {day.warmup.map((ex,wi)=>(
                      <div key={wi} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <div style={{fontSize:14,fontFamily:F.body}}>{ex.name}</div>
                        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>{ex.duration}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Blocks */}
                {day.blocks?.map((block,bi)=>(
                  <div key={bi} style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.accent,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>💪 {block.name?.toUpperCase()}</div>
                    {block.exercises?.map((ex,ei)=>(
                      <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,paddingLeft:8,borderLeft:`2px solid ${C.border}`}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:11,fontFamily:F.body,color:C.accent,fontWeight:700}}>{String.fromCharCode(65+bi)}{ei+1}</span>
                            <span style={{fontSize:15,fontFamily:F.display}}>{ex.name}</span>
                          </div>
                          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                            {ex.tempo&&<span style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>⏱ {ex.tempo}</span>}
                            {ex.rpe&&<span style={{fontSize:10,fontFamily:F.body,color:C.accentOrange}}>RPE {ex.rpe}</span>}
                            {ex.rest&&<span style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>Rest {ex.rest}</span>}
                          </div>
                        </div>
                        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,textAlign:"right",flexShrink:0,marginLeft:10}}>
                          <div>{ex.sets}×</div><div>{ex.reps}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Cool down */}
                {(day.cooldown?.exercises?.length>0||day.cooldown?.breathing?.pattern)&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.accentBlue,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>🧘 COOL DOWN</div>
                    {day.cooldown?.exercises?.map((ex,ci)=>(
                      <div key={ci} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <div style={{fontSize:14,fontFamily:F.body}}>{ex.name}</div>
                        <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted}}>{ex.duration}</div>
                      </div>
                    ))}
                    {day.cooldown?.breathing?.pattern&&(
                      <div style={{background:C.surface,borderRadius:8,padding:"8px 12px",marginTop:6}}>
                        <div style={{fontSize:10,fontFamily:F.body,color:C.accentBlue,fontWeight:700,marginBottom:2}}>BREATHING</div>
                        <div style={{fontSize:16,fontFamily:F.display,color:C.accentBlue}}>{day.cooldown.breathing.pattern}</div>
                        {day.cooldown.breathing.notes&&<div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:3}}>{day.cooldown.breathing.notes}</div>}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={()=>onStartWorkout(w)}
                  style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:16,cursor:"pointer"}}>
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
function HabitsTab({ user, habits, setHabits, habitDone, setHabitDone }) {
  const [choosing, setChoosing]=useState(false);
  const today=new Date().toISOString().slice(0,10);

  const toggle=(id)=>{
    const key=`${today}_${id}`, updated={...habitDone,[key]:!habitDone[key]};
    setHabitDone(updated); ls(KEYS.HABIT_DONE,updated);
    const h=habits.map(h=>h.id!==id?h:{...h,streak:updated[key]?h.streak+1:Math.max(0,h.streak-1)});
    setHabits(h); ls(KEYS.HABITS,h);
    if(user) saveUserDoc(user.uid,{habits:h,habitDone:updated});
  };

  const selectHabit=(habit)=>{
    let updated;
    const exists=habits.find(h=>h.id===habit.id);
    if(exists){ updated=habits.filter(h=>h.id!==habit.id); }
    else if(habits.length<2){ updated=[...habits,{...habit,streak:0}]; }
    else{ return; }
    setHabits(updated); ls(KEYS.HABITS,updated);
    if(user) saveUserDoc(user.uid,{habits:updated});
  };

  const comp=habits.filter(h=>habitDone[`${today}_${h.id}`]).length;

  return (
    <div style={{paddingTop:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:4}}>
        <div style={{fontSize:36,fontFamily:F.display}}>HABITS</div>
        <button onClick={()=>setChoosing(!choosing)}
          style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:12}}>
          {choosing?"DONE":"CHANGE"}
        </button>
      </div>
      <div style={{fontSize:12,fontFamily:F.body,color:C.textMuted,marginBottom:6}}>{comp}/{habits.length} TODAY · FOCUS ON 1-2 HABITS</div>
      <div style={{height:5,background:C.surface,borderRadius:3,marginBottom:20,overflow:"hidden"}}>
        <div style={{height:"100%",background:C.accent,width:habits.length>0?`${(comp/habits.length)*100}%`:"0%",transition:"width 0.4s"}} />
      </div>

      {choosing?(
        <div>
          <div style={{fontSize:13,fontFamily:F.body,color:C.textMuted,marginBottom:14}}>Pick 1-2 habits to focus on this month</div>
          {ALL_HABITS.map(h=>{
            const sel=!!habits.find(x=>x.id===h.id);
            const disabled=!sel&&habits.length>=2;
            return (
              <div key={h.id} onClick={()=>!disabled&&selectHabit(h)}
                style={{background:sel?C.accent+"0A":C.card,border:`1px solid ${sel?C.accent+"66":C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}>
                <span style={{fontSize:24}}>{h.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontFamily:F.display,color:sel?C.accent:C.text}}>{h.name}</div>
                  <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>Target: {h.target}</div>
                </div>
                <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${sel?C.accent:C.border}`,background:sel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:14}}>{sel?"✓":""}</div>
              </div>
            );
          })}
        </div>
      ):(
        habits.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted}}>
            <div style={{fontSize:32,marginBottom:12}}>🎯</div>
            <div style={{fontSize:18,fontFamily:F.display}}>NO HABITS SELECTED</div>
            <div style={{fontSize:12,fontFamily:F.body,marginTop:8}}>Tap CHANGE to pick 1-2 habits to focus on</div>
          </div>
        ):habits.map(h=>{
          const isDone=!!habitDone[`${today}_${h.id}`];
          return (
            <div key={h.id} onClick={()=>toggle(h.id)}
              style={{background:isDone?C.accent+"0A":C.card,border:`1px solid ${isDone?C.accent+"66":C.border}`,borderRadius:12,padding:"14px",marginBottom:10,display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{fontSize:28}}>{h.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:20,fontFamily:F.display,color:isDone?C.accent:C.text}}>{h.name}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>Target: {h.target} · 🔥 {h.streak||0} day streak</div>
              </div>
              <div style={{width:28,height:28,borderRadius:6,border:`2px solid ${isDone?C.accent:C.border}`,background:isDone?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:16,flexShrink:0}}>{isDone?"✓":""}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACK TAB (History + Progress + Weight + Check-in)
// ═══════════════════════════════════════════════════════════════════════════════
function TrackTab({ workoutLogs, habits, habitDone, weightLog: weightLogProp, onRefresh, user }) {
  const [view,     setView]    = useState("history");
  const [filter,   setFilter]  = useState("all");
  const [selected, setSelected]= useState(null);
  const [selEx,    setSelEx]   = useState("");
  const weightLog = weightLogProp || ll(KEYS.WEIGHT_LOG,[]);
  const [wellbeing,setWellbeing]=useState(()=>ll(KEYS.WELLBEING,{}));

  const VIEWS=[{id:"history",label:"HISTORY"},{id:"progress",label:"STRENGTH"},{id:"habits",label:"HABITS"},{id:"weight",label:"WEIGHT"},{id:"checkin",label:"CHECK-IN"}];

  const filteredLogs=workoutLogs.filter(log=>{
    if(filter==="all") return true;
    const d=log.completedAt?.toDate?log.completedAt.toDate():new Date(log.completedAt||0);
    return (Date.now()-d.getTime())<(filter==="week"?7:30)*24*60*60*1000;
  });

  const allExercises=[...new Set(workoutLogs.flatMap(l=>l.exercises?.map(e=>e.name)||[]))];
  const exHistory=workoutLogs.filter(l=>l.exercises?.some(e=>e.name===selEx)).map(l=>{
    const ex=l.exercises.find(e=>e.name===selEx);
    const done=ex?.sets?.filter(s=>s.completed)||[];
    const top=done.reduce((b,s)=>parseFloat(s.weight||0)>parseFloat(b?.weight||0)?s:b,null);
    return{logId:l.id,date:l.completedAt?.toDate?l.completedAt.toDate():new Date(l.completedAt||0),workoutName:l.workoutName,topWeight:parseFloat(top?.weight)||0,topReps:top?.reps||0,doneSets:done.length};
  }).sort((a,b)=>a.date-b.date);
  const maxW=exHistory.length>0?Math.max(...exHistory.map(d=>d.topWeight)):0;

  // Habit history — last 7 days
  const last7=Array(7).fill(0).map((_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    return d.toISOString().slice(0,10);
  }).reverse();

  // Check-in data
  const today=new Date().toISOString().slice(0,10);
  const todayWB=wellbeing[today]||{};
  const saveWB=(field,val)=>{
    const u={...wellbeing,[today]:{...todayWB,[field]:val}};
    setWellbeing(u); ls(KEYS.WELLBEING,u);
    if(user) saveUserDoc(user.uid,{wellbeing:u});
  };

  if(selected){
    const log=workoutLogs.find(l=>l.id===selected);
    if(!log){setSelected(null);return null;}
    return (
      <div style={{paddingTop:24}}>
        <button onClick={()=>setSelected(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",color:C.text,cursor:"pointer",fontFamily:F.display,fontSize:13,marginBottom:20}}>← BACK</button>
        <div style={{fontSize:28,fontFamily:F.display,marginBottom:4}}>{log.workoutName}</div>
        <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginBottom:16}}>
          {log.completedAt?.toDate?log.completedAt.toDate().toLocaleString():log.completedAt?new Date(log.completedAt).toLocaleString():"–"}
          {log.duration?` · ${Math.floor(log.duration/60)}min`:""}
        </div>
        {log.exercises?.map((ex,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
            <div style={{fontSize:16,fontFamily:F.display,marginBottom:8}}>{ex.name}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:4}}>
              {["SET","WEIGHT","REPS","DONE"].map(h=><div key={h} style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.1em"}}>{h}</div>)}
              {ex.sets?.map((s,si)=>[
                <div key={`n${si}`} style={{fontSize:14,fontFamily:F.display}}>{s.setNumber}</div>,
                <div key={`w${si}`} style={{fontSize:14,fontFamily:F.body,color:s.completed?C.text:C.textMuted}}>{s.weight||"–"}</div>,
                <div key={`r${si}`} style={{fontSize:14,fontFamily:F.body,color:s.completed?C.text:C.textMuted}}>{s.reps||"–"}</div>,
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
      {/* View switcher */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:20}}>
        {VIEWS.map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)}
            style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:`1px solid ${v.id===view?C.accent:C.border}`,background:v.id===view?C.accent+"22":"transparent",color:v.id===view?C.accent:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>
            {v.label}
          </button>
        ))}
      </div>

      {/* HISTORY */}
      {view==="history"&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:6}}>
              {["all","week","month"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${f===filter?C.accent:C.border}`,background:f===filter?C.accent+"22":"transparent",color:f===filter?C.accent:C.textMuted,fontSize:11,fontFamily:F.body,fontWeight:700,cursor:"pointer"}}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={onRefresh} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 12px",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:12}}>↻</button>
          </div>
          {filteredLogs.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:18,fontFamily:F.display}}>NO WORKOUTS YET</div>
            </div>
          ):filteredLogs.map((log,i)=>(
            <div key={log.id||i} onClick={()=>setSelected(log.id)}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:16,fontFamily:F.display}}>{log.workoutName}</div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>
                  {fmtDate(log.completedAt)}{log.duration?` · ${Math.floor(log.duration/60)}min`:""}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {log.rating&&<div style={{fontSize:14,fontFamily:F.display,color:C.accent}}>{log.rating}★</div>}
                <div style={{color:C.textDim,fontSize:18}}>›</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* STRENGTH PROGRESS */}
      {view==="progress"&&(
        <>
          <div style={{marginBottom:14}}>
            <select value={selEx} onChange={e=>setSelEx(e.target.value)}
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:F.body,outline:"none"}}>
              <option value="">— Choose an exercise —</option>
              {allExercises.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {selEx&&exHistory.length>0&&(
            <>
              <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"14px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em"}}>BEST — {selEx.toUpperCase()}</div>
                    <div style={{fontSize:48,fontFamily:F.display,color:C.accent,lineHeight:1,marginTop:4}}>
                      {maxW>0?maxW:"–"} <span style={{fontSize:18,color:C.textMuted}}>LBS</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>SESSIONS</div>
                    <div style={{fontSize:32,fontFamily:F.display,color:C.accentBlue}}>{exHistory.length}</div>
                  </div>
                </div>
                {exHistory.slice(-6).map((e,i,arr)=>{
                  const pct=maxW>0?(e.topWeight/maxW)*100:0, isLast=i===arr.length-1;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
                      <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,minWidth:48}}>{e.date.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      <div style={{flex:1,height:5,background:C.surface,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:isLast?C.accent:C.accentBlue+"88",width:`${pct}%`,transition:"width 0.5s"}} />
                      </div>
                      <div style={{fontSize:12,fontFamily:F.display,color:isLast?C.accent:C.text,minWidth:56,textAlign:"right"}}>{e.topWeight>0?`${e.topWeight}lbs`:"–"}</div>
                    </div>
                  );
                })}
              </div>
              {exHistory.slice().reverse().map((e,i)=>(
                <div key={i} onClick={()=>setSelected(e.logId)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                  <div>
                    <div style={{fontSize:14,fontFamily:F.display}}>{e.workoutName}</div>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{e.date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontFamily:F.display,color:i===0?C.accent:C.text}}>{e.topWeight>0?`${e.topWeight} lbs`:"–"}</div>
                    <div style={{fontSize:10,fontFamily:F.body,color:C.accentGreen}}>{e.doneSets} sets</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {!selEx&&<div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}><div style={{fontSize:38,marginBottom:12}}>📈</div><div style={{fontSize:16,fontFamily:F.display}}>SELECT AN EXERCISE</div></div>}
          {selEx&&exHistory.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.textMuted,fontFamily:F.body,fontSize:13}}>No data yet for {selEx}</div>}
        </>
      )}

      {/* HABITS HISTORY */}
      {view==="habits"&&(
        <div>
          <div style={{fontSize:14,fontFamily:F.body,color:C.textMuted,marginBottom:16}}>Last 7 days</div>
          {habits.length===0?(
            <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted,fontFamily:F.body,fontSize:13}}>No habits selected yet</div>
          ):habits.map(h=>(
            <div key={h.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <span style={{fontSize:24}}>{h.icon}</span>
                <div>
                  <div style={{fontSize:18,fontFamily:F.display}}>{h.name}</div>
                  <div style={{fontSize:11,fontFamily:F.body,color:C.accent}}>🔥 {h.streak||0} day streak</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {last7.map((d,i)=>{
                  const done=!!habitDone[`${d}_${h.id}`];
                  const isToday=d===today;
                  return (
                    <div key={i} style={{flex:1,textAlign:"center"}}>
                      <div style={{width:"100%",aspectRatio:"1",borderRadius:6,background:done?C.accent:C.surface,border:`1px solid ${isToday?C.accent:C.border}`,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:done?"#000":C.textDim}}>
                        {done?"✓":""}
                      </div>
                      <div style={{fontSize:9,fontFamily:F.body,color:isToday?C.accent:C.textDim}}>{new Date(d).toLocaleDateString("en-US",{weekday:"narrow"})}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WEIGHT LOG */}
      {view==="weight"&&(
        <div>
          {weightLog.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>
              <div style={{fontSize:38,marginBottom:12}}>⚖️</div>
              <div style={{fontSize:16,fontFamily:F.display}}>NO WEIGHT LOGGED YET</div>
              <div style={{fontSize:12,fontFamily:F.body,marginTop:8}}>Log your weight in the Me tab</div>
            </div>
          ):(
            <>
              <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"14px",marginBottom:14}}>
                <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em"}}>LATEST WEIGHT</div>
                <div style={{fontSize:48,fontFamily:F.display,color:C.accent,lineHeight:1,marginTop:4}}>{weightLog[0]?.weight} <span style={{fontSize:18,color:C.textMuted}}>lbs</span></div>
                <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:4}}>{weightLog[0]?.date}</div>
              </div>
              {weightLog.map((e,i)=>(
                <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  {e.photoUrls?.[0]&&<img src={e.photoUrls[0]} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0}} />}
                  <div style={{flex:1}}>
                    <div style={{fontSize:20,fontFamily:F.display,color:i===0?C.accent:C.text}}>{e.weight} <span style={{fontSize:13,color:C.textMuted}}>lbs</span></div>
                    <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{e.date}</div>
                  </div>
                  {i>0&&weightLog[i-1]&&(
                    <div style={{fontSize:13,fontFamily:F.display,color:e.weight<weightLog[i-1].weight?C.accentGreen:C.accentRed}}>
                      {e.weight<weightLog[i-1].weight?`-${(weightLog[i-1].weight-e.weight).toFixed(1)}`:`+${(e.weight-weightLog[i-1].weight).toFixed(1)}`}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* CHECK-IN HISTORY */}
      {view==="checkin"&&(
        <div>
          <div style={{fontSize:14,fontFamily:F.body,color:C.textMuted,marginBottom:16}}>Today's check-in</div>
          {[
            {key:"energy",label:"ENERGY",icon:"⚡"},
            {key:"sleep",label:"SLEEP",icon:"😴"},
            {key:"soreness",label:"SORENESS",icon:"💪"},
            {key:"stress",label:"STRESS",icon:"🧠"},
          ].map(m=>(
            <div key={m.key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:20}}>{m.icon}</span>
                <div style={{fontSize:16,fontFamily:F.display}}>{m.label}</div>
                {todayWB[m.key]&&<span style={{marginLeft:"auto",fontSize:10,fontFamily:F.body,fontWeight:700,background:C.accent+"20",color:C.accent,padding:"2px 9px",borderRadius:20}}>{todayWB[m.key]}/5</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>saveWB(m.key,n)}
                    style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${n<=(todayWB[m.key]||0)?C.accent:C.border}`,background:n<=(todayWB[m.key]||0)?C.accent+"22":"transparent",color:n<=(todayWB[m.key]||0)?C.accent:C.textMuted,fontSize:15,fontFamily:F.display,cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ME TAB
// ═══════════════════════════════════════════════════════════════════════════════
function MeTab({ user, onSignOut, onGoalsChange, onPerfGoalsChange, weightLog: weightLogProp, setWeightLog: setWeightLogProp }) {
  const [profile,     setProfile]     = useState(()=>ll(KEYS.PROFILE,{}));
  const [goals,       setGoals]       = useState(()=>ll(KEYS.GOALS,[]));
  const [perfGoals,   setPerfGoals]   = useState(()=>ll(KEYS.PERF_GOALS,[]));
  const weightLog = weightLogProp || ll(KEYS.WEIGHT_LOG,[]);
  const setWeightLog = (v)=>{ if(setWeightLogProp) setWeightLogProp(v); ls(KEYS.WEIGHT_LOG,v); };
  const [wellbeing,   setWellbeing]   = useState(()=>ll(KEYS.WELLBEING,{}));
  const [editProfile, setEditProfile] = useState(false);
  const [goalsOpen,   setGoalsOpen]   = useState(false);
  const [perfOpen,    setPerfOpen]    = useState(false);
  const [newWeight,   setNewWeight]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [photoCount,  setPhotoCount]  = useState(0);
  const photoRefs = [useRef(null),useRef(null),useRef(null),useRef(null)];
  const profilePhotoRef = useRef(null);
  const today=new Date().toISOString().slice(0,10);
  const todayWB=wellbeing[today]||{};

  const saveProfile=async p=>{ setProfile(p); ls(KEYS.PROFILE,p); if(user) await saveUserDoc(user.uid,{profile:p}); };
  const saveWB=(field,val)=>{ const u={...wellbeing,[today]:{...todayWB,[field]:val}}; setWellbeing(u); ls(KEYS.WELLBEING,u); if(user) saveUserDoc(user.uid,{wellbeing:u}); };

  const toggleGoal=(name)=>{
    const exists=goals.find(g=>g.name===name);
    const updated=exists?goals.map(g=>g.name===name?{...g,selected:!g.selected}:g):[...goals,{name,selected:true,deadline:"",createdAt:Date.now()}];
    setGoals(updated); ls(KEYS.GOALS,updated); onGoalsChange(updated);
    if(user) saveUserDoc(user.uid,{goals:updated});
  };
  const setGoalDeadline=(name,dl)=>{ const u=goals.map(g=>g.name===name?{...g,deadline:dl}:g); setGoals(u); ls(KEYS.GOALS,u); onGoalsChange(u); if(user) saveUserDoc(user.uid,{goals:u}); };

  const addPerfGoal=()=>{ const u=[...perfGoals,{id:Date.now().toString(),exercise:"",goalWeight:"",deadline:"",createdAt:Date.now()}]; setPerfGoals(u); ls(KEYS.PERF_GOALS,u); onPerfGoalsChange(u); if(user) saveUserDoc(user.uid,{perfGoals:u}); };
  const updPerfGoal=(id,f,v)=>{ const u=perfGoals.map(g=>g.id===id?{...g,[f]:v}:g); setPerfGoals(u); ls(KEYS.PERF_GOALS,u); onPerfGoalsChange(u); if(user) saveUserDoc(user.uid,{perfGoals:u}); };
  const rmPerfGoal=(id)=>{ const u=perfGoals.filter(g=>g.id!==id); setPerfGoals(u); ls(KEYS.PERF_GOALS,u); onPerfGoalsChange(u); if(user) saveUserDoc(user.uid,{perfGoals:u}); };

  const logWeight=async()=>{
    if(!newWeight) return; setSaving(true);
    const entry={weight:parseFloat(newWeight),date:today,loggedAt:Date.now(),photoUrls:[]};
    const updated=[entry,...weightLog]; setWeightLog(updated); ls(KEYS.WEIGHT_LOG,updated);
    if(user) await saveWeightEntry(user.uid,entry);
    setNewWeight(""); setSaving(false);
  };

  const handleProgressPhoto=async(file,idx)=>{
    if(!file||!user) return; setSaving(true);
    const url=await uploadFile(user.uid,file,"progressPhotos");
    if(url){
      const updated=[...weightLog];
      if(updated.length===0){
        // No weight logged yet — create today's entry with just the photo
        const today2=new Date().toISOString().slice(0,10);
        const entry={weight:null,date:today2,loggedAt:Date.now(),photoUrls:[null,null,null,null]};
        entry.photoUrls[idx]=url;
        updated.unshift(entry);
      } else {
        const photos=[...(updated[0].photoUrls||[null,null,null,null])];
        photos[idx]=url; updated[0]={...updated[0],photoUrls:photos};
      }
      setWeightLog(updated); ls(KEYS.WEIGHT_LOG,updated);
      // Upsert the entry to Firebase (saves photos array correctly)
      await saveWeightEntry(user.uid,updated[0]);
    }
    setSaving(false);
  };

  const handleProfilePhoto=async(file)=>{
    if(!file||!user) return; setSaving(true);
    const url=await uploadFile(user.uid,file,"profilePhotos");
    if(url) await saveProfile({...profile,photoUrl:url});
    setSaving(false);
  };

  const latestWeight=weightLog[0]?.weight;
  const goalWeight=profile.goalWeight?parseFloat(profile.goalWeight):null;
  const selectedGoals=goals.filter(g=>g.selected);
  const selectedPerf=perfGoals.filter(g=>g.exercise);

  return (
    <div style={{paddingTop:24,paddingBottom:40}}>
      {/* Profile header */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
        <div onClick={()=>setEditProfile(!editProfile)} style={{cursor:"pointer",position:"relative",flexShrink:0}}>
          {profile.photoUrl||user.photoURL?(
            <img src={profile.photoUrl||user.photoURL} alt="Profile" style={{width:64,height:64,borderRadius:"50%",border:`2px solid ${C.accent}`,objectFit:"cover"}} />
          ):(
            <div style={{width:64,height:64,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontFamily:F.display,color:"#000"}}>
              {(profile.name||user.displayName||"A")[0].toUpperCase()}
            </div>
          )}
          <div style={{position:"absolute",bottom:0,right:0,width:20,height:20,borderRadius:"50%",background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✏️</div>
        </div>
        <div style={{flex:1}} onClick={()=>setEditProfile(!editProfile)}>
          <div style={{fontSize:26,fontFamily:F.display,cursor:"pointer"}}>{profile.name||user.displayName?.toUpperCase()||"ATHLETE"}</div>
          <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted}}>{user.email}</div>
          {(profile.height||profile.age)&&(
            <div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:2}}>{profile.height?`${profile.height} · `:""}{profile.age?`${profile.age} yrs`:""}</div>
          )}
        </div>
      </div>

      {/* Profile editor */}
      {editProfile&&(
        <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:"16px",marginBottom:20}}>
          <div style={{fontSize:16,fontFamily:F.display,marginBottom:14}}>EDIT PROFILE</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {[{label:"NAME",field:"name",ph:"Your name",type:"text"},{label:"AGE",field:"age",ph:"Age",type:"number"},{label:"HEIGHT",field:"height",ph:"e.g. 6'2\"",type:"text"},{label:"GOAL WEIGHT (lbs)",field:"goalWeight",ph:"lbs",type:"number"}].map(({label:lbl,field,ph,type})=>(
              <div key={field}>
                <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:4}}>{lbl}</div>
                <input type={type} value={profile[field]||""} onChange={e=>saveProfile({...profile,[field]:e.target.value})} placeholder={ph}
                  style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:13,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" ref={profilePhotoRef} style={{display:"none"}} onChange={e=>handleProfilePhoto(e.target.files[0])} />
          <button onClick={()=>profilePhotoRef.current?.click()}
            style={{width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:13,marginBottom:10}}>
            📷 {saving?"UPLOADING...":"CHANGE PROFILE PHOTO"}
          </button>
          <button onClick={()=>setEditProfile(false)}
            style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:15,cursor:"pointer"}}>DONE</button>
        </div>
      )}

      {/* ── OVERVIEW: Weight + Check-in ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>WEIGHT</div>
          <div style={{fontSize:32,fontFamily:F.display,color:latestWeight?C.accent:C.textDim}}>{latestWeight||"–"}</div>
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted}}>lbs{goalWeight?` · Goal: ${goalWeight}`:""}</div>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>TODAY'S MOOD</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[{k:"energy",i:"⚡"},{k:"sleep",i:"😴"},{k:"soreness",i:"💪"},{k:"stress",i:"🧠"}].map(m=>(
              <div key={m.k} style={{textAlign:"center"}}>
                <div style={{fontSize:14}}>{m.i}</div>
                <div style={{fontSize:14,fontFamily:F.display,color:todayWB[m.k]?C.accent:C.textDim}}>{todayWB[m.k]||"–"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── GOALS ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:18,fontFamily:F.display}}>MY GOALS</div>
          <button onClick={()=>setGoalsOpen(!goalsOpen)}
            style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:11}}>
            {goalsOpen?"DONE":"CHANGE"}
          </button>
        </div>
        {!goalsOpen?(
          selectedGoals.length===0?(
            <div style={{fontSize:12,fontFamily:F.body,color:C.textDim}}>No goals selected — tap CHANGE to add goals</div>
          ):selectedGoals.map((g,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:i===0?"none":`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontFamily:F.body,color:C.text}}>{g.name}</div>
              {g.deadline&&<div style={{fontSize:11,fontFamily:F.body,color:C.accentBlue}}>{new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
            </div>
          ))
        ):(
          <div>
            {GOAL_OPTIONS.map(name=>{
              const g=goals.find(x=>x.name===name), sel=!!g?.selected;
              return (
                <div key={name}>
                  <div onClick={()=>toggleGoal(name)}
                    style={{background:sel?C.accent+"0A":C.surface,border:`1px solid ${sel?C.accent+"66":C.border}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:sel?0:6,transition:"all 0.15s"}}>
                    <div style={{fontSize:13,fontFamily:F.body,color:sel?C.accent:C.text}}>{name}</div>
                    <div style={{width:22,height:22,borderRadius:5,border:`2px solid ${sel?C.accent:C.border}`,background:sel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:13,flexShrink:0}}>{sel?"✓":""}</div>
                  </div>
                  {sel&&(
                    <div style={{padding:"6px 12px 8px",background:C.surface,borderRadius:"0 0 8px 8px",border:`1px solid ${C.accent}44`,borderTop:"none",marginBottom:6}}>
                      <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.15em",marginBottom:4}}>DEADLINE</div>
                      <input type="date" value={g?.deadline||""} onChange={e=>setGoalDeadline(name,e.target.value)}
                        style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PERFORMANCE GOALS ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:18,fontFamily:F.display}}>PERFORMANCE GOALS</div>
          <button onClick={()=>setPerfOpen(!perfOpen)}
            style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,cursor:"pointer",fontFamily:F.display,fontSize:11}}>
            {perfOpen?"DONE":"CHANGE"}
          </button>
        </div>
        {!perfOpen?(
          selectedPerf.length===0?(
            <div style={{fontSize:12,fontFamily:F.body,color:C.textDim}}>No performance goals — tap CHANGE to add goals</div>
          ):selectedPerf.map((g,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:i===0?"none":`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontFamily:F.display}}>{g.exercise}</div>
              <div style={{fontSize:14,fontFamily:F.display,color:C.accent}}>{g.goalWeight} lbs{g.deadline?` · ${new Date(g.deadline).toLocaleDateString("en-US",{month:"short",year:"numeric"})}`:""}</div>
            </div>
          ))
        ):(
          <div>
            {perfGoals.map(g=>(
              <div key={g.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px",marginBottom:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>EXERCISE</div>
                    <input value={g.exercise} onChange={e=>updPerfGoal(g.id,"exercise",e.target.value)} placeholder="e.g. Bench Press"
                      style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:13,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                  </div>
                  <div>
                    <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>GOAL (lbs)</div>
                    <input type="number" value={g.goalWeight} onChange={e=>updPerfGoal(g.id,"goalWeight",e.target.value)} placeholder="315"
                      style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:13,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:9,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:4}}>DEADLINE</div>
                  <input type="date" value={g.deadline} onChange={e=>updPerfGoal(g.id,"deadline",e.target.value)}
                    style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:13,fontFamily:F.body,outline:"none",boxSizing:"border-box"}} />
                </div>
                <button onClick={()=>rmPerfGoal(g.id)}
                  style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.accentRed}44`,background:"transparent",color:C.accentRed,cursor:"pointer",fontFamily:F.display,fontSize:11}}>REMOVE</button>
              </div>
            ))}
            <button onClick={addPerfGoal}
              style={{width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.text,fontFamily:F.display,fontSize:14,cursor:"pointer",borderStyle:"dashed"}}>
              + ADD GOAL
            </button>
          </div>
        )}
      </div>

      {/* ── WEIGHT TRACKER ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:12}}>
        <div style={{fontSize:18,fontFamily:F.display,marginBottom:12}}>DAILY WEIGH-IN</div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <input type="number" value={newWeight} onChange={e=>setNewWeight(e.target.value)} placeholder="Enter weight in lbs" step="0.1"
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontSize:16,fontFamily:F.display,outline:"none"}} />
          <button onClick={logWeight} disabled={saving||!newWeight}
            style={{padding:"10px 16px",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:F.display,fontSize:14,cursor:"pointer",opacity:!newWeight?0.4:1}}>
            LOG
          </button>
        </div>
        {/* 3-4 progress photos */}
        <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,fontWeight:700,letterSpacing:"0.12em",marginBottom:8}}>PROGRESS PHOTOS (optional)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[0,1,2,3].map(idx=>{
            const photoUrl=weightLog[0]?.photoUrls?.[idx];
            return (
              <div key={idx}>
                <input type="file" accept="image/*" ref={photoRefs[idx]} style={{display:"none"}} onChange={e=>handleProgressPhoto(e.target.files[0],idx)} />
                <div onClick={()=>photoRefs[idx].current?.click()}
                  style={{aspectRatio:"1",borderRadius:8,border:`1px dashed ${C.border}`,background:C.surface,cursor:"pointer",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {photoUrl?(
                    <img src={photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                  ):(
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:18}}>📷</div>
                      <div style={{fontSize:9,fontFamily:F.body,color:C.textDim,marginTop:2}}>{idx+1}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {saving&&<div style={{fontSize:11,fontFamily:F.body,color:C.textMuted,marginTop:8,textAlign:"center"}}>Uploading...</div>}
        <div style={{fontSize:10,fontFamily:F.body,color:C.textDim,marginTop:10,textAlign:"center"}}>Weight log & photos visible in Track → Weight and to your coach</div>
      </div>

      {/* ── DAILY CHECK-IN ── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:20}}>
        <div style={{fontSize:18,fontFamily:F.display,marginBottom:12}}>DAILY CHECK-IN</div>
        {[{key:"energy",label:"ENERGY",icon:"⚡"},{key:"sleep",label:"SLEEP",icon:"😴"},{key:"soreness",label:"SORENESS",icon:"💪"},{key:"stress",label:"STRESS",icon:"🧠"}].map(m=>(
          <div key={m.key} style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>{m.icon}</span>
              <div style={{fontSize:16,fontFamily:F.display}}>{m.label}</div>
              {todayWB[m.key]&&<span style={{marginLeft:"auto",fontSize:10,fontFamily:F.body,fontWeight:700,background:C.accent+"20",color:C.accent,padding:"2px 8px",borderRadius:20}}>{todayWB[m.key]}/5</span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>saveWB(m.key,n)}
                  style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${n<=(todayWB[m.key]||0)?C.accent:C.border}`,background:n<=(todayWB[m.key]||0)?C.accent+"22":"transparent",color:n<=(todayWB[m.key]||0)?C.accent:C.textMuted,fontSize:15,fontFamily:F.display,cursor:"pointer"}}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{fontSize:10,fontFamily:F.body,color:C.textDim,textAlign:"center",marginTop:4}}>Check-in data visible in Track → Check-In and to your coach</div>
      </div>

      <button onClick={onSignOut}
        style={{width:"100%",padding:"12px",borderRadius:8,border:`1px solid ${C.accentRed}44`,background:"transparent",color:C.accentRed,fontFamily:F.display,fontSize:15,cursor:"pointer"}}>
        SIGN OUT
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,          setUser]         = useState(null);
  const [authLoaded,    setAuthLoaded]   = useState(false);
  const [tab,           setTab]          = useState("today");
  const [activeWorkout, setActiveWorkout]= useState(null);
  const [workoutLogs,   setWorkoutLogs]  = useState(()=>ll(KEYS.LOGS,[]));
  const [program,       setProgram]      = useState(null);
  const [goals,         setGoals]        = useState(()=>ll(KEYS.GOALS,[]));
  const [perfGoals,     setPerfGoals]    = useState(()=>ll(KEYS.PERF_GOALS,[]));
  const [habits,        setHabits]       = useState(()=>ll(KEYS.HABITS,[]));
  const [habitDone,     setHabitDone]    = useState(()=>ll(KEYS.HABIT_DONE,{}));
  const [weightLog,     setWeightLog]    = useState(()=>ll(KEYS.WEIGHT_LOG,[]));

  // Unsub refs for real-time listeners
  const unsubRefs = useRef([]);
  const cleanupListeners = () => { unsubRefs.current.forEach(u=>{ try{u();}catch{} }); unsubRefs.current=[]; };

  useEffect(()=>{ const u=onAuthStateChanged(auth,usr=>{setUser(usr);setAuthLoaded(true);}); return u; },[]);

  useEffect(()=>{
    if(!user){ cleanupListeners(); return; }

    // ── 1. Workout logs — real-time listener ─────────────────────────────────
    const logsQ = query(collection(db,"workoutLogs"), where("userId","==",user.uid), orderBy("completedAt","desc"));
    const unsubLogs = onSnapshot(logsQ, snap=>{
      const logs = snap.docs.map(d=>({id:d.id,...d.data()}));
      // Merge with any locally-saved logs not yet in Firestore (e.g. offline)
      const local = ll(KEYS.LOGS,[]).filter(l=>!l.id||l.id.toString().length<20); // local-only entries have short IDs
      const merged = [...logs,...local];
      const deduped = [...new Map(merged.map(l=>[l.id||l.completedAt,l])).values()];
      deduped.sort((a,b)=>{
        const da=a.completedAt?.toDate?a.completedAt.toDate():new Date(a.completedAt||0);
        const db2=b.completedAt?.toDate?b.completedAt.toDate():new Date(b.completedAt||0);
        return db2-da;
      });
      setWorkoutLogs(deduped); ls(KEYS.LOGS,deduped);
    }, err=>console.warn("logs listener:",err));
    unsubRefs.current.push(unsubLogs);

    // ── 2. User doc — real-time listener (profile, goals, habits, wellbeing) ─
    const unsubUser = onSnapshot(doc(db,"users",user.uid), snap=>{
      if(!snap.exists()) return;
      const data = snap.data();
      if(data.profile)   { ls(KEYS.PROFILE,data.profile); }
      if(data.goals)     { setGoals(data.goals);     ls(KEYS.GOALS,data.goals); }
      if(data.perfGoals) { setPerfGoals(data.perfGoals); ls(KEYS.PERF_GOALS,data.perfGoals); }
      if(data.habits)    { setHabits(data.habits);   ls(KEYS.HABITS,data.habits); }
      if(data.habitDone) { setHabitDone(data.habitDone); ls(KEYS.HABIT_DONE,data.habitDone); }
      if(data.wellbeing) { ls(KEYS.WELLBEING,data.wellbeing); }
    }, err=>console.warn("user doc listener:",err));
    unsubRefs.current.push(unsubUser);

    // ── 3. Weight log — real-time listener ───────────────────────────────────
    const wlQ = query(collection(db,"weightLog"), where("userId","==",user.uid), orderBy("updatedAt","desc"));
    const unsubWeight = onSnapshot(wlQ, snap=>{
      const entries = snap.docs.map(d=>({id:d.id,...d.data()}));
      setWeightLog(entries); ls(KEYS.WEIGHT_LOG,entries);
    }, err=>console.warn("weight listener:",err));
    unsubRefs.current.push(unsubWeight);

    // ── 4. Client doc — real-time listener for assigned program ──────────────
    // Watches for coach assigning/changing program without needing app restart
    const watchClientDoc = async () => {
      try {
        let clientId = null;
        // Find client doc by userId
        let snap = await getDocs(query(collection(db,"clients"), where("userId","==",user.uid)));
        // Fallback: match by linkedEmail
        if(snap.empty && user.email){
          snap = await getDocs(query(collection(db,"clients"), where("linkedEmail","==",user.email)));
          if(!snap.empty){
            clientId = snap.docs[0].id;
            await updateDoc(doc(db,"clients",clientId),{userId:user.uid});
          }
        } else if(!snap.empty){
          clientId = snap.docs[0].id;
        }
        if(!clientId) return;

        // Real-time listener on this client's doc
        const unsubClient = onSnapshot(doc(db,"clients",clientId), async clientSnap=>{
          if(!clientSnap.exists()) return;
          const cd = clientSnap.data();
          if(cd.assignedProgramId){
            try {
              const ps = await getDoc(doc(db,"programs",cd.assignedProgramId));
              if(ps.exists()) setProgram({id:ps.id,...ps.data()});
            } catch(e){ console.warn("program fetch:",e); }
          } else {
            setProgram(null);
          }
        }, err=>console.warn("client doc listener:",err));
        unsubRefs.current.push(unsubClient);
      } catch(e){ console.warn("watchClientDoc:",e); }
    };
    watchClientDoc();

    return cleanupListeners;
  },[user]);

  // Pass weightLog down to TrackTab and MeTab via prop
  const handleComplete=(logs)=>{ setWorkoutLogs(logs); setActiveWorkout(null); setTab("track"); };
  const handleRefresh=async()=>{
    if(!user) return;
    // Force re-fetch (listeners will update automatically but this gives immediate feedback)
    const logs = await loadLogs(user.uid);
    if(logs.length>0){ setWorkoutLogs(logs); ls(KEYS.LOGS,logs); }
  };
  const handleSignOut=async()=>{ cleanupListeners(); await signOut(auth); setUser(null); setTab("today"); };

  if(!authLoaded) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:36,fontFamily:F.display,color:C.accent,letterSpacing:"0.1em"}}>LOADING...</div></div>;
  if(!user) return <LoginScreen />;
  if(activeWorkout) return <ActiveWorkout user={user} workout={activeWorkout} onComplete={handleComplete} onCancel={()=>setActiveWorkout(null)} />;

  const nav=[{id:"today",icon:"🏠",label:"Today"},{id:"program",icon:"📋",label:"Program"},{id:"habits",icon:"🔥",label:"Habits"},{id:"track",icon:"📊",label:"Track"},{id:"me",icon:"👤",label:"Me"}];

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
        textarea{font-family:${F.body};color:${C.text};background:${C.surface};}
      `}</style>

      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:28,letterSpacing:"0.08em",color:C.accent,lineHeight:1,fontFamily:F.display}}>FRAME<span style={{color:C.accentRed}}>WERKS</span></div>
          <div style={{fontSize:10,letterSpacing:"0.3em",color:C.textMuted,fontFamily:F.body,marginTop:2}}>FITNESS</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,boxShadow:`0 0 6px ${C.accent}`}} />
          <div style={{fontSize:10,fontFamily:F.body,color:C.textMuted,letterSpacing:"0.1em"}}>LIVE SYNC</div>
        </div>
      </div>

      <div style={{padding:"0 16px",paddingBottom:100}}>
        {tab==="today"   &&<TodayTab user={user} workoutLogs={workoutLogs} program={program} perfGoals={perfGoals} goals={goals} habits={habits} habitDone={habitDone} onStartWorkout={setActiveWorkout} />}
        {tab==="program" &&<ProgramTab program={program} onStartWorkout={setActiveWorkout} />}
        {tab==="habits"  &&<HabitsTab user={user} habits={habits} setHabits={setHabits} habitDone={habitDone} setHabitDone={setHabitDone} />}
        {tab==="track"   &&<TrackTab workoutLogs={workoutLogs} habits={habits} habitDone={habitDone} weightLog={weightLog} onRefresh={handleRefresh} user={user} />}
        {tab==="me"      &&<MeTab user={user} onSignOut={handleSignOut} onGoalsChange={setGoals} onPerfGoalsChange={setPerfGoals} weightLog={weightLog} setWeightLog={setWeightLog} />}
      </div>

      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"10px 0 20px",zIndex:100}}>
        {nav.map(item=>(
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
