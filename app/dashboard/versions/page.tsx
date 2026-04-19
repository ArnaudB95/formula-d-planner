"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, MessageCircle, Trophy, Users } from "lucide-react";

const releaseNotes = [
  {
    version: "v1.4.0",
    timestamp: "19/04/2026 · 12h20",
    details: [
      "Refonte complete de l onglet Resultats: 4 cartes image compactes, recadrees et lisibles en desktop/mobile, avec textes renforces.",
      "Nouveaux bandeaux de statut style HUD moderne (En cours/Termine), contraste optimise et rendu plus propre sur petits ecrans.",
      "Titres retravailles: accent sur Equipe/Individuel et Saison X, avec Championnat et - YYYY / YYYY volontairement plus discrets.",
      "Navigation corrigee: boutons Retour des pages dediees vers Resultats; page Equipe S1 basculee temporairement sur visuel E12 responsive (plein ecran + scroll horizontal).",
    ],
  },
  {
    version: "v1.3.2",
    timestamp: "18/04/2026 · 21h35",
    details: [
      "Evolution plus fiable, meme apres rafraichissement.",
      "Archives plus claires, fermees et sans reponse possible.",
      "Les meilleurs contributeurs gagnent leurs medailles.",
    ],
  },
  {
    version: "v1.3.1",
    timestamp: "18/04/2026 · 21h10",
    details: [
      "Badges Evolution plus stables et plus justes.",
      "Le bas d ecran est plus propre et mieux range.",
      "La lecture mobile est plus nette partout.",
    ],
  },
  {
    version: "v1.3.0",
    timestamp: "18/04/2026 · 19h35",
    details: [
      "Acces direct a Evolution depuis le Chat.",
      "Conversations plus fluides, jusqu au dernier message.",
      "Notifications mieux visibles, sans effets parasites.",
      "Dashboard plus propre, jusque dans les avatars.",
    ],
  },
  {
    version: "v1.1.2",
    timestamp: "17/04/2026 · 22h40",
    details: ["Affinage mobile du dashboard, compactage du chat et redesign tres discret du lien AB 2026 v1."],
  },
  {
    version: "v1.1.1",
    timestamp: "17/04/2026 · 22h05",
    details: ["Ajout du bouton discret en bas a droite et creation de la page Notes de version accessible via ce bouton."],
  },
  {
    version: "v1.1.0",
    timestamp: "17/04/2026 · 21h20",
    details: ["Le logo en haut a gauche ramene directement vers la page Parties."],
  },
  {
    version: "v1.0.11",
    timestamp: "17/04/2026 · 20h55",
    details: ["Suppression de l ascenseur horizontal du chat avec retour a la ligne automatique."],
  },
  {
    version: "v1.0.10",
    timestamp: "17/04/2026 · 20h25",
    details: ["Actions du chat passees en petites icones en haut a droite avec info-bulles et droits de suppression ajustes."],
  },
  {
    version: "v1.0.9",
    timestamp: "17/04/2026 · 19h50",
    details: ["Le chat revient en bas par defaut a l ouverture pour montrer les derniers messages."],
  },
];

export default function VersionsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  const navItems = [
    { key: "events", label: "Parties", icon: CalendarDays },
    { key: "proposition", label: "Propositions", icon: ClipboardList },
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "results", label: "Resultats", icon: Trophy },
    { key: "members", label: "Pilotes", icon: Users },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const access = window.sessionStorage.getItem("fd_release_notes_access");
    if (access !== "granted") {
      router.replace("/dashboard");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      <div className="h-1 w-full bg-[#d31f28]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-24 sm:pb-8">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Link href="/dashboard" className="shrink-0" aria-label="Aller aux Parties">
              <img
                src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
                alt="Formula D"
                className="h-7 sm:h-14 w-auto object-contain"
              />
            </Link>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-200 hover:text-white hover:border-white/40 transition"
            >
              Retour
            </button>
          </div>
        </header>

        <section className="mt-4 border-l-4 border-[#d31f28] border border-white/10 bg-black/30 p-4 sm:p-6">
          <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#d31f28]">Notes de version</p>
            <p className="mt-3 text-sm text-gray-300">
              Version actuelle : <span className="text-white font-bold">v1.4.0</span>
            </p>

          </div>

          <div className="mt-4 border border-white/10 bg-black/30 p-4 sm:p-6">
            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-gray-300">Historique recent</h2>
            <ol className="mt-4 space-y-3">
              {releaseNotes.map((item) => (
                <li key={item.version} className="border-l-2 border-[#d31f28]/70 pl-3">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3">
                    <p className="text-sm font-bold text-white whitespace-normal break-words">{item.version}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.12em] text-gray-500 whitespace-normal break-words">{item.timestamp}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {item.details.map((line) => (
                      <li key={line} className="text-sm text-gray-300 whitespace-normal break-words leading-5">
                        {line}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#000a18]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-2 py-2">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href="/dashboard"
                  className="flex flex-col items-center justify-center gap-1 px-1 py-2 transition text-gray-500 hover:text-white"
                >
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-[9px] font-black uppercase tracking-[0.08em] leading-none">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </main>
  );
}
