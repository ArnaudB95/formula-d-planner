"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

const championships = [
  {
    key: "team-s1-2024-2025",
    title: "Championnat Écurie Saison 1 - 2024 / 2025",
    href: "/dashboard/results-new/team-s1-2024-2025",
    status: "Terminé",
  },
] as const;

export default function ResultsNewMenuPage() {
  return (
    <main className="min-h-screen bg-[#0f1014] text-white">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="border border-[#3a3034] bg-[#161920] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e323b] pb-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#b8becd]">Resultats</p>
              <h1 className="mt-1 text-2xl sm:text-4xl font-black uppercase tracking-[0.08em] text-white">Menu championnats</h1>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white"
            >
              Retour dashboard
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {championships.map((championship) => (
              <Link
                key={championship.key}
                href={championship.href}
                className="group flex items-center justify-between gap-3 border border-[#3a3034] bg-[#1f232b] p-3 sm:p-4 transition hover:border-[#a13a42] hover:bg-[#2a171a]"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border border-[#5a606f] bg-[#151920] text-[#eef1f6]">
                    <Trophy className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold uppercase tracking-[0.04em] text-white leading-tight break-words">
                      {championship.title}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#9aa1b0]">Cliquer pour ouvrir la vue detaillee</p>
                  </div>
                </div>

                <span className="shrink-0 inline-flex items-center border border-white/25 bg-black/74 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ff4a52]">
                  {championship.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
