"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  applyPilotNamesRetroactively,
  ensureCurrentWeeklyRace,
  runRaceSimulationAndPersist,
  savePilotProfile,
  saveEntry,
  subscribeEntries,
  subscribeEntry,
  subscribePilotProfile,
  subscribeLatestRaceResult,
  subscribeRaceHistory,
  subscribeRaceResult,
  subscribeRace,
  subscribeSeasonStandings,
} from "./firestore";
import { carBudgetUsed } from "./simulator";
import { getCircuitConfigForWeekKey, getStatModifier, getStatMultiplier, profileLabel, type SimuF1StatKey } from "./circuit-config";
import type {
  SimuF1CarSetup,
  SimuF1Entry,
  SimuF1PilotProfile,
  SimuF1Race,
  SimuF1RaceHistoryItem,
  SimuF1RaceResult,
  SimuF1SeasonStandings,
} from "./types";
import TeamProfilePanel, { slugifyTeamName } from "./TeamProfilePanel";

type Props = {
  userEmail: string;
  userPseudo: string;
  defaultTeamName: string;
  isSuperAdmin: boolean;
};

const defaultCar = (pilotName: string): SimuF1CarSetup => ({
  pilotName,
  bloc: 5,
  grip: 5,
  audace: 5,
  defense: 5,
  endurance: 5,
  pneus: 5,
  pitStops: 1,
  pitLaps: [5],
});

const QUALIF_STATS: Array<keyof SimuF1CarSetup> = ["bloc", "grip"];
const COURSE_STATS: Array<keyof SimuF1CarSetup> = ["audace", "defense", "endurance", "pneus"];
const PARIS_TZ = "Europe/Paris";

const nextSundayISO = () => {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay();
  const diff = (7 - day) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const getParisNowParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
};

const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const getOffsetMinutesParis = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: PARIS_TZ, timeZoneName: "shortOffset" }).formatToParts(date);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const m = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] || "0");
  const mm = Number(m[3] || "0");
  return sign * (hh * 60 + mm);
};

const parisLocalToUtc = (year: number, month: number, day: number, hour: number, minute: number, second: number) => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const offset = getOffsetMinutesParis(new Date(guess));
    guess = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000;
  }
  return new Date(guess);
};

const nextParisSundayNoon = (now = new Date()) => {
  const p = getParisNowParts(now);
  const weekday = weekdayMap[p.weekday] ?? 0;
  let daysUntilSunday = (7 - weekday) % 7;
  const isPastNoonSunday = daysUntilSunday === 0 && (p.hour > 12 || (p.hour === 12 && (p.minute > 0 || p.second > 0)));
  if (isPastNoonSunday) daysUntilSunday = 7;

  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  base.setUTCDate(base.getUTCDate() + daysUntilSunday);
  return parisLocalToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 12, 0, 0);
};

const isRaceDueInParis = (sundayDateISO: string) => {
  const [y, m, d] = sundayDateISO.split("-").map(Number);
  if (!y || !m || !d) return false;
  const target = parisLocalToUtc(y, m, d, 12, 0, 0);
  return Date.now() >= target.getTime();
};

const formatCountdown = (ms: number) => {
  const safe = Math.max(0, ms);
  const total = Math.floor(safe / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days}j ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

const formatRaceDate = (dateISO: string) => {
  const [year, month, day] = dateISO.split("-").map(Number);
  if (!year || !month || !day) return dateISO;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

const gripEffect = (grip: number) => {
  const rules: Record<number, { chance: number; places: number; direction: "gain" | "lose" | "none" }> = {
    1: { chance: 80, places: 3, direction: "lose" },
    2: { chance: 60, places: 2, direction: "lose" },
    3: { chance: 40, places: 2, direction: "lose" },
    4: { chance: 20, places: 1, direction: "lose" },
    5: { chance: 0, places: 0, direction: "none" },
    6: { chance: 20, places: 1, direction: "gain" },
    7: { chance: 40, places: 1, direction: "gain" },
    8: { chance: 60, places: 2, direction: "gain" },
    9: { chance: 80, places: 2, direction: "gain" },
    10: { chance: 100, places: 3, direction: "gain" },
  };
  return rules[grip] || rules[5];
};
const audaceChance = (audace: number) => (audace >= 5 ? 16 + (audace - 5) * 6.3 : Math.max(5, 16 - (5 - audace) * 2.5));
const defenseChance = (defense: number) => (defense >= 5 ? 20 + (defense - 5) * 10 : Math.max(0, 20 - (5 - defense) * 5));
const enduranceBreakChance = (endurance: number) => (endurance >= 5 ? Math.max(0.95, 2.1 - (endurance - 5) * 0.22) : 2.1 + (5 - endurance) * 0.4);

const ceilInt = (value: number) => Math.ceil(Math.max(0, value));

const blocDeltaWithCircuit = (value: number, modifier: "boosted" | "penalized" | "neutral") => {
  const base = value - 5;
  if (value === 5 || modifier === "neutral") return base;
  if (value > 5) {
    if (modifier === "boosted") return base * 1.5;
    return base / 2;
  }
  if (modifier === "boosted") return base / 2;
  return base * 1.5;
};

const gripFactorWithCircuit = (value: number, modifier: "boosted" | "penalized" | "neutral") => {
  if (value === 5 || modifier === "neutral") return 1;
  if (value > 5) {
    if (modifier === "boosted") return 1.5;
    return 0.5;
  }
  if (modifier === "boosted") return 1 / 0.5;
  return 1.5;
};

const enduranceFactorWithCircuit = (modifier: "boosted" | "penalized" | "neutral") => {
  if (modifier === "boosted") return 0.72;
  if (modifier === "penalized") return 1.3;
  return 1;
};

const pneusScoreWithCircuit = (pneus: number, modifier: "boosted" | "penalized" | "neutral") => {
  let score = 11 - pneus;
  if (modifier === "boosted") score = Math.max(1, score - 1);
  if (modifier === "penalized") score += 1;
  return score;
};

const statRuleText = (
  key: SimuF1StatKey,
  value: number,
  circuit: ReturnType<typeof getCircuitConfigForWeekKey>
) => {
  const modifier = getStatModifier(circuit, key);
  const multiplier = getStatMultiplier(circuit, key);
  const modifierText = modifier === "boosted" ? "boostee" : modifier === "penalized" ? "penalisee" : "normale";
  if (key === "bloc") {
    const delta = value - 5;
    const adjusted = blocDeltaWithCircuit(value, modifier);
    return `QUALIF (${modifierText}): delta ${adjusted >= 0 ? "+" : ""}${adjusted.toFixed(1)}s (base ${delta >= 0 ? "+" : ""}${delta}s).`;
  }
  if (key === "grip") {
    const effect = gripEffect(value);
    if (effect.direction === "none") return `QUALIF (${modifierText}): aucun effet.`;
    const label = effect.direction === "gain" ? "chance de gagner" : "risque de perdre";
    const factor = gripFactorWithCircuit(value, modifier);
    const chance = Math.max(0, Math.min(100, ceilInt(effect.chance * factor)));
    const places = ceilInt(effect.places * factor);
    const placeLabel = places > 1 ? "places" : "place";
    return `QUALIF (${modifierText}): ${chance}% de ${label} ${places} ${placeLabel} (base ${effect.chance}% / ${effect.places}).`;
  }
  if (key === "audace") {
    const adjusted = Math.min(100, ceilInt(audaceChance(value) * multiplier));
    return `COURSE (${modifierText}): ${adjusted}% de chance de tentative de depassement (base ${audaceChance(value)}%).`;
  }
  if (key === "defense") {
    const adjusted = Math.min(100, ceilInt(defenseChance(value) * multiplier));
    return `COURSE (${modifierText}): ${adjusted}% de chance de bloquer un depassement (base ${defenseChance(value)}%).`;
  }
  if (key === "endurance") {
    const adjusted = Math.min(100, enduranceBreakChance(value) * enduranceFactorWithCircuit(modifier));
    return `COURSE (${modifierText}): ${adjusted.toFixed(1)}% de risque de casse par tour (base ${enduranceBreakChance(value).toFixed(1)}%).`;
  }
  if (key === "pneus") {
    const score = pneusScoreWithCircuit(value, modifier);
    const base = 11 - value;
    return `COURSE (${modifierText}): score pneus ${score} (base ${base}) sur 10 tours. A chaque echec pneus: +1 stack usure. Fin de tour: perte de floor(stacks/2) places. Pit stop: reset stacks.`;
  }
  return "";
};

const statLabel = (key: keyof SimuF1CarSetup) => {
  if (key === "bloc") return "VITESSE";
  if (key === "grip") return "BOOST";
  if (key === "audace") return "AUDACE";
  if (key === "defense") return "DÉFENSE";
  if (key === "endurance") return "ENDURANCE";
  if (key === "pneus") return "PNEUS";
  return String(key).toUpperCase();
};

// Qualif = spectre rouge (violet → orange)  |  Course = spectre bleu (bleu → jaune)
const STAT_COLORS: Record<string, { filled: string; empty: string; text: string; glow: string }> = {
  bloc:      { filled: "bg-violet-500",  empty: "bg-violet-900/30",  text: "text-violet-300",  glow: "shadow-[0_0_6px_rgba(139,92,246,0.7)]" },
  grip:      { filled: "bg-orange-400",  empty: "bg-orange-900/30",  text: "text-orange-300",  glow: "shadow-[0_0_6px_rgba(251,146,60,0.7)]" },
  audace:    { filled: "bg-blue-500",    empty: "bg-blue-900/30",    text: "text-blue-300",    glow: "shadow-[0_0_6px_rgba(59,130,246,0.7)]" },
  defense:   { filled: "bg-cyan-400",    empty: "bg-cyan-900/30",    text: "text-cyan-300",    glow: "shadow-[0_0_6px_rgba(34,211,238,0.7)]" },
  endurance: { filled: "bg-teal-400",    empty: "bg-teal-900/30",    text: "text-teal-300",    glow: "shadow-[0_0_6px_rgba(45,212,191,0.7)]" },
  pneus:     { filled: "bg-yellow-400",  empty: "bg-yellow-900/30",  text: "text-yellow-300",  glow: "shadow-[0_0_6px_rgba(250,204,21,0.7)]" },
};

const StatBar = ({ statKey, value }: { statKey: string; value: number }) => {
  const c = STAT_COLORS[statKey] ?? { filled: "bg-gray-400", empty: "bg-gray-800", text: "text-gray-300", glow: "" };
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`w-[5px] h-[14px] rounded-sm transition-all ${i < value ? `${c.filled} ${c.glow}` : c.empty}`}
        />
      ))}
    </div>
  );
};

type StandingsRowProps = {
  rank: number;
  title: string;
  subtitle?: string;
  points: number;
  accentColor: string;
  compact?: boolean;
  onClick?: () => void;
  rightAddon?: ReactNode;
  staggerIndex?: number;
};

const StandingsRow = ({
  rank,
  title,
  subtitle,
  points,
  accentColor,
  compact = false,
  onClick,
  rightAddon,
  staggerIndex = 0,
}: StandingsRowProps) => {
  const rowStyle = {
    "--fd-row-delay": `${Math.min(staggerIndex * 45, 500)}ms`,
  } as CSSProperties;

  return (
    <div
      className={`fd-row-stagger flex items-center justify-between rounded-[2px] border border-[#3a3034] bg-[#1f232b] px-2.5 py-2 transition ${onClick ? "cursor-pointer hover:border-[#a13a42] hover:bg-[#2a171a]" : ""}`}
      style={rowStyle}
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className={`inline-flex items-center justify-center rounded-[2px] bg-[#f7f8fb] px-1 font-black leading-none text-[#101834] ${compact ? "h-7 min-w-7 text-sm" : "h-10 min-w-10 text-xl"}`}>
          {rank}
        </span>
        <span className={`rounded-full ${compact ? "h-7 w-[3px]" : "h-8 w-[3px]"}`} style={{ backgroundColor: accentColor }} />
        <div className="min-w-0">
          <p className={`truncate uppercase leading-none text-white ${compact ? "text-sm font-bold tracking-[0.02em]" : "text-lg sm:text-2xl font-semibold"}`}>{title}</p>
          {subtitle ? (
            <p className={`truncate uppercase ${compact ? "text-[10px] tracking-[0.14em] text-[#a7aebb]" : "text-sm font-medium tracking-[0.08em] text-[#9aa1b0]"}`}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <p className={`font-semibold leading-[0.85] text-[#f6f8fc] ${compact ? "text-[30px]" : "text-[36px] sm:text-[58px]"}`}>{points}</p>
        {rightAddon}
      </div>
    </div>
  );
};

const pitStopsOrderError = (car: SimuF1CarSetup) => {
  for (let i = 0; i < car.pitStops; i += 1) {
    const lap = car.pitLaps[i];
    if (!Number.isFinite(lap) || lap < 1 || lap > 9) {
      return `Donnée invalide: chaque tour d'arrêt doit être compris entre 1 et 9 (course en 10 tours).`;
    }
  }
  if (car.pitStops <= 1) return null;
  for (let i = 0; i < car.pitStops - 1; i += 1) {
    const current = car.pitLaps[i];
    const next = car.pitLaps[i + 1];
    if (!(current < next)) {
      return `Donnée invalide: le tour d'arrêt ${i + 1} doit être strictement inférieur au tour d'arrêt ${i + 2}.`;
    }
  }
  return null;
};

const getMemberDisplayName = (userPseudo: string, userEmail: string) => {
  const pseudo = String(userPseudo || "").trim();
  if (pseudo) return pseudo;
  return String(userEmail || "").split("@")[0]?.trim() || "Pilote";
};

const getDefaultTeamName = (defaultTeamName: string, userPseudo: string, userEmail: string) => {
  const explicitTeamName = String(defaultTeamName || "").trim();
  if (explicitTeamName) return explicitTeamName;
  return `Écurie de ${getMemberDisplayName(userPseudo, userEmail)}`;
};

const getTeamPageHref = (teamName: string) => `/dashboard?tab=simuf1&team=${slugifyTeamName(teamName)}`;

const BACK_BUTTON_CLASS =
  "inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white";


export default function SimuF1Panel({ userEmail, userPseudo, defaultTeamName, isSuperAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamSlugFromQuery = String(searchParams.get("team") || "").trim();
  const fallbackTeamName = getDefaultTeamName(defaultTeamName, userPseudo, userEmail);
  const [view, setView] = useState<"home" | "setup" | "lastgp" | "standings" | "race-detail" | "team-profile">("home");
  const [raceId, setRaceId] = useState<string>("");
  const [race, setRace] = useState<SimuF1Race | null>(null);
  const [entries, setEntries] = useState<SimuF1Entry[]>([]);
  const [result, setResult] = useState<SimuF1RaceResult | null>(null);
  const [pilotProfile, setPilotProfile] = useState<SimuF1PilotProfile | null>(null);
  const [seasonStandings, setSeasonStandings] = useState<SimuF1SeasonStandings | null>(null);
  const [raceHistory, setRaceHistory] = useState<SimuF1RaceHistoryItem[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedRaceResult, setSelectedRaceResult] = useState<SimuF1RaceResult | null>(null);
  const [selectedRaceEntries, setSelectedRaceEntries] = useState<SimuF1Entry[]>([]);
  const [lastGpResult, setLastGpResult] = useState<SimuF1RaceResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [nowTick, setNowTick] = useState(Date.now());
  const autoRunRef = useRef<string | null>(null);

  const activeCircuit = useMemo(() => getCircuitConfigForWeekKey(race?.weekKey || ""), [race?.weekKey]);

  const [draft, setDraft] = useState<SimuF1Entry>({
    raceId: "",
    seasonYear: new Date().getFullYear(),
    userEmail,
    userPseudo: userPseudo || userEmail,
    teamName: fallbackTeamName,
    participating: true,
    cars: [defaultCar("Pilote1"), defaultCar("Pilote2")],
  });

  useEffect(() => {
    let unsubRace = () => {};
    let unsubMine = () => {};
    let unsubEntries = () => {};
    let unsubResult = () => {};

    const init = async () => {
      const seasonYear = 2026;
      const id = await ensureCurrentWeeklyRace(seasonYear);
      setRaceId(id);
      setDraft((prev) => ({ ...prev, raceId: id, seasonYear }));

      unsubRace = subscribeRace(id, setRace);
      unsubMine = subscribeEntry(id, userEmail, (mine) => {
        if (!mine) return;
        setDraft(mine);
      });
      unsubEntries = subscribeEntries(id, setEntries);
      unsubResult = subscribeLatestRaceResult(id, setResult);
      subscribePilotProfile(userEmail, setPilotProfile);
      subscribeSeasonStandings(seasonYear, setSeasonStandings);
      subscribeRaceHistory(seasonYear, setRaceHistory);
    };

    void init();

    return () => {
      unsubRace();
      unsubMine();
      unsubEntries();
      unsubResult();
    };
  }, [userEmail]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      userPseudo: userPseudo || prev.userPseudo,
      teamName: String(prev.teamName || "").trim() || fallbackTeamName,
    }));
  }, [userPseudo, fallbackTeamName]);

  useEffect(() => {
    if (!pilotProfile) return;
    setDraft((prev) => {
      const cars = [...prev.cars] as [SimuF1CarSetup, SimuF1CarSetup];
      cars[0] = { ...cars[0], pilotName: pilotProfile.pilot1Name || cars[0].pilotName };
      cars[1] = { ...cars[1], pilotName: pilotProfile.pilot2Name || cars[1].pilotName };
      return { ...prev, cars };
    });
  }, [pilotProfile]);

  const participants = useMemo(() => entries.filter((e) => e.participating), [entries]);
  const validatedParticipantsCount = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.participating === false) return false;
      return Array.isArray(entry.cars) && entry.cars.length === 2;
    }).length;
  }, [entries]);
  const participatingTeamNames = useMemo(() => {
    const names = entries
      .filter((entry) => {
        if (entry.participating === false) return false;
        return Array.isArray(entry.cars) && entry.cars.length === 2;
      })
      .map((entry) => String(entry.teamName || "").trim() || "Ecurie sans nom");

    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [entries]);
  const participantsPilotNames = useMemo(() => {
    const names = new Set<string>();
    participants.forEach((entry) => {
      entry.cars.forEach((car) => names.add(car.pilotName));
    });
    return names;
  }, [participants]);

  const liveStandingRows = useMemo(() => {
    const drivers = seasonStandings?.drivers || {};
    return Object.entries(drivers)
      .filter(([pilot]) => participantsPilotNames.has(pilot))
      .sort((a, b) => b[1] - a[1])
      .map(([pilot, points]) => ({ pilot, points }));
  }, [seasonStandings, participantsPilotNames]);

  const liveTeamStandingRows = useMemo(() => {
    const teams = seasonStandings?.teams || {};
    return Object.entries(teams)
      .sort((a, b) => b[1] - a[1])
      .map(([team, points]) => ({ team, points }));
  }, [seasonStandings]);

  const pilotTeamMapping = useMemo(() => {
    const map = new Map<string, string>();
    // From current race participants
    participants.forEach((entry) => {
      entry.cars.forEach((car) => {
        map.set(car.pilotName, entry.teamName);
      });
    });
    // Supplement from lastGpResult (pilots from last published race)
    if (lastGpResult) {
      lastGpResult.cars.forEach((car) => {
        if (!map.has(car.pilotName)) map.set(car.pilotName, car.teamName);
      });
    }
    // Supplement from selectedRaceResult
    if (selectedRaceResult) {
      selectedRaceResult.cars.forEach((car) => {
        if (!map.has(car.pilotName)) map.set(car.pilotName, car.teamName);
      });
    }
    return map;
  }, [participants, lastGpResult, selectedRaceResult]);

  const liveDriverStandingsWithTeams = useMemo(() => {
    const drivers = seasonStandings?.drivers || {};
    return Object.entries(drivers)
      .sort((a, b) => b[1] - a[1])
      .map(([pilot, points], idx) => ({
        pilot,
        points,
        team: pilotTeamMapping.get(pilot) || "—",
        position: idx + 1,
      }));
  }, [seasonStandings, pilotTeamMapping]);

  const latestPublishedRace = useMemo(() => {
    return raceHistory
      .filter((gp) => gp.status === "published")
      .sort((a, b) => String(b.sundayDateISO || "").localeCompare(String(a.sundayDateISO || "")))[0] || null;
  }, [raceHistory]);

  const teamAccents = ["#ffb100", "#e10600", "#1f6feb", "#ffd60a", "#ff7fbf", "#9ca3af", "#22c55e", "#fb923c", "#06b6d4"];

  const getTeamAccent = (teamName: string) => {
    const cleaned = String(teamName || "").trim().toLowerCase();
    if (!cleaned || cleaned === "—") return "#94a3b8";
    const compact = cleaned.replace(/[^a-z0-9]+/g, " ").trim();

    if (compact === "bears fury crew" || compact === "bear s fury crew") return "#e10600";
    if (compact === "tigers fury crew" || compact === "tiger s fury crew") return "#ff8a00";
    if (compact === "frx") return "#22cfd0";

    let hash = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      hash = (hash << 5) - hash + cleaned.charCodeAt(i);
      hash |= 0;
    }
    return teamAccents[Math.abs(hash) % teamAccents.length];
  };

  const goToTeamPage = (teamName: string, e?: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!teamName || teamName === "—") return;
    e?.stopPropagation();
    e?.preventDefault();
    router.push(getTeamPageHref(teamName));
  };

  const backFromTeamProfile = () => {
    router.push("/dashboard?tab=simuf1");
  };

  const generateRaceAnalysis = (result: SimuF1RaceResult | null, raceInfo: typeof latestPublishedRace | null, raceEntries: SimuF1Entry[]) => {
    if (!result || result.cars.length === 0) return "";

    const winner = result.cars[0];
    const podium = result.cars.slice(0, 3);
    const dnfs = result.cars.filter((c) => c.dnf);
    const diceLogs = result.diceLogs || [];
    const circuit = raceInfo?.circuitName || "ce circuit";
    const circuitConfig = raceInfo?.weekKey ? getCircuitConfigForWeekKey(raceInfo.weekKey) : null;

    const statNames: Record<string, string> = {
      bloc: "VITESSE",
      grip: "BOOST",
      audace: "AUDACE",
      defense: "DÉFENSE",
      endurance: "ENDURANCE",
      pneus: "PNEUS",
    };

    const getSetup = (car: typeof winner) =>
      raceEntries.find((e) => e.userEmail === car.ownerEmail)?.cars.find((c) => c.pilotName === car.pilotName) ?? null;

    const allSetups = raceEntries.flatMap((e) => e.cars);
    const avgByStat = {
      bloc: allSetups.reduce((s, c) => s + c.bloc, 0) / (allSetups.length || 1),
      grip: allSetups.reduce((s, c) => s + c.grip, 0) / (allSetups.length || 1),
      audace: allSetups.reduce((s, c) => s + c.audace, 0) / (allSetups.length || 1),
      defense: allSetups.reduce((s, c) => s + c.defense, 0) / (allSetups.length || 1),
      endurance: allSetups.reduce((s, c) => s + c.endurance, 0) / (allSetups.length || 1),
      pneus: allSetups.reduce((s, c) => s + c.pneus, 0) / (allSetups.length || 1),
    };

    const statUseCount: Record<string, number> = { bloc: 0, grip: 0, audace: 0, defense: 0, endurance: 0, pneus: 0 };
    let successCount = 0;
    let failCount = 0;
    diceLogs.forEach((log) => {
      if (log.stat in statUseCount) statUseCount[log.stat] += 1;
      if (log.success) successCount += 1;
      else failCount += 1;
    });

    const dominantSimStat = Object.entries(statUseCount).sort((a, b) => b[1] - a[1])[0];
    const successRate = Math.round((successCount * 100) / (successCount + failCount || 1));
    const earlyDnfs = dnfs.filter((d) => (d.dnfLap || 99) <= 5);

    const winnerSetup = getSetup(winner);
    const winnerTopStats = winnerSetup
      ? Object.entries({ bloc: winnerSetup.bloc, grip: winnerSetup.grip, audace: winnerSetup.audace, defense: winnerSetup.defense, endurance: winnerSetup.endurance, pneus: winnerSetup.pneus })
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
      : [];

    const podiumSetupLines = podium
      .map((car) => {
        const s = getSetup(car);
        if (!s) return null;
        const strengths = Object.entries({ bloc: s.bloc, grip: s.grip, audace: s.audace, defense: s.defense, endurance: s.endurance, pneus: s.pneus })
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k, v]) => `${statNames[k]} ${v}`)
          .join(" / ");
        const profile = s.audace >= 7 ? "ultra-offensive" : s.defense >= 7 ? "compacte et défensive" : s.endurance >= 7 ? "endurante et régulière" : "polyvalente";
        const pit = s.pitStops === 0 ? "zéro arrêt" : s.pitStops === 1 ? "1 arrêt" : `${s.pitStops} arrêts`;
        return `**${car.pilotName}** (${car.teamName}) : config ${profile}, points forts ${strengths}, stratégie stands ${pit}.`;
      })
      .filter(Boolean);

    const boostedLabel = (circuitConfig?.boosted || []).map((k) => statNames[k]).join(" / ");
    const penalizedLabel = (circuitConfig?.penalized || []).map((k) => statNames[k]).join(" / ");

    const lines: string[] = [];
    lines.push(`🏁 **${circuit.toUpperCase()} — ANALYSE À CHAUD !**`);
    lines.push("");
    lines.push(`Quel final ! **${winner.pilotName}** arrache la victoire avec **${winner.points} pts**, dans une course nerveuse où chaque réglage a compté au millimètre. On n'a pas juste vu des pilotes rapides, on a vu des choix techniques assumés: appuis, agressivité, tenue des gommes, et surtout maîtrise des arrêts.`);
    lines.push("");
    lines.push("## 🏆 PODIUM");
    podium.forEach((car, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      lines.push(`${medal} **${car.pilotName}** · ${car.teamName} · ${car.points} pts`);
    });
    if (dnfs.length > 0) {
      lines.push("");
      lines.push(`💥 **Abandons**: ${dnfs.map((d) => `${d.pilotName} (T${d.dnfLap})`).join(" · ")} ${earlyDnfs.length > 0 ? "— incidents précoces qui ont retourné la hiérarchie." : "— conséquence directe de prises de risques tardives."}`);
    }
    lines.push("");
    lines.push("## ⚙️ CONFIGURATION DÉCISIVE");
    if (winnerSetup && winnerTopStats.length > 0) {
      lines.push(`Chez le vainqueur, la base était claire: **${winnerTopStats.map(([k, v]) => `${statNames[k]} ${v}`).join(" + ")}**. Cette combinaison a fait la différence, avec ${winnerSetup.pitStops === 0 ? "une approche sans arrêt" : `${winnerSetup.pitStops} passage${winnerSetup.pitStops > 1 ? "s" : ""} au stand`} parfaitement calé${winnerSetup.pitStops > 1 ? "s" : ""} sur le tempo de la course.`);
    }
    if (boostedLabel || penalizedLabel) {
      lines.push(`Le profil du circuit a pesé lourd: boost sur **${boostedLabel || "aucune stat"}**, pénalité sur **${penalizedLabel || "aucune stat"}**. Les équipes qui ont orienté leur setup dans ce sens ont clairement pris l'ascendant.`);
    }
    podiumSetupLines.forEach((l) => l && lines.push(l));
    lines.push("");
    lines.push("## 🔥 VERDICT COMMENTATEUR");
    lines.push(`Cette analyse se mettra à jour automatiquement à chaque Grand Prix: même format, mais lecture différente selon les logs réels, les abandons, les stats dominantes et les choix de setup. Ici, la course s'est gagnée dans le garage autant que sur la piste.`);

    return lines.join("\n");
  };

  const getCarConfigSummary = (car: SimuF1CarSetup) => {
    const stats = { bloc: car.bloc, grip: car.grip, audace: car.audace, defense: car.defense, endurance: car.endurance, pneus: car.pneus };
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 2).map((s) => `${s[0]} ${s[1]}`).join(" • ");
    return `${top} • Arrêts: ${car.pitStops}`;
  };

  useEffect(() => {
    if (!selectedRaceId) return;
    const unsubResult = subscribeRaceResult(selectedRaceId, setSelectedRaceResult);
    const unsubEntries = subscribeEntries(selectedRaceId, setSelectedRaceEntries);
    return () => { unsubResult(); unsubEntries(); };
  }, [selectedRaceId]);

  useEffect(() => {
    if (!latestPublishedRace?.id) {
      setLastGpResult(null);
      return;
    }

    const unsub = subscribeRaceResult(latestPublishedRace.id, setLastGpResult);
    return () => unsub();
  }, [latestPublishedRace?.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!raceId) return;
    if (typeof window === "undefined") return;
    const isArnaud = (userEmail || "").toLowerCase() === "beaudouin.arnaud@gmail.com" || (userPseudo || "").toLowerCase() === "arnaud";
    if (!isArnaud) return;

    const key = `simuf1_reset_once_${raceId}_${(userEmail || "arnaud").toLowerCase()}`;
    if (window.localStorage.getItem(key) === "done") return;

    const resetEntry: SimuF1Entry = {
      raceId,
      seasonYear: race?.seasonYear || 2026,
      userEmail,
      userPseudo: userPseudo || userEmail,
      teamName: fallbackTeamName,
      participating: false,
      cars: [defaultCar("Pilote1"), defaultCar("Pilote2")],
    };

    void saveEntry(raceId, resetEntry).then(() => {
      setDraft(resetEntry);
      setMessage("Configuration Arnaud vidée: tu peux la modifier et sauvegarder à nouveau.");
      window.localStorage.setItem(key, "done");
    }).catch(() => {
      // Ignore and let manual save flow handle retry.
    });
  }, [raceId, race?.seasonYear, userEmail, userPseudo, fallbackTeamName]);

  useEffect(() => {
    if (!raceId || !race?.sundayDateISO) return;
    if (race.status === "published") return;
    const key = `${raceId}:${race.status}`;
    if (autoRunRef.current === key) return;
    if (!isRaceDueInParis(race.sundayDateISO)) return;

    autoRunRef.current = key;
    void runRaceSimulationAndPersist(raceId, race.seasonYear)
      .then(() => setMessage(`Grand Prix ${activeCircuit.circuitName} lance automatiquement (dimanche 12h heure de Paris).`))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Erreur pendant le lancement automatique.";
        setMessage(message);
      });
  }, [raceId, race?.seasonYear, race?.status, race?.sundayDateISO, activeCircuit.circuitName]);

  const setCarField = (index: 0 | 1, key: keyof SimuF1CarSetup, value: string | number) => {
    setDraft((prev) => {
      const cars = [...prev.cars] as [SimuF1CarSetup, SimuF1CarSetup];
      cars[index] = { ...cars[index], [key]: value };
      return { ...prev, cars };
    });
  };

  const setPitStops = (index: 0 | 1, value: number) => {
    setDraft((prev) => {
      const cars = [...prev.cars] as [SimuF1CarSetup, SimuF1CarSetup];
      const safe = Math.max(0, Math.min(3, value));
      const oldLaps = cars[index].pitLaps;
      const nextLaps = [...oldLaps.slice(0, safe)];
      while (nextLaps.length < safe) nextLaps.push(5 + nextLaps.length);
      cars[index] = { ...cars[index], pitStops: safe, pitLaps: nextLaps };
      return { ...prev, cars };
    });
  };

  const setPitLap = (index: 0 | 1, stopIdx: number, lap: number) => {
    setDraft((prev) => {
      const cars = [...prev.cars] as [SimuF1CarSetup, SimuF1CarSetup];
      const pitLaps = [...cars[index].pitLaps];
      pitLaps[stopIdx] = Math.max(1, Math.min(9, lap));
      cars[index] = { ...cars[index], pitLaps };
      return { ...prev, cars };
    });
  };

  const canEdit = true;

  const countdownLabel = useMemo(() => {
    const target = nextParisSundayNoon(new Date(nowTick));
    return formatCountdown(target.getTime() - nowTick);
  }, [nowTick]);

  const save = async () => {
    if (!raceId) return;
    const invalidOrder = draft.cars
      .map((car, idx) => ({ idx, error: pitStopsOrderError(car) }))
      .find((item) => item.error);
    if (invalidOrder?.error) {
      setMessage(`Voiture ${invalidOrder.idx + 1}: ${invalidOrder.error}`);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const pilot1Name = draft.cars[0].pilotName || "Pilote1";
      const pilot2Name = draft.cars[1].pilotName || "Pilote2";

      await savePilotProfile(userEmail, pilot1Name, pilot2Name);

      const shouldApplyRetroactive =
        !pilotProfile ||
        pilotProfile.pilot1Name !== pilot1Name ||
        pilotProfile.pilot2Name !== pilot2Name;

      if (shouldApplyRetroactive) {
        await applyPilotNamesRetroactively(userEmail, pilot1Name, pilot2Name, race?.seasonYear || 2026);
      }

      await saveEntry(raceId, {
        ...draft,
        raceId,
        seasonYear: race?.seasonYear || 2026,
        userEmail,
        userPseudo: draft.userPseudo || userEmail,
        teamName: String(draft.teamName || "").trim() || fallbackTeamName,
      });
      setMessage("Configuration enregistrée. Les noms pilotes sont conservés pour tous les circuits (mise à jour rétroactive appliquée).");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur lors de l'enregistrement.";
      setMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const renderDiceLogs = (raceResult: SimuF1RaceResult | null) => {
    if (!raceResult || raceResult.diceLogs.length === 0) {
      return <p className="text-sm text-gray-400">Aucun jet de dés enregistré.</p>;
    }

    return (
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {[...raceResult.diceLogs]
          .sort((a, b) => b.seq - a.seq)
          .map((log) => (
            <div key={log.seq} className="border border-white/10 bg-black/25 px-3 py-2 text-xs">
              <p className="text-gray-200 uppercase tracking-[0.12em]">#{log.seq} • {log.phase}{log.lap ? ` • Tour ${log.lap}` : ""} • {log.stat.toUpperCase()}</p>
              <p className="mt-1 text-gray-300">{log.summary}</p>
              {log.stat === "pneus" && typeof log.pneusWearStacks === "number" && (
                <p className="mt-1 text-[11px] text-[#90e59a]">
                  Stacks pneus: {log.pneusWearStacks}
                  {typeof log.pneusPlaceDrop === "number" && log.pneusPlaceDrop > 0 ? ` • Perte: ${log.pneusPlaceDrop} place(s)` : ""}
                </p>
              )}
              <p className="mt-1 text-gray-500">Jet: {log.roll ?? "—"} / Seuil: {log.threshold ?? "—"} / Résultat: {log.success ? "Réussi" : "Raté"}</p>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {teamSlugFromQuery && <TeamProfilePanel teamSlug={teamSlugFromQuery} onBack={backFromTeamProfile} />}

      {!teamSlugFromQuery && view === "home" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, participating: true }));
                setView("setup");
              }}
              className="group relative overflow-hidden border border-[#e10600]/60 bg-gradient-to-br from-[#e10600]/25 via-[#8f0f17]/20 to-[#121419] p-6 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] sm:text-[13px] uppercase tracking-[0.2em] text-[#ff6f66]">Prochaine course</p>
                <span className="inline-flex shrink-0 items-center rounded-full border border-[#ff6f66]/25 bg-[#e10600]/18 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd3d0] shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition group-hover:border-[#ff6f66]/40 group-hover:bg-[#e10600]/26 group-hover:text-white">
                  Participer
                </span>
              </div>
              <h4 className="mt-3 text-2xl tracking-[0.08em] text-white">
                <span className="font-black uppercase">{activeCircuit.circuitName}</span>
                <span className="mx-2 font-normal text-white/90">-</span>
                <span className="text-lg font-normal normal-case text-white/90">{formatRaceDate(race?.sundayDateISO || nextSundayISO())}</span>
              </h4>
              <p className="mt-3 text-xs text-[#ffd0cd]">
                {validatedParticipantsCount <= 1 ? "Écurie participante" : "Écuries participantes"}: {validatedParticipantsCount}
                {participatingTeamNames.length > 0 ? ` (${participatingTeamNames.join(" • ")})` : ""}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#ffd0cd]">Départ auto dans {countdownLabel}</p>
            </button>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!latestPublishedRace?.id) return;
                setSelectedRaceId(latestPublishedRace.id);
                setView("race-detail");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (!latestPublishedRace?.id) return;
                  setSelectedRaceId(latestPublishedRace.id);
                  setView("race-detail");
                }
              }}
              className="border border-white/15 bg-[#121419] p-4 sm:p-5 text-left hover:border-white/30 transition cursor-pointer"
            >
              <h4 className="text-lg sm:text-xl font-black uppercase tracking-[0.08em] text-white">Détail du dernier Grand Prix</h4>
              {!latestPublishedRace ? (
                <p className="mt-2 text-sm text-gray-400">Aucun Grand Prix publié pour le moment.</p>
              ) : !lastGpResult ? (
                <p className="mt-2 text-sm text-gray-400">Chargement...</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{latestPublishedRace.circuitName || getCircuitConfigForWeekKey(latestPublishedRace.weekKey).circuitName}</p>
                  <div className="border border-white/10 bg-[#0f1117] p-2 sm:p-2.5">
                    <div className="flex items-end justify-center gap-2 sm:gap-4">
                      {[1, 0, 2].map((podiumIndex) => {
                        const car = lastGpResult.cars[podiumIndex];
                        if (!car) return null;

                        const order = podiumIndex + 1;
                        const heightClass =
                          order === 1
                            ? "h-16 sm:h-20"
                            : order === 2
                            ? "h-14 sm:h-16"
                            : "h-12 sm:h-14";
                        const toneClass =
                          order === 1
                            ? "border-[#b8891e]/60 bg-[#c89b2b] text-[#15171d]"
                            : order === 2
                            ? "border-[#b7bdcc]/45 bg-[#b2b8c6] text-[#0e1118]"
                            : "border-[#9b6a4f]/45 bg-[#8a5d45] text-[#f5f6f8]";
                        const numberClass =
                          order === 1
                            ? "text-xl sm:text-2xl"
                            : order === 2
                            ? "text-lg sm:text-xl"
                            : "text-base sm:text-lg";
                        const pointsClass =
                          order === 1
                            ? "text-[9px] sm:text-[10px]"
                            : "text-[8px] sm:text-[9px]";

                        return (
                          <div key={car.carId} className="flex w-[31%] max-w-[170px] min-w-[92px] flex-col items-center">
                            <div className="mb-1 flex flex-col items-center text-center">
                              <button
                                type="button"
                                onClick={(e) => goToTeamPage(car.teamName, e)}
                                className="text-[10px] sm:text-[11px] font-semibold text-white truncate hover:text-[#ff6f66] w-full text-center"
                                title={`Voir l'écurie ${car.teamName}`}
                              >
                                {car.pilotName}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => goToTeamPage(car.teamName, e)}
                                className="text-[9px] sm:text-[10px] font-normal text-gray-400 truncate hover:text-[#ff9a94] w-full text-center"
                                title={`Voir l'écurie ${car.teamName}`}
                              >
                                {car.teamName}
                              </button>
                            </div>
                            <div className={`w-full border ${toneClass} ${heightClass} flex flex-col items-center justify-end px-2 py-1.5 sm:py-2`}>
                              {order === 1 && (
                                <span className="mb-0.5 inline-flex items-center" aria-label="Couronne première place" title="Couronne première place">
                                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path d="M4 18h16l-1.2-7-4.3 2.8L12 8.5l-2.5 5.3L5.2 11 4 18Zm1.8 2h12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </span>
                              )}
                              <span className={`${numberClass} font-bold leading-none`}>{order}</span>
                              <span className={`mt-0.5 ${pointsClass} font-medium uppercase tracking-[0.08em] leading-none`}>{car.points} pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border border-[#30343e] bg-[#171a22]/95 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-[0.08em] text-white">Classement</h3>
                <p className="mt-1 text-[11px] sm:text-xs uppercase tracking-[0.18em] text-[#a4abba]">Participants affichés uniquement • Saison 2026</p>
              </div>
              <button
                type="button"
                onClick={() => setView("standings")}
                className="border border-[#3b404d] bg-[#1b1f29] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#eef1f6] hover:border-[#676f82] hover:text-white"
              >
                Vue détaillée championnat
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a9afbd]">Pilotes</h4>
                {liveDriverStandingsWithTeams.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun classement disponible.</p>
                ) : (
                  liveDriverStandingsWithTeams.slice(0, 5).map((row, idx) => (
                    <StandingsRow
                      key={row.pilot}
                      rank={row.position}
                      title={row.pilot}
                      subtitle={row.team}
                      points={row.points}
                      accentColor={getTeamAccent(row.team)}
                      compact
                      onClick={() => (row.team && row.team !== "—" ? goToTeamPage(row.team) : setView("standings"))}
                      staggerIndex={idx}
                    />
                  ))
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a9afbd]">Écuries</h4>
                {liveTeamStandingRows.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun classement disponible.</p>
                ) : (
                  liveTeamStandingRows.slice(0, 5).map((row, idx) => (
                    <StandingsRow
                      key={row.team}
                      rank={idx + 1}
                      title={row.team}
                      points={row.points}
                      accentColor={getTeamAccent(row.team)}
                      compact
                      onClick={() => goToTeamPage(row.team)}
                      staggerIndex={idx + 2}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!teamSlugFromQuery && view === "lastgp" && (
        <div className="space-y-4">
          <div className="border border-white/10 bg-[#121419] p-6 min-h-[240px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-black uppercase tracking-[0.12em] text-white">Dernier Grand Prix</h4>
              <button
                type="button"
                onClick={() => setView("home")}
                className={BACK_BUTTON_CLASS}
              >
                ← Retour
              </button>
            </div>

            {!latestPublishedRace ? (
              <p className="text-sm text-gray-400">Aucun Grand Prix publié pour le moment.</p>
            ) : !lastGpResult ? (
              <p className="text-sm text-gray-400">Chargement du résultat du dernier Grand Prix...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                  {latestPublishedRace.weekKey} • {latestPublishedRace.circuitName || getCircuitConfigForWeekKey(latestPublishedRace.weekKey).circuitName} • {latestPublishedRace.sundayDateISO}
                </p>
                {lastGpResult.cars.map((car) => (
                  <div key={car.carId} className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <span className="text-gray-200">
                      P{car.position} •{" "}
                      <button
                        type="button"
                        onClick={(e) => goToTeamPage(car.teamName, e)}
                        className="font-semibold text-gray-100 hover:text-[#ff6f66]"
                        title={`Voir l'écurie ${car.teamName}`}
                      >
                        {car.pilotName}
                      </button>
                      {" "}•{" "}
                      <button
                        type="button"
                        onClick={(e) => goToTeamPage(car.teamName, e)}
                        className="text-gray-300 hover:text-[#ff9a94]"
                        title={`Voir l'écurie ${car.teamName}`}
                      >
                        {car.teamName}
                      </button>
                      {car.dnf ? ` • DNF T${car.dnfLap}` : ""}
                    </span>
                    <span className="text-[#ff4d44] font-black">{car.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-white mb-3">Historique des jets de dés (récent en premier)</h5>
            {renderDiceLogs(lastGpResult)}
          </div>
        </div>
      )}

      {!teamSlugFromQuery && view === "standings" && (
        <div className="space-y-4">
          <div className="border border-[#2f333d] bg-[#161920] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="f1-title text-2xl sm:text-3xl font-black uppercase tracking-[0.08em] text-white">Championnat 2026</h4>
              <button
                type="button"
                onClick={() => setView("home")}
                className={BACK_BUTTON_CLASS}
              >
                ← Retour
              </button>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:gap-6 pb-6 border-b border-[#223059]">
              <section className="border border-[#2e323b] bg-[#191c24] p-3 sm:p-4">
                <h5 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Driver Standings</h5>
                {liveDriverStandingsWithTeams.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun pilote participant pour le moment.</p>
                ) : (
                  <div className="space-y-1.5">
                    {liveDriverStandingsWithTeams.map((row, idx) => (
                      <StandingsRow
                        key={row.pilot}
                        rank={row.position}
                        title={row.pilot}
                        subtitle={row.team}
                        points={row.points}
                        accentColor={getTeamAccent(row.team)}
                        onClick={() => (row.team && row.team !== "—" ? goToTeamPage(row.team) : undefined)}
                        staggerIndex={idx}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="border border-[#2e323b] bg-[#191c24] p-3 sm:p-4">
                <h5 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Team Standings</h5>
                {liveTeamStandingRows.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune écurie enregistrée pour le moment.</p>
                ) : (
                  <div className="space-y-1.5">
                    {liveTeamStandingRows.map((row, idx) => (
                      <StandingsRow
                        key={row.team}
                        rank={idx + 1}
                        title={row.team}
                        points={row.points}
                        accentColor={getTeamAccent(row.team)}
                        onClick={() => goToTeamPage(row.team)}
                        staggerIndex={idx + 1}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div>
              <h5 className="text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6] mb-3">Historique des Grands Prix</h5>
              {raceHistory.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun Grand Prix enregistré.</p>
              ) : (
                <div className="space-y-2">
                  {[...raceHistory]
                    .sort((a, b) => String(b.sundayDateISO || "").localeCompare(String(a.sundayDateISO || "")))
                    .map((gp) => {
                      const statusColor =
                        gp.status === "published"
                          ? "border-[#ff6f66]/40 bg-[#5b2024]/35 hover:bg-[#6a2329]/45"
                          : gp.status === "simulated"
                          ? "border-[#d65a62]/35 bg-[#5b2024]/35 hover:bg-[#692329]/45"
                          : gp.status === "locked"
                          ? "border-amber-400/35 bg-amber-900/18 hover:bg-amber-900/28"
                          : "border-[#343844] bg-[#1e222c] hover:bg-[#262a34]";

                      const statusIcon =
                        gp.status === "published"
                          ? "✓"
                          : gp.status === "simulated"
                          ? "⚙"
                          : gp.status === "locked"
                          ? "🔒"
                          : "○";

                      return (
                        <button
                          key={gp.id}
                          type="button"
                          onClick={() => {
                            setSelectedRaceId(gp.id);
                            setView("race-detail");
                          }}
                          className={`w-full border px-4 py-3 text-left transition-all ${statusColor}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold">{gp.weekKey}</p>
                              <p className="mt-1 text-sm font-semibold text-white">{gp.circuitName || getCircuitConfigForWeekKey(gp.weekKey).circuitName}</p>
                              <p className="text-xs text-gray-400">{gp.sundayDateISO}</p>
                            </div>
                            <span className="text-lg shrink-0">{statusIcon}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!teamSlugFromQuery && view === "race-detail" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xl sm:text-2xl font-black uppercase tracking-[0.12em] text-white">
                  {!selectedRaceResult ? "Chargement..." : `${selectedRaceResult.cars[0]?.position ? "Résultat" : "Détail"} Grand Prix`}
                </h4>
                {selectedRaceResult && (
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-400">
                    {raceHistory.find((r) => r.id === selectedRaceId)?.circuitName} • {raceHistory.find((r) => r.id === selectedRaceId)?.sundayDateISO}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setView("standings")}
                className={BACK_BUTTON_CLASS}
              >
                ← Retour
              </button>
            </div>
          </div>

          {/* Podium & Results */}
          {!selectedRaceResult ? (
            <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
              <p className="text-sm text-gray-400">Chargement du résultat...</p>
            </div>
          ) : (
            <>
              <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
                <h5 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Résultats de la Course</h5>
                <div className="space-y-1.5">
                  {selectedRaceResult.cars.map((car, idx) => (
                    <StandingsRow
                      key={car.carId}
                      rank={car.position}
                      title={car.pilotName}
                      subtitle={car.teamName}
                      points={car.points}
                      accentColor={getTeamAccent(car.teamName)}
                      onClick={() => goToTeamPage(car.teamName)}
                      rightAddon={
                        car.dnf ? <span className="rounded border border-red-400/40 bg-red-900/30 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-200">DNF T{car.dnfLap}</span> : null
                      }
                      staggerIndex={idx}
                    />
                  ))}
                </div>
              </div>

              {/* Configuration Recap */}
              <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
                <h5 className="text-sm font-black uppercase tracking-[0.12em] text-gray-300 mb-4">⚙️ Configurations des Voitures</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedRaceResult.cars.map((car) => {
                    const entry = selectedRaceEntries.find((e) => e.userEmail === car.ownerEmail);
                    const carSetup = entry?.cars.find((c) => c.pilotName === car.pilotName);
                    if (!carSetup) return null;

                    return (
                      <div key={car.carId} className="border border-white/10 bg-black/25 p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-black text-gray-100">
                            <span className="text-[#ff4d44]">#{car.position}</span>{" "}
                            <button
                              type="button"
                              onClick={(e) => goToTeamPage(car.teamName, e)}
                              className="text-gray-100 hover:text-[#ff6f66]"
                              title={`Voir l'écurie ${car.teamName}`}
                            >
                              {car.pilotName}
                            </button>
                          </p>
                          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                            <span className="text-sm">🔧</span>
                            <span className="text-xs font-black text-white">{carSetup.pitStops}</span>
                            <span className="text-[10px] text-gray-400">arrêt{carSetup.pitStops !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => goToTeamPage(car.teamName, e)}
                          className="mb-2.5 text-[10px] text-gray-500 hover:text-[#ff9a94]"
                          title={`Voir l'écurie ${car.teamName}`}
                        >
                          {car.teamName}
                        </button>

                        {/* QUALIF */}
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ffd7da]/70 mb-1">QUALIF</p>
                        <div className="space-y-1 mb-2.5">
                          {(["bloc", "grip"] as const).map((key) => (
                            <div key={key} className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase w-14 shrink-0 ${STAT_COLORS[key].text}`}>{statLabel(key)}</span>
                              <StatBar statKey={key} value={carSetup[key]} />
                              <span className={`text-[9px] font-black shrink-0 w-3 text-right ${STAT_COLORS[key].text}`}>{carSetup[key]}</span>
                            </div>
                          ))}
                        </div>

                        {/* COURSE */}
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d7e8ff]/70 mb-1">COURSE</p>
                        <div className="space-y-1">
                          {(["audace", "defense", "endurance", "pneus"] as const).map((key) => (
                            <div key={key} className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase w-14 shrink-0 ${STAT_COLORS[key].text}`}>{statLabel(key)}</span>
                              <StatBar statKey={key} value={carSetup[key]} />
                              <span className={`text-[9px] font-black shrink-0 w-3 text-right ${STAT_COLORS[key].text}`}>{carSetup[key]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Race Analysis */}
              <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
                <h5 className="text-sm font-black uppercase tracking-[0.12em] text-gray-300 mb-4">📰 Analyse Journalistique</h5>
                <div className="space-y-2 text-sm">
                  {generateRaceAnalysis(selectedRaceResult, raceHistory.find((r) => r.id === selectedRaceId) || null, selectedRaceEntries)
                    .split("\n")
                    .map((line, idx) => {
                      if (line === "") return <div key={idx} className="h-1" />;
                      if (line.startsWith("## ")) {
                        const content = line.slice(3);
                        return (
                          <p key={idx} className="text-xs font-black uppercase tracking-[0.18em] text-[#ff4d44] mt-3 mb-1">
                            {content}
                          </p>
                        );
                      }
                      if (line.startsWith("🥇") || line.startsWith("🥈") || line.startsWith("🥉")) {
                        const parts = line.split("**");
                        return (
                          <p key={idx} className="text-gray-200 pl-2 border-l-2 border-white/15">
                            {parts.map((t, i) => i % 2 === 0 ? <span key={i}>{t}</span> : <strong key={i} className="text-white">{t}</strong>)}
                          </p>
                        );
                      }
                      if (line.startsWith("💥")) {
                        const parts = line.split("**");
                        return (
                          <p key={idx} className="text-red-300 font-semibold">
                            {parts.map((t, i) => i % 2 === 0 ? <span key={i}>{t}</span> : <strong key={i} className="text-red-200">{t}</strong>)}
                          </p>
                        );
                      }
                      const parts = line.split("**");
                      return (
                        <p key={idx} className="text-gray-300 leading-relaxed">
                          {parts.map((t, i) => i % 2 === 0 ? <span key={i}>{t}</span> : <strong key={i} className="text-white font-black">{t}</strong>)}
                        </p>
                      );
                    })}
                </div>
              </div>

              {/* Dice Logs */}
              <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
                <h5 className="text-sm font-black uppercase tracking-[0.14em] text-gray-300 mb-3">🎲 Historique des Jets de Dés (récent en premier)</h5>
                {renderDiceLogs(selectedRaceResult)}
              </div>
            </>
          )}
        </div>
      )}

      {view === "setup" && (
      <div className="border border-white/10 bg-[#121419] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg sm:text-xl font-black uppercase tracking-[0.12em] text-white">Participation & Paramétrage</h4>
            <p className="mt-1 text-xs text-gray-400">Circuit de la semaine: {activeCircuit.circuitName} • Profil {profileLabel(activeCircuit.profile)} • 10 tours de course</p>
          </div>
          <button
            type="button"
            onClick={() => setView("home")}
            className={BACK_BUTTON_CLASS}
          >
            ← Retour
          </button>
        </div>

        <div className="border border-white/10 bg-black/25 p-3 sm:p-4 space-y-2">
          <p className="text-xs text-[#90e59a]">
            Stats boostees : {activeCircuit.boosted.map((s) => statLabel(s)).join(" • ")}
          </p>
          <p className="text-xs text-[#ff858d]">
            Stats penalisees : {activeCircuit.penalized.map((s) => statLabel(s)).join(" • ")}
          </p>
          <p className="text-[11px] text-gray-400">Les valeurs affichees ci-dessous prennent en compte ces effets.</p>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={draft.participating}
              disabled={!canEdit}
              onChange={(e) => setDraft((prev) => ({ ...prev, participating: e.target.checked }))}
            />
            Je participe au Grand Prix
          </label>

          <label className="text-sm text-gray-300">
            Écurie
            <input
              className="ml-2 border border-white/20 bg-black/30 px-2 py-1 text-white"
              value={draft.teamName}
              disabled={!canEdit}
              onChange={(e) => setDraft((prev) => ({ ...prev, teamName: e.target.value }))}
            />
          </label>
        </div>

        {draft.participating && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1].map((idx) => {
              const car = draft.cars[idx as 0 | 1];
              const budget = carBudgetUsed(car);
              const isBudgetOk = budget === 31;
              const pitOrderError = pitStopsOrderError(car);
              return (
                <div key={idx} className="border border-white/10 bg-gradient-to-br from-black/30 to-[#100812] p-4 space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-[0.12em] text-white">Voiture {idx + 1}</h4>

                  <label className="block text-xs text-gray-300">
                    Pilote
                    <input
                      className="mt-1 w-full border border-white/20 bg-black/40 px-2 py-2 text-white"
                      value={car.pilotName}
                      disabled={!canEdit}
                      onChange={(e) => setCarField(idx as 0 | 1, "pilotName", e.target.value)}
                    />
                  </label>

                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-md border border-[#ff5a64]/45 bg-gradient-to-r from-[#3a0c12] via-[#5a121a] to-[#2a0b10] px-4 py-2.5 shadow-[0_0_24px_rgba(211,31,40,0.22)]">
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#ff4954]" aria-hidden="true" />
                      <p className="pl-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.24em] text-[#ffd7da]">Stats Qualif</p>
                    </div>
                    {QUALIF_STATS.map((key) => (
                      <div key={key} className="border border-white/10 bg-black/20 p-3">
                        {(() => {
                          const modifier = getStatModifier(activeCircuit, key as SimuF1StatKey);
                          const modColor = modifier === "boosted" ? "text-[#8ee59a]" : modifier === "penalized" ? "text-[#ff6a6a]" : "";
                          const underline = modifier === "boosted"
                              ? "underline decoration-[#8ee59a] decoration-2 underline-offset-4"
                              : modifier === "penalized"
                                ? "underline decoration-[#ff6a6a] decoration-2 underline-offset-4"
                                : "";
                          const sc = STAT_COLORS[key] ?? STAT_COLORS["bloc"];
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className={`text-xs font-black uppercase tracking-[0.12em] ${sc.text} ${underline}`}>{statLabel(key)}</p>
                                <p className={`text-xs font-black ${modColor || sc.text}`}>{car[key] as number}/10</p>
                              </div>
                              <StatBar statKey={key} value={car[key] as number} />
                              <input
                                type="range"
                                min={1}
                                max={10}
                                value={car[key] as number}
                                disabled={!canEdit}
                                onChange={(e) => setCarField(idx as 0 | 1, key, Number(e.target.value))}
                                className={`mt-2 w-full ${key === "bloc" ? "accent-violet-500" : "accent-orange-400"}`}
                              />
                              <p className="mt-1 text-[11px] text-gray-400">{statRuleText(key as SimuF1StatKey, car[key] as number, activeCircuit)}</p>
                            </>
                          );
                        })()}
                      </div>
                    ))}

                    <div className="relative overflow-hidden rounded-md border border-[#5d9bff]/45 bg-gradient-to-r from-[#0a1c33] via-[#0f2744] to-[#0a1a2d] px-4 py-2.5 shadow-[0_0_24px_rgba(77,138,255,0.20)]">
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#6aa8ff]" aria-hidden="true" />
                      <p className="pl-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.24em] text-[#d7e8ff]">Stats Course</p>
                    </div>
                    {COURSE_STATS.map((key) => (
                      <div key={key} className="border border-white/10 bg-black/20 p-3">
                        {(() => {
                          const modifier = getStatModifier(activeCircuit, key as SimuF1StatKey);
                          const modColor = modifier === "boosted" ? "text-[#8ee59a]" : modifier === "penalized" ? "text-[#ff6a6a]" : "";
                          const underline = modifier === "boosted"
                              ? "underline decoration-[#8ee59a] decoration-2 underline-offset-4"
                              : modifier === "penalized"
                                ? "underline decoration-[#ff6a6a] decoration-2 underline-offset-4"
                                : "";
                          const sc = STAT_COLORS[key] ?? STAT_COLORS["audace"];
                          const accentClass = key === "audace" ? "accent-blue-500" : key === "defense" ? "accent-cyan-400" : key === "endurance" ? "accent-teal-400" : "accent-yellow-400";
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className={`text-xs font-black uppercase tracking-[0.12em] ${sc.text} ${underline}`}>{statLabel(key)}</p>
                                <p className={`text-xs font-black ${modColor || sc.text}`}>{car[key] as number}/10</p>
                              </div>
                              <StatBar statKey={key} value={car[key] as number} />
                              <input
                                type="range"
                                min={1}
                                max={10}
                                value={car[key] as number}
                                disabled={!canEdit}
                                onChange={(e) => setCarField(idx as 0 | 1, key, Number(e.target.value))}
                                className={`mt-2 w-full ${accentClass}`}
                              />
                              <p className="mt-1 text-[11px] text-gray-400">{statRuleText(key as SimuF1StatKey, car[key] as number, activeCircuit)}</p>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="text-xs text-gray-300">
                      Arrêts aux stands (coût 1 par arrêt)
                      <input
                        type="number"
                        min={0}
                        max={3}
                        value={car.pitStops}
                        disabled={!canEdit}
                        onChange={(e) => setPitStops(idx as 0 | 1, Number(e.target.value))}
                        className="mt-1 w-full border border-white/20 bg-black/40 px-2 py-1 text-white"
                      />
                    </label>

                    {Array.from({ length: car.pitStops }).map((_, stopIdx) => (
                      <label key={stopIdx} className="text-xs text-gray-300">
                        Tour arrêt {stopIdx + 1}
                        <input
                          type="number"
                          min={1}
                          max={9}
                          value={car.pitLaps[stopIdx] || 5}
                          disabled={!canEdit}
                          onChange={(e) => setPitLap(idx as 0 | 1, stopIdx, Number(e.target.value))}
                          className="mt-1 w-full border border-white/20 bg-black/40 px-2 py-1 text-white"
                        />
                      </label>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-400">Course sur 10 tours: arrêts autorisés uniquement du tour 1 au tour 9.</p>

                  {pitOrderError && (
                    <p className="text-xs text-[#ff7f86]">{pitOrderError}</p>
                  )}

                  <p className={`text-xs ${isBudgetOk ? "text-[#8ee59a]" : "text-[#ff6a6a]"}`}>
                    Total utilisé: {budget}/31 {isBudgetOk ? "• valide" : "• ajuste tes curseurs"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!canEdit || saving}
            className="border border-[#e10600] bg-[#e10600] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer ma config"}
          </button>
        </div>

        {message && <p className="text-xs text-gray-300">{message}</p>}
      </div>
      )}

      {view === "setup" && (
      <div className="border border-white/10 bg-[#121419] p-4 sm:p-6">
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-white mb-3">Résultat de la course</h4>
        {!result || result.cars.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun résultat publié pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {result.cars.map((car) => (
              <div key={car.carId} className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <div className="text-gray-200">
                  P{car.position} • {car.pilotName} • {car.teamName}
                  {car.dnf ? ` • DNF T${car.dnfLap}` : ""}
                </div>
                <div className="text-[#ff4d44] font-black">{car.points} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

