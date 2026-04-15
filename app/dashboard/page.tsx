"use client";

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

  const admins = ["tonemail@gmail.com"];

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

  // 🧠 helper couleur
  const getColor = (eventVotes: any, email: string) => {
    if (eventVotes[email] === "present") return "text-green-400";
    if (eventVotes[email] === "absent") return "text-red-400";
    return "text-gray-400";
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-24">

      {/* HEADER */}
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">🏎 App</h1>
          <p className="text-gray-400">{getPseudo(user.email)}</p>
        </div>

        <button onClick={logout} className="bg-red-600 px-3 py-1 rounded">
          Quitter
        </button>
      </div>

      {/* EVENTS */}
      {tab === "events" && (
  <div className="space-y-6">

    <h2 className="font-bold">📅 Événements validés</h2>

    {upcomingEvents.map((event) => {

      const eventVotes = votes[event.id] || {};

      const present = members.filter(
        (m) => eventVotes[m.email] === "present"
      );

      const absent = members.filter(
        (m) => eventVotes[m.email] === "absent"
      );

      const waiting = members.filter(
        (m) => !eventVotes[m.email]
      );

      return (
        <div key={event.id} className="bg-gray-800 p-4 rounded space-y-3">

          {/* TITRE */}
          <h2 className="font-bold text-lg">
            📅 {event.title}
          </h2>

          {/* 🟢 PRESENTS */}
          <div>
            <p className="text-green-500 font-bold">🟢 Présents</p>
            {present.map((m) => (
              <p key={m.email} className="text-green-400">
                {m.pseudo || m.email}
              </p>
            ))}
          </div>

          {/* ⚪ ATTENTE */}
          <div>
            <p className="text-gray-400 font-bold">⚪ Attente réponse</p>
            {waiting.map((m) => (
              <p key={m.email} className="text-gray-400">
                {m.pseudo || m.email}
              </p>
            ))}
          </div>

          {/* 🔴 ABSENTS */}
          <div>
            <p className="text-red-500 font-bold">🔴 Absents</p>
            {absent.map((m) => (
              <p key={m.email} className="text-red-400">
                {m.pseudo || m.email}
              </p>
            ))}
          </div>

          {/* 🗳️ VOTE MODIFIABLE */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => vote(event.id, "present")}
              className="bg-green-600 px-3 py-1 rounded"
            >
              Présent
            </button>

            <button
              onClick={() => vote(event.id, "absent")}
              className="bg-red-600 px-3 py-1 rounded"
            >
              Absent
            </button>
          </div>

        </div>
      );
    })}

  </div>
)}

      {/* PROPOSITIONS */}
      {tab === "proposition" && (
        <div className="space-y-6">

          <h2 className="font-bold">🗳 Propositions</h2>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-gray-800 p-2 rounded w-full"
          />

          <button onClick={createEvent} className="bg-blue-600 px-4 py-2 rounded">
            ➕ Créer proposition
          </button>

          {pendingEvents.map((event) => {

            const eventVotes = votes[event.id] || {};

            const present = members.filter(
              (m) => eventVotes[m.email] === "present"
            );

            const absent = members.filter(
              (m) => eventVotes[m.email] === "absent"
            );

            const waiting = members.filter(
              (m) => !eventVotes[m.email]
            );

            return (
              <div key={event.id} className="bg-gray-800 p-4 rounded space-y-3">

                <h2 className="font-bold text-lg">{event.title}</h2>

                {/* 🟢 PRESENTS */}
                <div>
                  <p className="text-green-500 font-bold">🟢 Présents</p>
                  {present.map((m) => (
                    <p key={m.email} className="text-green-400">
                      {m.pseudo || m.email}
                    </p>
                  ))}
                </div>

                {/* ⚪ ATTENTE */}
                <div>
                  <p className="text-gray-400 font-bold">⚪ Attente réponse</p>
                  {waiting.map((m) => (
                    <p key={m.email} className="text-gray-400">
                      {m.pseudo || m.email}
                    </p>
                  ))}
                </div>

                {/* 🔴 ABSENTS */}
                <div>
                  <p className="text-red-500 font-bold">🔴 Absents</p>
                  {absent.map((m) => (
                    <p key={m.email} className="text-red-400">
                      {m.pseudo || m.email}
                    </p>
                  ))}
                </div>

                {/* VOTES */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => vote(event.id, "present")}
                    className="bg-green-600 px-3 py-1 rounded"
                  >
                    Présent
                  </button>

                  <button
                    onClick={() => vote(event.id, "absent")}
                    className="bg-red-600 px-3 py-1 rounded"
                  >
                    Absent
                  </button>
                </div>

                {/* VALIDATION */}
                <button
                  onClick={() => validateEvent(event.id)}
                  className="bg-blue-600 px-3 py-1 rounded mt-3"
                >
                  ✅ Valider l’événement
                </button>

              </div>
            );
          })}

        </div>
      )}

      {/* MEMBERS */}
      {tab === "members" && (
        <div className="space-y-4">

          <h2 className="font-bold">👥 Membres</h2>

          {members.map((m) => (
            <div key={m.email} className="bg-gray-800 p-3 rounded">
              <p className="font-bold">{m.pseudo || m.email}</p>
              <p className="text-gray-400">{m.team || "Sans écurie"}</p>
            </div>
          ))}

        </div>
      )}

      {/* CHAT */}
      {tab === "chat" && (
        <div className="space-y-2">

          <div className="h-[60vh] overflow-y-auto">
            {chatMessages.map((m, i) => (
              <p key={i}>{m.text}</p>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-gray-800 p-2 rounded"
            />

            <button onClick={sendChat} className="bg-blue-600 px-3 rounded">
              Envoyer
            </button>
          </div>

        </div>
      )}

      {/* MENU */}
      <div className="fixed bottom-0 left-0 right-0 bg-black flex justify-around py-3">
        <button onClick={() => setTab("events")}>📅</button>
        <button onClick={() => setTab("proposition")}>🗳 Propositions</button>
        <button onClick={() => setTab("members")}>👥</button>
        <button onClick={() => setTab("chat")}>💬</button>
      </div>

    </main>
  );
}