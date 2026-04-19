"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAuth, getFirestore } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, MessageCircle, Pencil, Reply, Trash2, Trophy, Users } from "lucide-react";

const FUN_INFO_TEMPLATES = [
  "[Pseudo] vise le podium... ou pas",
  "[Pseudo] sponsorise par RNG",
  "[Pseudo] prie les des en secret",
  "[Pseudo] va jouer safe... ou Pas !",
  "[Pseudo] vise la pole... Dance",
  "[Pseudo] a un plan fou ! ... flou",
  "[Pseudo] relit les regles... a sa facon",
  "[Pseudo] fait confiance aux des",
  "[Pseudo] prepare une strategie secrete",
  "[Pseudo] annonce une grande saison",
  "[Pseudo] suit son instinct",
  "[Pseudo] optimise... sur le papier",
  "[Pseudo] connait les regles... globalement",
  "[Pseudo] vise un championnat propre",
  "[Pseudo] prevoit un coup brillant",
  "[Pseudo] compte sur l'elan du moment",
  "[Pseudo] connait le circuit... en theorie",
  "[Pseudo] annonce du beau jeu",
  "[Pseudo] prepare un plan discret",
  "[Pseudo] joue la carte surprise",
  "[Pseudo] a tout prevu... presque",
  "[Pseudo] croit en sa strategie",
  "[Pseudo] prepare un depart soigne",
  "[Pseudo] vise une course memorable",
  "[Pseudo] affine son style",
  "[Pseudo] annonce une belle dynamique",
  "[Pseudo] apprivoise le hasard",
  "[Pseudo] prepare un coup audacieux",
  "[Pseudo] vise la regularite",
  "[Pseudo] affiche une confiance calme",
  "[Pseudo] prepare un plan solide",
  "[Pseudo] joue la victoire tranquille",
  "[Pseudo] vise un record perso",
  "[Pseudo] promet du spectacle",
  "[Pseudo] peaufine chaque detail",
  "[Pseudo] croit en ses chances",
  "[Pseudo] vise le haut du classement",
  "[Pseudo] prepare une surprise",
  "[Pseudo] annonce du tres serieux",
  "[Pseudo] joue gros cette saison",
];

export default function Dashboard() {
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const evolutionScrollRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [chatReadAt, setChatReadAt] = useState<Date | null>(null);
  const [evolutionReadByRequest, setEvolutionReadByRequest] = useState<Record<string, Date>>({});
  const [evolutionReadsLoaded, setEvolutionReadsLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatView, setChatView] = useState<"chat" | "evolution">("chat");
  const [evolutionRequests, setEvolutionRequests] = useState<any[]>([]);
  const [evolutionReplies, setEvolutionReplies] = useState<any[]>([]);
  const [selectedEvolutionId, setSelectedEvolutionId] = useState<string | null>(null);
  const [showEvolutionArchives, setShowEvolutionArchives] = useState(false);
  const [newEvolutionTitle, setNewEvolutionTitle] = useState("");
  const [newEvolutionBody, setNewEvolutionBody] = useState("");
  const [evolutionReplyInput, setEvolutionReplyInput] = useState("");
  const [onlineMembersCount, setOnlineMembersCount] = useState(1);
  const [onlineMemberEmails, setOnlineMemberEmails] = useState<Set<string>>(new Set());
  const [currentInfoLine, setCurrentInfoLine] = useState<{
    source: string;
    text: string;
    funPseudo?: string;
  } | null>(null);
  const [isInfoFading, setIsInfoFading] = useState(false);
  const infoPhaseRef = useRef<"system" | "fun">("system");
  const systemBurstRemainingRef = useRef(0);
  const systemIndexRef = useRef(0);
  const funTemplatePoolRef = useRef<string[]>([]);
  const funTemplateIndexRef = useRef(0);
  const funPseudoPoolRef = useRef<string[]>([]);
  const funPseudoIndexRef = useRef(0);

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
  const [suppressChatBadge, setSuppressChatBadge] = useState(false);

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
  const [venueEditorEventId, setVenueEditorEventId] = useState<string | null>(null);
  const [venueEditorValue, setVenueEditorValue] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (!requestedTab) return;
    const allowedTabs = new Set(["events", "proposition", "chat", "results", "members"]);
    if (!allowedTabs.has(requestedTab)) return;
    setTab((prev) => (prev === requestedTab ? prev : requestedTab));
  }, []);

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
      setOnlineMemberEmails(onlineEmails);
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
      setChatReadAt((current) => {
        if (!ts) return current;
        if (!current) return ts;
        return ts > current ? ts : current;
      });
    });
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) {
      setEvolutionReadByRequest({});
      setEvolutionReadsLoaded(false);
      return;
    }
    const firestore = getFirestore();
    if (!firestore) return;

    return onSnapshot(doc(firestore, "evolutionReads", user.email), (snap) => {
      const data = snap.data();
      const readMap = (data?.requestReadAt || {}) as Record<string, any>;
      setEvolutionReadByRequest((current) => {
        const next = { ...current };
        Object.entries(readMap).forEach(([requestId, rawValue]) => {
          const incoming = rawValue?.toDate?.() || null;
          if (!incoming) return;
          const existing = next[requestId];
          if (!existing || incoming > existing) {
            next[requestId] = incoming;
          }
        });
        return next;
      });
      setEvolutionReadsLoaded(true);
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
    if (tab !== "chat" || chatView !== "evolution" || !selectedEvolutionId) return;
    markEvolutionRequestAsRead(selectedEvolutionId);
  }, [tab, chatView, selectedEvolutionId, evolutionRequests.length, evolutionReplies.length]);

  useEffect(() => {
    if (tab === "chat") {
      setChatView("chat");
      setShowEvolutionArchives(false);
      setSuppressChatBadge(false);
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "chat" || chatView !== "chat") return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tab, chatView, chatMessages.length]);

  useEffect(() => {
    if (tab !== "chat" || chatView !== "evolution") return;
    const el = evolutionScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tab, chatView, selectedEvolutionId, evolutionReplies.length]);

  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    const q = query(collection(firestore, "evolutionRequests"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvolutionRequests(data);
      if (data.length === 0) {
        setSelectedEvolutionId(null);
        return;
      }
      const firstOpen = data.find((item: any) => (item.status || "en-cours") === "en-cours");
      if (!selectedEvolutionId || !data.some((item: any) => item.id === selectedEvolutionId)) {
        setSelectedEvolutionId((firstOpen || data[0]).id);
      }
    });
  }, [selectedEvolutionId]);

  useEffect(() => {
    if (chatView !== "evolution") return;
    const list = evolutionRequests.filter((request: any) => {
      const status = request.status || "en-cours";
      return showEvolutionArchives ? status !== "en-cours" : status === "en-cours";
    });
    if (list.length === 0) {
      setSelectedEvolutionId(null);
      return;
    }
    const existsInCurrentList = list.some((item: any) => item.id === selectedEvolutionId);
    if (!existsInCurrentList) {
      setSelectedEvolutionId(list[0].id);
    }
  }, [chatView, evolutionRequests, selectedEvolutionId, showEvolutionArchives]);

  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    const q = query(collection(firestore, "evolutionReplies"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      setEvolutionReplies(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  const updateEventVenueHost = async (eventId: string, venueHostEmail: string | null) => {
    if (!eventId) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "events", eventId),
      { venueHostEmail: venueHostEmail || null },
      { merge: true }
    );
  };

  const openVenueEditor = (event: any) => {
    if (!event?.id) return;
    setVenueEditorEventId(event.id);
    setVenueEditorValue(event.venueHostEmail || "");
  };

  const closeVenueEditor = () => {
    setVenueEditorEventId(null);
    setVenueEditorValue("");
  };

  const saveVenueEditor = async () => {
    if (!venueEditorEventId) return;
    await updateEventVenueHost(venueEditorEventId, venueEditorValue || null);
    closeVenueEditor();
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

    // Optimistic local read mark to avoid temporary badge flicker.
    setChatReadAt(new Date());

    await setDoc(
      doc(firestore, "chatReads", user.email),
      {
        userEmail: user.email,
        lastReadAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const markEvolutionRequestAsRead = async (requestId: string) => {
    if (!requestId) return;
    if (!user?.email) return;
    const firestore = getFirestore();
    if (!firestore) return;

    // Optimistic local read mark to avoid temporary badge flicker.
    const now = new Date();
    setEvolutionReadByRequest((current) => {
      const existing = current[requestId];
      if (existing && existing > now) return current;
      return { ...current, [requestId]: now };
    });

    await setDoc(
      doc(firestore, "evolutionReads", user.email),
      {
        userEmail: user.email,
        requestReadAt: {
          [requestId]: serverTimestamp(),
        },
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

  const removeMessage = async (messageId: string, messageUser: string) => {
    const canDelete = userRole === "admin" || userRole === "superAdmin" || messageUser === user?.email;
    if (!canDelete) return;
    const firestore = getFirestore();
    if (!firestore) return;
    await deleteDoc(doc(firestore, "chat", messageId));
  };

  const createEvolutionRequest = async () => {
    if (!user?.email || !newEvolutionTitle.trim() || !newEvolutionBody.trim()) return;
    const firestore = getFirestore();
    if (!firestore) return;

    const created = await addDoc(collection(firestore, "evolutionRequests"), {
      title: newEvolutionTitle.trim(),
      body: newEvolutionBody.trim(),
      createdBy: user.email,
      status: "en-cours",
      createdAt: serverTimestamp(),
    });

    setNewEvolutionTitle("");
    setNewEvolutionBody("");
    setSelectedEvolutionId(created.id);
    await markEvolutionRequestAsRead(created.id);
  };

  const sendEvolutionReply = async () => {
    if (!user?.email || !selectedEvolutionId || !evolutionReplyInput.trim()) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await addDoc(collection(firestore, "evolutionReplies"), {
      requestId: selectedEvolutionId,
      text: evolutionReplyInput.trim(),
      user: user.email,
      createdAt: serverTimestamp(),
    });

    setEvolutionReplyInput("");
    await markEvolutionRequestAsRead(selectedEvolutionId);
  };

  const deleteEvolutionRequest = async (requestId: string) => {
    if (userRole !== "admin" && userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await deleteDoc(doc(firestore, "evolutionRequests", requestId));
    const repliesSnap = await getDocs(query(collection(firestore, "evolutionReplies"), where("requestId", "==", requestId)));
    await Promise.all(repliesSnap.docs.map((replyDoc) => deleteDoc(replyDoc.ref)));

    if (selectedEvolutionId === requestId) {
      setSelectedEvolutionId(null);
    }
  };

  const updateEvolutionRequestStatus = async (requestId: string, status: "non-retenu" | "en-cours" | "traite") => {
    if (userRole !== "superAdmin") return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(
      doc(firestore, "evolutionRequests", requestId),
      {
        status,
        closedAt: status === "non-retenu" || status === "traite" ? serverTimestamp() : null,
        statusUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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

  const participatedEvolutionRequestIds = useMemo(() => {
    if (!currentUserEmail) return new Set<string>();
    const requestIds = new Set<string>();
    evolutionRequests.forEach((request: any) => {
      if (request.createdBy === currentUserEmail) {
        requestIds.add(request.id);
      }
    });
    evolutionReplies.forEach((reply: any) => {
      if (reply.user === currentUserEmail && reply.requestId) {
        requestIds.add(reply.requestId);
      }
    });
    return requestIds;
  }, [currentUserEmail, evolutionReplies, evolutionRequests]);

  const evolutionUnreadByRequest = useMemo(() => {
    const unreadByRequest = new Map<string, number>();
    if (!currentUserEmail || participatedEvolutionRequestIds.size === 0 || !evolutionReadsLoaded) {
      return unreadByRequest;
    }

    evolutionRequests.forEach((request: any) => {
      if (!participatedEvolutionRequestIds.has(request.id)) return;
      if (request.createdBy === currentUserEmail) return;
      const createdAt = request.createdAt?.toDate?.();
      if (!createdAt) return;
      const readAt = evolutionReadByRequest[request.id] || null;
      if (readAt && createdAt <= readAt) return;
      unreadByRequest.set(request.id, (unreadByRequest.get(request.id) || 0) + 1);
    });

    evolutionReplies.forEach((reply: any) => {
      if (!reply?.requestId) return;
      if (!participatedEvolutionRequestIds.has(reply.requestId)) return;
      if (reply.user === currentUserEmail) return;
      const createdAt = reply.createdAt?.toDate?.();
      if (!createdAt) return;
      const readAt = evolutionReadByRequest[reply.requestId] || null;
      if (readAt && createdAt <= readAt) return;
      unreadByRequest.set(reply.requestId, (unreadByRequest.get(reply.requestId) || 0) + 1);
    });

    return unreadByRequest;
  }, [
    currentUserEmail,
    evolutionReadsLoaded,
    evolutionReadByRequest,
    evolutionReplies,
    evolutionRequests,
    participatedEvolutionRequestIds,
  ]);

  const evolutionUnreadCount = useMemo(() => {
    let total = 0;
    evolutionUnreadByRequest.forEach((count) => {
      total += count;
    });
    return total;
  }, [evolutionUnreadByRequest]);

  const chatNotificationCount = unreadCount + evolutionUnreadCount;

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
  const isPresentInUpcomingEvent = currentUserEmail
    ? upcomingEvents.some((event: any) => votes[event.id]?.[currentUserEmail] === "present")
    : false;

  const systemInfoItems = useMemo(() => {
    return [
      upcomingEvents.length > 0 && isPresentInUpcomingEvent
        ? {
            source: upcomingEvents.length > 1 ? "Parties" : "Partie",
            text: `${upcomingEvents.length} date${upcomingEvents.length > 1 ? "s" : ""} a venir`,
          }
        : null,
      pendingForMeCount > 0
        ? {
            source: pendingForMeCount > 1 ? "Propositions" : "Proposition",
            text: `${pendingForMeCount} en attente`,
          }
        : null,
      mentionCount > 0
        ? {
            source: "Chat",
            text: `${mentionCount} mention${mentionCount > 1 ? "s" : ""} @`,
          }
        : null,
      unreadCount > 0
        ? {
            source: "Chat",
            text: `${unreadCount} non lu${unreadCount > 1 ? "s" : ""}`,
          }
        : null,
      otherOnlineCount > 0
        ? {
            source: "Membres",
            text:
              otherOnlineCount === 1
                ? "1 autre Pilote est en ligne"
                : `${otherOnlineCount} autres Pilotes sont en ligne`,
          }
        : null,
    ].filter(Boolean) as Array<{ source: string; text: string }>;
  }, [
    upcomingEvents.length,
    isPresentInUpcomingEvent,
    pendingForMeCount,
    mentionCount,
    unreadCount,
    otherOnlineCount,
  ]);

  const eligibleFunPseudos = useMemo(() => {
    return members
      .map((member: any) => String(member?.pseudo || "").trim())
      .filter((pseudo) => pseudo.length > 0 && !pseudo.includes("@"));
  }, [members]);

  const normalizeEvolutionStatus = (status: string | undefined) => {
    if (status === "non-retenu" || status === "traite" || status === "en-cours") return status;
    return "en-cours";
  };

  const getEvolutionStatusMeta = (status: string | undefined) => {
    const normalized = normalizeEvolutionStatus(status);
    if (normalized === "non-retenu") {
      return {
        label: "Non retenu",
        badgeClass: "border-[#d31f28]/60 bg-[#d31f28]/15 text-[#ff7b82]",
      };
    }
    if (normalized === "traite") {
      return {
        label: "Traite",
        badgeClass: "border-[#409b48]/60 bg-[#409b48]/15 text-[#7bd085]",
      };
    }
    return {
      label: "En cours",
      badgeClass: "border-[#f59e0b]/60 bg-[#f59e0b]/15 text-[#ffd089]",
    };
  };

  const activeEvolutionRequests = useMemo(
    () => evolutionRequests.filter((request: any) => normalizeEvolutionStatus(request.status) === "en-cours"),
    [evolutionRequests]
  );

  const archivedEvolutionRequests = useMemo(
    () => evolutionRequests.filter((request: any) => normalizeEvolutionStatus(request.status) !== "en-cours"),
    [evolutionRequests]
  );

  const visibleEvolutionRequests = showEvolutionArchives ? archivedEvolutionRequests : activeEvolutionRequests;

  const archivedEvolutionUnreadCount = useMemo(() => {
    let total = 0;
    archivedEvolutionRequests.forEach((request: any) => {
      total += evolutionUnreadByRequest.get(request.id) || 0;
    });
    return total;
  }, [archivedEvolutionRequests, evolutionUnreadByRequest]);

  const topEvolutionContributors = useMemo(() => {
    const counts = new Map<string, number>();
    evolutionRequests.forEach((request: any) => {
      const email = request.createdBy || "";
      if (!email) return;
      counts.set(email, (counts.get(email) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([email, count]) => ({ email, count }));
  }, [evolutionRequests]);

  const contributorMedals = ["🥇", "🥈", "🥉"];

  const venueEditorEvent = useMemo(() => {
    if (!venueEditorEventId) return null;
    return upcomingEvents.find((event: any) => event.id === venueEditorEventId) || null;
  }, [upcomingEvents, venueEditorEventId]);

  const venueEditorPresentMembers = useMemo(() => {
    if (!venueEditorEvent) return [];
    const eventVotes = votes[venueEditorEvent.id] || {};
    return members.filter((member) => eventVotes[member.email] === "present");
  }, [members, votes, venueEditorEvent]);

  const navItems = [
    { key: "events", label: "Parties", icon: CalendarDays },
    { key: "proposition", label: "Propositions", icon: ClipboardList },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "results", label: "Resultats", icon: Trophy },
    { key: "members", label: "Pilotes", icon: Users },
  ];

  const resultsCategories = [
    {
      key: "team-s2-2026-2027",
      title: "Championnat Équipe Saison 2 - 2026 / 2027",
      status: "En cours",
      statusClass: "border-[#78de86]/45 bg-[#409b48]/72 text-white",
      image:
        "https://cdn.discordapp.com/attachments/1068885680568148019/1495199476682457249/FD1.png?ex=69e56086&is=69e40f06&hm=6d8080959f88b13dca33d35e1fbd302ced8319d366623342aa0a293037be5c82&",
      imagePosition: "50% 38%",
      href: "/dashboard/results/team-s2-2026-2027",
    },
    {
      key: "individual-s1-2024-2026",
      title: "Championnat Individuel Saison 1 - 2024 / 2026",
      status: "En cours",
      statusClass: "border-[#78de86]/45 bg-[#409b48]/72 text-white",
      image:
        "https://cdn.discordapp.com/attachments/1068885680568148019/1495199499360927744/FD2.png?ex=69e5608c&is=69e40f0c&hm=2dcbb39083245c6e7d77dfe1924ebbb9d79228f9cbef9d23e1224df7ff13286a&",
      imagePosition: "50% 44%",
      href: "/dashboard/results/individual-s1-2024-2026",
    },
    {
      key: "team-s1-2024-2025",
      title: "Championnat Équipe Saison 1 - 2024 / 2025",
      status: "Terminé",
      statusClass: "border-white/25 bg-black/74 text-[#ff4a52]",
      image:
        "https://cdn.discordapp.com/attachments/1068885680568148019/1495199525089054731/FD3.png?ex=69e56092&is=69e40f12&hm=2160f83b6b67f694871d11f10b803a05baa425fcaa28daf4382100c06ee9f622&",
      imagePosition: "50% 42%",
      href: "/dashboard/results/team-s1-2024-2025",
    },
    {
      key: "team-s0-2015-2017",
      title: "Championnat Équipe Saison 0 - 2015 / 2017",
      status: "Terminé",
      statusClass: "border-white/25 bg-black/74 text-[#ff4a52]",
      image:
        "https://cdn.discordapp.com/attachments/1068885680568148019/1495199545888477417/FD4.png?ex=69e56097&is=69e40f17&hm=45c81c3fa167bdcfa359b292a63165548bd1df5095dcc1cba030d9c8ce4d9e52&",
      imagePosition: "50% 46%",
      href: "/dashboard/results/team-s0-2015-2017",
    },
  ];

  const renderResultsTitle = (title: string) => {
    const segments = title.split(/(Championnat|Équipe|Individuel|Saison\s+\d+|-\s*\d{4}\s*\/\s*\d{4}|\d{4}\s*\/\s*\d{4})/g).filter(Boolean);

    return segments.map((segment, index) => {
      if (segment === "Championnat") {
        return (
          <span
            key={`${segment}-${index}`}
            className="text-white/50 tracking-[0.06em] [font-variation-settings:'wght'_700]"
          >
            {segment}
          </span>
        );
      }

      if (segment === "Équipe" || segment === "Individuel") {
        return (
          <span
            key={`${segment}-${index}`}
            className="relative inline-block bg-gradient-to-r from-white via-[#d8e2ff] to-white bg-clip-text text-transparent [text-shadow:0_0_18px_rgba(255,255,255,0.2)] after:absolute after:-bottom-[2px] after:left-0 after:h-[2px] after:w-full after:origin-left after:bg-gradient-to-r after:from-white/70 after:via-white/25 after:to-transparent"
          >
            {segment}
          </span>
        );
      }

      if (/^Saison\s+\d+$/.test(segment)) {
        return (
          <span
            key={`${segment}-${index}`}
            className="relative inline-block bg-gradient-to-r from-[#ff8a90] via-[#ff5961] to-[#ff8a90] bg-clip-text text-transparent [text-shadow:0_0_16px_rgba(211,31,40,0.35)] after:absolute after:-bottom-[2px] after:left-0 after:h-[2px] after:w-full after:origin-left after:bg-gradient-to-r after:from-[#d31f28]/85 after:via-[#ff5961]/40 after:to-transparent"
          >
            {segment}
          </span>
        );
      }

      if (/^-\s*\d{4}\s*\/\s*\d{4}$/.test(segment) || /^\d{4}\s*\/\s*\d{4}$/.test(segment)) {
        return (
          <span
            key={`${segment}-${index}`}
            className="relative inline-block text-white/45 tracking-[0.06em] [font-variant-numeric:tabular-nums] after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-px after:bg-white/18"
          >
            {segment}
          </span>
        );
      }

      return <span key={`${segment}-${index}`} className="text-white/88">{segment}</span>;
    });
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === "chat") {
      // Avoid transient badge flicker while read state syncs.
      setSuppressChatBadge(true);
      setChatReadAt(new Date());
      setUnreadCount(0);
      void markChatAsRead();
    } else {
      setSuppressChatBadge(false);
    }
    setTab(nextTab);
  };

  useEffect(() => {
    const shuffle = <T,>(list: T[]) => {
      const clone = [...list];
      for (let i = clone.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
      }
      return clone;
    };

    const systemCount = systemInfoItems.length;
    const funPseudoCount = eligibleFunPseudos.length;
    const hasSystem = systemCount > 0;
    const hasFun = funPseudoCount > 0;

    if (!hasSystem && !hasFun) {
      setCurrentInfoLine(null);
      setIsInfoFading(false);
      return;
    }

    infoPhaseRef.current = hasSystem ? "system" : "fun";
    systemBurstRemainingRef.current = 0;
    systemIndexRef.current = 0;
    funTemplatePoolRef.current = shuffle(FUN_INFO_TEMPLATES);
    funTemplateIndexRef.current = 0;
    funPseudoPoolRef.current = shuffle(eligibleFunPseudos);
    funPseudoIndexRef.current = 0;

    const nextFunLine = () => {
      if (!hasFun) return null;

      if (funTemplateIndexRef.current >= funTemplatePoolRef.current.length) {
        funTemplatePoolRef.current = shuffle(FUN_INFO_TEMPLATES);
        funTemplateIndexRef.current = 0;
      }

      if (funPseudoIndexRef.current >= funPseudoPoolRef.current.length) {
        funPseudoPoolRef.current = shuffle(eligibleFunPseudos);
        funPseudoIndexRef.current = 0;
      }

      const template = funTemplatePoolRef.current[funTemplateIndexRef.current];
      const pseudo = funPseudoPoolRef.current[funPseudoIndexRef.current];
      funTemplateIndexRef.current += 1;
      funPseudoIndexRef.current += 1;

      return {
        source: "",
        text: template.replace("[Pseudo]", pseudo),
        funPseudo: pseudo,
      };
    };

    const nextSystemLine = () => {
      if (!hasSystem) return null;

      if (systemBurstRemainingRef.current <= 0) {
        const randomBurst = 1 + Math.floor(Math.random() * 2);
        systemBurstRemainingRef.current = Math.min(randomBurst, systemCount);
      }

      const line = systemInfoItems[systemIndexRef.current % systemCount];
      systemIndexRef.current = (systemIndexRef.current + 1) % systemCount;
      systemBurstRemainingRef.current -= 1;

      if (systemBurstRemainingRef.current <= 0 && hasFun) {
        infoPhaseRef.current = "fun";
      }

      return line;
    };

    const getNextInfoLine = () => {
      if (infoPhaseRef.current === "fun" && hasFun) {
        const line = nextFunLine();
        infoPhaseRef.current = hasSystem ? "system" : "fun";
        return line;
      }

      const systemLine = nextSystemLine();
      if (systemLine) return systemLine;

      return nextFunLine();
    };

    setCurrentInfoLine(getNextInfoLine());
    setIsInfoFading(false);

    const canRotate =
      (hasSystem && hasFun) ||
      (hasSystem && systemCount > 1) ||
      (hasFun && (FUN_INFO_TEMPLATES.length > 1 || funPseudoCount > 1));

    if (!canRotate) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setIsInfoFading(true);
      window.setTimeout(() => {
        setCurrentInfoLine(getNextInfoLine());
        setIsInfoFading(false);
      }, 240);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [eligibleFunPseudos, systemInfoItems]);

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

  const openReleaseNotes = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("fd_release_notes_access", "granted");
    }
    router.push("/dashboard/versions");
  };

  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      {/* F1 top accent bar */}
      <div className="h-1 w-full bg-[#d31f28]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-40 sm:pb-20">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setTab("events")}
              aria-label="Aller aux Parties"
              className="shrink-0"
            >
              <img
                src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
                alt="Formula D"
                className="h-7 sm:h-14 w-auto object-contain"
              />
            </button>

            <div className="info-laser-border h-14 flex-1 min-w-0 max-w-[640px] bg-[#010d1e] px-3 sm:px-4 flex items-center overflow-hidden py-0 sm:py-0">
              {!currentInfoLine ? (
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-500">Aucune info urgente</p>
              ) : (
                <div className={`w-full transition-opacity duration-300 ${isInfoFading ? "opacity-0" : "opacity-100"}`}>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-200 leading-4 whitespace-normal break-words">
                    {currentInfoLine?.funPseudo ? (
                      <>
                        <span className="text-[#d31f28] mr-1">{currentInfoLine.funPseudo}</span>
                        {currentInfoLine.text.slice(currentInfoLine.funPseudo.length)}
                      </>
                    ) : (
                      <>
                        <span className="text-[#d31f28] mr-2">{currentInfoLine?.source}</span>
                        {currentInfoLine?.text}
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <div className="relative w-fit">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-9 h-9 sm:w-14 sm:h-14 rounded-[2px] p-[2px] bg-black transition"
              >
                <div className="w-full h-full rounded-[2px] overflow-hidden bg-[#d31f28] [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)] flex items-center justify-center">
                  {profile.avatar ? (
                    <div
                      aria-label="Avatar"
                      className="w-full h-full rounded-[inherit] bg-center bg-cover"
                      style={{ backgroundImage: `url("${profile.avatar}")` }}
                    />
                  ) : (
                    <svg className="w-6 h-6 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  )}
                </div>
              </button>
              <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 p-0.5 flex items-center justify-center pointer-events-none">
                <svg className="w-2 h-2 sm:w-3 sm:h-3 text-white/85 mix-blend-difference" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-[#001122] border border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-[2px] p-[2px] bg-black">
                        <div className="w-full h-full bg-[#d31f28] rounded-[2px] flex items-center justify-center overflow-hidden [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)]">
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
          <section className={`border border-white/10 bg-[#010d1e] ${tab === "chat" ? "px-0 py-4 sm:p-6" : "p-4 sm:p-6"}`}>
            <div className={`flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10 mb-6 ${tab === "chat" ? "px-3 sm:px-0" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-[#d31f28]" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                  {tab === "events" && <>Parties a venir — <span className="text-[#d31f28]">{nextEventDays !== null ? `J-${nextEventDays}` : "—"}</span></>}
                  {tab === "proposition" && <>Propositions de dates</>}
                  {tab === "chat" && <>{chatView === "evolution" ? "Evolution Appli" : "Chat"}</>}
                  {tab === "results" && <>Resultats</>}
                  {tab === "members" && <>Participants</>}
                </p>
              </div>
              {tab === "chat" && (
                <button
                  type="button"
                  onClick={() => setChatView(chatView === "chat" ? "evolution" : "chat")}
                  className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${chatView === "chat" ? "border-[#d31f28] bg-[#d31f28] text-white hover:bg-[#b81d23]" : "border-white/20 text-gray-200 hover:text-white hover:border-white/40"}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {chatView === "chat" ? "Evolution Appli" : "← Retour Chat"}
                    {chatView === "chat" && evolutionUnreadCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#8b0f15] px-1.5 py-0.5 text-[9px] font-black text-white">
                        {evolutionUnreadCount}
                      </span>
                    )}
                  </span>
                </button>
              )}
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
                    const venueHostLabel = event.venueHostEmail ? getPseudo(event.venueHostEmail) : null;

                    return (
                      <div key={event.id} className="border-l-4 border-[#d31f28] bg-white/5 border border-white/10 p-4 sm:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-[0.3em] font-bold">Session validée</p>
                            <h3 className="text-xl font-black uppercase text-white mt-1">{event.title}</h3>
                            <div className="mt-2 flex items-center gap-2">
                              <p className="text-sm uppercase tracking-[0.16em] text-gray-300">
                                <span className="text-gray-500">Lieu :</span>{" "}
                                {venueHostLabel ? (
                                  <>
                                    Chez <span className="text-white font-bold">{venueHostLabel}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400">a definir</span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => openVenueEditor(event)}
                                className="inline-flex h-6 w-6 items-center justify-center border border-white/20 text-gray-300 transition hover:border-white/40 hover:text-white"
                                aria-label="Configurer le lieu"
                                title="Configurer le lieu"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
              <div className="space-y-2 sm:space-y-3">
                {resultsCategories.map((category) => (
                  <Link
                    key={category.key}
                    href={category.href}
                    className="group relative block overflow-hidden rounded-[6px]"
                  >
                    <div className="relative min-h-[96px] sm:min-h-[126px]">
                      <img
                        src={category.image}
                        alt={category.title}
                        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                        style={{ objectPosition: category.imagePosition }}
                      />
                      <div className="absolute inset-x-0 bottom-0 h-[84%] sm:h-[72%] bg-gradient-to-t from-[#00050d]/90 via-[#00050d]/56 to-transparent transition group-hover:from-[#00050d]/82 group-hover:via-[#00050d]/46" />

                      <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">
                        <span className={`relative block -skew-x-[18deg] overflow-hidden border px-2.5 py-1 shadow-[0_10px_22px_rgba(0,0,0,0.45)] backdrop-blur-[6px] sm:px-3.5 sm:py-1.5 ${category.statusClass}`}>
                          <span className="absolute inset-0 bg-gradient-to-r from-white/24 via-white/0 to-black/22" aria-hidden="true" />
                          <span className="relative z-10 flex items-center gap-1.5 skew-x-[18deg]">
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-95" aria-hidden="true" />
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] [font-variant-numeric:tabular-nums] sm:text-[10px] sm:tracking-[0.2em]">
                              {category.status}
                            </span>
                          </span>
                        </span>
                      </div>

                      <div className="relative z-10 flex min-h-[96px] sm:min-h-[126px] items-end p-2.5 sm:p-3.5">
                        <div className="pr-[4.5rem] sm:pr-[6rem] max-w-full">
                          <p className="text-[11px] sm:text-[14px] font-black uppercase tracking-[0.16em] sm:tracking-[0.19em] text-[#ff5961]">Resultats</p>
                          <h3 className="mt-1 text-[16px] sm:text-[28px] font-black uppercase tracking-[0.02em] sm:tracking-[0.04em] text-white leading-[1.08] break-words">
                            {renderResultsTitle(category.title)}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
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
                      <div className="w-12 h-12 rounded-[2px] p-[2px] bg-black flex-shrink-0">
                        <div className="w-full h-full rounded-[2px] overflow-hidden bg-[#d31f28] [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)] flex items-center justify-center">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.pseudo || m.email} className="w-full h-full object-cover rounded-[inherit]" />
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${onlineMemberEmails.has(m.email) ? "bg-[#22c55e]" : "bg-[#d31f28]"}`}
                              title={onlineMemberEmails.has(m.email) ? "En ligne" : "Hors ligne"}
                              aria-label={onlineMemberEmails.has(m.email) ? "En ligne" : "Hors ligne"}
                            />
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
              <div className="space-y-3 sm:space-y-4">
                {chatView === "chat" && (
                  <>
                    <div ref={chatScrollRef} className="border-y border-white/10 sm:border bg-[#010d1e] p-2 sm:p-6 max-h-[50vh] sm:max-h-[44vh] overflow-y-auto overflow-x-hidden">
                      {chatMessages.length === 0 ? (
                        <p className="text-xs uppercase tracking-widest text-gray-500">Pas encore de messages. Lancez la discussion.</p>
                      ) : (
                        chatMessages
                          .filter((m) => !m.parentId)
                          .map((m) => {
                            const replies = chatMessages.filter((r) => r.parentId === m.id);
                            return (
                              <div key={m.id} className="mb-3 sm:mb-4 border-l-2 border-white/10 pl-2 sm:pl-3">
                                <div className="flex items-start justify-between gap-2 sm:gap-3">
                                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.13em] sm:tracking-[0.15em] text-gray-500 mb-1">
                                    {getPseudo(m.user)} · {formatChatTime(m.createdAt)}
                                    {m.editedAt ? " · modifie" : ""}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setReplyToMessageId(m.id)}
                                      title="Repondre"
                                      aria-label="Repondre"
                                      className="group relative p-1 text-gray-500 hover:text-white transition"
                                    >
                                      <Reply className="h-3.5 w-3.5" />
                                      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                        Repondre
                                      </span>
                                    </button>
                                    {isChatManager && (
                                      <button
                                        onClick={() => startEditMessage(m)}
                                        title="Editer"
                                        aria-label="Editer"
                                        className="group relative p-1 text-gray-500 hover:text-white transition"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                          Editer
                                        </span>
                                      </button>
                                    )}
                                    {(isChatManager || m.user === currentUserEmail) && (
                                      <button
                                        onClick={() => removeMessage(m.id, m.user)}
                                        title="Supprimer"
                                        aria-label="Supprimer"
                                        className="group relative p-1 text-[#d31f28] hover:text-[#ff4c55] transition"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                          Supprimer
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-200 text-[13px] sm:text-sm whitespace-pre-wrap break-words">{renderTextWithMentions(m.text || "")}</p>

                                {replies.length > 0 && (
                                  <div className="mt-2.5 ml-2 sm:mt-3 sm:ml-3 space-y-2 border-l border-white/10 pl-2 sm:pl-3">
                                    {replies.map((reply) => (
                                      <div key={reply.id} className="bg-black/30 border border-white/10 px-2 py-2 sm:px-3">
                                        <div className="mb-1 flex items-start justify-between gap-1.5 sm:gap-2">
                                          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.13em] sm:tracking-[0.15em] text-gray-500">
                                            {getPseudo(reply.user)} · {formatChatTime(reply.createdAt)}
                                            {reply.editedAt ? " · modifie" : ""}
                                          </p>
                                          <div className="flex items-center gap-1">
                                            {isChatManager && (
                                              <button
                                                onClick={() => startEditMessage(reply)}
                                                title="Editer"
                                                aria-label="Editer"
                                                className="group relative p-1 text-gray-500 hover:text-white transition"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                                  Editer
                                                </span>
                                              </button>
                                            )}
                                            {(isChatManager || reply.user === currentUserEmail) && (
                                              <button
                                                onClick={() => removeMessage(reply.id, reply.user)}
                                                title="Supprimer"
                                                aria-label="Supprimer"
                                                className="group relative p-1 text-[#d31f28] hover:text-[#ff4c55] transition"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                                  Supprimer
                                                </span>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-[13px] sm:text-sm text-gray-200 whitespace-pre-wrap break-words">{renderTextWithMentions(reply.text || "")}</p>
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
                      <p className="px-2 sm:px-0 text-[11px] text-gray-500 uppercase tracking-widest">{formatTypingLabel()}</p>
                    )}

                    {replyToMessageId && (
                      <div className="mx-2 sm:mx-0 border border-[#d31f28]/40 bg-[#d31f28]/10 px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
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
                      <div className="mx-2 sm:mx-0 border border-white/20 bg-black/30 p-3 space-y-3">
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

                    <div className="px-2 sm:px-0 flex flex-col sm:flex-row gap-3">
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
                        className="flex-1 border border-white/20 bg-transparent px-3 sm:px-5 py-3 text-white text-sm outline-none focus:border-[#d31f28] transition"
                        placeholder="Ecrire un message... (utilisez @pseudo)"
                      />
                      <button
                        onClick={sendChat}
                        className="w-full sm:w-auto bg-[#d31f28] px-6 sm:px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-[#b81d23] transition"
                      >
                        Envoyer
                      </button>
                    </div>
                  </>
                )}

                {chatView === "evolution" && (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                    <div className="space-y-4">
                      <div className="border border-white/10 bg-black/30 p-4 space-y-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Nouvelle demande</p>
                        <input
                          value={newEvolutionTitle}
                          onChange={(e) => setNewEvolutionTitle(e.target.value)}
                          className="w-full border border-white/20 bg-transparent px-3 py-2 text-white text-sm outline-none focus:border-[#d31f28] transition"
                          placeholder="Titre"
                        />
                        <textarea
                          value={newEvolutionBody}
                          onChange={(e) => setNewEvolutionBody(e.target.value)}
                          className="w-full min-h-28 border border-white/20 bg-transparent px-3 py-2 text-white text-sm outline-none focus:border-[#d31f28] transition"
                          placeholder="Detaille ta demande d'evolution..."
                        />
                        <button
                          onClick={createEvolutionRequest}
                          className="w-full bg-[#d31f28] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#b81d23] transition"
                        >
                          Ouvrir une demande
                        </button>
                      </div>

                      <div className="border border-white/10 bg-black/30 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Contributeurs</p>
                          <button
                            type="button"
                            onClick={() => setShowEvolutionArchives((current) => !current)}
                            className={`w-full sm:w-auto border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] whitespace-normal break-words text-center transition ${showEvolutionArchives ? "border-[#d31f28]/60 bg-[#d31f28]/15 text-white" : "border-white/20 text-gray-300 hover:text-white hover:border-white/40"}`}
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              {showEvolutionArchives ? "Retour demandes" : "Archives"}
                              {!showEvolutionArchives && archivedEvolutionUnreadCount > 0 && (
                                <span
                                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#d31f28] px-1 py-[1px] text-[9px] font-black text-white"
                                  aria-label={`Notification ${archivedEvolutionUnreadCount}`}
                                  title={`Notification ${archivedEvolutionUnreadCount}`}
                                >
                                  {archivedEvolutionUnreadCount}
                                </span>
                              )}
                            </span>
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {topEvolutionContributors.length === 0 ? (
                            <p className="text-[11px] uppercase tracking-widest text-gray-500">Pas encore de statistiques.</p>
                          ) : (
                            topEvolutionContributors.map((item, index) => (
                              <div key={item.email} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border border-white/10 bg-[#010d1e] px-3 py-2">
                                <p className="text-xs text-gray-200 whitespace-normal break-words">
                                  {contributorMedals[index] ? <span className="mr-2">{contributorMedals[index]}</span> : null}
                                  {getPseudo(item.email)}
                                </p>
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 whitespace-normal break-words">{item.count} demande{item.count > 1 ? "s" : ""}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="border border-white/10 bg-black/30 max-h-[45vh] overflow-y-auto">
                        {visibleEvolutionRequests.length === 0 ? (
                          <p className="p-4 text-[11px] uppercase tracking-widest text-gray-500">
                            {showEvolutionArchives ? "Aucune archive." : "Aucune demande en cours."}
                          </p>
                        ) : (
                          visibleEvolutionRequests.map((request: any) => {
                            const replyCount = evolutionReplies.filter((r: any) => r.requestId === request.id).length;
                            const exchangeCount = replyCount + 1;
                            const selected = selectedEvolutionId === request.id;
                            const statusMeta = getEvolutionStatusMeta(request.status);
                            const requestUnreadCount = evolutionUnreadByRequest.get(request.id) || 0;
                            return (
                              <button
                                key={request.id}
                                onClick={() => setSelectedEvolutionId(request.id)}
                                className={`w-full text-left px-4 py-3 border-b border-white/10 transition ${selected ? "bg-[#d31f28]/15" : "hover:bg-white/5"}`}
                              >
                                <p className="text-sm font-semibold text-white whitespace-normal break-words leading-5">{request.title}</p>
                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 whitespace-normal break-words">{exchangeCount} echange{exchangeCount > 1 ? "s" : ""}</p>
                                    {requestUnreadCount > 0 && (
                                      <span
                                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#d31f28] px-1 py-[1px] text-[9px] font-black text-white"
                                        aria-label={`Notification ${requestUnreadCount}`}
                                        title={`Notification ${requestUnreadCount}`}
                                      >
                                        {requestUnreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`w-fit border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] whitespace-normal break-words ${statusMeta.badgeClass}`}>
                                    {statusMeta.label}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="border border-white/10 bg-black/30 p-4 space-y-4 min-h-[240px]">
                      {selectedEvolutionId ? (
                        (() => {
                          const currentRequest = evolutionRequests.find((r: any) => r.id === selectedEvolutionId);
                          const replies = evolutionReplies.filter((r: any) => r.requestId === selectedEvolutionId);
                          const isArchivedRequest = currentRequest ? normalizeEvolutionStatus(currentRequest.status) !== "en-cours" : false;
                          if (!currentRequest) {
                            return <p className="text-[11px] uppercase tracking-widest text-gray-500">Selectionne une demande.</p>;
                          }

                          return (
                            <>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-[#d31f28]">Demande</p>
                                  <h3 className="text-lg font-black text-white mt-1">{currentRequest.title}</h3>
                                  <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">{getPseudo(currentRequest.createdBy)} · {formatChatTime(currentRequest.createdAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {userRole === "superAdmin" && (
                                    <select
                                      value={normalizeEvolutionStatus(currentRequest.status)}
                                      onChange={(e) => updateEvolutionRequestStatus(currentRequest.id, e.target.value as "non-retenu" | "en-cours" | "traite")}
                                      className="border border-white/20 bg-black/40 px-2 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white outline-none"
                                    >
                                      <option value="en-cours">En cours</option>
                                      <option value="non-retenu">Non retenu</option>
                                      <option value="traite">Traite</option>
                                    </select>
                                  )}
                                  {(userRole === "admin" || userRole === "superAdmin") && (
                                    <button
                                      onClick={() => deleteEvolutionRequest(currentRequest.id)}
                                      className="border border-[#d31f28]/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ff5b63] hover:bg-[#d31f28]/10"
                                    >
                                      Supprimer
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="border border-white/10 bg-[#010d1e] p-3">
                                <p className="text-sm text-gray-200 whitespace-pre-wrap">{currentRequest.body}</p>
                              </div>

                              <div ref={evolutionScrollRef} className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                                {replies.map((reply: any) => (
                                  <div key={reply.id} className="border border-white/10 bg-[#010d1e] px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{getPseudo(reply.user)} · {formatChatTime(reply.createdAt)}</p>
                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{reply.text}</p>
                                  </div>
                                ))}
                              </div>

                              {isArchivedRequest ? (
                                <div className="border border-white/10 bg-[#010d1e] px-4 py-3">
                                  <p className="text-[11px] uppercase tracking-[0.08em] sm:tracking-widest leading-5 whitespace-normal break-words text-gray-500">Discussion cloturee. Reponses desactivees. Je vous invite a creer une nouvelle demande</p>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <input
                                    value={evolutionReplyInput}
                                    onChange={(e) => setEvolutionReplyInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        sendEvolutionReply();
                                      }
                                    }}
                                    className="flex-1 border border-white/20 bg-transparent px-4 py-2 text-white text-sm outline-none focus:border-[#d31f28] transition"
                                    placeholder="Repondre a cette demande..."
                                  />
                                  <button
                                    onClick={sendEvolutionReply}
                                    className="bg-[#d31f28] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#b81d23]"
                                  >
                                    Repondre
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <p className="text-[11px] uppercase tracking-widest text-gray-500">Selectionne une demande dans la liste.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <nav className="border-t border-white/10 bg-[#000a18]/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-2 py-2">
            <div className="grid grid-cols-5 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabChange(item.key)}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 transition ${isActive ? "text-white" : "text-gray-500"}`}
                  >
                    <span className="relative inline-flex">
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#d31f28]" : "text-gray-500"}`} />
                      {item.key === "chat" && !suppressChatBadge && chatNotificationCount > 0 && (
                        <span
                          className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#d31f28] px-1 py-[1px] text-[9px] font-black text-white"
                          aria-label={`Notification ${chatNotificationCount}`}
                          title={`Notification ${chatNotificationCount}`}
                        >
                          {chatNotificationCount}
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 bg-[#000a18]/95">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 py-1.5">
            <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-[9px] sm:text-[10px] uppercase tracking-[0.12em]">
              <a
                href="https://www.jeuxavolonte.asso.fr/regles/formula_d.pdf"
                target="_blank"
                rel="noreferrer"
                className="text-white/40 hover:text-white/60 transition whitespace-normal break-words"
              >
                Regles du jeu
              </a>
              <span className="text-white/20">|</span>
              <a
                href="https://www.youtube.com/watch?v=n8ySi6tTb84"
                target="_blank"
                rel="noreferrer"
                aria-label="Video YouTube"
                title="Video YouTube"
                className="text-white/40 hover:text-white/60 transition inline-flex items-center"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M23.5 6.2a2.98 2.98 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A2.98 2.98 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 2.98 2.98 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a2.98 2.98 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.9 12l-6.3 3.6Z" />
                </svg>
              </a>
              <span className="text-white/20">|</span>
              <a
                href="https://boardgamearena.com/gamepanel?game=formulad"
                target="_blank"
                rel="noreferrer"
                className="text-white/40 hover:text-white/60 transition whitespace-normal break-words"
              >
                BGA (BoardGame Arena)
              </a>
              <span className="text-white/20">|</span>
              <a
                href="https://formuladworldchampionship.mydurable.com/"
                target="_blank"
                rel="noreferrer"
                className="text-white/40 hover:text-white/60 transition whitespace-normal break-words"
              >
                FDWC (Formula D World Championship)
              </a>
              <span className="text-white/20">|</span>
              <button
                type="button"
                onClick={openReleaseNotes}
                className="text-[8px] sm:text-[9px] font-medium tracking-[0.28em] text-white/28 hover:text-white/45 transition whitespace-normal break-words"
              >
                AB 2026 v1
              </button>
            </div>
          </div>
        </div>
      </div>

      {venueEditorEventId && venueEditorEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md border border-white/20 bg-[#001122] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Configuration du lieu</p>
                <p className="mt-1 text-sm text-white">{venueEditorEvent.title}</p>
              </div>
              <button
                type="button"
                onClick={closeVenueEditor}
                className="border border-white/20 px-2 py-1 text-xs uppercase tracking-[0.14em] text-gray-300 hover:border-white/40 hover:text-white"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-gray-400">Chez qui</label>
              <select
                value={venueEditorValue}
                onChange={(e) => setVenueEditorValue(e.target.value)}
                disabled={venueEditorPresentMembers.length === 0}
                className="w-full border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">A definir</option>
                {venueEditorPresentMembers.map((member: any) => (
                  <option key={member.email} value={member.email}>
                    Chez {getPseudo(member.email)}
                  </option>
                ))}
              </select>
              {venueEditorPresentMembers.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">Aucun pilote present pour cette partie.</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeVenueEditor}
                className="border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-gray-300 hover:border-white/40 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveVenueEditor}
                className="bg-[#d31f28] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#b81d23]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

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
