"use client";

import { useEffect, useRef, useState } from "react";
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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, MessageCircle, Trophy, Users } from "lucide-react";

export default function Dashboard() {
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [chatReadAt, setChatReadAt] = useState<Date | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineMembersCount, setOnlineMembersCount] = useState(1);
  const [infoPairIndex, setInfoPairIndex] = useState(0);
  const [isInfoFading, setIsInfoFading] = useState(false);

  const [tab, setTab] = useState("events");

  const [selectedDate, setSelectedDate] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
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

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [tempMemberRole, setTempMemberRole] = useState("");
  const [tempPilotStars, setTempPilotStars] = useState("");
  const [tempPilotSeasons, setTempPilotSeasons] = useState("");
  const [tempTeamStars, setTempTeamStars] = useState("");
  const [tempTeamSeasons, setTempTeamSeasons] = useState("");
  const [tempCrowns, setTempCrowns] = useState("");
  const [tempCrownSeasons, setTempCrownSeasons] = useState("");

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

    const fictiveMemberEmails = [
      "maxime.bernard@gmail.com",
      "sarah.leclerc@gmail.com",
      "thomas.gasquet@gmail.com",
      "alice.mathieu@gmail.com",
    ];

    // Cleanup once on load so fake accounts disappear from Firestore and UI.
    const cleanupFictiveMembers = async () => {
      await Promise.all(
        fictiveMemberEmails.map(async (email) => {
          try {
            await deleteDoc(doc(firestore, "members", email));
          } catch {
            // Ignore permission/network issues; snapshot below still drives UI.
          }
        })
      );
    };

    cleanupFictiveMembers();

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
      setChatMessages(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    return onSnapshot(collection(firestore, "chatTyping"), (snapshot) => {
      const now = Date.now();
      const onlineWindowMs = 5 * 60 * 1000;
      const active = snapshot.docs
        .map((d) => ({ email: d.id, ...d.data() }))
        .filter((entry: any) => {
          if (!entry.isTyping || entry.email === user.email) return false;
          const updatedMs = entry.updatedAt?.toDate?.()?.getTime?.() || 0;
          return now - updatedMs < 7000;
        });
      const onlineEmails = new Set<string>();
      snapshot.docs.forEach((d) => {
        const data: any = d.data();
        const updatedMs = data?.updatedAt?.toDate?.()?.getTime?.() || 0;
        if (now - updatedMs < onlineWindowMs) {
          onlineEmails.add(d.id);
        }
      });
      onlineEmails.add(user.email);

      setTypingUsers(active);
      setOnlineMembersCount(onlineEmails.size);
    });
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    const heartbeat = async () => {
      await setDoc(
        doc(firestore, "chatTyping", user.email),
        {
          userEmail: user.email,
          isTyping: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, 60000);

    return () => window.clearInterval(intervalId);
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    return onSnapshot(doc(firestore, "chatReads", user.email), (snap) => {
      const data = snap.data();
      const ts = data?.lastReadAt?.toDate?.() || null;
      setChatReadAt(ts);
    });
  }, [user?.email]);

  useEffect(() => {
    if (!chatReadAt) {
      setUnreadCount(chatMessages.length);
      return;
    }
    const unread = chatMessages.filter((m) => {
      const createdAt = m.createdAt?.toDate?.();
      if (!createdAt) return false;
      return createdAt > chatReadAt;
    }).length;
    setUnreadCount(unread);
  }, [chatMessages, chatReadAt]);

  useEffect(() => {
    if (tab !== "chat") return;
    markChatAsRead();
  }, [tab, chatMessages.length]);

  useEffect(() => {
    if (tab !== "chat") return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tab, chatMessages.length]);

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
  const canManageProposition = (event: any) => {
    if (userRole === "admin" || userRole === "superAdmin") return true;
    return event?.status === "pending" && !!user?.email && event?.createdBy === user.email;
  };

  const validateEvent = async (event: any) => {
    if (!event?.id) return;
    if (!canManageProposition(event)) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "events", event.id),
      { status: "validated" },
      { merge: true }
    );
  };

  // ❌ DELETE EVENT
  const deleteEvent = async (event: any) => {
    if (!event?.id) return;
    if (!canManageProposition(event) && userRole !== "admin" && userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await deleteDoc(doc(firestore, "events", event.id));
  };

  // 🔧 PROMOTE / DEMOTE MEMBER
  const updateMemberRole = async (memberEmail: string, role: string) => {
    if (userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "members", memberEmail), { role }, { merge: true });
  };

  const updateMemberDetails = async (memberEmail: string, payload: any) => {
    if (userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "members", memberEmail), payload, { merge: true });
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
  const markChatAsRead = async () => {
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "chatReads", user.email),
      {
        userEmail: user.email,
        lastReadAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const setTypingStatus = async (isTyping: boolean) => {
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "chatTyping", user.email),
      {
        userEmail: user.email,
        isTyping,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const findMentionedEmails = (text: string) => {
    const mentionMatches = text.match(/@([^\s@]+)/g) || [];
    if (mentionMatches.length === 0) return [];
    const pseudos = mentionMatches.map((m) => m.slice(1).toLowerCase());
    return members
      .filter((member: any) => member.pseudo && pseudos.includes(String(member.pseudo).toLowerCase()))
      .map((member: any) => member.email);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !user) return;

    const firestore = getFirestore();
    if (!firestore) return;

    const mentionedEmails = findMentionedEmails(chatInput);

    await addDoc(collection(firestore, "chat"), {
      text: chatInput.trim(),
      user: user.email,
      parentId: replyToMessageId || null,
      mentions: mentionedEmails,
      editedAt: null,
      createdAt: serverTimestamp(),
    });

    setChatInput("");
    setReplyToMessageId(null);
    setTypingStatus(false);
    await markChatAsRead();
  };

  const startEditMessage = (message: any) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text || "");
  };

  const saveEditedMessage = async () => {
    if (!editingMessageId || !editingMessageText.trim()) return;
    if (userRole !== "admin" && userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    const mentionedEmails = findMentionedEmails(editingMessageText);

    await updateDoc(doc(firestore, "chat", editingMessageId), {
      text: editingMessageText.trim(),
      mentions: mentionedEmails,
      editedAt: serverTimestamp(),
    });

    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const removeMessage = async (messageId: string) => {
    if (userRole !== "admin" && userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;
    await deleteDoc(doc(firestore, "chat", messageId));
  };

  const getPseudo = (email: string) =>
    members.find((m) => m.email === email)?.pseudo || email;

  const formatTypingLabel = () => {
    if (typingUsers.length === 0) return "";
    const pseudos = typingUsers.map((u: any) => getPseudo(u.email));
    if (pseudos.length === 1) return `${pseudos[0]} ecrit...`;
    if (pseudos.length === 2) return `${pseudos[0]} et ${pseudos[1]} ecrivent...`;
    return `${pseudos[0]} et ${pseudos.length - 1} autres ecrivent...`;
  };

  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        const token = part.slice(1).toLowerCase();
        const exists = members.some(
          (member: any) => member.pseudo && String(member.pseudo).toLowerCase() === token
        );
        if (exists) {
          return (
            <span key={`${part}-${idx}`} className="text-[#d31f28] font-bold">
              {part}
            </span>
          );
        }
      }
      return <span key={`${part}-${idx}`}>{part}</span>;
    });
  };

  const formatChatTime = (value: any) => {
    const date = value?.toDate?.() || null;
    if (!date) return "--:--";
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const isChatManager = userRole === "admin" || userRole === "superAdmin";
  const currentUserEmail = user?.email || "";

  const pendingEvents = events.filter((e) => e.status === "pending");

  const upcomingEvents = events.filter(
    (e) => e.status === "validated" && new Date(e.date) >= new Date()
  );

  const nextEventDays = upcomingEvents.length > 0 ? Math.ceil((new Date(upcomingEvents[0].date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  const pendingForMeCount = currentUserEmail
    ? pendingEvents.filter((event: any) => !votes[event.id]?.[currentUserEmail]).length
    : 0;
  const mentionCount = chatMessages.filter((message: any) =>
    currentUserEmail && Array.isArray(message.mentions) && message.mentions.includes(currentUserEmail)
  ).length;
  const otherOnlineCount = Math.max(onlineMembersCount - 1, 0);

  const infoItems = [
    upcomingEvents.length > 0 ? `${upcomingEvents.length} partie${upcomingEvents.length > 1 ? "s" : ""} a venir` : null,
    pendingForMeCount > 0 ? `${pendingForMeCount} proposition${pendingForMeCount > 1 ? "s" : ""} en attente de ta reponse` : null,
    mentionCount > 0 ? `${mentionCount} message${mentionCount > 1 ? "s" : ""} avec @toi` : null,
    unreadCount > 0 ? `${unreadCount} message${unreadCount > 1 ? "s" : ""} non lu${unreadCount > 1 ? "s" : ""}` : null,
    otherOnlineCount > 0 ? `${otherOnlineCount} membre${otherOnlineCount > 1 ? "s" : ""} en ligne` : null,
  ].filter(Boolean) as string[];

  const normalizedInfoIndex = infoItems.length === 0 ? 0 : infoPairIndex % infoItems.length;
  const currentInfoLine = infoItems[normalizedInfoIndex] || "";

  const navItems = [
    { key: "events", label: "Parties", icon: CalendarDays },
    { key: "proposition", label: "Propositions", icon: ClipboardList },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "results", label: "Resultats", icon: Trophy },
    { key: "members", label: "Participants", icon: Users },
  ];

  useEffect(() => {
    if (infoItems.length <= 1) {
      setInfoPairIndex(0);
      setIsInfoFading(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      setIsInfoFading(true);
      window.setTimeout(() => {
        setInfoPairIndex((current) => (current + 1) % infoItems.length);
        setIsInfoFading(false);
      }, 240);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [infoItems.length]);

  if (!user) return null;

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

  const parseSeasons = (value: any) =>
    String(value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const hasMemberStats = (member: any) => {
    return [
      member.pilotStars,
      member.pilotStarSeasons,
      member.teamStars,
      member.teamStarSeasons,
      member.crowns,
      member.crownSeasons,
    ].some((v) => String(v || "").trim() !== "");
  };

  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      {/* F1 top accent bar */}
      <div className="h-1 w-full bg-[#d31f28]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-24 sm:pb-8">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <img
              src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
              alt="Formula D"
              className="h-14 w-auto object-contain shrink-0"
            />

            <div className="info-laser-border h-14 flex-1 min-w-0 max-w-[640px] bg-[#010d1e] px-3 sm:px-4 flex items-center overflow-hidden">
              {infoItems.length === 0 ? (
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-500">Aucune info urgente</p>
              ) : (
                <div className={`w-full transition-opacity duration-300 ${isInfoFading ? "opacity-0" : "opacity-100"}`}>
                  <p className="truncate text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-200 leading-5">
                    <span className="text-[#d31f28] mr-2">Info</span>{currentInfoLine}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <div className="relative w-fit">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-14 h-14 rounded-3xl p-[2px] bg-black transition"
              >
                <div className="w-full h-full rounded-[1.35rem] overflow-hidden bg-[#d31f28] [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)] flex items-center justify-center">
                  {profile.avatar ? (
                    <div
                      aria-label="Avatar"
                      className="w-full h-full rounded-[inherit] bg-center bg-cover"
                      style={{ backgroundImage: `url("${profile.avatar}")` }}
                    />
                  ) : (
                    <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  )}
                </div>
              </button>
              <div className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 flex items-center justify-center border-2 border-[#000e22]">
                <svg className="w-3.5 h-3.5 text-[#d31f28]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-[#001122] border border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-[#d31f28] rounded-3xl flex items-center justify-center overflow-hidden [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)]">
                        {profile.avatar ? (
                          <div
                            aria-label="Avatar"
                            className="w-full h-full rounded-[inherit] bg-center bg-cover"
                            style={{ backgroundImage: `url("${profile.avatar}")` }}
                          />
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

        <div className="mt-4 sm:mt-6">
          <section className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-[#d31f28]" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                  {tab === "events" && <>Parties a venir — <span className="text-[#d31f28]">{nextEventDays !== null ? `J-${nextEventDays}` : "—"}</span></>}
                  {tab === "proposition" && <>Propositions de dates</>}
                  {tab === "chat" && <>Chat equipe</>}
                  {tab === "results" && <>Resultats</>}
                  {tab === "members" && <>Participants</>}
                </p>
              </div>
            </div>

            {tab === "events" && (
              <div className="space-y-5">
                {upcomingEvents.length === 0 ? (
                  <div className="border border-white/10 bg-black/40 p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucun événement validé pour le moment.
                  </div>
                ) : (
                  upcomingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => eventVotes[m.email] === "present");
                    const absent = members.filter((m) => eventVotes[m.email] === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);

                    return (
                      <div key={event.id} className="border-l-4 border-[#d31f28] bg-white/5 border border-white/10 p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-[0.3em] font-bold">Session validée</p>
                            <h3 className="text-xl font-black uppercase text-white mt-1">{event.title}</h3>
                          </div>
                          <div className="flex w-full sm:w-auto flex-wrap gap-2">
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="flex-1 sm:flex-none text-center bg-[#409b48] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#37853e] transition"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="flex-1 sm:flex-none text-center bg-[#d31f28] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#b81d23] transition"
                            >
                              Absent
                            </button>
                            {(userRole === "admin" || userRole === "superAdmin") && (
                              <button
                                onClick={() => deleteEvent(event)}
                                className="flex-1 sm:flex-none text-center border border-white/20 bg-transparent px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white transition"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-px sm:grid-cols-3 bg-white/10">
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#409b48] font-black">Présents — {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">{present.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
                          </div>
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">En attente — {waiting.length}</p>
                          </div>
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#d31f28] font-black">Absents — {absent.length}</p>
                            <p className="mt-2 text-sm text-[#d31f28]">{absent.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
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
                <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Nouvelle proposition</p>
                  
                  <div className="bg-white/5 p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={handlePrevMonth}
                        className="px-3 py-2 text-white hover:bg-white/10 font-bold"
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
                            className={`py-2 text-sm font-bold transition ${
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
                    className="mt-4 w-full bg-[#d31f28] px-5 py-4 text-xs font-black uppercase tracking-[0.3em] text-white hover:bg-[#b81d23] transition"
                  >
                    + Créer proposition
                  </button>
                </div>

                {pendingEvents.length === 0 ? (
                  <div className="border border-white/10 bg-[#010d1e] p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucune proposition en attente.
                  </div>
                ) : (
                  pendingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => eventVotes[m.email] === "present");
                    const absent = members.filter((m) => eventVotes[m.email] === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);

                    return (
                      <div key={event.id} className="border-l-4 border-yellow-500 bg-white/5 border border-white/10 p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs text-yellow-500 uppercase tracking-[0.3em] font-black">Vote en cours</p>
                            <h3 className="text-xl font-black uppercase text-white mt-1">{event.title}</h3>
                          </div>
                          <div className="flex w-full sm:w-auto flex-wrap gap-2">
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="flex-1 sm:flex-none text-center bg-[#409b48] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#37853e] transition"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="flex-1 sm:flex-none text-center bg-[#d31f28] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#b81d23] transition"
                            >
                              Absent
                            </button>
                            {canManageProposition(event) && (
                              <button
                                onClick={() => validateEvent(event)}
                                className="flex-1 sm:flex-none text-center border border-yellow-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-yellow-400 hover:bg-yellow-500/10 transition"
                              >
                                Valider
                              </button>
                            )}
                            {canManageProposition(event) && (
                              <button
                                onClick={() => deleteEvent(event)}
                                className="flex-1 sm:flex-none text-center border border-white/20 px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white transition"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-px sm:grid-cols-3 bg-white/10">
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#409b48] font-black">Présents — {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">{present.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
                          </div>
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">En attente — {waiting.length}</p>
                          </div>
                          <div className="bg-[#010d1e] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#d31f28] font-black">Absents — {absent.length}</p>
                            <p className="mt-2 text-sm text-[#d31f28]">{absent.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "results" && (
              <div className="border border-white/10 bg-black/30 p-8 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-[#d31f28] mb-3">Resultats</p>
                <p className="text-sm uppercase tracking-widest text-gray-400">En construction</p>
              </div>
            )}

            {tab === "members" && (
              <div className="space-y-2">
                {members.length === 0 ? (
                  <div className="border border-white/10 bg-[#010d1e] p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucun membre trouvé.
                  </div>
                ) : (
                  members.map((m) => (
                    <div 
                      key={m.email} 
                      onClick={() => {
                        if (userRole === "superAdmin") {
                          setSelectedMember(m);
                          setTempMemberRole(m.role || "member");
                          setTempPilotStars(String(m.pilotStars || ""));
                          setTempPilotSeasons(String(m.pilotStarSeasons || ""));
                          setTempTeamStars(String(m.teamStars || ""));
                          setTempTeamSeasons(String(m.teamStarSeasons || ""));
                          setTempCrowns(String(m.crowns || ""));
                          setTempCrownSeasons(String(m.crownSeasons || ""));
                          setIsEditingMember(true);
                        }
                      }}
                      className={`border border-white/10 bg-[#010d1e] px-4 sm:px-6 py-4 flex items-start sm:items-center gap-3 sm:gap-5 ${userRole === "superAdmin" ? "cursor-pointer hover:bg-white/5 transition" : ""}`}
                    >
                      {/* avatar */}
                      <div className="w-12 h-12 bg-[#d31f28] flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.pseudo || m.email} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          )}
                        </div>
                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <p className="text-sm font-black uppercase tracking-wide text-white">{m.pseudo || m.email}</p>
                            {hasMemberStats(m) && (
                              <div className="flex items-center gap-1 text-[11px] relative top-[-14px]">
                                {Number(m.pilotStars) > 0 && (
                                  <span className="relative group cursor-default leading-none">
                                    {"⭐".repeat(Number(m.pilotStars))}
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Pilote{parseSeasons(m.pilotStarSeasons).length > 0 ? " · " + parseSeasons(m.pilotStarSeasons).map((s: string) => `S${s}`).join(" · ") : ""}
                                    </span>
                                  </span>
                                )}
                                {Number(m.teamStars) > 0 && (
                                  <span className="relative group cursor-default leading-none">
                                    {"☀️".repeat(Number(m.teamStars))}
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Écurie{parseSeasons(m.teamStarSeasons).length > 0 ? " · " + parseSeasons(m.teamStarSeasons).map((s: string) => `S${s}`).join(" · ") : ""}
                                    </span>
                                  </span>
                                )}
                                {Number(m.crowns) > 0 && (
                                  <span className="relative group cursor-default leading-none">
                                    {"👑".repeat(Number(m.crowns))}
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      Individuel{parseSeasons(m.crownSeasons).length > 0 ? " · " + parseSeasons(m.crownSeasons).map((s: string) => `S${s}`).join(" · ") : ""}
                                    </span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{m.team || "Sans écurie"}</p>
                        </div>
                        {userRole === "superAdmin" && (
                          <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "chat" && (
              <div className="space-y-4">
                <div ref={chatScrollRef} className="border border-white/10 bg-[#010d1e] p-4 sm:p-6 max-h-[50vh] sm:max-h-[44vh] overflow-y-auto">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs uppercase tracking-widest text-gray-500">Pas encore de messages. Lancez la discussion.</p>
                  ) : (
                    chatMessages
                      .filter((m) => !m.parentId)
                      .map((m) => {
                        const replies = chatMessages.filter((r) => r.parentId === m.id);
                        return (
                          <div key={m.id} className="mb-4 border-l-2 border-white/10 pl-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.15em] text-gray-500 mb-1">
                                  {getPseudo(m.user)} · {formatChatTime(m.createdAt)}
                                  {m.editedAt ? " · modifie" : ""}
                                </p>
                                <p className="text-gray-200 text-sm">{renderTextWithMentions(m.text || "")}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <button
                                  onClick={() => setReplyToMessageId(m.id)}
                                  className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition"
                                >
                                  Repondre
                                </button>
                                {isChatManager && (
                                  <>
                                    <button
                                      onClick={() => startEditMessage(m)}
                                      className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition"
                                    >
                                      Editer
                                    </button>
                                    <button
                                      onClick={() => removeMessage(m.id)}
                                      className="text-[10px] uppercase tracking-widest text-[#d31f28] hover:text-[#ff4c55] transition"
                                    >
                                      Supprimer
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {replies.length > 0 && (
                              <div className="mt-3 ml-3 space-y-2 border-l border-white/10 pl-3">
                                {replies.map((reply) => (
                                  <div key={reply.id} className="bg-black/30 border border-white/10 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mb-1">
                                      {getPseudo(reply.user)} · {formatChatTime(reply.createdAt)}
                                      {reply.editedAt ? " · modifie" : ""}
                                    </p>
                                    <p className="text-sm text-gray-200">{renderTextWithMentions(reply.text || "")}</p>
                                    {isChatManager && (
                                      <div className="mt-2 flex items-center gap-3">
                                        <button
                                          onClick={() => startEditMessage(reply)}
                                          className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition"
                                        >
                                          Editer
                                        </button>
                                        <button
                                          onClick={() => removeMessage(reply.id)}
                                          className="text-[10px] uppercase tracking-widest text-[#d31f28] hover:text-[#ff4c55] transition"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                {formatTypingLabel() && (
                  <p className="text-[11px] text-gray-500 uppercase tracking-widest">{formatTypingLabel()}</p>
                )}

                {replyToMessageId && (
                  <div className="border border-[#d31f28]/40 bg-[#d31f28]/10 px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-widest text-gray-300">Reponse en fil active</p>
                    <button
                      onClick={() => setReplyToMessageId(null)}
                      className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-white transition"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                {editingMessageId && isChatManager && (
                  <div className="border border-white/20 bg-black/30 p-3 space-y-3">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Edition du message</p>
                    <input
                      value={editingMessageText}
                      onChange={(e) => setEditingMessageText(e.target.value)}
                      className="w-full border border-white/20 bg-transparent px-4 py-2 text-white text-sm outline-none focus:border-[#d31f28] transition"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditingMessageText("");
                        }}
                        className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={saveEditedMessage}
                        className="bg-[#d31f28] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#b81d23]"
                      >
                        Sauvegarder
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                      setTypingStatus(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    className="flex-1 border border-white/20 bg-transparent px-5 py-3 text-white text-sm outline-none focus:border-[#d31f28] transition"
                    placeholder="Ecrire un message... (utilisez @pseudo)"
                  />
                  <button
                    onClick={sendChat}
                    className="w-full sm:w-auto bg-[#d31f28] px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-[#b81d23] transition"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#000a18]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-2 py-2">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`flex flex-col items-center justify-center gap-1 px-1 py-2 transition ${isActive ? "text-white" : "text-gray-500"}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#d31f28]" : "text-gray-500"}`} />
                  <span className="text-[9px] font-black uppercase tracking-[0.08em] leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {isEditingMember && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#000e22] border-l-4 border-[#d31f28] border border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
              <div className="w-1 h-6 bg-[#d31f28]" />
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">Modifier le membre</h2>
            </div>
            <div className="p-6">
            <div className="mb-6 flex items-center gap-4 border border-white/10 p-4 bg-white/5">
              <div className="w-12 h-12 bg-[#d31f28] flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedMember.avatar ? (
                  <img src={selectedMember.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                )}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-white">{selectedMember.pseudo || selectedMember.email}</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{selectedMember.team || "Sans écurie"}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Rôle</label>
              <select
                value={tempMemberRole}
                onChange={(e) => setTempMemberRole(e.target.value)}
                className="w-full px-4 py-3 bg-[#d31f28] border-2 border-[#d31f28] rounded-lg text-white font-semibold hover:bg-[#b81d23] transition"
              >
                <option value="member" className="bg-gray-800 text-white">Membre</option>
                <option value="admin" className="bg-gray-800 text-white">Admin</option>
              </select>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre d'étoiles Pilote</label>
                <input
                  type="number"
                  min="0"
                  value={tempPilotStars}
                  onChange={(e) => setTempPilotStars(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Saisons étoiles Pilote</label>
                <input
                  type="text"
                  value={tempPilotSeasons}
                  onChange={(e) => setTempPilotSeasons(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 0,1,3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre d'étoiles Écurie</label>
                <input
                  type="number"
                  min="0"
                  value={tempTeamStars}
                  onChange={(e) => setTempTeamStars(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Saisons étoiles Écurie</label>
                <input
                  type="text"
                  value={tempTeamSeasons}
                  onChange={(e) => setTempTeamSeasons(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 0,1,3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de Couronne</label>
                <input
                  type="number"
                  min="0"
                  value={tempCrowns}
                  onChange={(e) => setTempCrowns(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Saisons Couronne</label>
                <input
                  type="text"
                  value={tempCrownSeasons}
                  onChange={(e) => setTempCrownSeasons(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Ex: 0,1,3"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsEditingMember(false)}
                className="flex-1 border border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-white transition"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (selectedMember.email) {
                    await updateMemberDetails(selectedMember.email, {
                      role: tempMemberRole,
                      pilotStars: tempPilotStars.trim(),
                      pilotStarSeasons: tempPilotSeasons.trim(),
                      teamStars: tempTeamStars.trim(),
                      teamStarSeasons: tempTeamSeasons.trim(),
                      crowns: tempCrowns.trim(),
                      crownSeasons: tempCrownSeasons.trim(),
                    });
                    setIsEditingMember(false);
                    setSelectedMember(null);
                  }
                }}
                className="flex-1 bg-[#d31f28] px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[#b81d23] transition"
              >
                Sauvegarder
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
