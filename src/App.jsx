import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  doc,
  orderBy,
  Timestamp,
  setDoc
} from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDumer7KJOVMOf85aoEP1cam4kpLKs5kiQ",
  authDomain: "framewerks-dashboard.firebaseapp.com",
  projectId: "framewerks-dashboard",
  storageBucket: "framewerks-dashboard.firebasestorage.app",
  messagingSenderId: "878987259944",
  appId: "1:878987259944:web:38bc7c9e3e5e28d2877c9b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============= STORAGE UTILITIES =============
const STORAGE_KEYS = {
  WORKOUT_LOGS: 'framewerks_workout_logs',
  WEEK_SCHEDULE: 'framewerks_week_schedule',
  ACTIVE_HABITS: 'framewerks_active_habits',
  HABIT_COMPLETIONS: 'framewerks_habit_completions',
  WELLBEING_HISTORY: 'framewerks_wellbeing_history'
};

const saveToLocal = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const loadFromLocal = (key, defaultValue = null) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return defaultValue;
  }
};

// ============= SYNC UTILITIES =============
const syncWorkoutLogToFirebase = async (userId, logEntry) => {
  try {
    await addDoc(collection(db, 'workoutLogs'), {
      userId,
      ...logEntry,
      syncedAt: Timestamp.now()
    });
    console.log('✓ Workout log synced to Firebase');
  } catch (error) {
    console.error('Error syncing workout log:', error);
  }
};

const syncSetToFirebase = async (userId, workoutLogId, setData) => {
  try {
    // Store individual set completion
    await addDoc(collection(db, 'setSyncs'), {
      userId,
      workoutLogId,
      ...setData,
      syncedAt: Timestamp.now()
    });
    console.log('✓ Set synced to Firebase');
  } catch (error) {
    console.error('Error syncing set:', error);
  }
};

const loadAllWorkoutLogs = async (userId) => {
  try {
    const q = query(
      collection(db, 'workoutLogs'),
      where('userId', '==', userId),
      orderBy('completedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error loading workout logs:', error);
    return [];
  }
};

// ============= MAIN APP =============
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [assignedProgram, setAssignedProgram] = useState(null);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [weekSchedule, setWeekSchedule] = useState({});
  const [todayLesson, setTodayLesson] = useState(null);
  const [activeHabits, setActiveHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState({});
  const [wellbeingHistory, setWellbeingHistory] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load data when user is authenticated
  useEffect(() => {
    if (user && !dataLoaded) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    // Load from localStorage first (instant)
    const localLogs = loadFromLocal(STORAGE_KEYS.WORKOUT_LOGS, []);
    const localSchedule = loadFromLocal(STORAGE_KEYS.WEEK_SCHEDULE, {});
    const localHabits = loadFromLocal(STORAGE_KEYS.ACTIVE_HABITS, []);
    const localCompletions = loadFromLocal(STORAGE_KEYS.HABIT_COMPLETIONS, {});
    const localWellbeing = loadFromLocal(STORAGE_KEYS.WELLBEING_HISTORY, []);

    setWorkoutLogs(localLogs);
    setWeekSchedule(localSchedule);
    setActiveHabits(localHabits);
    setHabitCompletions(localCompletions);
    setWellbeingHistory(localWellbeing);

    // Then sync from Firebase (background update)
    try {
      // Load assigned program
      const programQuery = query(
        collection(db, 'clients'),
        where('email', '==', user.email)
      );
      const programSnapshot = await getDocs(programQuery);
      
      if (!programSnapshot.empty) {
        const clientData = programSnapshot.docs[0].data();
        if (clientData.assignedProgram) {
          setAssignedProgram(clientData.assignedProgram);
        }
        if (clientData.weekSchedule) {
          setWeekSchedule(clientData.weekSchedule);
          saveToLocal(STORAGE_KEYS.WEEK_SCHEDULE, clientData.weekSchedule);
        }
      }

      // Load ALL workout logs from Firebase
      const cloudLogs = await loadAllWorkoutLogs(user.uid);
      if (cloudLogs.length > 0) {
        setWorkoutLogs(cloudLogs);
        saveToLocal(STORAGE_KEYS.WORKOUT_LOGS, cloudLogs);
      }

      // Load lesson of the day
      const lessonQuery = query(
        collection(db, 'lessons'),
        orderBy('createdAt', 'desc')
      );
      const lessonSnapshot = await getDocs(lessonQuery);
      if (!lessonSnapshot.empty) {
        setTodayLesson(lessonSnapshot.docs[0].data());
      }

      // Load active habits
      const habitsQuery = query(
        collection(db, 'habits'),
        where('userId', '==', user.uid),
        where('active', '==', true)
      );
      const habitsSnapshot = await getDocs(habitsQuery);
      const habits = habitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveHabits(habits);
      saveToLocal(STORAGE_KEYS.ACTIVE_HABITS, habits);

      // Load habit completions
      const completionsQuery = query(
        collection(db, 'habitCompletions'),
        where('userId', '==', user.uid)
      );
      const completionsSnapshot = await getDocs(completionsQuery);
      const completions = {};
      completionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.habitId}_${data.date}`;
        completions[key] = true;
      });
      setHabitCompletions(completions);
      saveToLocal(STORAGE_KEYS.HABIT_COMPLETIONS, completions);

      // Load wellbeing history
      const wellbeingQuery = query(
        collection(db, 'wellbeingCheckins'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const wellbeingSnapshot = await getDocs(wellbeingQuery);
      const wellbeing = wellbeingSnapshot.docs.map(doc => doc.data());
      setWellbeingHistory(wellbeing);
      saveToLocal(STORAGE_KEYS.WELLBEING_HISTORY, wellbeing);

      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading user data:', error);
      setDataLoaded(true);
    }
  };

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAssignedProgram(null);
      setActiveWorkout(null);
      setWorkoutLogs([]);
      setDataLoaded(false);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0A0A0A',
        color: '#FFFFFF'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <h1 style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '48px',
          color: '#FF4D1C',
          marginBottom: '40px',
          letterSpacing: '2px'
        }}>
          FRAMEWERKS
        </h1>
        <button
          onClick={handleSignIn}
          style={{
            background: '#FF4D1C',
            color: '#FFFFFF',
            border: 'none',
            padding: '16px 32px',
            fontSize: '18px',
            fontFamily: '"Bebas Neue", sans-serif',
            letterSpacing: '1px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          SIGN IN WITH GOOGLE
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      color: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: '80px'
    }}>
      {/* Header */}
      <div style={{
        background: '#1A1A1A',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #2A2A2A'
      }}>
        <h1 style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '28px',
          color: '#FF4D1C',
          margin: 0,
          letterSpacing: '1.5px'
        }}>
          FRAMEWERKS
        </h1>
        <button
          onClick={handleSignOut}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #333',
            padding: '8px 16px',
            fontSize: '12px',
            fontFamily: '"Bebas Neue", sans-serif',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          SIGN OUT
        </button>
      </div>

      {/* Main Content */}
      <div style={{ padding: '20px' }}>
        {activeTab === 'today' && (
          <TodayTab
            assignedProgram={assignedProgram}
            weekSchedule={weekSchedule}
            setWeekSchedule={setWeekSchedule}
            setActiveWorkout={setActiveWorkout}
            setActiveTab={setActiveTab}
            todayLesson={todayLesson}
            user={user}
          />
        )}
        {activeTab === 'habits' && (
          <HabitsTab
            activeHabits={activeHabits}
            habitCompletions={habitCompletions}
            setHabitCompletions={setHabitCompletions}
            wellbeingHistory={wellbeingHistory}
            setWellbeingHistory={setWellbeingHistory}
            user={user}
          />
        )}
        {activeTab === 'program' && (
          <ProgramTab 
            program={assignedProgram}
            weekSchedule={weekSchedule}
            setWeekSchedule={setWeekSchedule}
            user={user}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab 
            workoutLogs={workoutLogs}
            user={user}
          />
        )}
        {activeTab === 'workout' && activeWorkout && (
          <WorkoutTab
            workout={activeWorkout}
            onComplete={(logEntry) => {
              const updatedLogs = [logEntry, ...workoutLogs];
              setWorkoutLogs(updatedLogs);
              saveToLocal(STORAGE_KEYS.WORKOUT_LOGS, updatedLogs);
              syncWorkoutLogToFirebase(user.uid, logEntry);
              setActiveWorkout(null);
              setActiveTab('today');
            }}
            onExit={() => {
              setActiveWorkout(null);
              setActiveTab('today');
            }}
            user={user}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {activeTab !== 'workout' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#1A1A1A',
          borderTop: '1px solid #2A2A2A',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '12px 0'
        }}>
          {[
            { id: 'today', label: 'TODAY', icon: '📅' },
            { id: 'habits', label: 'HABITS', icon: '✓' },
            { id: 'program', label: 'PROGRAM', icon: '📋' },
            { id: 'history', label: 'HISTORY', icon: '📊' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === tab.id ? '#FF4D1C' : '#888',
                fontSize: '11px',
                fontFamily: '"Bebas Neue", sans-serif',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                letterSpacing: '0.5px'
              }}
            >
              <span style={{ fontSize: '20px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= TODAY TAB =============
function TodayTab({ assignedProgram, weekSchedule, setWeekSchedule, setActiveWorkout, setActiveTab, todayLesson, user }) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayWorkout = weekSchedule[today];

  const handleSaveSchedule = async () => {
    if (!user) return;
    
    try {
      const clientQuery = query(
        collection(db, 'clients'),
        where('email', '==', user.email)
      );
      const snapshot = await getDocs(clientQuery);
      
      if (!snapshot.empty) {
        const clientDoc = snapshot.docs[0];
        await updateDoc(doc(db, 'clients', clientDoc.id), {
          weekSchedule
        });
        saveToLocal(STORAGE_KEYS.WEEK_SCHEDULE, weekSchedule);
        alert('Schedule saved!');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule');
    }
  };

  return (
    <div>
      <h2 style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '32px',
        color: '#FF4D1C',
        marginBottom: '20px',
        letterSpacing: '1px'
      }}>
        TODAY - {today.toUpperCase()}
      </h2>

      {/* Lesson of the Day */}
      {todayLesson && (
        <div style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid #FF4D1C'
        }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '14px',
            color: '#FF4D1C',
            marginBottom: '8px',
            letterSpacing: '1px'
          }}>
            COACH'S LESSON
          </div>
          <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
            {todayLesson.content}
          </div>
        </div>
      )}

      {/* Today's Workout */}
      {todayWorkout ? (
        <div style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '18px',
            color: '#FFFFFF',
            marginBottom: '12px',
            letterSpacing: '1px'
          }}>
            {todayWorkout.name}
          </div>
          <button
            onClick={() => {
              setActiveWorkout(todayWorkout);
              setActiveTab('workout');
            }}
            style={{
              width: '100%',
              background: '#FF4D1C',
              color: '#FFFFFF',
              border: 'none',
              padding: '16px',
              fontSize: '16px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              letterSpacing: '1px'
            }}
          >
            START WORKOUT
          </button>
        </div>
      ) : (
        <div style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '24px',
          textAlign: 'center',
          color: '#888'
        }}>
          No workout scheduled for today
        </div>
      )}

      {/* Weekly Calendar */}
      {assignedProgram && (
        <div style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h3 style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '20px',
            marginBottom: '16px',
            letterSpacing: '1px'
          }}>
            WEEKLY SCHEDULE
          </h3>
          
          {days.map(day => (
            <div key={day} style={{
              marginBottom: '12px',
              padding: '12px',
              background: day === today ? '#2A2A2A' : '#0A0A0A',
              borderRadius: '4px',
              border: day === today ? '1px solid #FF4D1C' : 'none'
            }}>
              <div style={{
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: '14px',
                color: day === today ? '#FF4D1C' : '#888',
                marginBottom: '8px',
                letterSpacing: '0.5px'
              }}>
                {day.toUpperCase()}
              </div>
              <select
                value={weekSchedule[day]?.id || ''}
                onChange={(e) => {
                  const selectedDay = assignedProgram.phases
                    .flatMap(p => p.days)
                    .find(d => d.id === e.target.value);
                  setWeekSchedule({
                    ...weekSchedule,
                    [day]: selectedDay || null
                  });
                }}
                style={{
                  width: '100%',
                  background: '#0A0A0A',
                  color: '#FFFFFF',
                  border: '1px solid #333',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Rest Day</option>
                {assignedProgram.phases.map(phase => (
                  <optgroup key={phase.name} label={phase.name}>
                    {phase.days.map(dayWorkout => (
                      <option key={dayWorkout.id} value={dayWorkout.id}>
                        {dayWorkout.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}

          <button
            onClick={handleSaveSchedule}
            style={{
              width: '100%',
              background: '#FF4D1C',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px',
              fontSize: '14px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              marginTop: '12px',
              letterSpacing: '1px'
            }}
          >
            SAVE SCHEDULE
          </button>
        </div>
      )}
    </div>
  );
}

// ============= HABITS TAB =============
function HabitsTab({ activeHabits, habitCompletions, setHabitCompletions, wellbeingHistory, setWellbeingHistory, user }) {
  const [showWellbeingCheckin, setShowWellbeingCheckin] = useState(false);
  const [wellbeingScores, setWellbeingScores] = useState({
    energy: 5,
    mood: 5,
    stress: 5,
    sleep: 5
  });

  const pillars = {
    nutrition: { icon: '🥗', label: 'NUTRITION' },
    mindfulness: { icon: '🧘', label: 'MINDFULNESS' },
    movement: { icon: '🏃', label: 'MOVEMENT' }
  };

  const today = new Date().toISOString().split('T')[0];

  const toggleHabit = async (habitId) => {
    const key = `${habitId}_${today}`;
    const newCompletions = {
      ...habitCompletions,
      [key]: !habitCompletions[key]
    };
    setHabitCompletions(newCompletions);
    saveToLocal(STORAGE_KEYS.HABIT_COMPLETIONS, newCompletions);

    // Sync to Firebase
    try {
      if (newCompletions[key]) {
        await addDoc(collection(db, 'habitCompletions'), {
          userId: user.uid,
          habitId,
          date: today,
          completedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error syncing habit:', error);
    }
  };

  const submitWellbeingCheckin = async () => {
    const checkin = {
      userId: user.uid,
      date: today,
      ...wellbeingScores,
      submittedAt: Timestamp.now()
    };

    const updatedHistory = [checkin, ...wellbeingHistory];
    setWellbeingHistory(updatedHistory);
    saveToLocal(STORAGE_KEYS.WELLBEING_HISTORY, updatedHistory);

    try {
      await addDoc(collection(db, 'wellbeingCheckins'), checkin);
    } catch (error) {
      console.error('Error saving wellbeing checkin:', error);
    }

    setShowWellbeingCheckin(false);
    setWellbeingScores({ energy: 5, mood: 5, stress: 5, sleep: 5 });
  };

  const todayCheckin = wellbeingHistory.find(h => h.date === today);

  return (
    <div>
      <h2 style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '32px',
        color: '#FF4D1C',
        marginBottom: '20px',
        letterSpacing: '1px'
      }}>
        HABITS
      </h2>

      {/* Wellbeing Check-in */}
      <div style={{
        background: '#1A1A1A',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <div style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '18px',
          marginBottom: '12px',
          letterSpacing: '1px'
        }}>
          DAILY CHECK-IN
        </div>
        
        {todayCheckin ? (
          <div style={{ color: '#888', fontSize: '14px' }}>
            ✓ Completed today
          </div>
        ) : (
          <button
            onClick={() => setShowWellbeingCheckin(true)}
            style={{
              width: '100%',
              background: '#FF4D1C',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px',
              fontSize: '14px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              letterSpacing: '1px'
            }}
          >
            START CHECK-IN
          </button>
        )}
      </div>

      {/* Wellbeing Checkin Modal */}
      {showWellbeingCheckin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#1A1A1A',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <h3 style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '24px',
              marginBottom: '24px',
              letterSpacing: '1px'
            }}>
              HOW ARE YOU FEELING?
            </h3>

            {Object.entries(wellbeingScores).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '24px' }}>
                <div style={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  fontSize: '14px',
                  marginBottom: '8px',
                  letterSpacing: '0.5px'
                }}>
                  {key.toUpperCase()}: {value}/10
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={value}
                  onChange={(e) => setWellbeingScores({
                    ...wellbeingScores,
                    [key]: parseInt(e.target.value)
                  })}
                  style={{
                    width: '100%',
                    accentColor: '#FF4D1C'
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={submitWellbeingCheckin}
                style={{
                  flex: 1,
                  background: '#FF4D1C',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '12px',
                  fontSize: '14px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  letterSpacing: '1px'
                }}
              >
                SUBMIT
              </button>
              <button
                onClick={() => setShowWellbeingCheckin(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  padding: '12px',
                  fontSize: '14px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  letterSpacing: '1px'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Habit Pillars */}
      {Object.entries(pillars).map(([pillarKey, pillar]) => {
        const pillarHabits = activeHabits.filter(h => h.pillar === pillarKey);
        if (pillarHabits.length === 0) return null;

        return (
          <div key={pillarKey} style={{
            background: '#1A1A1A',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '18px',
              marginBottom: '16px',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{pillar.icon}</span>
              {pillar.label}
            </div>

            {pillarHabits.map(habit => {
              const key = `${habit.id}_${today}`;
              const completed = habitCompletions[key];

              return (
                <div
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  style={{
                    padding: '16px',
                    background: completed ? '#2A2A2A' : '#0A0A0A',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: completed ? '1px solid #FF4D1C' : 'none'
                  }}
                >
                  <span>{habit.name}</span>
                  <span style={{ fontSize: '20px' }}>
                    {completed ? '✓' : '○'}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============= PROGRAM TAB =============
function ProgramTab({ program, weekSchedule, setWeekSchedule, user }) {
  const [expandedPhase, setExpandedPhase] = useState(null);

  if (!program) {
    return (
      <div>
        <h2 style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '32px',
          color: '#FF4D1C',
          marginBottom: '20px',
          letterSpacing: '1px'
        }}>
          PROGRAM
        </h2>
        <div style={{
          background: '#1A1A1A',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#888'
        }}>
          No program assigned yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '32px',
        color: '#FF4D1C',
        marginBottom: '8px',
        letterSpacing: '1px'
      }}>
        {program.name}
      </h2>
      {program.description && (
        <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
          {program.description}
        </p>
      )}

      {program.phases?.map((phase, phaseIdx) => (
        <div key={phaseIdx} style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div
            onClick={() => setExpandedPhase(expandedPhase === phaseIdx ? null : phaseIdx)}
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              letterSpacing: '1px'
            }}
          >
            <span>{phase.name}</span>
            <span>{expandedPhase === phaseIdx ? '−' : '+'}</span>
          </div>

          {expandedPhase === phaseIdx && (
            <div style={{ marginTop: '16px' }}>
              {phase.days?.map((day, dayIdx) => (
                <div key={dayIdx} style={{
                  background: '#0A0A0A',
                  padding: '16px',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: '16px',
                    marginBottom: '12px',
                    letterSpacing: '0.5px'
                  }}>
                    {day.name}
                  </div>

                  {/* Warmup */}
                  {day.warmup?.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                        WARMUP
                      </div>
                      {day.warmup.map((ex, i) => (
                        <div key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>
                          • {ex.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Main */}
                  {day.main?.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                        MAIN
                      </div>
                      {day.main.map((ex, i) => (
                        <div key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>
                          • {ex.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cooldown */}
                  {day.cooldown?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                        COOLDOWN
                      </div>
                      {day.cooldown.map((ex, i) => (
                        <div key={i} style={{ fontSize: '14px', marginBottom: '4px' }}>
                          • {ex.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============= HISTORY TAB =============
function HistoryTab({ workoutLogs, user }) {
  const [filter, setFilter] = useState('all'); // 'all', 'thisWeek', 'thisMonth'

  const getFilteredLogs = () => {
    const now = new Date();
    
    return workoutLogs.filter(log => {
      if (filter === 'all') return true;
      
      const logDate = log.completedAt?.toDate ? log.completedAt.toDate() : new Date(log.completedAt);
      
      if (filter === 'thisWeek') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return logDate >= weekAgo;
      }
      
      if (filter === 'thisMonth') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return logDate >= monthAgo;
      }
      
      return true;
    });
  };

  const filteredLogs = getFilteredLogs();

  return (
    <div>
      <h2 style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '32px',
        color: '#FF4D1C',
        marginBottom: '20px',
        letterSpacing: '1px'
      }}>
        WORKOUT HISTORY
      </h2>

      {/* Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px'
      }}>
        {[
          { id: 'all', label: 'ALL' },
          { id: 'thisWeek', label: 'THIS WEEK' },
          { id: 'thisMonth', label: 'THIS MONTH' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              flex: 1,
              background: filter === f.id ? '#FF4D1C' : 'transparent',
              color: filter === f.id ? '#FFFFFF' : '#888',
              border: filter === f.id ? 'none' : '1px solid #333',
              padding: '10px',
              fontSize: '12px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              letterSpacing: '0.5px'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Workout Logs */}
      {filteredLogs.length === 0 ? (
        <div style={{
          background: '#1A1A1A',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#888'
        }}>
          No workouts logged yet
        </div>
      ) : (
        filteredLogs.map((log, idx) => {
          const logDate = log.completedAt?.toDate ? log.completedAt.toDate() : new Date(log.completedAt);
          
          return (
            <div key={idx} style={{
              background: '#1A1A1A',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div>
                  <div style={{
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: '18px',
                    marginBottom: '4px',
                    letterSpacing: '0.5px'
                  }}>
                    {log.workoutName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {logDate.toLocaleDateString()} • {log.duration}
                  </div>
                </div>
                <div style={{
                  background: '#FF4D1C',
                  color: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  letterSpacing: '0.5px'
                }}>
                  {log.rating}/10
                </div>
              </div>

              {log.exercises && (
                <div style={{ fontSize: '14px', color: '#AAA' }}>
                  {log.exercises.map((ex, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>
                      • {ex.name} - {ex.sets?.length || 0} sets
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ============= WORKOUT TAB =============
function WorkoutTab({ workout, onComplete, onExit, user }) {
  const [activeSection, setActiveSection] = useState('warmup');
  const [exerciseData, setExerciseData] = useState({});
  const [startTime] = useState(new Date());
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(7);
  const [restTimer, setRestTimer] = useState(null);
  const [restRemaining, setRestRemaining] = useState(0);

  const sections = [
    { id: 'warmup', label: 'WARMUP', exercises: workout.warmup || [] },
    { id: 'main', label: 'MAIN', exercises: workout.main || [] },
    { id: 'cooldown', label: 'COOLDOWN', exercises: workout.cooldown || [] }
  ];

  const currentSection = sections.find(s => s.id === activeSection);

  const updateSet = async (exerciseId, setIndex, field, value) => {
    const key = `${exerciseId}_${setIndex}`;
    const updated = {
      ...exerciseData,
      [key]: {
        ...exerciseData[key],
        [field]: value
      }
    };
    setExerciseData(updated);

    // Sync to Firebase immediately
    await syncSetToFirebase(user.uid, `${workout.id}_${Date.now()}`, {
      exerciseId,
      setIndex,
      field,
      value,
      workoutName: workout.name,
      timestamp: Timestamp.now()
    });
  };

  const startRestTimer = (seconds) => {
    setRestRemaining(seconds);
    if (restTimer) clearInterval(restTimer);
    
    const timer = setInterval(() => {
      setRestRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setRestTimer(timer);
  };

  const completeWorkout = () => {
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const duration = `${minutes} min`;

    const allExercises = [
      ...(workout.warmup || []),
      ...(workout.main || []),
      ...(workout.cooldown || [])
    ].map(ex => ({
      name: ex.name,
      sets: Object.entries(exerciseData)
        .filter(([key]) => key.startsWith(ex.id))
        .map(([_, data]) => data)
    }));

    const logEntry = {
      workoutName: workout.name,
      workoutId: workout.id,
      completedAt: Timestamp.now(),
      duration,
      rating,
      exercises: allExercises
    };

    onComplete(logEntry);
  };

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '28px',
          color: '#FF4D1C',
          margin: 0,
          letterSpacing: '1px'
        }}>
          {workout.name}
        </h2>
        <button
          onClick={onExit}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #333',
            padding: '8px 16px',
            fontSize: '12px',
            fontFamily: '"Bebas Neue", sans-serif',
            cursor: 'pointer',
            borderRadius: '4px',
            letterSpacing: '0.5px'
          }}
        >
          EXIT
        </button>
      </div>

      {/* Rest Timer */}
      {restRemaining > 0 && (
        <div style={{
          background: '#FF4D1C',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '32px',
            letterSpacing: '1px'
          }}>
            REST: {restRemaining}s
          </div>
          <button
            onClick={() => {
              setRestRemaining(0);
              if (restTimer) clearInterval(restTimer);
            }}
            style={{
              background: '#FFFFFF',
              color: '#FF4D1C',
              border: 'none',
              padding: '8px 16px',
              fontSize: '12px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              marginTop: '8px',
              letterSpacing: '0.5px'
            }}
          >
            SKIP
          </button>
        </div>
      )}

      {/* Section Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px'
      }}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              flex: 1,
              background: activeSection === section.id ? '#FF4D1C' : 'transparent',
              color: activeSection === section.id ? '#FFFFFF' : '#888',
              border: activeSection === section.id ? 'none' : '1px solid #333',
              padding: '12px',
              fontSize: '12px',
              fontFamily: '"Bebas Neue", sans-serif',
              cursor: 'pointer',
              borderRadius: '4px',
              letterSpacing: '0.5px'
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Exercises */}
      {currentSection.exercises.map((exercise, exIdx) => (
        <div key={exIdx} style={{
          background: '#1A1A1A',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '18px',
            marginBottom: '12px',
            letterSpacing: '0.5px'
          }}>
            {exercise.name}
          </div>

          {exercise.sets && (
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
              {exercise.sets} sets × {exercise.reps} reps
              {exercise.weight && ` @ ${exercise.weight}`}
              {exercise.tempo && ` • Tempo: ${exercise.tempo}`}
              {exercise.rpe && ` • RPE: ${exercise.rpe}`}
            </div>
          )}

          {/* Set Inputs */}
          {exercise.sets && [...Array(parseInt(exercise.sets))].map((_, setIdx) => {
            const key = `${exercise.id}_${setIdx}`;
            const setData = exerciseData[key] || {};

            return (
              <div key={setIdx} style={{
                background: '#0A0A0A',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '8px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#888',
                  marginBottom: '8px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  letterSpacing: '0.5px'
                }}>
                  SET {setIdx + 1}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Reps"
                    value={setData.reps || ''}
                    onChange={(e) => updateSet(exercise.id, setIdx, 'reps', e.target.value)}
                    style={{
                      flex: 1,
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      border: '1px solid #333',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Weight"
                    value={setData.weight || ''}
                    onChange={(e) => updateSet(exercise.id, setIdx, 'weight', e.target.value)}
                    style={{
                      flex: 1,
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      border: '1px solid #333',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={() => startRestTimer(90)}
                    style={{
                      background: '#FF4D1C',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontFamily: '"Bebas Neue", sans-serif',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      letterSpacing: '0.5px'
                    }}
                  >
                    REST
                  </button>
                </div>
              </div>
            );
          })}

          {exercise.breathwork && (
            <BreathworkTimer duration={exercise.breathwork} />
          )}
        </div>
      ))}

      {/* Complete Workout Button */}
      <button
        onClick={() => setShowRating(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          left: '20px',
          right: '20px',
          background: '#FF4D1C',
          color: '#FFFFFF',
          border: 'none',
          padding: '16px',
          fontSize: '16px',
          fontFamily: '"Bebas Neue", sans-serif',
          cursor: 'pointer',
          borderRadius: '4px',
          letterSpacing: '1px'
        }}
      >
        COMPLETE WORKOUT
      </button>

      {/* Rating Modal */}
      {showRating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1A1A1A',
            padding: '32px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '24px',
              marginBottom: '24px',
              textAlign: 'center',
              letterSpacing: '1px'
            }}>
              RATE YOUR WORKOUT
            </h3>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '32px',
              flexWrap: 'wrap'
            }}>
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <button
                  key={num}
                  onClick={() => setRating(num)}
                  style={{
                    width: '50px',
                    height: '50px',
                    background: rating === num ? '#FF4D1C' : '#0A0A0A',
                    color: '#FFFFFF',
                    border: rating === num ? 'none' : '1px solid #333',
                    fontSize: '18px',
                    fontFamily: '"Bebas Neue", sans-serif',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={completeWorkout}
                style={{
                  flex: 1,
                  background: '#FF4D1C',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '14px',
                  fontSize: '14px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  letterSpacing: '1px'
                }}
              >
                SUBMIT
              </button>
              <button
                onClick={() => setShowRating(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  padding: '14px',
                  fontSize: '14px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  letterSpacing: '1px'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============= BREATHWORK TIMER =============
function BreathworkTimer({ duration }) {
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [phase, setPhase] = useState('inhale');
  const [phaseTime, setPhaseTime] = useState(0);
  const ballRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsActive(false);
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration]);

  useEffect(() => {
    if (!isActive) return;

    const cycleDuration = 9000; // 3s inhale + 6s exhale
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const cyclePosition = elapsed % cycleDuration;

      if (cyclePosition < 3000) {
        setPhase('inhale');
        setPhaseTime(cyclePosition / 3000);
      } else {
        setPhase('exhale');
        setPhaseTime((cyclePosition - 3000) / 6000);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  const ballSize = phase === 'inhale'
    ? 60 + (phaseTime * 80)
    : 140 - (phaseTime * 80);

  return (
    <div style={{
      background: '#0A0A0A',
      padding: '24px',
      borderRadius: '4px',
      marginTop: '12px'
    }}>
      <div style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '14px',
        color: '#888',
        marginBottom: '16px',
        letterSpacing: '0.5px'
      }}>
        BREATHWORK TIMER
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          width: '200px',
          height: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <div
            ref={ballRef}
            style={{
              width: `${ballSize}px`,
              height: `${ballSize}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, #FF6D3C, #FF4D1C)`,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              transition: 'none'
            }}
          />
        </div>

        {isActive && (
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '20px',
            color: '#FF4D1C',
            letterSpacing: '1px'
          }}>
            {phase.toUpperCase()} • {timeLeft}s
          </div>
        )}

        <button
          onClick={() => setIsActive(!isActive)}
          style={{
            background: isActive ? 'transparent' : '#FF4D1C',
            color: isActive ? '#888' : '#FFFFFF',
            border: isActive ? '1px solid #333' : 'none',
            padding: '12px 24px',
            fontSize: '14px',
            fontFamily: '"Bebas Neue", sans-serif',
            cursor: 'pointer',
            borderRadius: '4px',
            letterSpacing: '1px'
          }}
        >
          {isActive ? 'STOP' : 'START'}
        </button>
      </div>
    </div>
  );
}
