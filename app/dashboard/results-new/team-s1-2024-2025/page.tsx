"use client";

import Link from "next/link";
import { CircleDot, Trophy } from "lucide-react";

type DriverStanding = {
  rank: number;
  name: string;
  team: string;
  points: number;
};

type TeamStanding = {
  rank: number;
  team: string;
  points: number;
  color: string;
};

type RaceCard = {
  id: string;
  label: string;
  circuit: string;
  date: string;
  podium: Array<{ position: 1 | 2 | 3; pilot: string; team: string }>;
};

const driverStandings: DriverStanding[] = [
  { rank: 1, name: "Fast", team: "Tiger Fury Crew", points: 95 },
  { rank: 2, name: "Furious", team: "Tiger Fury Crew", points: 88 },
  { rank: 3, name: "Arnaud", team: "Bears Fury Crew", points: 82 },
  { rank: 4, name: "Loris", team: "Bears Fury Crew", points: 74 },
  { rank: 5, name: "Mumu", team: "FRX", points: 67 },
  { rank: 6, name: "Shadow", team: "FRX", points: 61 },
];

const teamStandings: TeamStanding[] = [
  { rank: 1, team: "Tiger Fury Crew", points: 183, color: "#ff8a00" },
  { rank: 2, team: "Bears Fury Crew", points: 156, color: "#e10600" },
  { rank: 3, team: "FRX", points: 128, color: "#22cfd0" },
];

const races: RaceCard[] = [
  {
    id: "E10",
    label: "E10",
    circuit: "Monza",
    date: "2025-03-09",
    podium: [
      { position: 1, pilot: "Fast", team: "Tiger Fury Crew" },
      { position: 2, pilot: "Arnaud", team: "Bears Fury Crew" },
      { position: 3, pilot: "Mumu", team: "FRX" },
    ],
  },
  {
    id: "E11",
    label: "E11",
    circuit: "Suzuka",
    date: "2025-03-16",
    podium: [
      { position: 1, pilot: "Furious", team: "Tiger Fury Crew" },
      { position: 2, pilot: "Loris", team: "Bears Fury Crew" },
      { position: 3, pilot: "Shadow", team: "FRX" },
    ],
  },
  {
    id: "E12",
    label: "E12",
    circuit: "Interlagos",
    date: "2025-03-23",
    podium: [
      { position: 1, pilot: "Arnaud", team: "Bears Fury Crew" },
      { position: 2, pilot: "Fast", team: "Tiger Fury Crew" },
      { position: 3, pilot: "Furious", team: "Tiger Fury Crew" },
    ],
  },
];

const BACK_BUTTON_CLASS =
  "inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white";

const rankLabel = (rank: number) => `#${rank}`;

function HelmetBadge({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_0_18px_rgba(0,0,0,0.3)]"
      style={{ borderColor: `${color}88`, backgroundColor: "transparent" }}
    >
      <CircleDot className="h-4 w-4" style={{ color }} />
    </span>
  );
}

export default function TeamS1DetailedPage() {
  return (
    <main className="min-h-screen bg-[#0f1014] text-white">
      <div className="h-1 w-full bg-[#e10600]" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="border border-[#3a3034] bg-gradient-to-r from-[#171a22] via-[#1b1f29] to-[#161920] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#b8becd]">Championnat Écurie</p>
              <h1 className="f1-title mt-1 text-2xl sm:text-4xl font-black uppercase tracking-[0.08em] text-white">
                Saison 1 - 2024 / 2025
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/results-new" className={BACK_BUTTON_CLASS}>
                Retour menu
              </Link>
              <Link href="/dashboard" className={BACK_BUTTON_CLASS}>
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article className="border border-[#313541] bg-[#151920]/88 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Classement pilotes</h2>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#9aa1b0]">
                <CircleDot className="h-3.5 w-3.5" />
                Pilotes
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {driverStandings.map((driver) => {
                const teamColor = teamStandings.find((t) => t.team === driver.team)?.color || "#94a3b8";
                return (
                  <div key={driver.name} className="flex items-center justify-between rounded-[2px] border border-[#3a3034] bg-[#1f232b] px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[2px] bg-[#f7f8fb] px-1 text-sm font-black leading-none text-[#101834]">
                        {driver.rank}
                      </span>
                      <span className="h-7 w-[3px] rounded-full" style={{ backgroundColor: teamColor }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold uppercase tracking-[0.02em] text-white">{driver.name}</p>
                        <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[#a7aebb]">{driver.team}</p>
                      </div>
                    </div>

                    <div className="ml-2 flex items-center gap-2">
                      <HelmetBadge color={teamColor} />
                      <p className="text-[30px] font-semibold leading-[0.9] text-[#f6f8fc]">{driver.points}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="border border-[#313541] bg-[#151920]/88 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Classement ecuries</h2>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#9aa1b0]">
                <Trophy className="h-3.5 w-3.5" />
                Ecuries
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {teamStandings.map((team) => (
                <div key={team.team} className="flex items-center justify-between rounded-[2px] border border-[#3a3034] bg-[#1f232b] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[2px] bg-[#f7f8fb] px-1 text-sm font-black leading-none text-[#101834]">
                      {team.rank}
                    </span>
                    <span className="h-7 w-[3px] rounded-full" style={{ backgroundColor: team.color }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase tracking-[0.02em] text-white">{team.team}</p>
                      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[#a7aebb]">{rankLabel(team.rank)}</p>
                    </div>
                  </div>
                  <p className="ml-2 text-[30px] font-semibold leading-[0.9] text-[#f6f8fc]">{team.points}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-4 border border-[#313541] bg-[#151920]/88 p-4 sm:p-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#eef1f6]">Dernieres courses</h2>

          <div className="mt-4 space-y-2.5">
            {races.map((race) => (
              <article key={race.id} className="border border-[#3a3034] bg-[#1f232b] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#a7aebb]">
                    {race.label} • {race.circuit} • {race.date}
                  </p>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Podium</span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {race.podium.map((row) => {
                    const teamColor = teamStandings.find((t) => t.team === row.team)?.color || "#94a3b8";
                    return (
                      <div key={`${race.id}-${row.position}-${row.pilot}`} className="flex items-center justify-between border border-[#343844] bg-[#1e222c] px-3 py-2">
                        <p className="text-sm text-gray-100">
                          P{row.position} • {row.pilot}
                        </p>
                        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#ffd3d0]">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                          {row.team}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
