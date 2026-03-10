import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC6mtaBP6B4Jf7515VO9s1Z9dstYPY_5ew",
  authDomain: "framewerks-dashboard.firebaseapp.com",
  projectId: "framewerks-dashboard",
  storageBucket: "framewerks-dashboard.firebasestorage.app",
  messagingSenderId: "838679216503",
  appId: "1:838679216503:web:04eaca225681ee43e1e172",
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
  const q = query(
    collection(db, "workoutLogs"),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

// ─── Habits ─────────────────────────────────────────────────────
export async function saveHabitEntry(entry) {
  const id = `${entry.date}_${entry.userId}`;
  await setDoc(doc(db, "habits", id), { ...entry, id });
}

export async function loadHabitEntries(userId) {
  const q = query(
    collection(db, "habits"),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(60)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export { db, auth };
