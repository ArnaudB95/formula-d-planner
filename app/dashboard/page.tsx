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
import { CalendarDays, ClipboardList, MessageCircle, Pencil, Reply, Trash2, Trophy, Users, Route, Gamepad2 } from "lucide-react";
import SimuF1Panel from "./simuf1/SimuF1Panel";
import { applyTeamNameRetroactively } from "./simuf1/firestore";

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

const TEAM_S1_RACES = [
  { key: "E01", place: "Spa-Francorchamps", date: "2024-12-07", winner: "Sébastien", winnerPoints: 11 },
  { key: "E02", place: "Monza", date: "2024-12-07", winner: "Arnaud", winnerPoints: 13 },
  { key: "E03", place: "Monaco", date: "2025-01-11", winner: "Sébastien", winnerPoints: 14 },
  { key: "E04", place: "Melbourne", date: "2025-02-15", winner: "Alain", winnerPoints: 18 },
  { key: "E05", place: "Sepang", date: "2025-03-22", winner: "Arnaud", winnerPoints: 16 },
  { key: "E06", place: "Interlagos", date: "2025-04-26", winner: "Sébastien", winnerPoints: 16 },
  { key: "E07", place: "Montréal", date: "2025-06-28", winner: "Arnaud", winnerPoints: 14 },
  { key: "E08", place: "Hockenheim", date: "2025-07-26", winner: "Sébastien", winnerPoints: 10 },
  { key: "E09", place: "Magny Cours", date: "2025-10-04", winner: "Arnaud", winnerPoints: 18 },
  { key: "E10", place: "Sebring", date: "2025-10-04", winner: "Arnaud", winnerPoints: 15 },
  { key: "E11", place: "Valencia", date: "2025-12-06", winner: "Sébastien", winnerPoints: 14 },
  { key: "E12", place: "San Marino", date: "2025-12-06", winner: "Bogs", winnerPoints: 16 },
] as const;

const TEAM_S1_STANDINGS = [
  {
    rank: 1,
    player: "Arnaud",
    total: 117,
    average: 10.64,
    appearances: 11,
    races: { E01: 10, E02: 13, E03: 8, E04: 11, E05: 16, E06: null, E07: 14, E08: 6, E09: 18, E10: 15, E11: 6, E12: 0 },
  },
  {
    rank: 2,
    player: "Sébastien",
    total: 112,
    average: 9.33,
    appearances: 12,
    races: { E01: 11, E02: 10, E03: 14, E04: 3, E05: 13, E06: 16, E07: 2, E08: 10, E09: 11, E10: 8, E11: 14, E12: 0 },
  },
  {
    rank: 3,
    player: "Alain",
    total: 64,
    average: 9.14,
    appearances: 7,
    races: { E01: null, E02: null, E03: 6, E04: 18, E05: null, E06: 11, E07: 11, E08: 5, E09: null, E10: null, E11: 0, E12: 13 },
  },
  {
    rank: 4,
    player: "Bogs",
    total: 52,
    average: 6.5,
    appearances: 8,
    races: { E01: 11, E02: 10, E03: 5, E04: null, E05: 4, E06: null, E07: null, E08: null, E09: 0, E10: 0, E11: 6, E12: 16 },
  },
  {
    rank: 5,
    player: "Valérian",
    total: 26,
    average: 4.33,
    appearances: 6,
    races: { E01: 4, E02: 5, E03: 0, E04: 3, E05: null, E06: 6, E07: null, E08: 8, E09: null, E10: null, E11: null, E12: null },
  },
  {
    rank: 6,
    player: "William",
    total: 24,
    average: 8,
    appearances: 3,
    races: { E01: null, E02: null, E03: null, E04: null, E05: null, E06: null, E07: 11, E08: null, E09: null, E10: null, E11: 13, E12: 0 },
  },
  {
    rank: 7,
    player: "Laetitia",
    total: 19,
    average: 6.33,
    appearances: 3,
    races: { E01: null, E02: null, E03: null, E04: 4, E05: null, E06: 5, E07: null, E08: 10, E09: null, E10: null, E11: null, E12: null },
  },
  {
    rank: 8,
    player: "Yann",
    total: 10,
    average: 5,
    appearances: 2,
    races: { E01: null, E02: null, E03: null, E04: null, E05: null, E06: null, E07: null, E08: null, E09: 4, E10: 6, E11: null, E12: null },
  },
  {
    rank: 9,
    player: "Romain",
    total: 0,
    average: 0,
    appearances: 1,
    races: { E01: null, E02: null, E03: null, E04: null, E05: 0, E06: null, E07: null, E08: null, E09: null, E10: null, E11: null, E12: null },
  },
  {
    rank: 10,
    player: "Eiffeline",
    total: 0,
    average: 0,
    appearances: 0,
    races: { E01: null, E02: null, E03: null, E04: null, E05: null, E06: null, E07: null, E08: null, E09: null, E10: null, E11: null, E12: null },
  },
] as const;

const TEAM_S1_HIGHLIGHTS = [
  {
    label: "Meilleur pilote",
    value: "Arnaud",
    detail: "Pilote 1, 6.0 pts de moyenne et victoire finale.",
    accentClass: "from-[#fff0ec] via-[#ffd1c7] to-[#ff9b86] text-[#43110f]",
  },
  {
    label: "Meilleure debutante",
    value: "Laetitia",
    detail: "Pilote 2, 6.33 pts de moyenne sur ses apparitions.",
    accentClass: "from-[#f7f4ff] via-[#d4d6ff] to-[#9aa6ff] text-[#171b46]",
  },
  {
    label: "Meilleure ecurie",
    value: "Arnaud",
    detail: "117 points, 11 courses disputees, 5 victoires d etape.",
    accentClass: "from-[#ffe8ea] via-[#ffb8bc] to-[#ff6a73] text-[#420d13]",
  },
] as const;

const formatTeamS1Date = (isoDate: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));

const normalizeEmail = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const pickFirstNonEmpty = (...values: any[]) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

export default function Dashboard() {
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const evolutionScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [votes, setVotes] = useState<any>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [chatReadAt, setChatReadAt] = useState<Date | null>(null);
  const [chatReadsLoaded, setChatReadsLoaded] = useState(false);
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
  const [editingEvolutionTarget, setEditingEvolutionTarget] = useState<{
    type: "request" | "reply";
    id: string;
  } | null>(null);
  const [editingEvolutionTitle, setEditingEvolutionTitle] = useState("");
  const [editingEvolutionText, setEditingEvolutionText] = useState("");
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
  const singleSystemFunRemainingRef = useRef(0);
  const systemIndexRef = useRef(0);
  const funTemplatePoolRef = useRef<string[]>([]);
  const funTemplateIndexRef = useRef(0);
  const funPseudoPoolRef = useRef<string[]>([]);
  const funPseudoIndexRef = useRef(0);
  const chatNotificationTimeoutsRef = useRef<NodeJS.Timeout | null>(null);
  const chatNotificationCountRef = useRef<number>(0);
  const [simuF1NextRace, setSimuF1NextRace] = useState<{
    raceName: string;
    sundayDateISO: string | null;
    participating: boolean;
  }>({ raceName: "Monaco", sundayDateISO: null, participating: false });

  const [tab, setTab] = useState("events");
  const [selectedResultKey, setSelectedResultKey] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatPanelHeight, setChatPanelHeight] = useState<number | null>(null);
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
  const [editAddress, setEditAddress] = useState("");
  const [editEmailNotifications, setEditEmailNotifications] = useState(false);
  const [editNotificationEmail, setEditNotificationEmail] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [addressSuggestionsError, setAddressSuggestionsError] = useState<string | null>(null);
  const [addressSelectionLocked, setAddressSelectionLocked] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [suppressChatBadge, setSuppressChatBadge] = useState(false);

  const [profile, setProfile] = useState<any>({
    pseudo: "",
    team: "",
    avatar: "",
    address: "",
    emailNotifications: false,
    notificationEmail: "",
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
  const [tempMemberPseudo, setTempMemberPseudo] = useState("");
  const [tempMemberTeam, setTempMemberTeam] = useState("");
  const [tempMemberAvatar, setTempMemberAvatar] = useState("");
  const [tempMemberAvatarUrlInput, setTempMemberAvatarUrlInput] = useState("");
  const [venueEditorEventId, setVenueEditorEventId] = useState<string | null>(null);
  const [venueEditorValue, setVenueEditorValue] = useState("");

  const router = useRouter();

  // Suggestions d'adresse via Google Places API (HTTP)
  useEffect(() => {
    if (!isMenuOpen) {
      setIsEditingAddress(false);
      return;
    }

    if (!isEditingAddress) {
      setAddressSuggestions([]);
      setAddressSuggestionsError(null);
      return;
    }

    if (addressSelectionLocked) {
      setAddressSuggestions([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "REMPLACE_PAR_TA_CLE_API") return;

    const query = editAddress.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressSuggestionsError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "suggestions.placePrediction.text.text",
          },
          body: JSON.stringify({
            input: query,
            languageCode: "fr",
            regionCode: "FR",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMessage = "Impossible de charger les suggestions d'adresse.";
          try {
            const errorBody = await response.json();
            const apiMessage = errorBody?.error?.message;
            if (typeof apiMessage === "string" && apiMessage.length > 0) {
              if (apiMessage.includes("Places API (New)")) {
                errorMessage = "Active Places API (New) dans Google Cloud pour afficher les suggestions.";
              } else {
                errorMessage = apiMessage;
              }
            }
          } catch {
            // Keep default message when error body is not readable.
          }
          setAddressSuggestionsError(errorMessage);
          setAddressSuggestions([]);
          return;
        }

        const data = await response.json();
        const suggestions: string[] = (data?.suggestions || [])
          .map((item: any) => item?.placePrediction?.text?.text)
          .filter((value: any): value is string => typeof value === "string" && value.length > 0);

        setAddressSuggestions(Array.from(new Set(suggestions)).slice(0, 6));
        setAddressSuggestionsError(null);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setAddressSuggestionsError("Impossible de contacter Google Places. Vérifie la connexion et les restrictions de clé API.");
          setAddressSuggestions([]);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [editAddress, isMenuOpen, addressSelectionLocked, isEditingAddress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const allowedTabs = new Set(["events", "proposition", "chat", "results", "members", "circuits", "simuf1"]);

    const syncStateFromUrl = () => {
      const query = new URLSearchParams(window.location.search);
      const requestedTab = String(query.get("tab") || "").trim();
      const requestedResult = String(query.get("result") || "").trim();

      setSelectedResultKey(requestedResult);

      if (!requestedTab || !allowedTabs.has(requestedTab)) return;
      setTab((prev) => (prev === requestedTab ? prev : requestedTab));
    };

    syncStateFromUrl();
    window.addEventListener("popstate", syncStateFromUrl);

    return () => {
      window.removeEventListener("popstate", syncStateFromUrl);
    };
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

      const normalizedEmail = normalizeEmail(u.email);
      const isSuperAdmin = normalizedEmail === "beaudouin.arnaud@gmail.com";

      await setDoc(
        doc(firestore, "members", normalizedEmail),
        {
          email: normalizedEmail,
          role: isSuperAdmin ? "superAdmin" : "member",
        },
        { merge: true }
      );
    });

    return () => unsub();
  }, [router]);

  // Cleanup chat notification timeout on unmount
  useEffect(() => {
    return () => {
      if (chatNotificationTimeoutsRef.current) {
        clearTimeout(chatNotificationTimeoutsRef.current);
      }
    };
  }, []);

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

  // 🏎️ SIMUF1 NEXT RACE INFO (for system info line)
  useEffect(() => {
    const firestore = getFirestore();
    if (!firestore) return;

    let unsubEntry: (() => void) | null = null;

    const unsubRaces = onSnapshot(collection(firestore, "simuf1Races"), (snapshot) => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const races = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((race) => typeof race.sundayDateISO === "string")
        .sort((a, b) => String(a.sundayDateISO).localeCompare(String(b.sundayDateISO)));

      const nextRace = races.find((race) => race.sundayDateISO >= todayISO) || races[races.length - 1] || null;

      if (!nextRace) {
        setSimuF1NextRace({ raceName: "Monaco", sundayDateISO: null, participating: false });
        if (unsubEntry) {
          unsubEntry();
          unsubEntry = null;
        }
        return;
      }

      const raceName =
        String(nextRace.circuitName || nextRace.trackName || nextRace.name || "").trim() || "Monaco";

      const email = String(user?.email || "").trim();
      if (!email) {
        setSimuF1NextRace({ raceName, sundayDateISO: String(nextRace.sundayDateISO), participating: false });
        if (unsubEntry) {
          unsubEntry();
          unsubEntry = null;
        }
        return;
      }

      const entryId = email.replaceAll("/", "_").replaceAll(".", "_");
      if (unsubEntry) unsubEntry();
      unsubEntry = onSnapshot(doc(firestore, "simuf1Races", String(nextRace.id), "entries", entryId), (entrySnap) => {
        const participating = entrySnap.exists() ? entrySnap.data()?.participating === true : false;
        setSimuF1NextRace({ raceName, sundayDateISO: String(nextRace.sundayDateISO), participating });
      });
    });

    return () => {
      unsubRaces();
      if (unsubEntry) unsubEntry();
    };
  }, [user?.email]);

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
      const byEmail = new Map<string, any>();

      snapshot.docs.forEach((d) => {
        const raw = { email: d.id, ...d.data() } as any;
        const key = normalizeEmail(raw.email || d.id);
        const previous = byEmail.get(key);

        if (!previous) {
          byEmail.set(key, {
            ...raw,
            email: key,
          });
          return;
        }

        byEmail.set(key, {
          ...previous,
          ...raw,
          email: key,
          pseudo: pickFirstNonEmpty(raw.pseudo, previous.pseudo),
          team: pickFirstNonEmpty(raw.team, previous.team),
          avatar: pickFirstNonEmpty(raw.avatar, previous.avatar),
          role: raw.role || previous.role || "member",
        });
      });

      const membersData = Array.from(byEmail.values());
      setMembers(membersData);

      // Set user role
      if (user) {
        const currentMember = byEmail.get(normalizeEmail(user.email));
        if (currentMember) {
          setUserRole(currentMember.role || "member");
          setProfile({
            pseudo: currentMember.pseudo || "",
            team: currentMember.team || "",
            avatar: currentMember.avatar || "",
            address: currentMember.address || "",
            emailNotifications: currentMember.emailNotifications === true,
            notificationEmail: currentMember.notificationEmail || "",
          });
          setEditPseudo(currentMember.pseudo || "");
          setEditTeam(currentMember.team || "");
          setEditAvatar(currentMember.avatar || "");
          setEditAddress(currentMember.address || "");
          setEditEmailNotifications(currentMember.emailNotifications === true);
          setEditNotificationEmail(currentMember.notificationEmail || "");
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
        data[v.eventId][v.userEmail] = v;
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
          onlineEmails.add(normalizeEmail(d.id));
        }
      });
      onlineEmails.add(normalizeEmail(user.email));

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
    if (!user?.email) {
      setChatReadAt(null);
      setChatReadsLoaded(false);
      return;
    }
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
      setChatReadsLoaded(true);
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
    if (!chatReadsLoaded) {
      setUnreadCount(0);
      return;
    }
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
  }, [chatMessages, chatReadAt, chatReadsLoaded]);

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
    let settleTimeoutId = 0;
    const frameId = window.requestAnimationFrame(() => {
      scrollChatToLatestBoundary();
      settleTimeoutId = window.setTimeout(() => {
        scrollChatToLatestBoundary();
      }, 120);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (settleTimeoutId) {
        window.clearTimeout(settleTimeoutId);
      }
    };
  }, [tab, chatView, chatMessages.length]);

  useEffect(() => {
    if (tab !== "chat" || chatView !== "chat") {
      setChatPanelHeight(null);
      return;
    }

    const recalc = () => {
      const panel = chatPanelRef.current;
      if (!panel) return;

      const panelTop = panel.getBoundingClientRect().top;
      const footerHeight = bottomBarRef.current?.getBoundingClientRect().height || 0;
      const available = Math.floor(window.innerHeight - panelTop - footerHeight - 10);
      setChatPanelHeight(Math.max(160, available));
    };

    const frameId = window.requestAnimationFrame(recalc);
    window.addEventListener("resize", recalc);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => recalc())
      : null;

    if (resizeObserver) {
      if (chatPanelRef.current) resizeObserver.observe(chatPanelRef.current);
      if (bottomBarRef.current) resizeObserver.observe(bottomBarRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", recalc);
      resizeObserver?.disconnect();
    };
  }, [tab, chatView, replyToMessageId, editingMessageId, typingUsers.length]);

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
    });
  }, []);

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

    const recipients = members
      .filter((member: any) => member?.email && member.email !== user.email && member.emailNotifications === true)
      .map((member: any) => {
        const email = (member.notificationEmail && member.notificationEmail.trim()) || member.email;
        return email;
      })
      .filter((email: string) => Boolean(email));

    if (recipients.length > 0) {
      try {
        console.log("Sending proposition notification to:", recipients);
        const res = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "new-proposition",
            recipients,
            actorEmail: user.email,
            title: formatDateFR(selectedDate),
            date: selectedDate,
          }),
        });
        const data = await res.json();
        console.log("Proposition notification response:", data);
      } catch (error) {
        console.error("Notification proposition non envoyée:", error);
      }
    }

    setSelectedDate("");
  };

  const getVoteStatus = (voteEntry: any) => {
    if (!voteEntry) return null;
    if (typeof voteEntry === "string") return voteEntry;
    return voteEntry.status || null;
  };

  const getVoteSlots = (voteEntry: any) => {
    if (getVoteStatus(voteEntry) !== "present") {
      return { slot14: false, slot17: false };
    }
    if (voteEntry && typeof voteEntry === "object") {
      return {
        slot14: voteEntry.slot14 !== false,
        slot17: voteEntry.slot17 !== false,
      };
    }
    return { slot14: true, slot17: true };
  };

  const getPresenceWindowLabel = (voteEntry: any) => {
    if (getVoteStatus(voteEntry) !== "present") return "";
    const slots = getVoteSlots(voteEntry);
    if (slots.slot14 && !slots.slot17) return "(uniquement 14h)";
    if (!slots.slot14 && slots.slot17) return "(uniquement 17h)";
    return "";
  };

  // 🗳️ VOTE (modifiable)
  const vote = async (
    eventId: string,
    status: string,
    slots?: { slot14: boolean; slot17: boolean }
  ) => {
    if (!user) return;

    const firestore = getFirestore();
    if (!firestore) return;

    const normalizedSlots =
      status === "present"
        ? {
            slot14: slots?.slot14 ?? true,
            slot17: slots?.slot17 ?? true,
          }
        : { slot14: false, slot17: false };

    await setDoc(doc(firestore, "votes", `${eventId}_${user.email}`), {
      eventId,
      userEmail: user.email,
      status,
      ...normalizedSlots,
      updatedAt: serverTimestamp(),
    });
  };

  const toggleRacePresence = async (eventId: string, slot: "slot14" | "slot17") => {
    if (!currentUserEmail) return;
    const currentVote = votes[eventId]?.[currentUserEmail];
    const currentStatus = getVoteStatus(currentVote);
    if (currentStatus !== "present") return;

    const currentSlots = getVoteSlots(currentVote);
    const nextSlots = {
      slot14: slot === "slot14" ? !currentSlots.slot14 : currentSlots.slot14,
      slot17: slot === "slot17" ? !currentSlots.slot17 : currentSlots.slot17,
    };

    if (!nextSlots.slot14 && !nextSlots.slot17) {
      await vote(eventId, "absent", nextSlots);
      return;
    }

    await vote(eventId, "present", nextSlots);
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
    const label = event?.status === "pending" ? "cette proposition" : "cet evenement";
    const eventTitle = event?.title ? `\n\n${event.title}` : "";
    const confirmed = window.confirm(`Confirmer la suppression de ${label} ?${eventTitle}`);
    if (!confirmed) return;
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
    if (!(userRole === "superAdmin" && user?.email === "beaudouin.arnaud@gmail.com")) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "members", normalizeEmail(memberEmail)), { role }, { merge: true });
  };

  const updateMemberDetails = async (memberEmail: string, payload: any) => {
    if (!(userRole === "superAdmin" && user?.email === "beaudouin.arnaud@gmail.com")) return;
    const firestore = getFirestore();
    if (!firestore) return;

    await setDoc(doc(firestore, "members", normalizeEmail(memberEmail)), payload, { merge: true });
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
    let avatarUrl = String(avatarUrlInput || editAvatar || "").trim();

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
      const nextTeamName = String(editTeam || "").trim();

      console.log("Saving profile to Firestore...", {
        pseudo: editPseudo || null,
        team: editTeam || null,
        avatar: avatarUrl || null,
      });

      await setDoc(
        doc(firestore, "members", normalizeEmail(user.email)),
        {
          pseudo: editPseudo || null,
          team: editTeam || null,
          avatar: avatarUrl || null,
          address: editAddress || null,
          emailNotifications: !!editEmailNotifications,
          notificationEmail: editNotificationEmail || null,
        },
        { merge: true }
      );

      if (nextTeamName && user.email) {
        setProfileSaveMessage("Profil enregistré. Synchronisation SimuF1 en cours...");
        await applyTeamNameRetroactively(user.email, nextTeamName);
      }

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

  const sendChatNotificationBatched = (messageCount: number = 1) => {
    const recipients = members
      .filter((member: any) => member?.email && member.email !== user.email && member.emailNotifications === true)
      .map((member: any) => {
        const email = (member.notificationEmail && member.notificationEmail.trim()) || member.email;
        return email;
      })
      .filter((email: string) => Boolean(email));

    if (recipients.length === 0) return;

    // Increment message count
    chatNotificationCountRef.current += messageCount;

    // Cancel existing timeout
    if (chatNotificationTimeoutsRef.current) {
      clearTimeout(chatNotificationTimeoutsRef.current);
    }

    // Debounce: send notification after 30 seconds of inactivity
    const debounceTimer = setTimeout(async () => {
      const totalMessages = chatNotificationCountRef.current;
      try {
        console.log(`Sending batched chat notification for ${totalMessages} message(s) to:`, recipients);
        const res = await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "new-chat-message",
            recipients,
            actorEmail: user.email,
            text: totalMessages > 1 ? `${totalMessages} nouveaux messages` : "Nouveau message",
            hasMentions: false,
            messageCount: totalMessages,
          }),
        });
        const data = await res.json();
        console.log("Batched chat notification response:", data);
      } catch (error) {
        console.error("Notification chat non envoyée:", error);
      } finally {
        chatNotificationCountRef.current = 0;
        chatNotificationTimeoutsRef.current = null;
      }
    }, 30000); // 30 second debounce

    chatNotificationTimeoutsRef.current = debounceTimer;
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

    if (members.some((m: any) => m?.email && m.email !== user.email && m.emailNotifications === true)) {
      sendChatNotificationBatched(1);
    }

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

  const canEditEvolutionRequest = (request: any) => {
    return userRole === "admin" || userRole === "superAdmin" || request?.createdBy === user?.email;
  };

  const canEditEvolutionReply = (reply: any) => {
    return userRole === "admin" || userRole === "superAdmin" || reply?.user === user?.email;
  };

  const startEditEvolutionRequest = (request: any) => {
    setEditingEvolutionTarget({ type: "request", id: request.id });
    setEditingEvolutionTitle(request.title || "");
    setEditingEvolutionText(request.body || "");
  };

  const startEditEvolutionReply = (reply: any) => {
    setEditingEvolutionTarget({ type: "reply", id: reply.id });
    setEditingEvolutionTitle("");
    setEditingEvolutionText(reply.text || "");
  };

  const cancelEvolutionEdit = () => {
    setEditingEvolutionTarget(null);
    setEditingEvolutionTitle("");
    setEditingEvolutionText("");
  };

  const saveEditedEvolutionMessage = async () => {
    if (!editingEvolutionTarget) return;
    const firestore = getFirestore();
    if (!firestore) return;

    if (editingEvolutionTarget.type === "request") {
      if (!editingEvolutionTitle.trim() || !editingEvolutionText.trim()) return;
      const currentRequest = evolutionRequests.find((request: any) => request.id === editingEvolutionTarget.id);
      if (!currentRequest || !canEditEvolutionRequest(currentRequest)) return;

      await updateDoc(doc(firestore, "evolutionRequests", editingEvolutionTarget.id), {
        title: editingEvolutionTitle.trim(),
        body: editingEvolutionText.trim(),
        editedAt: serverTimestamp(),
      });
    } else {
      if (!editingEvolutionText.trim()) return;
      const currentReply = evolutionReplies.find((reply: any) => reply.id === editingEvolutionTarget.id);
      if (!currentReply || !canEditEvolutionReply(currentReply)) return;

      await updateDoc(doc(firestore, "evolutionReplies", editingEvolutionTarget.id), {
        text: editingEvolutionText.trim(),
        editedAt: serverTimestamp(),
      });
    }

    cancelEvolutionEdit();
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

  const openMemberProfile = (member: any) => {
    setSelectedMember(member);
    setIsEditingMember(false);
  };

  const openMemberEditor = (member: any) => {
    setSelectedMember(member);
    setTempMemberRole(member.role || "member");
    setTempPilotStars(String(member.pilotStars || ""));
    setTempPilotSeasons(String(member.pilotStarSeasons || ""));
    setTempTeamStars(String(member.teamStars || ""));
    setTempTeamSeasons(String(member.teamStarSeasons || ""));
    setTempCrowns(String(member.crowns || ""));
    setTempCrownSeasons(String(member.crownSeasons || ""));
    setTempMemberPseudo(String(member.pseudo || ""));
    setTempMemberTeam(String(member.team || ""));
    setTempMemberAvatar(String(member.avatar || ""));
    setTempMemberAvatarUrlInput("");
    setIsEditingMember(true);
  };

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
            <span key={`${part}-${idx}`} className="text-[#e10600] font-bold">
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

  const isSuperAdmin = userRole === "superAdmin";
  const canManageMemberProfiles = isSuperAdmin && currentUserEmail === "beaudouin.arnaud@gmail.com";
  const selectedMemberLive = useMemo(() => {
    if (!selectedMember?.email) return null;
    return members.find((m) => normalizeEmail(m.email) === normalizeEmail(selectedMember.email)) || selectedMember;
  }, [members, selectedMember]);

  const participatedEvolutionRequestIds = useMemo(() => {
    if (!currentUserEmail) return new Set<string>();
    // Super admin receives notifications for all requests since they are the destination.
    if (isSuperAdmin) {
      return new Set<string>(evolutionRequests.map((r: any) => r.id));
    }
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
  }, [currentUserEmail, isSuperAdmin, evolutionReplies, evolutionRequests]);

  const evolutionUnreadByRequest = useMemo(() => {
    const unreadByRequest = new Map<string, number>();
    if (!currentUserEmail || participatedEvolutionRequestIds.size === 0 || !evolutionReadsLoaded) {
      return unreadByRequest;
    }

    evolutionRequests.forEach((request: any) => {
      if (!participatedEvolutionRequestIds.has(request.id)) return;
      // Never count your own request as unread.
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
    ? upcomingEvents.some((event: any) => getVoteStatus(votes[event.id]?.[currentUserEmail]) === "present")
    : false;

  const systemInfoItems = useMemo(() => {
    const simuF1Days = simuF1NextRace.sundayDateISO
      ? Math.max(
          0,
          Math.ceil(
            (new Date(`${simuF1NextRace.sundayDateISO}T00:00:00`).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

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
      simuF1Days !== null
        ? {
            source: "SimuF1",
            text: `Prochaine course ${simuF1NextRace.raceName} dans ${simuF1Days} jour${simuF1Days > 1 ? "s" : ""} - ${simuF1NextRace.participating ? "Bravo tu participes !" : "Inscrit toi !"}`,
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
    simuF1NextRace.participating,
    simuF1NextRace.raceName,
    simuF1NextRace.sundayDateISO,
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
        badgeClass: "border-[#e10600]/60 bg-[#e10600]/15 text-[#ff7b82]",
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
    return members.filter((member) => getVoteStatus(eventVotes[member.email]) === "present");
  }, [members, votes, venueEditorEvent]);

  const navItems = [
    { key: "events", label: "Parties", icon: CalendarDays },
    { key: "proposition", label: "Propos", icon: ClipboardList },
    { key: "results", label: "Resultats", icon: Trophy },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "members", label: "Pilotes", icon: Users },
    { key: "circuits", label: "Circuits", icon: Route },
    { key: "simuf1", label: "SimuF1", icon: Gamepad2 },
  ];

  const resultsCategories = [
    {
      key: "team-s2-2026-2027",
      title: "Championnat Écurie Saison 2 - 2026 / 2027",
      status: "En cours",
      statusClass: "border-[#78de86]/45 bg-[#409b48]/72 text-white",
      href: "/dashboard?tab=results&result=team-s2-2026-2027",
    },
    {
      key: "individual-s1-2024-2026",
      title: "Championnat Individuel Saison 1 - 2024 / 2026",
      status: "En cours",
      statusClass: "border-[#78de86]/45 bg-[#409b48]/72 text-white",
      href: "/dashboard?tab=results&result=individual-s1-2024-2026",
      resultImage: "/I09.png",
    },
    {
      key: "team-s1-2024-2025",
      title: "Championnat Écurie Saison 1 - 2024 / 2025",
      status: "Terminé",
      statusClass: "border-white/25 bg-black/74 text-[#ff4a52]",
      href: "/dashboard?tab=results&result=team-s1-2024-2025",
      resultImage: "/E12.png",
    },
    {
      key: "team-s0-2015-2017",
      title: "Championnat Écurie Saison 0 - 2015 / 2017",
      status: "Terminé",
      statusClass: "border-white/25 bg-black/74 text-[#ff4a52]",
      href: "/dashboard?tab=results&result=team-s0-2015-2017",
    },
  ];

  const selectedResultsCategory = resultsCategories.find((category) => category.key === selectedResultKey) || null;

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
            className="relative inline-block text-white [text-shadow:0_0_10px_rgba(255,255,255,0.12)] after:absolute after:-bottom-[1px] after:left-0 after:h-[1px] after:w-full after:origin-left after:bg-gradient-to-r after:from-white/85 after:via-white/45 after:to-transparent"
          >
            {segment}
          </span>
        );
      }

      if (/^Saison\s+\d+$/.test(segment)) {
        return (
          <span
            key={`${segment}-${index}`}
            className="relative inline-block bg-gradient-to-r from-[#ff6a60] via-[#ff3b30] to-[#ff6a60] bg-clip-text text-transparent [text-shadow:0_0_16px_rgba(211,31,40,0.35)] after:absolute after:-bottom-[2px] after:left-0 after:h-[2px] after:w-full after:origin-left after:bg-gradient-to-r after:from-[#e10600]/85 after:via-[#ff3b30]/40 after:to-transparent"
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

  const renderResultRowLights = (status: string) => {
    const isActive = status === "En cours";

    return (
      <div className="inline-flex items-center gap-1.5" aria-hidden="true">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isActive ? "bg-[#52da63] shadow-[0_0_10px_rgba(82,218,99,0.55)]" : "bg-[#2a303a]"}`} />
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isActive ? "bg-[#2a303a]" : "bg-[#ff4a52] shadow-[0_0_10px_rgba(255,74,82,0.5)]"}`} />
      </div>
    );
  };

  const renderTeamS1Result = () => (
    <div className="mt-4 overflow-hidden border border-[#322329] bg-[#120d11] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="relative overflow-hidden border-b border-[#38262b] bg-[radial-gradient(circle_at_top_left,_rgba(255,106,115,0.22),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1),_transparent_24%),linear-gradient(135deg,_#160f14_0%,_#100c10_55%,_#19080b_100%)] px-4 py-5 sm:px-6 sm:py-6">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] opacity-30" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.42em] text-[#ff9aa0] sm:text-xs">Formula D</p>
            <h4 className="mt-2 text-3xl font-black uppercase tracking-[0.03em] text-white sm:text-5xl">Championnat Ecurie Saison #1</h4>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d6c9cf] sm:text-[15px]">
              Premiere archive native du championnat equipe, reconstruite depuis le classeur source pour remplacer le visuel statique et garder le detail des 12 courses directement dans l application.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[480px] xl:grid-cols-1">
            {TEAM_S1_HIGHLIGHTS.map((highlight) => (
              <div
                key={highlight.label}
                className="overflow-hidden rounded-[18px] border border-white/10 bg-black/30 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-sm"
              >
                <div className={`bg-gradient-to-r px-4 py-4 ${highlight.accentClass}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em]">{highlight.label}</p>
                  <p className="mt-2 text-2xl font-black uppercase leading-none">{highlight.value}</p>
                  <p className="mt-2 text-xs font-bold leading-5 opacity-80">{highlight.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 bg-[#151018] p-4 sm:p-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <section className="overflow-hidden rounded-[20px] border border-[#34262d] bg-[#18121b]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30242a] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff8d95]">Classement general</p>
              <h5 className="mt-1 text-lg font-black uppercase tracking-[0.04em] text-white sm:text-xl">Tableau ecuries</h5>
            </div>
            <div className="rounded-full border border-[#4b3138] bg-[#20161b] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#e7cfd5]">
              12 courses
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[72px_minmax(180px,1.4fr)_110px_110px_120px_repeat(12,minmax(58px,1fr))] border-b border-[#30242a] bg-[#120d13] text-[10px] font-black uppercase tracking-[0.18em] text-[#8f7e87]">
                <div className="px-3 py-3">Rang</div>
                <div className="px-3 py-3">Equipe</div>
                <div className="px-3 py-3 text-[#ff9aa0]">Moy.</div>
                <div className="px-3 py-3">Total</div>
                <div className="px-3 py-3">Courses</div>
                {TEAM_S1_RACES.map((race) => (
                  <div key={race.key} className="px-2 py-3 text-center text-[#ff9aa0]">
                    {race.key}
                  </div>
                ))}
              </div>

              {[...TEAM_S1_STANDINGS].sort((a, b) => b.average - a.average).map((team, idx) => {
                const displayRank = idx + 1;
                return (
                <div
                  key={team.player}
                  className={`grid grid-cols-[72px_minmax(180px,1.4fr)_110px_110px_120px_repeat(12,minmax(58px,1fr))] border-b border-[#271d22] text-sm ${displayRank <= 3 ? "bg-[linear-gradient(90deg,rgba(255,255,255,0.04),transparent_22%)]" : "bg-[#18121b]"}`}
                >
                  <div className="flex items-center px-3 py-3">
                    <span className={`inline-flex min-w-[40px] items-center justify-center rounded-full border px-2 py-1 text-xs font-black ${displayRank === 1 ? "border-[#ffd27d]/55 bg-[#6a4a13]/35 text-[#ffe8b3]" : displayRank === 2 ? "border-[#d9dde5]/40 bg-[#39414c]/30 text-[#eef2fa]" : displayRank === 3 ? "border-[#efab86]/45 bg-[#693523]/30 text-[#ffd6c2]" : "border-[#3a2d35] bg-[#20161b] text-[#c7b2bb]"}`}>
                      #{displayRank}
                    </span>
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-[15px] font-black uppercase tracking-[0.03em] text-white">{team.player}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d7a82]">Championnat ecurie</p>
                  </div>
                  <div className="flex items-center px-3 py-3 text-sm font-black text-[#ff9aa0]">{team.average.toFixed(2)}</div>
                  <div className="flex items-center px-3 py-3 text-base font-black text-white">{team.total}</div>
                  <div className="flex items-center px-3 py-3 text-sm font-bold text-[#c8b7bf]">{team.appearances}</div>
                  {TEAM_S1_RACES.map((race) => {
                    const points = team.races[race.key as keyof typeof team.races];
                    const isWinner = points === race.winnerPoints && team.player === race.winner;
                    return (
                      <div key={`${team.player}-${race.key}`} className="flex items-center justify-center px-1 py-3">
                        {points === null ? (
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4c3c44]">--</span>
                        ) : (
                          <span className={`inline-flex min-w-[38px] items-center justify-center rounded-[10px] border px-2 py-1 text-xs font-black ${isWinner ? "border-[#ff9aa0]/60 bg-[#6b1f27]/55 text-white shadow-[0_0_18px_rgba(225,6,0,0.2)]" : points === 0 ? "border-[#433138] bg-[#21161b] text-[#927f88]" : "border-[#3b2d35] bg-[#20161b] text-[#f6e8eb]"}`}>
                            {points}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-[20px] border border-[#34262d] bg-[#18121b]">
            <div className="border-b border-[#30242a] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff8d95]">Calendrier</p>
              <h5 className="mt-1 text-lg font-black uppercase tracking-[0.04em] text-white">Toutes les courses</h5>
            </div>
            <div className="divide-y divide-[#271d22]">
              {TEAM_S1_RACES.map((race) => (
                <div key={race.key} className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 px-4 py-3 sm:px-5">
                  <div className="flex flex-col items-center justify-center rounded-[14px] border border-[#4b3138] bg-[#21161b] px-2 py-2 text-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ff9aa0]">{race.key}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#b29ea6]">{formatTeamS1Date(race.date)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-[0.03em] text-white">{race.place}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8e7a83]">Vainqueur d etape: {race.winner}</p>
                    <p className="mt-1 text-xs leading-5 text-[#d4c6cc]">{race.winnerPoints} points marques sur cette manche.</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#34262d] bg-[#18121b]">
            <div className="border-b border-[#30242a] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff8d95]">Lecture rapide</p>
              <h5 className="mt-1 text-lg font-black uppercase tracking-[0.04em] text-white">Ce que dit la saison</h5>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm leading-6 text-[#d8cbd1] sm:px-5">
              <p>Arnaud termine champion avec 117 points et un pic net sur le dernier tiers de saison, notamment Magny Cours et Sebring.</p>
              <p>Sébastien reste au contact jusqu'au bout avec 112 points et la meilleure constance globale sur 12 courses disputees.</p>
              <p>Le tableau conserve toutes les manches E01 a E12, avec les absences laissees vides et les zero affiches explicitement.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  const syncDashboardQuery = (nextTab: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextTab);

    // A click on any bottom-tab icon should return to that tab's root state.
    params.delete("result");
    params.delete("team");
    params.delete("simuView");
    params.delete("simuRace");
    setSelectedResultKey("");

    window.history.pushState({}, "", `/dashboard?${params.toString()}`);
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === "chat") {
      // Avoid transient badge flicker while read state syncs.
      setSuppressChatBadge(true);
      setChatReadAt(new Date());
      setUnreadCount(0);
      setChatView("chat");
      void markChatAsRead();
    } else {
      setSuppressChatBadge(false);
    }
    syncDashboardQuery(nextTab);
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
    singleSystemFunRemainingRef.current = 0;
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
      const singleSystemMode = hasSystem && hasFun && systemCount === 1;

      if (singleSystemMode) {
        if (infoPhaseRef.current === "fun") {
          const line = nextFunLine();
          singleSystemFunRemainingRef.current = Math.max(0, singleSystemFunRemainingRef.current - 1);
          infoPhaseRef.current = singleSystemFunRemainingRef.current > 0 ? "fun" : "system";
          return line;
        }

        const systemLine = nextSystemLine();
        if (systemLine) {
          singleSystemFunRemainingRef.current = 3;
          infoPhaseRef.current = "fun";
          return systemLine;
        }

        return nextFunLine();
      }

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
    }, 8400);

    return () => window.clearInterval(intervalId);
  }, [eligibleFunPseudos, systemInfoItems]);

  function scrollChatToLatestBoundary() {
    const container = chatScrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }

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
    const status = getVoteStatus(eventVotes[email]);
    if (status === "present") return "text-[#409b48]";
    if (status === "absent") return "text-[#e10600]";
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

  const resolvedAvatar = ((profile?.avatar as string) || (user?.photoURL as string) || "").trim();
  const resolvedPseudo = String((profile?.pseudo as string) || user?.displayName || user?.email || "Utilisateur").trim();
  const resolvedTeam = String((profile?.team as string) || "").trim();

  const getAdaptivePseudoStyle = (pseudo: string, baseSize = 34) => {
    const len = String(pseudo || "").trim().length;
    const minSize = 13;
    const computedSize = Math.max(minSize, baseSize - Math.max(0, len - 12) * 1.25);
    const spacing = len <= 16 ? 0.06 : len <= 24 ? 0.04 : len <= 32 ? 0.025 : 0.012;
    return {
      fontSize: `${computedSize}px`,
      letterSpacing: `${spacing}em`,
      lineHeight: 0.95,
    } as const;
  };

  return (
    <main className="min-h-screen bg-[#0f1014] text-white">
      {/* F1 top accent bar */}
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-40 sm:pb-20">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => handleTabChange("events")}
              aria-label="Aller aux Parties"
              className="shrink-0"
            >
              <img
                src="/fd-icon.png"
                alt="Formula D"
                className="h-7 sm:h-14 w-auto object-contain"
              />
            </button>

            <div className="info-laser-border h-14 flex-1 min-w-0 max-w-[640px] bg-[#121419] px-3 sm:px-4 flex items-center overflow-hidden py-0 sm:py-0">
              {!currentInfoLine ? (
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-500">Aucune info urgente</p>
              ) : (
                <div className={`w-full transition-opacity duration-300 ${isInfoFading ? "opacity-0" : "opacity-100"}`}>
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.14em] text-gray-200 leading-4 whitespace-normal break-words">
                    {currentInfoLine?.funPseudo ? (
                      <>
                        <span className="text-[#e10600] mr-1">{currentInfoLine.funPseudo}</span>
                        {currentInfoLine.text.slice(currentInfoLine.funPseudo.length)}
                      </>
                    ) : (
                      <>
                        <span className="text-[#e10600] mr-2">{currentInfoLine?.source}</span>
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
                <div className="w-full h-full rounded-[2px] overflow-hidden bg-[#e10600] [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)] flex items-center justify-center">
                  {resolvedAvatar ? (
                    <img
                      src={resolvedAvatar}
                      alt="Avatar profil"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
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
                <div className="absolute right-0 top-full mt-2 w-[min(64rem,calc(100vw-2rem))] bg-[#13151b] border border-white/20 rounded-lg shadow-xl z-50">
                  <div className="p-4">
                    <div className="mb-5 flex items-center gap-4 border border-white/10 bg-[#10131a] p-4 sm:p-5">
                      <div className="w-[168px] h-[168px] sm:w-[180px] sm:h-[180px] rounded-[2px] p-[2px] bg-black shrink-0">
                        <div className="w-full h-full bg-[#e10600] rounded-[2px] flex items-center justify-center overflow-hidden [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)]">
                          {resolvedAvatar ? (
                            <img
                              src={resolvedAvatar}
                              alt="Avatar profil"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <svg className="w-[72px] h-[72px] text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p
                          className="text-white uppercase whitespace-nowrap"
                          style={{
                            fontFamily: "var(--font-bebas-neue), sans-serif",
                            ...getAdaptivePseudoStyle(resolvedPseudo, 34),
                          }}
                          title={resolvedPseudo}
                        >
                          {resolvedPseudo}
                        </p>
                        {resolvedTeam ? (
                          <p className="mt-1 text-[11px] text-[#ff8b92] uppercase tracking-[0.2em]">{resolvedTeam}</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-500 uppercase tracking-[0.2em]">Sans ecurie</p>
                        )}
                        <p className="mt-2 text-xs text-gray-400 break-all">{user?.email}</p>
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
                        <label className="block text-sm font-medium mb-1">Écurie</label>
                        <input
                          type="text"
                          value={editTeam}
                          onChange={(e) => setEditTeam(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400"
                          placeholder="Votre écurie"
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
                      <div>
                        <label className="block text-sm font-medium mb-1">Adresse (domicile)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => {
                              setAddressSelectionLocked(false);
                              setIsEditingAddress(true);
                              setEditAddress(e.target.value);
                            }}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-400"
                            placeholder="Ex: 12 rue de la Course, 75001 Paris"
                            autoComplete="off"
                          />
                          {addressSuggestions.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border border-white/20 bg-[#161920] shadow-xl overflow-hidden">
                              {addressSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onMouseDown={() => {
                                    setAddressSelectionLocked(true);
                                    setEditAddress(suggestion);
                                    setAddressSuggestions([]);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {addressSuggestionsError && (
                          <p className="mt-1 text-xs text-red-300">{addressSuggestionsError}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">Utilisée pour afficher le lieu quand tu héberges une partie.</p>
                      </div>
                      <div className="border border-white/10 bg-white/5 px-3 py-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editEmailNotifications}
                            onChange={(e) => setEditEmailNotifications(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent"
                          />
                          <span>
                            Recevoir les notifications email
                            <span className="block text-xs text-gray-400">
                              Nouvelles propositions et nouveaux messages chat (désactivé par défaut).
                            </span>
                          </span>
                        </label>
                      </div>
                      {editEmailNotifications && (
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Adresse email pour les notifications
                          </label>
                          <input
                            type="email"
                            value={editNotificationEmail}
                            onChange={(e) => setEditNotificationEmail(e.target.value)}
                            placeholder="nom@outlook.com, nom@gmail.com, etc."
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#e10600]"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Laisse vide pour utiliser {user?.email}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={isSavingProfile}
                        className="w-full bg-[#e10600] disabled:bg-[#7a1b20] hover:bg-[#ba0500] text-white px-4 py-2 rounded-md transition"
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
          <section className={`border border-[#2a2d36] ${tab === "events" || tab === "proposition" || tab === "chat" ? "bg-[#15171d] shadow-[0_14px_36px_rgba(0,0,0,0.26)]" : "bg-[#15171d]"} ${tab === "chat" ? "px-0 py-4 sm:p-6" : "p-4 sm:p-6"}`}>
            <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#343845] pb-5 mb-6 ${tab === "chat" ? "px-3 sm:px-0" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-[#e10600]" />
                <h2 className="f1-title text-2xl sm:text-3xl font-black uppercase tracking-[0.09em] text-white">
                  {tab === "events" && <>Parties a venir — <span className="text-[#e10600]">{nextEventDays !== null ? `J-${nextEventDays}` : "—"}</span></>}
                  {tab === "proposition" && <>Propositions de dates</>}
                  {tab === "chat" && <>{chatView === "evolution" ? "Evolution Appli" : "Chat"}</>}
                  {tab === "results" && <>Resultats</>}
                  {tab === "members" && <>Pilotes</>}
                  {tab === "circuits" && <>Circuits</>}
                  {tab === "simuf1" && <>SimuF1</>}
                </h2>
              </div>
              {tab === "chat" && (
                <button
                  type="button"
                  onClick={() => setChatView(chatView === "chat" ? "evolution" : "chat")}
                  className={`border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${chatView === "chat" ? "border-[#e10600] bg-[#e10600] text-white hover:bg-[#ba0500]" : "border-white/20 text-gray-200 hover:text-white hover:border-white/40"}`}
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
                <div className="border border-[#313541] bg-[#181c23]/85 px-3 py-2 sm:px-4 sm:py-3">
                  <p className="text-[10px] sm:text-[11px] text-gray-500 leading-4">
                    Info session: 2 courses prévues (14h-17h puis 17h-21h), horaires indicatifs pouvant bouger de 1h à 2h selon le circuit. Par défaut, un pilote présent est considéré présent sur les 2 courses; si besoin, ajuste 14h/17h.
                  </p>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div className="border border-white/10 bg-black/40 p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucun événement validé pour le moment.
                  </div>
                ) : (
                  upcomingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => getVoteStatus(eventVotes[m.email]) === "present");
                    const absent = members.filter((m) => getVoteStatus(eventVotes[m.email]) === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);
                    const currentVote = currentUserEmail ? eventVotes[currentUserEmail] : null;
                    const currentVoteStatus = getVoteStatus(currentVote);
                    const currentSlots = getVoteSlots(currentVote);
                    const venueHostLabel = event.venueHostEmail ? getPseudo(event.venueHostEmail) : null;
                    const venueHostMember = event.venueHostEmail ? members.find((m: any) => m.email === event.venueHostEmail) : null;
                    const venueHostAddress = venueHostMember?.address || null;

                    return (
                      <div key={event.id} className="border-l-4 border-[#e10600] border border-[#313541] bg-[#1b1f27]/90 p-4 sm:p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
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
                                    {venueHostAddress && (
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueHostAddress)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-2 inline-flex items-center gap-1 text-[11px] normal-case text-[#ff5d64] hover:underline"
                                        title={venueHostAddress}
                                      >
                                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                        {venueHostAddress}
                                      </a>
                                    )}
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
                            {currentVoteStatus === "present" && (
                              <>
                                <button
                                  onClick={() => toggleRacePresence(event.id, "slot14")}
                                  className={`flex-1 sm:flex-none text-center px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${currentSlots.slot14 ? "bg-[#409b48] text-white hover:bg-[#37853e]" : "bg-[#e10600] text-white hover:bg-[#ba0500]"}`}
                                >
                                  14h
                                </button>
                                <button
                                  onClick={() => toggleRacePresence(event.id, "slot17")}
                                  className={`flex-1 sm:flex-none text-center px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${currentSlots.slot17 ? "bg-[#409b48] text-white hover:bg-[#37853e]" : "bg-[#e10600] text-white hover:bg-[#ba0500]"}`}
                                >
                                  17h
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => vote(event.id, "present")}
                              className="flex-1 sm:flex-none text-center bg-[#409b48] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#37853e] transition"
                            >
                              Présent
                            </button>
                            <button
                              onClick={() => vote(event.id, "absent")}
                              className="flex-1 sm:flex-none text-center bg-[#e10600] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#ba0500] transition"
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
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#409b48] font-black">Présents — {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">
                              {present.length === 0
                                ? "—"
                                : present.map((m, index) => {
                                    const slotLabel = getPresenceWindowLabel(eventVotes[m.email]);
                                    return (
                                      <span key={m.email}>
                                        {index > 0 ? ", " : ""}
                                        <span className="text-[#409b48]">{getPseudo(m.email)}</span>
                                        {slotLabel && <span className="text-[11px] text-[#70b87a]"> {slotLabel}</span>}
                                      </span>
                                    );
                                  })}
                            </p>
                          </div>
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">En attente — {waiting.length}</p>
                          </div>
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#e10600] font-black">Absents — {absent.length}</p>
                            <p className="mt-2 text-sm text-[#e10600]">{absent.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
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
                <div className="border border-[#313541] bg-[#181c23]/90 p-4 sm:p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Nouvelle proposition</p>
                  
                  <div className="border border-[#2a2d36] bg-[#1d2129]/80 p-4 sm:p-6">
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
                                ? "bg-[#e10600] text-white"
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
                    className="mt-4 w-full bg-[#e10600] px-5 py-4 text-xs font-black uppercase tracking-[0.3em] text-white hover:bg-[#ba0500] transition"
                  >
                    + Créer proposition
                  </button>
                </div>

                {pendingEvents.length === 0 ? (
                  <div className="border border-white/10 bg-[#121419] p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucune proposition en attente.
                  </div>
                ) : (
                  pendingEvents.map((event) => {
                    const eventVotes = votes[event.id] || {};
                    const present = members.filter((m) => getVoteStatus(eventVotes[m.email]) === "present");
                    const absent = members.filter((m) => getVoteStatus(eventVotes[m.email]) === "absent");
                    const waiting = members.filter((m) => !eventVotes[m.email]);

                    return (
                      <div key={event.id} className="border-l-4 border-yellow-500 border border-[#313541] bg-[#1c2028]/90 p-4 sm:p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
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
                              className="flex-1 sm:flex-none text-center bg-[#e10600] px-5 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#ba0500] transition"
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
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#409b48] font-black">Présents — {present.length}</p>
                            <p className="mt-2 text-sm text-[#409b48]">{present.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
                          </div>
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">En attente — {waiting.length}</p>
                          </div>
                          <div className="bg-[#121419] p-4">
                            <p className="text-xs uppercase tracking-[0.3em] text-[#e10600] font-black">Absents — {absent.length}</p>
                            <p className="mt-2 text-sm text-[#e10600]">{absent.map(m => getPseudo(m.email)).join(', ') || '—'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "results" && (
              <div className="space-y-1 sm:space-y-1.5">
                {selectedResultsCategory ? (
                  <div className="border border-[#2d303a] bg-[#161920] p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e323b] pb-4">
                      <div className="min-w-0 flex items-center gap-4">
                        <div className="shrink-0">
                          {renderResultRowLights(selectedResultsCategory.status)}
                        </div>
                        <h3
                          className="text-lg sm:text-2xl font-black uppercase tracking-[0.04em] text-white break-words leading-[1.22] overflow-hidden"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {renderResultsTitle(selectedResultsCategory.title)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href="/dashboard?tab=results"
                          onClick={() => setSelectedResultKey("")}
                          className="inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white"
                        >
                          Retour
                        </Link>
                      </div>
                    </div>

                    {selectedResultsCategory.key === "team-s1-2024-2025" ? (
                      renderTeamS1Result()
                    ) : selectedResultsCategory.resultImage ? (
                      <div className="mt-4 border border-[#2e323b] bg-[#181b22] p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.14em] text-[#9da5b3]">Mobile: pincez pour zoomer ou glissez horizontalement</p>
                          <a
                            href={selectedResultsCategory.resultImage}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-[#434957] bg-[#1c1f27] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#eef1f6] hover:border-[#676f82] hover:text-white transition"
                          >
                            Ouvrir en plein ecran
                          </a>
                        </div>

                        <div className="mt-3 border border-[#2a2d35] bg-[#1c1f27] p-2 sm:p-3 overflow-x-auto">
                          <img
                            src={selectedResultsCategory.resultImage}
                            alt={selectedResultsCategory.title}
                            className="h-auto w-full min-w-[920px] sm:min-w-0 object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 border border-[#2e323b] bg-[#181b22] p-6 sm:p-8 text-center">
                        <p className="mt-3 text-sm uppercase tracking-[0.16em] text-gray-300">En cours de construction</p>
                      </div>
                    )}
                  </div>
                ) : (
                  resultsCategories.map((category) => (
                    <Link
                      key={category.key}
                      href={category.href}
                      onClick={() => setSelectedResultKey(category.key)}
                      className="group relative block overflow-hidden border border-[#2a2d36] bg-[#1a1d25] transition-colors hover:border-[#3a3f4d]"
                    >
                      <div className="relative min-h-[44px] sm:h-[40px] px-2 sm:px-2.5 py-1 sm:py-0">
                        <div className="flex h-full items-center justify-start pl-1 sm:pl-2">
                          <div className="flex w-full max-w-[980px] items-center gap-5">
                            <div className="flex w-[22px] shrink-0 items-center justify-center">
                              {renderResultRowLights(category.status)}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center">
                              <h3 className="block w-full whitespace-normal text-[14px] sm:text-[17px] font-black uppercase tracking-[0.01em] text-white leading-[1.24] text-left break-words" title={category.title}>
                                {renderResultsTitle(category.title)}
                              </h3>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {tab === "members" && (
              <div className="space-y-2">
                {selectedMemberLive ? (
                  <div className="border border-white/10 bg-[#121419] p-4 sm:p-6 space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(null);
                          setIsEditingMember(false);
                        }}
                        className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] text-gray-300 hover:text-white hover:border-white/40 transition"
                      >
                        <span aria-hidden="true">←</span>
                        Retour
                      </button>
                      {canManageMemberProfiles && (
                        <button
                          type="button"
                          onClick={() => openMemberEditor(selectedMemberLive)}
                          className="inline-flex items-center gap-2 bg-[#e10600] px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#ba0500] transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                      )}
                    </div>

                    <div className="border border-white/10 bg-black/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2px] p-[2px] bg-black flex-shrink-0">
                        <div className="w-full h-full rounded-[2px] overflow-hidden bg-[#e10600] flex items-center justify-center">
                          {String(selectedMemberLive.avatar || "").trim() ? (
                            <img src={String(selectedMemberLive.avatar || "").trim()} alt={selectedMemberLive.pseudo || selectedMemberLive.email} className="w-full h-full object-cover rounded-[inherit]" />
                          ) : (
                            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="f1-title text-[24px] sm:text-[30px] font-black uppercase text-white leading-[0.92] break-words">
                          {selectedMemberLive.pseudo || selectedMemberLive.email}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-widest text-gray-500">{selectedMemberLive.team || "Sans écurie"}</p>
                      </div>
                    </div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="border border-white/10 bg-[#121419] p-6 text-center text-xs uppercase tracking-widest text-gray-500">
                    Aucun membre trouvé.
                  </div>
                ) : (
                  members.map((m) => (
                    <div 
                      key={m.email} 
                      onClick={() => openMemberProfile(m)}
                      className="border border-white/10 bg-[#121419] px-4 sm:px-6 py-4 flex items-start sm:items-center gap-4 sm:gap-6 cursor-pointer hover:bg-white/5 transition"
                    >
                      {/* avatar */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2px] p-[2px] bg-black flex-shrink-0">
                        <div className="w-full h-full rounded-[2px] overflow-hidden bg-[#e10600] [transform:translateZ(0)] [-webkit-mask-image:-webkit-radial-gradient(white,black)] [mask-image:radial-gradient(white,black)] flex items-center justify-center">
                          {String(m.avatar || "").trim() ? (
                            <img src={String(m.avatar || "").trim()} alt={m.pseudo || m.email} className="w-full h-full object-cover rounded-[inherit]" />
                          ) : (
                            <svg className="w-9 h-9 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${onlineMemberEmails.has(normalizeEmail(m.email)) ? "bg-[#22c55e]" : "bg-[#e10600]"}`}
                              title={onlineMemberEmails.has(normalizeEmail(m.email)) ? "En ligne" : "Hors ligne"}
                              aria-label={onlineMemberEmails.has(normalizeEmail(m.email)) ? "En ligne" : "Hors ligne"}
                            />
                            <p
                              className="f1-title text-[20px] sm:text-[24px] leading-[0.95] font-black uppercase tracking-[0.09em] text-white"
                            >
                              {m.pseudo || m.email}
                            </p>
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
                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "circuits" && (
              <div className="border border-white/10 bg-[#121419] p-6 sm:p-8 text-center">
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-[0.12em] text-white">Circuits</h3>
                <p className="mt-4 text-sm sm:text-base text-gray-300">Page à venir avec la liste des circuits à notre disposition</p>
              </div>
            )}

            {tab === "simuf1" && (
              <div className="space-y-4">
                <SimuF1Panel
                  userEmail={user?.email || ""}
                  userPseudo={profile?.pseudo || user?.displayName || user?.email || "Pilote"}
                  defaultTeamName={profile?.team || ""}
                  isSuperAdmin={userRole === "superAdmin"}
                />
              </div>
            )}

            {tab === "chat" && (
              <div
                ref={chatPanelRef}
                className="flex min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden"
                style={chatView === "chat" && chatPanelHeight ? { height: `${chatPanelHeight}px` } : undefined}
              >
                {chatView === "chat" && (
                  <>
                    <div ref={chatScrollRef} className="border-y border-[#313541] sm:border bg-[#151920]/88 p-2 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
                      {chatMessages.length === 0 ? (
                        <p className="text-xs uppercase tracking-widest text-gray-500">Pas encore de messages. Lancez la discussion.</p>
                      ) : (
                        chatMessages
                          .filter((m) => !m.parentId)
                          .map((m) => {
                            const replies = chatMessages.filter((r) => r.parentId === m.id);
                            return (
                              <div key={m.id} data-chat-thread-item="true" className="mb-3 sm:mb-4 border-l-2 border-white/10 pl-2 sm:pl-3">
                                <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
                                  <p className="min-w-0 flex-1 text-[10px] sm:text-[11px] uppercase tracking-[0.13em] sm:tracking-[0.15em] text-gray-500 mb-1 break-words [overflow-wrap:anywhere]">
                                    <span className="text-[#e10600]">{getPseudo(m.user)}</span> · {formatChatTime(m.createdAt)}
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
                                        className="group relative p-1 text-[#e10600] hover:text-[#ff4c55] transition"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                          Supprimer
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-200 text-[13px] sm:text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderTextWithMentions(m.text || "")}</p>

                                {replies.length > 0 && (
                                  <div className="mt-2.5 ml-2 sm:mt-3 sm:ml-3 space-y-2 border-l border-white/10 pl-2 sm:pl-3">
                                    {replies.map((reply) => (
                                      <div key={reply.id} className="bg-black/30 border border-white/10 px-2 py-2 sm:px-3">
                                        <div className="mb-1 flex items-start justify-between gap-1.5 sm:gap-2 min-w-0">
                                          <p className="min-w-0 flex-1 text-[9px] sm:text-[10px] uppercase tracking-[0.13em] sm:tracking-[0.15em] text-gray-500 break-words [overflow-wrap:anywhere]">
                                            <span className="text-[#e10600]">{getPseudo(reply.user)}</span> · {formatChatTime(reply.createdAt)}
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
                                                className="group relative p-1 text-[#e10600] hover:text-[#ff4c55] transition"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[10px] uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
                                                  Supprimer
                                                </span>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-[13px] sm:text-sm text-gray-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderTextWithMentions(reply.text || "")}</p>
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
                      <div className="mx-2 sm:mx-0 border border-[#e10600]/40 bg-[#e10600]/10 px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
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
                          className="w-full border border-white/20 bg-transparent px-4 py-2 text-white text-sm outline-none focus:border-[#e10600] transition"
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
                            className="bg-[#e10600] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ba0500]"
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
                        className="flex-1 border border-white/20 bg-transparent px-3 sm:px-5 py-3 text-white text-sm outline-none focus:border-[#e10600] transition"
                        placeholder="Ecrire un message... (utilisez @pseudo)"
                      />
                      <button
                        onClick={sendChat}
                        className="w-full sm:w-auto bg-[#e10600] px-6 sm:px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-[#ba0500] transition"
                      >
                        Envoyer
                      </button>
                    </div>
                  </>
                )}

                {chatView === "evolution" && (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                    <div className="space-y-4">
                      <div className="border border-[#313541] bg-[#1a1d24]/88 p-4 space-y-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Nouvelle demande</p>
                        <input
                          value={newEvolutionTitle}
                          onChange={(e) => setNewEvolutionTitle(e.target.value)}
                          className="w-full border border-white/20 bg-transparent px-3 py-2 text-white text-sm outline-none focus:border-[#e10600] transition"
                          placeholder="Titre"
                        />
                        <textarea
                          value={newEvolutionBody}
                          onChange={(e) => setNewEvolutionBody(e.target.value)}
                          className="w-full min-h-28 border border-white/20 bg-transparent px-3 py-2 text-white text-sm outline-none focus:border-[#e10600] transition"
                          placeholder="Detaille ta demande d'evolution..."
                        />
                        <button
                          onClick={createEvolutionRequest}
                          className="w-full bg-[#e10600] px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#ba0500] transition"
                        >
                          Ouvrir une demande
                        </button>
                      </div>

                      <div className="border border-[#313541] bg-[#1a1d24]/88 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Contributeurs</p>
                          <button
                            type="button"
                            onClick={() => setShowEvolutionArchives((current) => !current)}
                            className={`w-full sm:w-auto border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] whitespace-normal break-words text-center transition ${showEvolutionArchives ? "border-[#e10600]/60 bg-[#e10600]/15 text-white" : "border-white/20 text-gray-300 hover:text-white hover:border-white/40"}`}
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              {showEvolutionArchives ? "Retour demandes" : "Archives"}
                              {!showEvolutionArchives && archivedEvolutionUnreadCount > 0 && (
                                <span
                                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#e10600] px-1 py-[1px] text-[9px] font-black text-white"
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
                              <div key={item.email} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border border-white/10 bg-[#121419] px-3 py-2">
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

                      <div className="border border-[#313541] bg-[#1a1d24]/88 max-h-[45vh] overflow-y-auto">
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
                                onClick={() => {
                                  setSelectedEvolutionId(request.id);
                                  cancelEvolutionEdit();
                                }}
                                className={`w-full text-left px-4 py-3 border-b border-white/10 transition ${selected ? "bg-[#e10600]/15" : "hover:bg-white/5"}`}
                              >
                                <p className="text-sm font-semibold text-white whitespace-normal break-words leading-5">{request.title}</p>
                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 whitespace-normal break-words">{exchangeCount} echange{exchangeCount > 1 ? "s" : ""}</p>
                                    {requestUnreadCount > 0 && (
                                      <span
                                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#e10600] px-1 py-[1px] text-[9px] font-black text-white"
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

                    <div className="border border-[#313541] bg-[#1a1d24]/88 p-4 space-y-4 min-h-[240px]">
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
                                  <p className="text-xs uppercase tracking-[0.2em] text-[#e10600]">Demande</p>
                                  <h3 className="text-lg font-black text-white mt-1">{currentRequest.title}</h3>
                                  <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">{getPseudo(currentRequest.createdBy)} · {formatChatTime(currentRequest.createdAt)}{currentRequest.editedAt ? " · modifie" : ""}</p>
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
                                  {canEditEvolutionRequest(currentRequest) && (
                                    <button
                                      onClick={() => startEditEvolutionRequest(currentRequest)}
                                      className="border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/40"
                                      title="Editer"
                                      aria-label="Editer"
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Pencil className="h-3.5 w-3.5" />
                                        Editer
                                      </span>
                                    </button>
                                  )}
                                  {(userRole === "admin" || userRole === "superAdmin") && (
                                    <button
                                      onClick={() => deleteEvolutionRequest(currentRequest.id)}
                                      className="border border-[#e10600]/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ff5b63] hover:bg-[#e10600]/10"
                                    >
                                      Supprimer
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="border border-white/10 bg-[#121419] p-3">
                                {editingEvolutionTarget?.type === "request" && editingEvolutionTarget.id === currentRequest.id ? (
                                  <div className="space-y-3">
                                    <input
                                      value={editingEvolutionTitle}
                                      onChange={(e) => setEditingEvolutionTitle(e.target.value)}
                                      className="w-full border border-white/20 bg-transparent px-4 py-2 text-white text-sm outline-none focus:border-[#e10600] transition"
                                      placeholder="Titre de la demande"
                                    />
                                    <textarea
                                      value={editingEvolutionText}
                                      onChange={(e) => setEditingEvolutionText(e.target.value)}
                                      rows={5}
                                      className="w-full border border-white/20 bg-transparent px-4 py-3 text-white text-sm outline-none focus:border-[#e10600] transition resize-y"
                                      placeholder="Message de la demande"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={saveEditedEvolutionMessage}
                                        className="bg-[#e10600] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ba0500]"
                                      >
                                        Enregistrer
                                      </button>
                                      <button
                                        onClick={cancelEvolutionEdit}
                                        className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/40"
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{currentRequest.body}</p>
                                )}
                              </div>

                              <div ref={evolutionScrollRef} className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                                {replies.map((reply: any) => (
                                  <div key={reply.id} className="border border-white/10 bg-[#121419] px-3 py-2">
                                    <div className="mb-1 flex items-start justify-between gap-2">
                                      <p className="text-[10px] uppercase tracking-widest text-gray-500">{getPseudo(reply.user)} · {formatChatTime(reply.createdAt)}{reply.editedAt ? " · modifie" : ""}</p>
                                      {canEditEvolutionReply(reply) && (
                                        <button
                                          onClick={() => startEditEvolutionReply(reply)}
                                          className="text-gray-400 hover:text-white transition"
                                          title="Editer"
                                          aria-label="Editer"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    {editingEvolutionTarget?.type === "reply" && editingEvolutionTarget.id === reply.id ? (
                                      <div className="space-y-3">
                                        <textarea
                                          value={editingEvolutionText}
                                          onChange={(e) => setEditingEvolutionText(e.target.value)}
                                          rows={4}
                                          className="w-full border border-white/20 bg-transparent px-4 py-3 text-white text-sm outline-none focus:border-[#e10600] transition resize-y"
                                          placeholder="Modifier la reponse"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            onClick={saveEditedEvolutionMessage}
                                            className="bg-[#e10600] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ba0500]"
                                          >
                                            Enregistrer
                                          </button>
                                          <button
                                            onClick={cancelEvolutionEdit}
                                            className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/40"
                                          >
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{reply.text}</p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {isArchivedRequest ? (
                                <div className="border border-white/10 bg-[#121419] px-4 py-3">
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
                                    className="flex-1 border border-white/20 bg-transparent px-4 py-2 text-white text-sm outline-none focus:border-[#e10600] transition"
                                    placeholder="Repondre a cette demande..."
                                  />
                                  <button
                                    onClick={sendEvolutionReply}
                                    className="bg-[#e10600] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ba0500]"
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

      <div ref={bottomBarRef} className="fixed bottom-0 left-0 right-0 z-50">
        <nav className="border-t border-white/10 bg-[#0c0d11]/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-2 py-2">
            <div
              className={`grid gap-1 ${navItems.length === 7 ? "grid-cols-7" : navItems.length === 6 ? "grid-cols-6" : "grid-cols-5"}`}
            >
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
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#e10600]" : "text-gray-500"}`} />
                      {item.key === "chat" && chatReadsLoaded && !suppressChatBadge && chatNotificationCount > 0 && (
                        <span
                          className="absolute -right-3 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#e10600] px-1 py-[1px] text-[9px] font-black text-white"
                          aria-label={`Notification ${chatNotificationCount}`}
                          title={`Notification ${chatNotificationCount}`}
                        >
                          {chatNotificationCount}
                        </span>
                      )}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.06em] leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 bg-[#0c0d11]/95">
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
                className="normal-case text-[8px] sm:text-[9px] font-medium tracking-[0.28em] text-white/28 hover:text-white/45 transition whitespace-normal break-words"
              >
                AB 2026 v2
              </button>
            </div>
          </div>
        </div>
      </div>

      {venueEditorEventId && venueEditorEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md border border-white/20 bg-[#13151b] p-4 sm:p-5">
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
                className="bg-[#e10600] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#ba0500]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditingMember && selectedMember && canManageMemberProfiles && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1014] border-l-4 border-[#e10600] border border-white/10 shadow-2xl max-w-[64rem] w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
              <div className="w-1 h-6 bg-[#e10600]" />
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">Modifier le membre</h2>
            </div>
            <div className="p-6">
            <div className="mb-6 flex items-center gap-4 border border-white/10 p-4 bg-white/5">
              <div className="w-[168px] h-[168px] sm:w-[180px] sm:h-[180px] bg-[#e10600] flex items-center justify-center overflow-hidden flex-shrink-0">
                {tempMemberAvatar ? (
                  <img src={tempMemberAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-[72px] h-[72px] text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p
                  className="f1-title font-black text-white uppercase whitespace-nowrap"
                  style={getAdaptivePseudoStyle(tempMemberPseudo || selectedMember.email, 34)}
                  title={tempMemberPseudo || selectedMember.email}
                >
                  {tempMemberPseudo || selectedMember.email}
                </p>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{tempMemberTeam || "Sans écurie"}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Rôle</label>
              <select
                value={tempMemberRole}
                onChange={(e) => setTempMemberRole(e.target.value)}
                className="w-full px-4 py-3 bg-[#e10600] border-2 border-[#e10600] rounded-lg text-white font-semibold hover:bg-[#ba0500] transition"
              >
                <option value="member" className="bg-gray-800 text-white">Membre</option>
                <option value="admin" className="bg-gray-800 text-white">Admin</option>
              </select>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Pseudo</label>
                <input
                  type="text"
                  value={tempMemberPseudo}
                  onChange={(e) => setTempMemberPseudo(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Pseudo du membre"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Écurie</label>
                <input
                  type="text"
                  value={tempMemberTeam}
                  onChange={(e) => setTempMemberTeam(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="Nom de l'écurie"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Avatar (URL)</label>
                <input
                  type="text"
                  value={tempMemberAvatarUrlInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTempMemberAvatarUrlInput(value);
                    if (value.trim()) setTempMemberAvatar(value.trim());
                  }}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white"
                  placeholder="https://..."
                />
              </div>
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
                    const nextTeamName = String(tempMemberTeam || "").trim();
                    const previousTeamName = String(selectedMember.team || "").trim();
                    await updateMemberDetails(selectedMember.email, {
                      role: tempMemberRole,
                      pseudo: tempMemberPseudo.trim() || null,
                      team: nextTeamName || null,
                      avatar: String(tempMemberAvatar || "").trim() || null,
                      pilotStars: tempPilotStars.trim(),
                      pilotStarSeasons: tempPilotSeasons.trim(),
                      teamStars: tempTeamStars.trim(),
                      teamStarSeasons: tempTeamSeasons.trim(),
                      crowns: tempCrowns.trim(),
                      crownSeasons: tempCrownSeasons.trim(),
                    });

                    if (selectedMember.email && nextTeamName && previousTeamName !== nextTeamName) {
                      await applyTeamNameRetroactively(selectedMember.email, nextTeamName);
                    }

                    setIsEditingMember(false);
                    setSelectedMember(null);
                  }
                }}
                className="flex-1 bg-[#e10600] px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[#ba0500] transition"
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

