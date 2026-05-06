"use client";

import { useEffect, useMemo, useState } from "react";
import { getCircuitConfigForWeekKey } from "./circuit-config";
import { subscribeEntries, subscribeRaceHistory, subscribeRaceResult, subscribeSeasonStandings } from "./firestore";
import type { SimuF1Entry, SimuF1RaceHistoryItem, SimuF1RaceResult, SimuF1SeasonStandings } from "./types";

export const slugifyTeamName = (teamName: string) =>
  String(teamName || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type DriverStanding = {
  name: string;
  points: number;
  rank: number;
};

type TeamProfilePanelProps = {
  teamSlug: string;
  onBack: () => void;
};

const BACK_BUTTON_CLASS =
  "inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white";

const TEAM_ACCENTS = ["#ffb100", "#e10600", "#1f6feb", "#ffd60a", "#ff7fbf", "#9ca3af", "#22c55e", "#fb923c", "#06b6d4"];

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = String(hex || "")
    .trim()
    .replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [148, 163, 184];
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${clampByte(r).toString(16).padStart(2, "0")}${clampByte(g).toString(16).padStart(2, "0")}${clampByte(b)
    .toString(16)
    .padStart(2, "0")}`;

const mixHex = (baseHex: string, withHex: string, amount: number) => {
  const t = Math.max(0, Math.min(1, amount));
  const [br, bg, bb] = hexToRgb(baseHex);
  const [wr, wg, wb] = hexToRgb(withHex);
  return rgbToHex(br + (wr - br) * t, bg + (wg - bg) * t, bb + (wb - bb) * t);
};

const getTeamAccentColor = (teamName: string) => {
  const cleaned = String(teamName || "").trim().toLowerCase();
  if (!cleaned || cleaned === "-") return "#94a3b8";
  const compact = cleaned.replace(/[^a-z0-9]+/g, " ").trim();

  if (compact === "bears fury crew" || compact === "bear s fury crew" || compact === "bear fury crew") return "#e10600";
  if (compact === "tigers fury crew" || compact === "tiger s fury crew") return "#ff8a00";
  if (compact === "frx") return "#22cfd0";

  let hash = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash << 5) - hash + cleaned.charCodeAt(i);
    hash |= 0;
  }
  return TEAM_ACCENTS[Math.abs(hash) % TEAM_ACCENTS.length];
};

function HelmetIcon({ baseColor, variant = 1 }: { baseColor: string; variant?: 1 | 2 }) {
  const shell = variant === 1 ? mixHex(baseColor, "#ffffff", 0.1) : mixHex(baseColor, "#000000", 0.1);
  const stripe = variant === 1 ? "#ffffff" : "#0a0a0a";
  const visor = mixHex(baseColor, "#0b0d12", variant === 1 ? 0.58 : 0.66);
  const visorTop = mixHex(baseColor, "#ffffff", variant === 1 ? 0.2 : 0.08);
  const shellStroke = mixHex(baseColor, "#ffffff", 0.18);
  const chin = variant === 1 ? mixHex(baseColor, "#ffffff", 0.16) : mixHex(baseColor, "#000000", 0.14);
  const stripeOutline = variant === 1 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.28)";

  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
      <path
        d="M3.5 17.8c0-7 5.6-12.6 12.6-12.6 6.8 0 12.4 5.3 12.6 12.1v5.4H8.4c-2.7 0-4.9-2.2-4.9-4.9z"
        fill={shell}
        stroke={shellStroke}
        strokeWidth="1"
      />
      <path d="M17.2 5.5c2.6.3 5.2 1.7 7.1 4.2l-2.8 1.8c-1.5-2-3.4-3-5.2-3.2z" fill={stripe} opacity="0.95" />
      <path d="M17.1 6.7c2 .3 3.8 1.2 5.2 3" stroke={stripeOutline} strokeWidth="0.95" strokeLinecap="round" opacity="0.9" />
      <path d="M11.5 12.9h17.2v5.1H11.5z" fill={visor} />
      <path d="M11.5 12.9h17.2v1.3H11.5z" fill={visorTop} opacity="0.92" />
      <path d="M7.9 21.2h6.4" stroke="#0f1014" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M8.9 9.2c1.5-1.1 3.2-1.7 5-1.9" stroke={stripe} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16.8 22.7h5.3" stroke={chin} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

const isPlaceholderPilotName = (name: string) => {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  return /^pilote\s*[0-9]*$/i.test(normalized) || normalized === "pilot" || /^pilot\s*[0-9]*$/i.test(normalized);
};

const getCarSlotIndex = (carId: string) => {
  const match = String(carId || "").match(/__(\d+)$/);
  const index = Number(match?.[1] || 0) - 1;
  return index >= 0 && index <= 1 ? index : -1;
};

export default function TeamProfilePanel({ teamSlug, onBack }: TeamProfilePanelProps) {
  const [history, setHistory] = useState<SimuF1RaceHistoryItem[]>([]);
  const [seasonStandings, setSeasonStandings] = useState<SimuF1SeasonStandings | null>(null);
  const [resultsByRace, setResultsByRace] = useState<Record<string, SimuF1RaceResult | null>>({});
  const [entriesByRace, setEntriesByRace] = useState<Record<string, SimuF1Entry[]>>({});

  useEffect(() => {
    const unsubs = [subscribeRaceHistory(2026, setHistory), subscribeSeasonStandings(2026, setSeasonStandings)];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (history.length === 0) return;

    const unsubs: Array<() => void> = [];
    history.forEach((race) => {
      unsubs.push(
        subscribeRaceResult(race.id, (result) => {
          setResultsByRace((prev) => ({ ...prev, [race.id]: result }));
        })
      );
      unsubs.push(
        subscribeEntries(race.id, (entries) => {
          setEntriesByRace((prev) => ({ ...prev, [race.id]: entries }));
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [history]);

  const allKnownTeams = useMemo(() => {
    const names = new Set<string>();

    Object.keys(seasonStandings?.teams || {}).forEach((name) => names.add(name));

    Object.values(entriesByRace).forEach((entries) => {
      entries.forEach((entry) => {
        const name = String(entry.teamName || "").trim();
        if (name) names.add(name);
      });
    });

    Object.values(resultsByRace).forEach((result) => {
      result?.cars.forEach((car) => {
        const name = String(car.teamName || "").trim();
        if (name) names.add(name);
      });
    });

    return Array.from(names);
  }, [entriesByRace, resultsByRace, seasonStandings]);

  const teamName = useMemo(() => {
    return allKnownTeams.find((name) => slugifyTeamName(name) === teamSlug) || "";
  }, [allKnownTeams, teamSlug]);

  const teamAccentColor = useMemo(() => getTeamAccentColor(teamName), [teamName]);

  const sortedRaceHistory = useMemo(
    () => [...history].sort((a, b) => String(b.sundayDateISO || "").localeCompare(String(a.sundayDateISO || ""))),
    [history]
  );

  const latestTeamEntry = useMemo(() => {
    for (const race of sortedRaceHistory) {
      const entry = (entriesByRace[race.id] || []).find((e) => String(e.teamName || "").trim() === teamName);
      if (entry) return entry;
    }
    return null;
  }, [entriesByRace, sortedRaceHistory, teamName]);

  const pilotNames = useMemo(() => {
    const racePilotsBySlot = ["", ""];
    Object.values(resultsByRace).forEach((result) => {
      result?.cars
        .filter((car) => car.teamName === teamName)
        .forEach((car) => {
          const name = String(car.pilotName || "").trim();
          const slotIndex = getCarSlotIndex(car.carId);
          if (slotIndex >= 0 && name && !isPlaceholderPilotName(name) && !racePilotsBySlot[slotIndex]) {
            racePilotsBySlot[slotIndex] = name;
          }
        });
    });

    const entrySlots = latestTeamEntry?.cars?.map((car) => String(car.pilotName || "").trim()) || [];
    const resolved: string[] = [];

    for (let i = 0; i < 2; i += 1) {
      const slotName = entrySlots[i] || "";
      if (slotName && !isPlaceholderPilotName(slotName) && !resolved.includes(slotName)) {
        resolved.push(slotName);
        continue;
      }

      const raceSlotName = racePilotsBySlot[i] || "";
      if (raceSlotName && !resolved.includes(raceSlotName)) {
        resolved.push(raceSlotName);
        continue;
      }

      const fallback = slotName || `Pilote ${i + 1}`;
      resolved.push(fallback);
    }

    return resolved;
  }, [latestTeamEntry, resultsByRace, teamName]);

  const teamPoints = useMemo(() => {
    const direct = seasonStandings?.teams?.[teamName];
    if (typeof direct === "number") return direct;

    let points = 0;
    Object.values(resultsByRace).forEach((result) => {
      result?.cars
        .filter((car) => car.teamName === teamName)
        .forEach((car) => {
          points += car.points;
        });
    });
    return points;
  }, [resultsByRace, seasonStandings, teamName]);

  const teamRank = useMemo(() => {
    const standings = Object.entries(seasonStandings?.teams || {}).sort((a, b) => b[1] - a[1]);
    const idx = standings.findIndex(([name]) => name === teamName);
    return idx >= 0 ? idx + 1 : null;
  }, [seasonStandings, teamName]);

  const driverStandings = useMemo<DriverStanding[]>(() => {
    const all = Object.entries(seasonStandings?.drivers || {}).sort((a, b) => b[1] - a[1]);

    return pilotNames.map((pilot) => {
      const points = seasonStandings?.drivers?.[pilot] || 0;
      const rankIndex = all.findIndex(([name]) => name === pilot);
      return {
        name: pilot,
        points,
        rank: rankIndex >= 0 ? rankIndex + 1 : all.length + 1,
      };
    });
  }, [pilotNames, seasonStandings]);

  const raceCards = useMemo(() => {
    return sortedRaceHistory
      .map((race) => {
        const raceEntries = entriesByRace[race.id] || [];
        const raceResult = resultsByRace[race.id];
        const entry = raceEntries.find((e) => String(e.teamName || "").trim() === teamName);
        const cars = raceResult?.cars.filter((c) => c.teamName === teamName) || [];

        if (!entry && cars.length === 0) return null;

        return {
          race,
          entry,
          cars,
        };
      })
      .filter(Boolean) as Array<{
      race: SimuF1RaceHistoryItem;
      entry: SimuF1Entry | undefined;
      cars: SimuF1RaceResult["cars"];
    }>;
  }, [entriesByRace, resultsByRace, sortedRaceHistory, teamName]);

  if (!teamSlug || !teamName) {
    return (
      <div className="border border-white/10 bg-[#121419] p-6 text-center">
        <h2 className="text-xl font-black uppercase tracking-[0.08em] text-white">Écurie introuvable</h2>
        <p className="mt-2 text-sm text-gray-400">Aucune écurie ne correspond à cette URL actuellement.</p>
        <button
          type="button"
          onClick={onBack}
          className={`mt-4 ${BACK_BUTTON_CLASS}`}
        >
          Retour SimuF1
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="border border-[#3a3034] bg-gradient-to-r from-[#171a22] via-[#1b1f29] to-[#161920] p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#b8becd]">Fiche écurie</p>
            <h2 className="f1-title mt-1 text-2xl sm:text-4xl font-black uppercase tracking-[0.08em] text-white">{teamName}</h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className={BACK_BUTTON_CLASS}
          >
            Retour SimuF1
          </button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="border border-[#3a3034] bg-[#1f232b] px-4 py-4 sm:py-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#9aa1b0]">Écurie</p>
          <p className="mt-2 text-4xl font-black leading-none text-white">{teamRank ? `#${teamRank}` : "—"}</p>
          <p className="mt-2 inline-flex items-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd3d0]">
            {teamPoints} pts
          </p>
        </article>

        {driverStandings.map((driver, index) => (
          <article key={driver.name} className="border border-[#3a3034] bg-[#1f232b] px-4 py-4 sm:py-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#9aa1b0]">Pilote {index + 1}</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-white">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-[#ffd3d0] shadow-[0_0_18px_rgba(0,0,0,0.3)]"
                style={{
                  borderColor: `${mixHex(teamAccentColor, "#ffffff", 0.34)}88`,
                  backgroundColor: "transparent",
                }}
              >
                <HelmetIcon baseColor={teamAccentColor} variant={index % 2 === 0 ? 1 : 2} />
              </span>
              {driver.name}
            </p>
            <p className="mt-2 text-3xl font-black leading-none text-white">#{driver.rank}</p>
            <p className="mt-2 inline-flex items-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd3d0]">
              {driver.points} pts
            </p>
          </article>
        ))}
      </section>

      <section className="border border-[#313541] bg-[#151920]/88 p-4 sm:p-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Historique de l'écurie</h3>

        {raceCards.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">Aucune course associée pour le moment.</p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {raceCards.map(({ race, entry, cars }) => {
              const circuitName = race.circuitName || getCircuitConfigForWeekKey(race.weekKey).circuitName;

              return (
                <div key={race.id} className="border border-[#3a3034] bg-[#1f232b] p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#a7aebb]">
                      {race.weekKey} • {circuitName} • {race.sundayDateISO}
                    </p>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Statut: {race.status}</span>
                  </div>

                  {cars.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {cars.map((car) => (
                        <div key={car.carId} className="flex items-center justify-between border border-[#343844] bg-[#1e222c] px-3 py-2">
                          <p className="text-sm text-gray-100">
                            P{car.position} • {car.pilotName}
                            {car.dnf ? ` • DNF T${car.dnfLap}` : ""}
                          </p>
                          <p className="inline-flex items-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd3d0]">
                            {car.points} pts
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 border border-white/10 bg-[#171a22] px-3 py-2 text-xs text-gray-400">
                      {entry ? "Écurie inscrite, résultat non publié pour cette course." : "Aucun résultat disponible."}
                    </div>
                  )}

                  {entry?.cars?.length === 2 && (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-gray-500">
                      {(() => {
                        const declared = entry.cars.map((car) => String(car.pilotName || "").trim());
                        const raceKnown = ["", ""];
                        cars.forEach((car) => {
                          const slotIndex = getCarSlotIndex(car.carId);
                          const name = String(car.pilotName || "").trim();
                          if (slotIndex >= 0 && name && !isPlaceholderPilotName(name) && !raceKnown[slotIndex]) {
                            raceKnown[slotIndex] = name;
                          }
                        });
                        const shown = declared.map((name, idx) => {
                          if (!name || isPlaceholderPilotName(name)) return raceKnown[idx] || name || `Pilote ${idx + 1}`;
                          return name;
                        });
                        return `Pilotes déclarés: ${shown[0]} • ${shown[1]}`;
                      })()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
