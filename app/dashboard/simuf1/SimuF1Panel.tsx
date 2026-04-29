"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const audaceChance = (audace: number) => (audace >= 5 ? 4 + (audace - 5) * 2 : Math.max(0, 4 - (5 - audace)));
const defenseChance = (defense: number) => (defense >= 5 ? 20 + (defense - 5) * 10 : Math.max(0, 20 - (5 - defense) * 5));
const enduranceBreakChance = (endurance: number) => (endurance >= 5 ? Math.max(0, 5 - (endurance - 5)) : 5 + (5 - endurance) * 0.5);

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
  if (modifier === "boosted") return 0.5;
  if (modifier === "penalized") return 1.5;
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
    const t5 = Math.min(100, score * 5);
    const t10 = Math.min(100, score * 10);
    return `COURSE (${modifierText}): score pneus ${score} (base ${base}). Risque = score x tour (T5 <= ${t5}%, T10 <= ${t10}%).`;
  }
  return "";
};

const statLabel = (key: keyof SimuF1CarSetup) => {
  if (key === "bloc") return "VITESSE";
  if (key === "grip") return "BOOST";
  if (key === "audace") return "AUDACE";
  if (key === "defense") return "DEFENSE";
  if (key === "endurance") return "ENDURANCE";
  if (key === "pneus") return "PNEUS";
  return String(key).toUpperCase();
};

const pitStopsOrderError = (car: SimuF1CarSetup) => {
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


export default function SimuF1Panel({ userEmail, userPseudo, defaultTeamName, isSuperAdmin }: Props) {
  const fallbackTeamName = getDefaultTeamName(defaultTeamName, userPseudo, userEmail);
  const [view, setView] = useState<"home" | "setup" | "lastgp" | "standings" | "race-detail">("home");
  const [raceId, setRaceId] = useState<string>("");
  const [race, setRace] = useState<SimuF1Race | null>(null);
  const [entries, setEntries] = useState<SimuF1Entry[]>([]);
  const [result, setResult] = useState<SimuF1RaceResult | null>(null);
  const [pilotProfile, setPilotProfile] = useState<SimuF1PilotProfile | null>(null);
  const [seasonStandings, setSeasonStandings] = useState<SimuF1SeasonStandings | null>(null);
  const [raceHistory, setRaceHistory] = useState<SimuF1RaceHistoryItem[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [selectedRaceResult, setSelectedRaceResult] = useState<SimuF1RaceResult | null>(null);
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

  useEffect(() => {
    if (!selectedRaceId) return;
    const unsub = subscribeRaceResult(selectedRaceId, setSelectedRaceResult);
    return () => unsub();
  }, [selectedRaceId]);

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
      .catch((error: any) => setMessage(error?.message || "Erreur pendant le lancement automatique."));
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
      pitLaps[stopIdx] = Math.max(1, Math.min(10, lap));
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
    } catch (error: any) {
      setMessage(error?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {view === "home" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, participating: true }));
                setView("setup");
              }}
              className="group relative overflow-hidden border border-[#d31f28]/60 bg-gradient-to-br from-[#d31f28]/25 via-[#8f0f17]/20 to-[#010d1e] p-6 text-left"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] sm:text-[13px] uppercase tracking-[0.2em] text-[#ff8b91]">Prochaine course</p>
                <span className="inline-flex shrink-0 items-center rounded-full border border-[#ff8b91]/25 bg-[#d31f28]/18 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#ffe1e4] shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition group-hover:border-[#ff8b91]/40 group-hover:bg-[#d31f28]/26 group-hover:text-white">
                  Participer
                </span>
              </div>
              <h4 className="mt-3 text-2xl tracking-[0.08em] text-white">
                <span className="font-black uppercase">{activeCircuit.circuitName}</span>
                <span className="mx-2 font-normal text-white/90">-</span>
                <span className="text-lg font-normal normal-case text-white/90">{formatRaceDate(race?.sundayDateISO || nextSundayISO())}</span>
              </h4>
              <p className="mt-3 text-xs text-[#ffd6d9]">{validatedParticipantsCount <= 1 ? "Écurie participante" : "Écuries participantes"}: {validatedParticipantsCount}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#ffd6d9]">Départ auto dans {countdownLabel}</p>
            </button>

            <button
              type="button"
              onClick={() => setView("lastgp")}
              className="border border-white/15 bg-[#010d1e] p-6 text-left hover:border-white/30 transition"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Archive rapide</p>
              <h4 className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-white">Détail du dernier Grand Prix</h4>
              <p className="mt-2 text-sm text-gray-300">Page blanche pour l’instant (contenu à venir).</p>
            </button>
          </div>

          <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-[0.12em] text-white">Classement actuel</h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-400">Participants affichés uniquement • Saison 2026</p>
              </div>
              <button
                type="button"
                onClick={() => setView("standings")}
                className="border border-white/25 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:border-white/50"
              >
                Vue détaillée championnat
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {liveStandingRows.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun classement participant disponible pour le moment.</p>
              ) : (
                liveStandingRows.map((row, idx) => (
                  <button
                    type="button"
                    key={row.pilot}
                    onClick={() => setView("standings")}
                    className="w-full flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/35"
                  >
                    <span className="text-gray-200">P{idx + 1} • {row.pilot}</span>
                    <span className="text-[#ff6168] font-black">{row.points} pts</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {view === "lastgp" && (
        <div className="border border-white/10 bg-[#010d1e] p-6 min-h-[360px]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-black uppercase tracking-[0.12em] text-white">Dernier Grand Prix</h4>
            <button type="button" onClick={() => setView("home")} className="text-xs text-gray-300 hover:text-white">Retour</button>
          </div>
          <div className="h-[250px] border border-dashed border-white/20 bg-black/20" />
        </div>
      )}

      {view === "standings" && (
        <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-black uppercase tracking-[0.12em] text-white">Championnat 2026</h4>
            <button type="button" onClick={() => setView("home")} className="text-xs text-gray-300 hover:text-white">Retour</button>
          </div>

          <div className="space-y-2">
            {raceHistory.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun Grand Prix enregistré.</p>
            ) : (
              raceHistory.map((gp) => (
                <button
                  key={gp.id}
                  type="button"
                  onClick={() => {
                    setSelectedRaceId(gp.id);
                    setView("race-detail");
                  }}
                  className="w-full border border-white/10 bg-black/20 px-3 py-3 text-left hover:bg-black/35"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{gp.weekKey}</p>
                  <p className="mt-1 text-sm text-white">{gp.circuitName || getCircuitConfigForWeekKey(gp.weekKey).circuitName} • {gp.sundayDateISO} • statut {gp.status}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {view === "race-detail" && (
        <div className="space-y-4">
          <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-black uppercase tracking-[0.12em] text-white">Détail Grand Prix</h4>
              <button type="button" onClick={() => setView("standings")} className="text-xs text-gray-300 hover:text-white">Retour</button>
            </div>

            {!selectedRaceResult ? (
              <p className="text-sm text-gray-400">Chargement du résultat...</p>
            ) : (
              <div className="space-y-2">
                {selectedRaceResult.cars.map((car) => (
                  <div key={car.carId} className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <span className="text-gray-200">P{car.position} • {car.pilotName} • {car.teamName}{car.dnf ? ` • DNF T${car.dnfLap}` : ""}</span>
                    <span className="text-[#ff6168] font-black">{car.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
            <h5 className="text-sm font-black uppercase tracking-[0.14em] text-white mb-3">Historique des jets de dés (récent en premier)</h5>
            {!selectedRaceResult || selectedRaceResult.diceLogs.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun jet de dés enregistré.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {[...selectedRaceResult.diceLogs]
                  .sort((a, b) => b.seq - a.seq)
                  .map((log) => (
                    <div key={log.seq} className="border border-white/10 bg-black/25 px-3 py-2 text-xs">
                      <p className="text-gray-200 uppercase tracking-[0.12em]">#{log.seq} • {log.phase}{log.lap ? ` • Tour ${log.lap}` : ""} • {log.stat.toUpperCase()}</p>
                      <p className="mt-1 text-gray-300">{log.summary}</p>
                      <p className="mt-1 text-gray-500">Jet: {log.roll ?? "—"} / Seuil: {log.threshold ?? "—"} / Résultat: {log.success ? "Réussi" : "Raté"}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "setup" && (
      <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg sm:text-xl font-black uppercase tracking-[0.12em] text-white">Participation & Paramétrage</h4>
            <p className="mt-1 text-xs text-gray-400">Circuit de la semaine: {activeCircuit.circuitName} • Profil {profileLabel(activeCircuit.profile)}</p>
          </div>
          <button
            type="button"
            onClick={() => setView("home")}
            className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-200 hover:text-white hover:border-white/40 transition"
          >
            Retour
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
                          const valueColor = modifier === "boosted" ? "text-[#8ee59a]" : modifier === "penalized" ? "text-[#ff6a6a]" : "text-white";
                          const titleClass =
                            modifier === "boosted"
                              ? "text-xs font-black uppercase tracking-[0.12em] text-white underline decoration-[#8ee59a] decoration-2 underline-offset-4"
                              : modifier === "penalized"
                                ? "text-xs font-black uppercase tracking-[0.12em] text-white underline decoration-[#ff6a6a] decoration-2 underline-offset-4"
                                : "text-xs font-black uppercase tracking-[0.12em] text-white";
                          return (
                            <>
                        <div className="flex items-center justify-between">
                          <p className={titleClass}>{statLabel(key)}</p>
                          <p className={`text-xs ${valueColor}`}>{car[key] as number}/10</p>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={car[key] as number}
                          disabled={!canEdit}
                          onChange={(e) => setCarField(idx as 0 | 1, key, Number(e.target.value))}
                          className="mt-2 w-full accent-[#d31f28]"
                        />
                        <p className="mt-2 text-[11px] text-gray-400">{statRuleText(key as SimuF1StatKey, car[key] as number, activeCircuit)}</p>
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
                          const valueColor = modifier === "boosted" ? "text-[#8ee59a]" : modifier === "penalized" ? "text-[#ff6a6a]" : "text-white";
                          const titleClass =
                            modifier === "boosted"
                              ? "text-xs font-black uppercase tracking-[0.12em] text-white underline decoration-[#8ee59a] decoration-2 underline-offset-4"
                              : modifier === "penalized"
                                ? "text-xs font-black uppercase tracking-[0.12em] text-white underline decoration-[#ff6a6a] decoration-2 underline-offset-4"
                                : "text-xs font-black uppercase tracking-[0.12em] text-white";
                          return (
                            <>
                        <div className="flex items-center justify-between">
                          <p className={titleClass}>{statLabel(key)}</p>
                          <p className={`text-xs ${valueColor}`}>{car[key] as number}/10</p>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={car[key] as number}
                          disabled={!canEdit}
                          onChange={(e) => setCarField(idx as 0 | 1, key, Number(e.target.value))}
                          className="mt-2 w-full accent-[#d31f28]"
                        />
                        <p className="mt-2 text-[11px] text-gray-400">{statRuleText(key as SimuF1StatKey, car[key] as number, activeCircuit)}</p>
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
                          max={10}
                          value={car.pitLaps[stopIdx] || 5}
                          disabled={!canEdit}
                          onChange={(e) => setPitLap(idx as 0 | 1, stopIdx, Number(e.target.value))}
                          className="mt-1 w-full border border-white/20 bg-black/40 px-2 py-1 text-white"
                        />
                      </label>
                    ))}
                  </div>

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
            className="border border-[#d31f28] bg-[#d31f28] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer ma config"}
          </button>
        </div>

        {message && <p className="text-xs text-gray-300">{message}</p>}
      </div>
      )}

      {view === "setup" && (
      <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
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
                <div className="text-[#ff6168] font-black">{car.points} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
