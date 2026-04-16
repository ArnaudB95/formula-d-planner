"use client";

import { useEffect, useState } from "react";
import { getAuth, getFirestore } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar, Vote, Users, MessageCircle, Settings } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const [tab, setTab] = useState("events");

  const [selectedDate, setSelectedDate] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const [userRole, setUserRole] = useState<string>("member");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editPseudo, setEditPseudo] = useState("");
  const [editTeam, setEditTeam] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>({
    pseudo: "",
    team: "",
    avatar: "",
  });

  const router = useRouter();

  // 🔐 AUTH
  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;

    const firestore = getFirestore();
    if (!firestore) return;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/");

      setUser(u);

      const isSuperAdmin =
        u.email === "beaudouin.arnaud@gmail.com" ||
        u.displayName === "Arnaud";

      await setDoc(
        doc(firestore, "members", u.email!),
        {
          email: u.email,
          role: isSuperAdmin ? "superAdmin" : "member",
        },
        { merge: true }
      );
    });

    return () => unsub();
  }, [router]);

  //  EVENTS
  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    const q = query(collection(firestore, "events"), orderBy("date", "asc"));

    return onSnapshot(q, (snapshot) => {
      setEvents(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });
  }, []);

  // 👥 MEMBERS
  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    return onSnapshot(collection(firestore, "members"), (snapshot) => {
      const membersData = snapshot.docs.map((d) => ({
        email: d.id,
        ...d.data(),
      }));
      setMembers(membersData);

      // Set user role
      if (user) {
        const currentMember = snapshot.docs.find(d => d.id === user.email);
        if (currentMember) {
          setUserRole(currentMember.data().role || "member");
          setProfile({
            pseudo: currentMember.data().pseudo || "",
            team: currentMember.data().team || "",
            avatar: currentMember.data().avatar || "",
          });
          setEditPseudo(currentMember.data().pseudo || "");
          setEditTeam(currentMember.data().team || "");
          setEditAvatar(currentMember.data().avatar || "");
        }
      }
    });
  }, [user]);

  // 🗳️ VOTES LIVE
  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    return onSnapshot(collection(firestore, "votes"), (snapshot) => {
      const data: any = {};

      snapshot.forEach((docSnap) => {
        const v = docSnap.data();

        if (!data[v.eventId]) data[v.eventId] = {};
        data[v.eventId][v.userEmail] = v.status;
      });

      setVotes(data);
    });
  }, []);

  // 💬 CHAT
  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    const q = query(collection(firestore, "chat"), orderBy("createdAt", "asc"));

    return onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map((d) => d.data()));
    });
  }, []);

  const logout = async () => {
    const auth = getAuth();
    if (!auth) return;
    await signOut(auth);
    router.push("/");
  };

  // 📅 FORMAT DATE
  const formatDateFR = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // ➕ CREATE PROPOSITION
  const createEvent = async () => {
    if (!selectedDate || !user) return;

    const today = new Date().toISOString().split('T')[0];
    if (selectedDate < today) return;

    const firestore = getFirestore();
    if (!firestore) return;

    await addDoc(collection(firestore, "events"), {
      date: selectedDate,
      title: formatDateFR(selectedDate),
      createdAt: serverTimestamp(),
      createdBy: user.email,
      status: "pending",
    });

    setSelectedDate("");
  };

  // 🗳️ VOTE (modifiable)
  const vote = async (eventId: string, status: string) => {
    if (!user) return;

    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "votes", `${eventId}_${user.email}`), {
      eventId,
      userEmail: user.email,
      status,
      updatedAt: serverTimestamp(),
    });
  };

  // ✅ VALIDATION EVENT
  const validateEvent = async (eventId: string) => {
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "events", eventId),
      { status: "validated" },
      { merge: true }
    );
  };

  // ❌ DELETE EVENT
  const deleteEvent = async (eventId: string) => {
    if (!userRole || (userRole !== "admin" && userRole !== "superAdmin")) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await deleteDoc(doc(firestore, "events", eventId));
  };

  // 🔧 PROMOTE / DEMOTE MEMBER
  const updateMemberRole = async (memberEmail: string, role: string) => {
    if (userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "members", memberEmail), { role }, { merge: true });
  };

  // 💾 SAVE PROFILE
  const saveProfile = async () => {
    const resetSaving = (message?: string) => {
      setIsSavingProfile(false);
      setProfileSaveMessage(message || null);
    };

    console.log("saveProfile clicked");
    setProfileSaveMessage("Enregistrement en cours...");
    setIsSavingProfile(true);

    if (!user) {
      resetSaving("Utilisateur non connecté.");
      alert("Utilisateur non connecté.");
      return;
    }

    const firestore = getFirestore();
    let avatarUrl = avatarUrlInput || editAvatar;

    console.log("saveProfile start", {
      userEmail: user.email,
      editPseudo,
      editTeam,
      editAvatar,
      avatarUrlInput,
      firestoreInitialized: !!firestore,
    });

    if (!firestore) {
      resetSaving("Impossible de sauvegarder le profil. Firestore n'est pas initialisé.");
      alert("Impossible de sauvegarder le profil. Firestore n'est pas initialisé.");
      return;
    }

    try {
      console.log("Saving profile to Firestore...", {
        pseudo: editPseudo || null,
        team: editTeam || null,
        avatar: avatarUrl || null,
      });

      await setDoc(
        doc(firestore, "members", user.email!),
        {
          pseudo: editPseudo || null,
          team: editTeam || null,
          avatar: avatarUrl || null,
        },
        { merge: true }
      );

      console.log("Profile saved successfully");
      resetSaving("Profil enregistré avec succès.");
      setAvatarUrlInput("");
      setIsMenuOpen(false);
      alert("Profil enregistré avec succès.");
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde du profil :", error);
      const message = `Impossible de sauvegarder le profil : ${error.code || error.message || error}`;
      resetSaving(message);
      alert(message);
    }
  };

  // 💬 CHAT
  const sendChat = async () => {
    if (!chatInput || !user) return;

    const firestore = getFirestore();
    if (!firestore) return;

    await addDoc(collection(firestore, "chat"), {
      text: chatInput,
      user: user.email,
      createdAt: serverTimestamp(),
    });

    setChatInput("");
  };

  const getPseudo = (email: string) =>
    members.find((m) => m.email === email)?.pseudo || email;

  if (!user) return null;

  const pendingEvents = events.filter((e) => e.status === "pending");

  const upcomingEvents = events.filter(
    (e) => e.status === "validated" && new Date(e.date) >= new Date()
  );

  const nextEventDays = upcomingEvents.length > 0 ? Math.ceil((new Date(upcomingEvents[0].date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(dateStr);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const getColor = (eventVotes: any, email: string) => {
    if (eventVotes[email] === "present") return "text-[#409b48]";
    if (eventVotes[email] === "absent") return "text-[#d31f28]";
    return "text-gray-400";
  };

  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-black tracking-[-0.04em] leading-tight">
              PLANIFIEZ VOS <br />
              <span className="text-[#d31f28]">PARTIES DE FORMULA D</span>
            </h1>
            <p className="mt-4 max-w-2xl text-gray-400 text-lg leading-8">
              Sondages, chat et gestion d’équipe pour vos sessions Formula D.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-12 h-12 bg-[#d31f28] rounded-full flex items-center justify-center hover:bg-[#b81d23] transition overflow-hidden"
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                )}
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#001122] border border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-[#d31f28] rounded-full flex items-center justify-center overflow-hidden">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{user?.displayName || "Utilisateur"}</p>
                        <p className="text-sm text-gray-400">{user?.email}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Pseudo</label>
                        <input
                          type="text"
                          value={editPseudo}
                          onChange={(e) => setEditPseudo(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400"
                          placeholder="Votre pseudo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Équipe</label>
                        <input
                          type="text"
                          value={editTeam}
                          onChange={(e) => setEditTeam(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400"
                          placeholder="Votre équipe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">URL de l'avatar</label>
                        <input
                          type="url"
                          value={avatarUrlInput}
                          onChange={(e) => setAvatarUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400"
                        />
                        {avatarUrlInput && (
                          <div className="mt-2">
                            <img
                              src={avatarUrlInput}
                              alt="Aperçu URL"
                              className="w-16 h-16 rounded-full object-cover border border-white/20"
                            />
                          </div>
                        )}
                        <p className="mt-2 text-xs text-gray-400">Entrez une URL d'image publique pour votre avatar.</p>
                      </div>
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={isSavingProfile}
                        className="w-full bg-[#d31f28] disabled:bg-[#7a1b20] hover:bg-[#b81d23] text-white px-4 py-2 rounded-md transition"
                      >
                        {isSavingProfile ? "Enregistrement..." : "Sauvegarder"}
                      </button>
                      {profileSaveMessage && (
                        <p className="mt-2 text-sm text-gray-300">{profileSaveMessage}</p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <button
                        onClick={logout}
                        className="w-full text-left text-red-400 hover:text-red-300 transition"
                      >
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => setTab("events")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "events" ? "ring-1 ring-[#d31f28]/60" : ""}`}
          >
            <p className="text-[#d31f28] text-2xl mb-4">📊</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Prochaines Parties</p>
            <p className="text-white text-lg font-semibold">{upcomingEvents.length} validés</p>
          </button>

          <button
            onClick={() => setTab("proposition")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "proposition" ? "ring-1 ring-[#d31f28]/60" : ""}`}
          >
            <p className="text-[#d31f28] text-2xl mb-4">🗳️</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Propositions</p>
            <p className="text-white text-lg font-semibold">{pendingEvents.length} en attente</p>
          </button>

          <button
            onClick={() => setTab("members")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "members" ? "ring-1 ring-[#d31f28]/60" : ""}`}
          >
            <p className="text-[#d31f28] text-2xl mb-4">👥</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Équipes</p>
            <p className="text-white text-lg font-semibold">{members.length} membres</p>
          </button>

          <button
            onClick={() => setTab("chat")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "chat" ? "ring-1 ring-[#d31f28]/60" : ""}`}
          >
            <p className="text-[#d31f28] text-2xl mb-4">💬</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Chat</p>
            <p className="text-white text-lg font-semibold">{chatMessages.length} messages</p>
          </button>
        </div>

        <div className="mt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10 mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-gray-400">Prochaine partie <span className="text-[#d31f28]">dans {nextEventDays} jours</span></p>
              </div>
            </div>

            {tab === "events" && (
              <div className="space-y-5">
                {upcomingEvents.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-gray-300">
                    Aucun événement validé pour le moment.
                  </div>
                ) : (
                  upcomingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => eventVotes[m.email] === "present");
                    const absent = members.filter((m) => eventVotes[m.email] === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);

                    return (
                      <div key={event.id} className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-400 uppercase tracking-[0.24em]">Prochaine session</p>
                            <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="rounded-2xl bg-[#409b48] px-4 py-2 text-sm font-semibold text-white hover:bg-[#409b48]"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="rounded-2xl bg-[#d31f28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d31f28]"
                            >
                              Absent
                            </button>
                            {(userRole === "admin" || userRole === "superAdmin") && (
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-[#409b48] font-semibold">Présents {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">{present.map(m => getPseudo(m.email)).join(', ')}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Attente</p>
                            <p className="mt-2 text-lg font-semibold text-gray-200">{waiting.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-[#d31f28] font-semibold">Absents {absent.length}</p>
                            <p className="mt-2 text-sm text-[#d31f28]">{absent.map(m => getPseudo(m.email)).join(', ')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "proposition" && (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
                  <p className="text-sm uppercase tracking-[0.28em] text-gray-400 mb-4">Nouvelle proposition</p>
                  
                  <div className="rounded-3xl bg-white/5 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={handlePrevMonth}
                        className="rounded px-3 py-2 text-white hover:bg-white/10"
                      >
                        ←
                      </button>
                      <h3 className="text-lg font-semibold text-white">{monthNames[currentMonth]} {currentYear}</h3>
                      <button
                        onClick={handleNextMonth}
                        className="px-3 py-2 text-white hover:bg-white/10 rounded"
                      >
                        →
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {dayNames.map((day) => (
                        <div key={day} className="text-center text-xs text-gray-400 font-semibold py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isSelected = selectedDate === dateStr;
                        const today = new Date().toISOString().split('T')[0];
                        const isToday = dateStr === today;
                        const isPast = dateStr < today;
                        return (
                          <button
                            key={day}
                            onClick={() => !isPast && handleDateClick(day)}
                            disabled={isPast}
                            className={`py-2 rounded-lg font-semibold transition ${
                              isSelected
                                ? "bg-[#d31f28] text-white"
                                : isToday
                                ? "bg-gray-600 text-white"
                                : isPast
                                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                : "bg-white/5 text-white hover:bg-white/10"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDate && (
                    <p className="mt-4 text-center text-[#409b48] font-semibold">
                      Date sélectionnée : {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  )}

                  <button
                    onClick={createEvent}
                    className="mt-4 w-full rounded-3xl bg-[#d31f28] px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#d31f28]"
                  >
                    ➕ Créer proposition
                  </button>
                </div>

                {pendingEvents.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-gray-300">
                    Aucune proposition en attente.
                  </div>
                ) : (
                  pendingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => eventVotes[m.email] === "present");
                    const absent = members.filter((m) => eventVotes[m.email] === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);

                    return (
                      <div key={event.id} className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-400 uppercase tracking-[0.24em]">Proposition</p>
                            <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="rounded-2xl bg-[#409b48] px-4 py-2 text-sm font-semibold text-white hover:bg-[#409b48]"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="rounded-2xl bg-[#d31f28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d31f28]"
                            >
                              Absent
                            </button>
                            <button
                              onClick={() => validateEvent(event.id)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                            >
                              Valider
                            </button>
                            {(userRole === "admin" || userRole === "superAdmin") && (
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-[#409b48] font-semibold">Présents {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">{present.map(m => getPseudo(m.email)).join(', ')}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Attente</p>
                            <p className="mt-2 text-lg font-semibold text-gray-200">{waiting.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-[#d31f28] font-semibold">Absents {absent.length}</p>
                            <p className="mt-2 text-sm text-[#d31f28]">{absent.map(m => getPseudo(m.email)).join(', ')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "members" && (
              <div className="space-y-4">
                {members.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-gray-300">
                    Aucun membre trouvé.
                  </div>
                ) : (
                  members.map((m) => (
                    <div key={m.email} className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-white">{m.pseudo || m.email}</p>
                          <p className="mt-1 text-gray-400">{m.team || "Sans écurie"}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-gray-400">Role : {m.role || "member"}</p>
                        </div>
                        {userRole === "superAdmin" && m.email !== user?.email && (
                          <div className="flex gap-2 flex-wrap">
                            {m.role === "admin" ? (
                              <button
                                onClick={() => updateMemberRole(m.email, "member")}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                              >
                                Retirer admin
                              </button>
                            ) : (
                              <button
                                onClick={() => updateMemberRole(m.email, "admin")}
                                className="rounded-2xl bg-[#d31f28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d31f28]"
                              >
                                Promouvoir admin
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "chat" && (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-6 max-h-[44vh] overflow-y-auto">
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-400">Pas encore de messages. Lancez la discussion.</p>
                  ) : (
                    chatMessages.map((m, i) => (
                      <p key={i} className="text-gray-100 mb-3">{m.text}</p>
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 rounded-3xl border border-white/10 bg-[#121212] px-5 py-4 text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                    placeholder="Écrire un message..."
                  />
                  <button
                    onClick={sendChat}
                    className="rounded-3xl bg-red-600 px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-red-700"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
