import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDwCIb6OQ40TDNlNr1TjxO4kZVf2Ho62X8",
  authDomain: "framewerks-coach.firebaseapp.com",
  projectId: "framewerks-coach",
  storageBucket: "framewerks-coach.firebasestorage.app",
  messagingSenderId: "850336233136",
  appId: "1:850336233136:web:2bf59afb82672435c4ed75",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ─── Auth ───────────────────────────────────────────────────────
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  // Create/update user profile in Firestore
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoUrl: user.photoURL || "",
      assignedProgramId: null,
      createdAt: new Date().toISOString(),
    });
  }
  return user;
}

export async function logOut() {
  await signOut(auth);
}

// ─── User Profile ───────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// ─── Programs (read-only from client) ───────────────────────────
export async function loadProgram(programId) {
  const snap = await getDoc(doc(db, "programs", programId));
  return snap.exists() ? snap.data() : null;
}

export async function loadAllPrograms() {
  const snapshot = await getDocs(collection(db, "programs"));
  return snapshot.docs.map((d) => d.data());
}

// ─── Workout Logs ───────────────────────────────────────────────
export async function saveWorkoutLog(log) {
  await setDoc(doc(db, "workoutLogs", log.id), log);
}

export async function loadWorkoutLogs(userId) {
  try {
    // Try indexed query first
    const q = query(
      collection(db, "workoutLogs"),
      where("userId", "==", userId),
      orderBy("date", "desc"),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data());
  } catch (err) {
    console.warn("Indexed query failed, using fallback:", err.message);
    // Fallback: query without orderBy (doesn't need composite index)
    try {
      const q = query(
        collection(db, "workoutLogs"),
        where("userId", "==", userId),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((d) => d.data());
      return results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch (err2) {
      console.error("Workout log load failed:", err2);
      return [];
    }
  }
}

// ─── Habits ─────────────────────────────────────────────────────
export async function saveHabitEntry(entry) {
  const id = `${entry.date}_${entry.userId}`;
  await setDoc(doc(db, "habits", id), { ...entry, id });
}

export async function loadHabitEntries(userId) {
  try {
    const q = query(
      collection(db, "habits"),
      where("userId", "==", userId),
      orderBy("date", "desc"),
      limit(60)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data());
  } catch (err) {
    console.warn("Indexed habit query failed, using fallback:", err.message);
    try {
      const q = query(
        collection(db, "habits"),
        where("userId", "==", userId),
        limit(60)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((d) => d.data());
      return results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch (err2) {
      console.error("Habit load failed:", err2);
      return [];
    }
  }
}

export { db, auth };
