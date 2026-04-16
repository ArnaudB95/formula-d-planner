from pathlib import Path

page_content = '''"use client";

import { useEffect, useState } from "react";
import { auth, provider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Landing() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u) {
        router.push("/dashboard");
      }
    });

    return () => unsub();
  }, []);

  const login = async () => {
    await signInWithPopup(auth, provider);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col">

      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center font-bold tracking-[0.2em] text-sm">
          FD
        </div>
        <span className="font-semibold uppercase tracking-[0.2em] text-white/90">Formula D</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-8 lg:px-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-emerald-300/90 mb-6">
          APP MOBILE
        </span>

        <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-[-0.03em]">
          PLANIFIEZ VOS <br />
          <span className="text-red-500">PARTIES F1</span>
        </h1>

        <p className="max-w-2xl text-gray-400 text-lg leading-8 mt-5">
          Sondages, chat et gestion d’équipe pour vos sessions Formula D.
        </p>

        <button
          onClick={login}
          className="mt-10 w-full max-w-2xl rounded-3xl bg-red-600 py-4 text-base font-semibold uppercase tracking-[0.12em] text-white shadow-[0_25px_90px_rgba(255,34,34,0.18)] transition hover:bg-red-700"
        >
          <span className="inline-flex items-center justify-center gap-3">
            <span className="text-xl">G</span>
            CONNEXION GOOGLE
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 px-6 py-6">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-red-500 text-2xl mb-4">📊</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">SONDAGES</p>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-red-500 text-2xl mb-4">💬</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">CHAT</p>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-red-500 text-2xl mb-4">👥</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">ÉQUIPES</p>
        </div>
      </div>
    </main>
  );
}
'''

page_path = Path('app/page.tsx')
page_path.write_text(page_content, encoding='utf-8')

# Update dashboard page

dashboard_content = '''"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Calendar, Vote, Users, MessageCircle } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const [tab, setTab] = useState("events");

  const [selectedDate, setSelectedDate] = useState("");
  const [chatInput, setChatInput] = useState("");

  const [profile, setProfile] = useState<any>({
    pseudo: "",
    team: "",
    avatar: "",
  });

  const router = useRouter();

  // 🔐 AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/");

      setUser(u);

      await setDoc(
        doc(db, "members", u.email!),
        { email: u.email },
        { merge: true }
      );
    });

    return () => unsub();
  }, []);

  // 👤 PROFILE
  useEffect(() => {
    if (!user) return;

    return onSnapshot(doc(db, "members", user.email!), (snap) => {
      if (!snap.exists()) return;

      const d = snap.data();

      setProfile({
        pseudo: d.pseudo ?? "",
        team: d.team ?? "",
        avatar: d.avatar ?? "",
      });
    });
  }, [user]);

  // 📅 EVENTS
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "asc"));

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
    return onSnapshot(collection(db, "members"), (snapshot) => {
      setMembers(
        snapshot.docs.map((d) => ({
          email: d.id,
          ...d.data(),
        }))
      );
    });
  }, []);

  // 🗳️ VOTES LIVE
  useEffect(() => {
    return onSnapshot(collection(db, "votes"), (snapshot) => {
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
    const q = query(collection(db, "chat"), orderBy("createdAt", "asc"));

    return onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map((d) => d.data()));
    });
  }, []);

  const logout = async () => {
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

    await addDoc(collection(db, "events"), {
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

    await setDoc(doc(db, "votes", `${eventId}_${user.email}`), {
      eventId,
      userEmail: user.email,
      status,
      updatedAt: serverTimestamp(),
    });
  };

  // ✅ VALIDATION EVENT
  const validateEvent = async (eventId: string) => {
    await setDoc(
      doc(db, "events", eventId),
      { status: "validated" },
      { merge: true }
    );
  };

  // 💬 CHAT
  const sendChat = async () => {
    if (!chatInput || !user) return;

    await addDoc(collection(db, "chat"), {
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

  const getColor = (eventVotes: any, email: string) => {
    if (eventVotes[email] === "present") return "text-green-400";
    if (eventVotes[email] === "absent") return "text-red-400";
    return "text-gray-400";
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-emerald-300/90 mb-4">
              APP MOBILE
            </span>
            <h1 className="text-5xl sm:text-6xl font-black tracking-[-0.04em] leading-tight">
              PLANIFIEZ VOS <br />
              <span className="text-red-500">PARTIES F1</span>
            </h1>
            <p className="mt-4 max-w-2xl text-gray-400 text-lg leading-8">
              Sondages, chat et gestion d’équipe pour vos sessions Formula D.
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full sm:w-auto rounded-3xl bg-red-600 px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] transition hover:bg-red-700"
          >
            SE DÉCONNECTER
          </button>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => setTab("events")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "events" ? "ring-1 ring-red-500/60" : ""}`}
          >
            <p className="text-red-500 text-2xl mb-4">📊</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Sondages</p>
            <p className="text-white text-lg font-semibold">{upcomingEvents.length} validés</p>
          </button>

          <button
            onClick={() => setTab("proposition")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "proposition" ? "ring-1 ring-red-500/60" : ""}`}
          >
            <p className="text-red-500 text-2xl mb-4">🗳️</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Propositions</p>
            <p className="text-white text-lg font-semibold">{pendingEvents.length} en attente</p>
          </button>

          <button
            onClick={() => setTab("members")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "members" ? "ring-1 ring-red-500/60" : ""}`}
          >
            <p className="text-red-500 text-2xl mb-4">👥</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Équipes</p>
            <p className="text-white text-lg font-semibold">{members.length} membres</p>
          </button>

          <button
            onClick={() => setTab("chat")}
            className={`rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-left transition hover:bg-white/10 ${tab === "chat" ? "ring-1 ring-red-500/60" : ""}`}
          >
            <p className="text-red-500 text-2xl mb-4">💬</p>
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-2">Chat</p>
            <p className="text-white text-lg font-semibold">{chatMessages.length} messages</p>
          </button>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10 mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-gray-400">Vue rapide</p>
                <h2 className="text-2xl font-semibold text-white">Tableau de bord</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300">Validés {upcomingEvents.length}</span>
                <span className="rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300">Propositions {pendingEvents.length}</span>
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                              Absent
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Présents</p>
                            <p className="mt-2 text-lg font-semibold text-green-300">{present.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Attente</p>
                            <p className="mt-2 text-lg font-semibold text-gray-200">{waiting.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Absents</p>
                            <p className="mt-2 text-lg font-semibold text-red-300">{absent.length}</p>
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
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#121212] px-4 py-4 text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
                  />
                  <button
                    onClick={createEvent}
                    className="mt-4 w-full rounded-3xl bg-red-600 px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white hover:bg-red-700"
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
                          <button
                            onClick={() => validateEvent(event.id)}
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Valider
                          </button>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Présents</p>
                            <p className="mt-2 text-lg font-semibold text-green-300">{present.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Attente</p>
                            <p className="mt-2 text-lg font-semibold text-gray-200">{waiting.length}</p>
                          </div>
                          <div className="rounded-3xl bg-white/5 p-4">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Absents</p>
                            <p className="mt-2 text-lg font-semibold text-red-300">{absent.length}</p>
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
                      <p className="text-lg font-semibold text-white">{m.pseudo || m.email}</p>
                      <p className="mt-1 text-gray-400">{m.team || "Sans écurie"}</p>
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

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
              <p className="text-sm uppercase tracking-[0.28em] text-gray-400 mb-4">Dernière activité</p>
              <div className="grid gap-3">
                <div className="rounded-3xl bg-black/30 p-4">
                  <p className="text-sm text-gray-400">Membres actifs</p>
                  <p className="mt-2 text-xl font-semibold text-white">{members.length}</p>
                </div>
                <div className="rounded-3xl bg-black/30 p-4">
                  <p className="text-sm text-gray-400">Votes enregistrés</p>
                  <p className="mt-2 text-xl font-semibold text-white">{Object.keys(votes).length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
              <p className="text-sm uppercase tracking-[0.28em] text-gray-400 mb-4">Actions rapides</p>
              <div className="grid gap-3">
                <button
                  onClick={() => setTab("proposition")}
                  className="rounded-3xl border border-white/10 bg-[#121212] px-4 py-4 text-left text-white hover:bg-white/5"
                >
                  Créer une proposition
                </button>
                <button
                  onClick={() => setTab("chat")}
                  className="rounded-3xl border border-white/10 bg-[#121212] px-4 py-4 text-left text-white hover:bg-white/5"
                >
                  Ouvrir le chat
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
'''

Path('app/dashboard/page.tsx').write_text(dashboard_content, encoding='utf-8')
"
