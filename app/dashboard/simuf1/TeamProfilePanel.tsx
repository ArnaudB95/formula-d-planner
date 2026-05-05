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

function HelmetIcon({ variant = 1 }: { variant?: 1 | 2 }) {
  const shell = variant === 1 ? "#ff6f66" : "#5ad3d1";
  const stripe = variant === 1 ? "#f7f8fb" : "#c7f9f8";
  const visor = variant === 1 ? "#e10600" : "#159a98";

  return (
    <svg viewBox="0 0 28 28" className="h-5 w-5" aria-hidden="true">
      <path d="M3 15a11 11 0 0 1 22 0v5H6a3 3 0 0 1-3-3v-2Z" fill={shell} />
      <path d="M12 9h10.3A8.1 8.1 0 0 0 12 2.7V9Z" fill={stripe} opacity="0.95" />
      <path d="M11.2 11.7H25v4.2H11.2z" fill={visor} />
      <path d="M6.7 19.3h5.1" stroke="#0f1014" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 7.4c1.4-1 3-1.6 4.7-1.8" stroke={stripe} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

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
    if (latestTeamEntry?.cars?.length === 2) {
      return [latestTeamEntry.cars[0].pilotName, latestTeamEntry.cars[1].pilotName];
    }

    const pilots = new Set<string>();
    Object.values(resultsByRace).forEach((result) => {
      result?.cars
        .filter((car) => car.teamName === teamName)
        .forEach((car) => pilots.add(car.pilotName));
    });

    return Array.from(pilots).slice(0, 2);
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
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d65a62]/45 bg-[#5b2024]/45 text-[#ffd3d0] shadow-[0_0_16px_rgba(225,6,0,0.22)]">
                <HelmetIcon variant={index % 2 === 0 ? 1 : 2} />
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
                      Pilotes déclarés: {entry.cars[0].pilotName} • {entry.cars[1].pilotName}
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
