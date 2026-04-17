import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { DayPicker } from "@/components/DayPicker";
import { ClassCard } from "@/components/ClassCard";
import {
  SEMESTERS,
  SEMESTER_SECTIONS,
  SLOTS,
  DAYS,
  getTodayName,
  getClassesForStudent,
  getClassesForTeacher,
  getTeacherList,
  normalizeTeacherName,
  getInitials,
  cleanTeacherName,
  ClassEntry,
  routineData as staticRoutineData,
} from "@/data/routineData";
import { GraduationCap, User, ArrowLeftRight, BookOpen, Search, RefreshCcw, LayoutGrid, MapPin, Clock, Phone, SearchCheck, Menu, Info, Users, Code, Github, Facebook, Linkedin, MessageCircle, Lock, LogIn, LogOut, Bell, Settings, X, AlertTriangle, Moon, Sun, Quote } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { toast } from "@/components/ui/sonner";
import { motion, AnimatePresence } from "motion/react";
import { getGoogleSheetCsvUrlByGid, parseRoutineCsv, parseTeacherCsv } from "@/lib/parser";
import { Teacher } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, handleFirestoreError, OperationType } from "@/lib/firebase";
import { User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";

const DEFAULT_SHEET = "https://docs.google.com/spreadsheets/d/1Sdmr60rcZeBCa2ofswUr9mxIreIj71W9HYM1RRhvfMM/edit";
const INFO_GID = "989827005";

const SEMESTER_GIDS: Record<number, string> = {
  1: "0",
  2: "1739684797",
  3: "1812971555",
  4: "1642366900",
  5: "1698922910",
  6: "1687685897",
  7: "2130237812",
  8: "1780568258",
  9: "614628609",
};

type Role = "student" | "teacher" | null;

const QUOTES = [
  "And He has found you lost and guided [you]. - Surah Ad-Duha 93:7",
  "Allah does not burden a soul beyond that it can bear. - Surah Al-Baqarah 2:286",
  "So verily, with the hardship, there is relief. - Surah Al-Inshirah 94:5",
  "The best of you are those who learn the Quran and teach it. - Prophet Muhammad (SAW)",
  "Whoever follows a path in pursuit of knowledge, Allah will make easy for him a path to Paradise. - Prophet Muhammad (SAW)",
  "Indeed, Allah is with the patient. - Surah Al-Baqarah 2:153",
  "And rely upon Allah; and sufficient is Allah as Disposer of affairs. - Surah Al-Ahzab 33:3",
  "My success can only come from Allah. - Surah Hud 11:88"
];

const getFormattedDate = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function Index() {
  const { theme, setTheme } = useTheme();
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [role, setRole] = useState<Role>(() => {
    return (localStorage.getItem("routine-role") as Role) || null;
  });
  const [isChangingRole, setIsChangingRole] = useState(() => {
    return !localStorage.getItem("routine-role");
  });
  const [semester, setSemester] = useState(() => Number(localStorage.getItem("routine-semester")) || 1);
  const [section, setSection] = useState(() => localStorage.getItem("routine-section") || "A");
  const [selectedTeacher, setSelectedTeacher] = useState(() => localStorage.getItem("routine-teacher") || "");
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = getTodayName();
    return DAYS.includes(today as typeof DAYS[number]) ? today : "Sunday";
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [currentRoutine, setCurrentRoutine] = useState<ClassEntry[]>(() => {
    const cached = localStorage.getItem("cached-routine");
    return cached ? JSON.parse(cached) : staticRoutineData;
  });
  const [teacherInfo, setTeacherInfo] = useState<Teacher[]>(() => {
    const cached = localStorage.getItem("cached-teachers");
    return cached ? JSON.parse(cached) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  
  // Room Finder states
  const [isRoomFinderOpen, setIsRoomFinderOpen] = useState(false);
  const [roomFinderMode, setRoomFinderMode] = useState<"room" | "time">("room");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(1);

  // Detail Dialog states
  const [selectedEntry, setSelectedEntry] = useState<ClassEntry | null>(null);

  // App Menu states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(0);
  const [isTeacherDirOpen, setIsTeacherDirOpen] = useState(false);
  const [isDevInfoOpen, setIsDevInfoOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [dirSearchTerm, setDirSearchTerm] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Firebase / Admin states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<{ text: string, active: boolean, type: "normal" | "important" }>({ text: "", active: false, type: "normal" });
  const [adminSettings, setAdminSettings] = useState<{ 
    mainSheetUrl: string, 
    infoGid: string, 
    semesterGids?: Record<string, string>,
    githubUsername?: string,
    adminEmails?: string[]
  }>({ 
    mainSheetUrl: DEFAULT_SHEET, 
    infoGid: INFO_GID,
    semesterGids: SEMESTER_GIDS,
    githubUsername: "mafikul01",
    adminEmails: ["mafikulmovie@gmail.com"]
  });

  // Notice Dismissal state
  const [hasDismissedNotice, setHasDismissedNotice] = useState(false);

  // Admin form states
  const [newNoticeText, setNewNoticeText] = useState("");
  const [newNoticeType, setNewNoticeType] = useState<"normal" | "important">("normal");
  const [newMainSheetUrl, setNewMainSheetUrl] = useState("");
  const [newInfoGid, setNewInfoGid] = useState("");
  const [newGithubUsername, setNewGithubUsername] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  
  const [devName, setDevName] = useState("");
  const [devStudentId, setDevStudentId] = useState("");
  const [devFacebook, setDevFacebook] = useState("");
  const [devLinkedin, setDevLinkedin] = useState("");
  const [devWhatsapp, setDevWhatsapp] = useState("");
  
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const unsubNotice = onSnapshot(doc(db, "notices", "current"), (s) => {
      if (s.exists()) {
        const data = s.data() as { text: string; active: boolean; type?: "normal" | "important" };
        setNotice({
          text: data.text,
          active: data.active,
          type: data.type || "normal"
        });
        setNewNoticeText(data.text);
        setNewNoticeType(data.type || "normal");
      }
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (s) => {
      if (s.exists()) {
        const data = s.data() as { 
          mainSheetUrl: string; 
          infoGid: string; 
          githubUsername?: string; 
          adminEmails?: string[];
          devName?: string;
          devStudentId?: string;
          devFacebook?: string;
          devLinkedin?: string;
          devWhatsapp?: string;
        };
        setAdminSettings(prev => ({ ...prev, ...data }));
        setNewMainSheetUrl(data.mainSheetUrl);
        setNewInfoGid(data.infoGid);
        setNewGithubUsername(data.githubUsername || "mafikul01");
        setDevName(data.devName || "Mafikul Islam");
        setDevStudentId(data.devStudentId || "232311070");
        setDevFacebook(data.devFacebook || "mafikul01");
        setDevLinkedin(data.devLinkedin || "mafikul01");
        setDevWhatsapp(data.devWhatsapp || "01788302771");
      }
    });

    return () => {
      unsubAuth();
      unsubNotice();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (user && user.emailVerified) {
      const isRoot = user.email === "mafikulmovie@gmail.com";
      const isGlobal = (adminSettings.adminEmails || []).includes(user.email || "");
      setIsAdmin(isRoot || isGlobal);
    } else {
      setIsAdmin(false);
    }
  }, [user, adminSettings.adminEmails]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Logged In");
    } catch (e) {
      toast.error("Login Failed");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out");
    } catch (e) {
      toast.error("Logout failed");
    }
  };

  const updateNotice = async () => {
    try {
      await setDoc(doc(db, "notices", "current"), {
        text: newNoticeText,
        active: true,
        type: newNoticeType,
        createdAt: new Date()
      });
      toast.success("Notice Updated");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "notices/current");
    }
  };

  const toggleNotice = async () => {
    try {
      await updateDoc(doc(db, "notices", "current"), {
        active: !notice.active
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "notices/current");
    }
  };

  const updateSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "global"), {
        ...adminSettings,
        mainSheetUrl: newMainSheetUrl,
        infoGid: newInfoGid,
        githubUsername: newGithubUsername,
        devName,
        devStudentId,
        devFacebook,
        devLinkedin,
        devWhatsapp
      });
      toast.success("Settings Saved");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/global");
    }
  };

  const addAdminEmail = async () => {
    if (!newAdminEmail || !newAdminEmail.includes("@")) return;
    
    const rootAdmin = "mafikulmovie@gmail.com";
    if (newAdminEmail === rootAdmin) {
      setNewAdminEmail("");
      return; // Root admin is always there
    }

    const currentEmails = adminSettings.adminEmails || [rootAdmin];
    if (currentEmails.includes(newAdminEmail)) {
      toast.info("Already Admin");
      return;
    }

    const updatedEmails = [...currentEmails, newAdminEmail];
    
    try {
      await setDoc(doc(db, "settings", "global"), {
        ...adminSettings,
        adminEmails: updatedEmails
      });
      setNewAdminEmail("");
      toast.success("Admin Added");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/global");
    }
  };

  const removeAdminEmail = async (emailToRemove: string) => {
    const rootAdmin = "mafikulmovie@gmail.com";
    if (emailToRemove === rootAdmin) {
      toast.error("Root Admin Locked");
      return;
    }

    const currentEmails = adminSettings.adminEmails || [rootAdmin];
    const updatedEmails = currentEmails.filter(e => e !== emailToRemove);
    
    try {
      await setDoc(doc(db, "settings", "global"), {
        ...adminSettings,
        adminEmails: updatedEmails
      });
      toast.success("Admin Removed");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/global");
    }
  };

  useEffect(() => {
    // Reset dismissal state whenever the exact notice text changes
    // This allows the user to see the notice again if the admin updates it
    setHasDismissedNotice(false);
  }, [notice.text, notice.type]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const fetchDynamicRoutine = async () => {
    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      // 1. Fetch Teachers Info from dynamic settings
      try {
        const infoUrl = getGoogleSheetCsvUrlByGid(adminSettings.mainSheetUrl, adminSettings.infoGid);
        const infoResponse = await fetch(infoUrl);
        if (infoResponse.ok) {
          const infoCsv = await infoResponse.text();
          let teachers = parseTeacherCsv(infoCsv);
          
          // Custom injection/cleanup
          if (!teachers.some(t => t.name.includes("Faisal Aziz") || t.name.includes("Eco New teacher 3"))) {
            teachers.push({
              name: "Faisal Aziz",
              phone: "+8801717843998",
              initials: "FA",
              designation: "Lecturer",
              department: "ECO",
              email: "",
              officeRoom: ""
            });
          }
          
          // Clean names in teacher info and enrich Faisal Aziz data
          teachers = teachers.map(t => {
            const cleanedName = cleanTeacherName(t.name);
            if (cleanedName === "Faisal Aziz") {
              return {
                ...t,
                name: "Faisal Aziz",
                phone: t.phone || "+8801717843998",
                designation: (!t.designation || t.designation === "Faculty Member") ? "Lecturer" : t.designation,
                department: t.department || "ECO",
                initials: t.initials || "FA"
              };
            }
            return {
              ...t,
              name: cleanedName
            };
          });

          setTeacherInfo(teachers);
          localStorage.setItem("cached-teachers", JSON.stringify(teachers));
          successCount++;
        } else {
          console.warn(`Teacher info fetch failed: ${infoResponse.status}`);
          failCount++;
        }
      } catch (e) {
        console.error("Teacher sync error:", e);
        failCount++;
      }

      // 2. Fetch Routine from dynamic settings
      const relevantGids = adminSettings.semesterGids || SEMESTER_GIDS;
      const allSessions: ClassEntry[] = [];
      
      const sessionPromises = Object.entries(relevantGids).map(async ([sem, gid]) => {
        try {
          const csvUrl = getGoogleSheetCsvUrlByGid(adminSettings.mainSheetUrl, gid);
          const response = await fetch(csvUrl);
          if (!response.ok) {
            console.warn(`Routine fetch failed for Sem ${sem}: ${response.status}`);
            return [];
          }
          const csvText = await response.text();
          const sems = parseRoutineCsv(csvText, parseInt(sem, 10));
          if (sems.length > 0) successCount++;
          return sems;
        } catch (e) {
          console.error(`Error fetching Sem ${sem}:`, e);
          return [];
        }
      });

      const results = await Promise.all(sessionPromises);
      const flattened = results.flat();

      if (flattened.length > 0) {
        setCurrentRoutine(flattened);
        localStorage.setItem("cached-routine", JSON.stringify(flattened));
        setLastSynced(new Date().toLocaleTimeString());
        toast.success("Routine Updated Successfully");
      } else if (successCount > 0) {
        toast.success("Teacher Info Updated");
      } else {
        toast.error("Could not fetch new data. Using offline version.");
      }
    } catch (error) {
      console.error("Fatal Sync error:", error);
      toast.error("Sync failed. Check network connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDynamicRoutine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSettings.mainSheetUrl, adminSettings.infoGid]);

  const teachers = getTeacherList(currentRoutine);
  const availableSections = useMemo(() => SEMESTER_SECTIONS[semester] || ["A"], [semester]);

  // Reset section if not valid for current semester
  useEffect(() => {
    if (!availableSections.includes(section)) {
      setSection(availableSections[0]);
    }
  }, [semester, availableSections, section]);

  useEffect(() => {
    if (role) localStorage.setItem("routine-role", role);
    localStorage.setItem("routine-semester", String(semester));
    localStorage.setItem("routine-section", section);
    localStorage.setItem("routine-teacher", selectedTeacher);
  }, [role, semester, section, selectedTeacher]);

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setIsChangingRole(false);
    if (r === "teacher" && !selectedTeacher && teachers.length > 0) {
      setSelectedTeacher(teachers[0]);
    }
  };

  const allRooms = useMemo(() => Array.from(new Set(currentRoutine.map(e => e.room))).sort(), [currentRoutine]);

  const getClassesByRoom = useCallback((day: string, room: string) => {
    return currentRoutine
      .filter(e => e.day === day && e.room === room)
      .sort((a, b) => a.slot - b.slot);
  }, [currentRoutine]);

  const getClassesBySlot = useCallback((day: string, slot: number) => {
    return currentRoutine
      .filter(e => e.day === day && e.slot === slot)
      .sort((a, b) => a.room.localeCompare(b.room));
  }, [currentRoutine]);

  const currentFreeDays = useMemo(() => {
    return DAYS.filter(day => {
      const dayClasses = role === "student"
        ? getClassesForStudent(day, semester, section, currentRoutine)
        : getClassesForTeacher(day, selectedTeacher, currentRoutine);
      return dayClasses.length === 0;
    });
  }, [role, semester, section, selectedTeacher, currentRoutine]);

  const roomFreeDays = useMemo(() => {
    if (selectedRoom) {
      return DAYS.filter(day => getClassesByRoom(day, selectedRoom).length === 0);
    }
    return [];
  }, [selectedRoom, getClassesByRoom]);

  const classes =
    role === "student"
      ? getClassesForStudent(selectedDay, semester, section, currentRoutine)
      : getClassesForTeacher(selectedDay, selectedTeacher, currentRoutine);

  const filteredTeachers = teacherSearch
    ? teachers.filter(t => {
        const normT = normalizeTeacherName(t);
        const normS = normalizeTeacherName(teacherSearch);
        const initials = getInitials(t);
        return normT.includes(normS) || normS.includes(normT) || initials.toLowerCase().includes(normS.toLowerCase());
      })
    : teachers;

  if (isChangingRole || !role) {
    // Current role will be in 2nd position, other role in 1st.
    const isStudent = role === "student";
    
    const StudentBtn = () => (
      <button
        onClick={() => handleRoleSelect("student")}
        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md ${role === "student" ? "border-green-500 bg-green-50/10" : role ? "border-sky-400 bg-sky-50/10" : "bg-card hover:border-primary"}`}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${role === "student" ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"}`}>
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading font-semibold text-foreground">Student</p>
          <p className="text-xs text-muted-foreground">View your section's routine</p>
        </div>
      </button>
    );

    const TeacherBtn = () => (
      <button
        onClick={() => handleRoleSelect("teacher")}
        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md ${role === "teacher" ? "border-green-500 bg-green-50/10" : role ? "border-sky-400 bg-sky-50/10" : "bg-card hover:border-primary"}`}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${role === "teacher" ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"}`}>
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading font-semibold text-foreground">Teacher</p>
          <p className="text-xs text-muted-foreground">View your daily classes</p>
        </div>
      </button>
    );

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Vu Routine</h1>
            <p className="mt-1 text-sm text-muted-foreground">CSE Department</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {role ? "Change your role" : "I am a"}
            </p>
            {isStudent ? (
              <>
                <TeacherBtn />
                <StudentBtn />
              </>
            ) : (
              <>
                <StudentBtn />
                <TeacherBtn />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-20 relative">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-bold">
            {role === "student" ? "Vu Routine" : "My Classes"}
          </h1>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground font-medium">
              {role === "student"
                ? `${semester}${semester === 1 ? "st" : semester === 2 ? "nd" : semester === 3 ? "rd" : "th"} Semester • Section ${section}`
                : cleanTeacherName(selectedTeacher)}
            </p>
            <p className="text-[11px] text-muted-foreground/70 font-bold tracking-wide">
              {getFormattedDate()}
            </p>
          </div>
          {lastSynced && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              Synced at {lastSynced}
            </p>
          )}
        </div>
        <div className="flex gap-2 relative" ref={menuRef}>
          <button
            onClick={fetchDynamicRoutine}
            disabled={isSyncing}
            className={`flex items-center justify-center rounded-lg bg-secondary p-2 transition-all hover:bg-secondary/80 ${isSyncing ? "animate-spin opacity-50" : ""}`}
            title="Refresh from Google Sheet"
          >
            <RefreshCcw className="h-4 w-4 text-secondary-foreground" />
          </button>
          <button
            onClick={() => setIsChangingRole(true)}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-center rounded-lg bg-secondary p-2 transition-all hover:bg-secondary/80"
            title="Menu"
          >
            <Menu className="h-4 w-4 text-secondary-foreground" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border bg-card p-1 shadow-lg z-40 animate-fade-in">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsTeacherDirOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <Users className="h-4 w-4" />
                Teacher Directory
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsDevInfoOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <Info className="h-4 w-4" />
                Dev Info
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsAdminDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-600 font-semibold transition-colors hover:bg-blue-50"
                >
                  <Lock className="h-4 w-4" />
                  Admin Panel
                </button>
              )}
              <div className="border-t my-1"></div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <div className="border-t my-1"></div>
              {!user ? (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogin();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      <AnimatePresence>
        {notice.active && notice.text && (!hasDismissedNotice || notice.type === "important") && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ 
              opacity: 0, 
              x: swipeDirection > 0 ? 100 : swipeDirection < 0 ? -100 : 0,
              filter: "blur(10px)",
              transition: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDrag={(e, info) => {
              setSwipeDirection(info.offset.x);
            }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 50 && notice.type === "normal") {
                setHasDismissedNotice(true);
              } else {
                setSwipeDirection(0);
              }
            }}
            className="mb-5 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className={`flex items-start gap-3 rounded-xl p-4 border shadow-sm transition-colors ${notice.type === "important" ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50" : "bg-primary/10 border-primary/20 dark:bg-primary/5 dark:border-primary/20"}`}>
              {notice.type === "important" ? (
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              )}
              <div className="flex-1 overflow-hidden">
                <p className={`text-sm font-semibold leading-relaxed ${notice.type === "important" ? "text-red-900 dark:text-red-200" : "text-foreground"}`}>
                  {notice.text}
                </p>
                {notice.type === "normal" && (
                   <p className="mt-1 text-[10px] text-muted-foreground/70 font-medium">
                     Swipe left or right to dismiss
                   </p>
                )}
              </div>
              {notice.type === "normal" && (
                <button 
                  onClick={() => setHasDismissedNotice(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student: Semester picker */}
      {role === "student" && (
        <div className="mb-5 flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Semester</label>
            <div className="relative">
              <select
                value={semester}
                onChange={e => setSemester(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border bg-card py-2.5 pl-3 pr-8 text-sm outline-none focus:border-blue-500 font-medium"
              >
                {SEMESTERS.map(sem => (
                  <option key={sem} value={sem}>{sem}{sem === 1 ? 'st' : sem === 2 ? 'nd' : sem === 3 ? 'rd' : 'th'} Semester</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Section</label>
            <div className="relative">
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                className="w-full appearance-none rounded-lg border bg-card py-2.5 pl-3 pr-8 text-sm outline-none focus:border-blue-500 font-medium"
              >
                {availableSections.map(sec => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher: Search picker */}
      {role === "teacher" && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Teacher</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search teacher..."
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          {teacherSearch && (
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border bg-card">
              {filteredTeachers.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setSelectedTeacher(t);
                    setTeacherSearch("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                    selectedTeacher === t ? "bg-secondary font-medium" : ""
                  }`}
                >
                  {cleanTeacherName(t)}
                </button>
              ))}
              {filteredTeachers.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No match</p>
              )}
            </div>
          )}
          {!teacherSearch && selectedTeacher && (
            <p className="mt-1 text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{cleanTeacherName(selectedTeacher)}</span>
            </p>
          )}
        </div>
      )}

      {/* Day picker */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Day</label>
        <DayPicker selectedDay={selectedDay} onSelectDay={setSelectedDay} freeDays={currentFreeDays} />
      </div>

      {/* Classes list */}
      <div className="space-y-3">
        {classes.length > 0 ? (
          classes.map((entry, i) => (
            <div 
              key={`${entry.course}-${entry.slot}-${entry.section}-${i}`} 
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => setSelectedEntry(entry)}
              className="cursor-pointer transition-transform active:scale-[0.98]"
            >
              <ClassCard entry={entry} showSection={role !== "student"} />
            </div>
          ))
        ) : (
          <div className="relative mb-8 mt-5 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm">
            {/* Soft material-style graphic background */}
            <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-10">
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary blur-3xl" />
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-blue-500 blur-3xl" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-secondary/20 blur-2xl" />
            </div>
            
            <Quote className="mx-auto mb-4 h-8 w-8 text-primary/40" />
            <h3 className="mb-2 text-lg font-bold text-foreground">No Classes Today</h3>
            <p className="mx-auto mb-6 max-w-xs text-sm italic leading-relaxed text-muted-foreground">
              "{QUOTES[currentQuoteIndex]}"
            </p>
            <button 
              onClick={() => setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length)}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
            >
              <RefreshCcw className="h-3 w-3" />
              Show More Quotes
            </button>
          </div>
        )}
      </div>

      {/* Room Finder FAB & Dialog */}
      <Dialog open={isRoomFinderOpen} onOpenChange={setIsRoomFinderOpen}>
        <DialogTrigger asChild>
          <button className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95 z-50">
            <span className="material-symbols-outlined text-[28px]">search_insights</span>
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Room Finder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-1.5">
              <button
                onClick={() => setRoomFinderMode("room")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  roomFinderMode === "room"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Find by Room
              </button>
              <button
                onClick={() => setRoomFinderMode("time")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  roomFinderMode === "time"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Clock className="h-4 w-4" />
                Find by Time
              </button>
            </div>

            {/* Day picker for Room Finder */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Select Day</label>
              <DayPicker 
                selectedDay={selectedDay} 
                onSelectDay={setSelectedDay} 
                freeDays={roomFinderMode === "room" ? roomFreeDays : currentFreeDays} 
              />
            </div>

            {roomFinderMode === "room" && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">Select Room</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    className="w-full appearance-none rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Choose a room...</option>
                    {allRooms.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                {selectedRoom && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Classes in {selectedRoom} on {selectedDay}</p>
                    {getClassesByRoom(selectedDay, selectedRoom).length > 0 ? (
                      getClassesByRoom(selectedDay, selectedRoom).map((entry, i) => (
                        <div key={i} className="rounded-lg border p-3 flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {entry.startTime || SLOTS.find(s => s.slot === entry.slot)?.start} - {entry.endTime || SLOTS.find(s => s.slot === entry.slot)?.end}
                            </span>
                          </div>
                          <span className="font-medium text-sm">{entry.course} ({entry.section})</span>
                          <span className="text-xs text-muted-foreground">{entry.teachers.join(", ")}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-green-600 font-medium bg-green-50 p-3 rounded-lg border border-green-100 dark:bg-green-900/20 dark:border-green-900/30">
                        Room is free all day!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {roomFinderMode === "time" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">Select Time Slot</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={selectedSlot}
                    onChange={e => setSelectedSlot(Number(e.target.value))}
                    className="w-full appearance-none rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                  >
                    {SLOTS.map(s => (
                      <option key={s.slot} value={s.slot}>
                        {s.start} - {s.end}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSlot && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">
                      Availability at {SLOTS.find(s => s.slot === selectedSlot)?.start} - {SLOTS.find(s => s.slot === selectedSlot)?.end} on {selectedDay}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {allRooms.map(room => {
                        const classesInSlot = getClassesBySlot(selectedDay, selectedSlot);
                        const occupyingClass = classesInSlot.find(c => c.room === room);
                        const isFree = !occupyingClass;
                        return (
                          <div key={room} className={`p-3 rounded-lg border ${isFree ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900/30' : 'border-red-100 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/20'}`}>
                            <div className="font-bold text-sm mb-1">{room}</div>
                            {isFree ? (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-green-600 dark:text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" /> FREE
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-red-500 dark:text-red-400 mb-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" /> NOT AVAILABLE
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate" title={`${occupyingClass.course} (${occupyingClass.section})`}>
                                  {occupyingClass.course} ({occupyingClass.section})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">{selectedEntry?.course}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Class Time</p>
                <p className="text-sm font-semibold">
                  {selectedEntry?.startTime} - {selectedEntry?.endTime || SLOTS.find(s => s.slot === selectedEntry?.slot)?.end}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <MapPin className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Location</p>
                <p className="text-sm font-semibold">Room {selectedEntry?.room}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Teacher Info</p>
              {selectedEntry?.teachers.map((name, idx) => {
                const normName = normalizeTeacherName(cleanTeacherName(name));
                const info = teacherInfo.find(t => {
                  const normTName = normalizeTeacherName(t.name);
                  const normTInitials = normalizeTeacherName(t.initials || "");
                  return normTName.includes(normName) || normName.includes(normTName) || (normTInitials && normTInitials === normName);
                });
                return (
                  <div key={idx} className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{cleanTeacherName(info?.name || name)}</p>
                        <p className="text-xs text-muted-foreground">{info?.designation || "Faculty Member"}</p>
                      </div>
                    </div>
                    {info?.phone && (
                      <a 
                        href={`tel:${info.phone}`}
                        className="flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm text-primary transition-colors hover:bg-primary/10"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{info.phone}</span>
                        <span className="ml-auto text-xs opacity-60">Call now</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Directory Dialog */}
      <Dialog open={isTeacherDirOpen} onOpenChange={setIsTeacherDirOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Teacher Directory
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 border-b pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, initials, or designation..."
                value={dirSearchTerm}
                onChange={e => setDirSearchTerm(e.target.value)}
                className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
            {teacherInfo
              .filter(t => 
                t.name.toLowerCase().includes(dirSearchTerm.toLowerCase()) || 
                (t.initials && t.initials.toLowerCase().includes(dirSearchTerm.toLowerCase())) ||
                (t.designation && t.designation.toLowerCase().includes(dirSearchTerm.toLowerCase()))
              )
              .map((teacher, idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                      <span className="font-bold text-primary text-sm">{teacher.initials || <User className="h-5 w-5" />}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{cleanTeacherName(teacher.name)}</p>
                      <p className="text-xs text-muted-foreground truncate">{teacher.designation || "Faculty Member"}</p>
                    </div>
                  </div>
                  {teacher.phone && (
                    <a 
                      href={`tel:${teacher.phone}`}
                      className="flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm text-primary transition-colors hover:bg-primary/10"
                    >
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{teacher.phone}</span>
                      <span className="ml-auto text-xs opacity-60">Call</span>
                    </a>
                  )}
                </div>
              ))}
            {teacherInfo.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading teacher data...
              </div>
            )}
            {teacherInfo.length > 0 && dirSearchTerm && !teacherInfo.some(t => 
                t.name.toLowerCase().includes(dirSearchTerm.toLowerCase()) || 
                (t.initials && t.initials.toLowerCase().includes(dirSearchTerm.toLowerCase())) ||
                (t.designation && t.designation.toLowerCase().includes(dirSearchTerm.toLowerCase()))
              ) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No teachers found matching "{dirSearchTerm}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Developer Info Dialog */}
      <Dialog open={isDevInfoOpen} onOpenChange={setIsDevInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Code className="h-5 w-5 text-indigo-500" />
              Developer Info
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center py-4">
              <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xl relative overflow-hidden border-4 border-background">
                <img 
                  src={`https://github.com/${adminSettings.githubUsername || "mafikul01"}.png`} 
                  alt="Developer" 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-heading text-2xl font-bold">{adminSettings.devName || "Mafikul Islam"}</h3>
              <p className="text-sm font-medium text-primary">Student ID: {adminSettings.devStudentId || "232311070"}</p>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">6th Semester • Section B</p>
              <p className="text-xs text-muted-foreground pt-2">
                Developer & Maintainer of the CSE Class Routine App
              </p>
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <a 
                href={`https://wa.me/${adminSettings.devWhatsapp || "8801788302771"}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 transition-colors hover:bg-green-500 hover:text-white"
                title="WhatsApp"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a 
                href={`https://github.com/${adminSettings.githubUsername || "mafikul01"}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-foreground hover:text-background"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href={`https://facebook.com/${adminSettings.devFacebook || "mafikul01"}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
                title="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href={`https://linkedin.com/in/${adminSettings.devLinkedin || "mafikul01"}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700/10 text-blue-700 transition-colors hover:bg-blue-700 hover:text-white"
                title="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
            
            <div className="mt-6 rounded-xl border bg-secondary/30 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">App Features</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Lightning Fast Google Sheets Sync
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Dynamic Real-time Room Finder
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Smart Teacher Directory Integration
                </li>
              </ul>
            </div>
            <p className="pt-4 text-center text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-30">
              Version 1.0
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Panel Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Admin Dashboard
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Notice Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <Bell className="h-4 w-4" />
                  Active Notice
                </h4>
                <button 
                  onClick={toggleNotice}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition-colors ${notice.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                >
                  {notice.active ? 'Visible' : 'Hidden'}
                </button>
              </div>
              <div className="flex bg-secondary p-1 rounded-lg">
                <button
                  onClick={() => setNewNoticeType("normal")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newNoticeType === "normal" ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setNewNoticeType("important")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newNoticeType === "important" ? 'bg-red-500 shadow text-white' : 'text-muted-foreground hover:bg-background/50'}`}
                >
                  Important
                </button>
              </div>
              <textarea
                value={newNoticeText}
                onChange={(e) => setNewNoticeText(e.target.value)}
                placeholder="Enter notice text here..."
                className="w-full h-24 rounded-lg border bg-card p-3 text-sm outline-none focus:border-primary resize-none"
              />
              <button
                onClick={updateNotice}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Update Notice & Push Live
              </button>
            </div>

            <div className="h-px bg-border"></div>

            {/* Config Management */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Settings className="h-4 w-4" />
                App Configuration
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Google Sheet Base URL</label>
                  <input
                    type="text"
                    value={newMainSheetUrl}
                    onChange={(e) => setNewMainSheetUrl(e.target.value)}
                    className="w-full rounded-lg border bg-card p-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Teachers Info GID</label>
                  <input
                    type="text"
                    value={newInfoGid}
                    onChange={(e) => setNewInfoGid(e.target.value)}
                    className="w-full rounded-lg border bg-card p-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                
                <h5 className="text-xs font-bold uppercase text-muted-foreground pt-2 border-t">Developer Section Info</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Dev Name</label>
                    <input
                      type="text"
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Student ID</label>
                    <input
                      type="text"
                      value={devStudentId}
                      onChange={(e) => setDevStudentId(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">GitHub</label>
                    <input
                      type="text"
                      value={newGithubUsername}
                      onChange={(e) => setNewGithubUsername(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">LinkedIn</label>
                    <input
                      type="text"
                      value={devLinkedin}
                      onChange={(e) => setDevLinkedin(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Facebook</label>
                    <input
                      type="text"
                      value={devFacebook}
                      onChange={(e) => setDevFacebook(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">WhatsApp No.</label>
                    <input
                      type="text"
                      value={devWhatsapp}
                      onChange={(e) => setDevWhatsapp(e.target.value)}
                      className="w-full rounded-lg border bg-card p-2 text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={updateSettings}
                  className="w-full rounded-lg bg-secondary py-2.5 text-sm font-bold text-secondary-foreground shadow-sm transition-all hover:bg-secondary/80 active:scale-[0.98]"
                >
                  Save Configuration
                </button>
              </div>
            </div>

            <div className="h-px bg-border"></div>

            {/* Admin Management */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4" />
                Admin Management
              </h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to add admin..."
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1 rounded-lg border bg-card p-2.5 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={addAdminEmail}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  >
                    Add
                  </button>
                </div>
                
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Current Admins:</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between rounded bg-secondary/50 p-2 text-sm">
                      <span className="font-medium">mafikulmovie@gmail.com</span>
                      <span className="text-[10px] font-bold uppercase text-primary">Root</span>
                    </div>
                    {adminSettings.adminEmails?.map((email) => {
                      if (email === "mafikulmovie@gmail.com") return null;
                      return (
                        <div key={email} className="flex items-center justify-between rounded bg-secondary/50 p-2 text-sm">
                          <span className="truncate pr-2">{email}</span>
                          <button 
                            onClick={() => removeAdminEmail(email)}
                            className="text-red-500 hover:text-red-700 p-1 transition-colors"
                            title="Remove Admin"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-orange-50 p-4 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30">
              <p className="text-xs text-orange-800 dark:text-orange-300">
                <strong>Pro Tip:</strong> All changes made here are applied in real-time to all users without needing a code redeploy.
              </p>
            </div>
            
            <p className="pt-2 text-center text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-30">
              Version 1.0
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
