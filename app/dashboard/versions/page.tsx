"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, MessageCircle, Trophy, Users } from "lucide-react";

const releaseNotes = [
  {
    version: "v1.5.5",
    timestamp: "23/04/2026 · 21h30",
    details: [
      "Notifications email: champ personnel pour changer l'adresse (Gmail/Outlook/etc), suggestions d'adresse invisibles jusqu'à modification.",
      "Batching chat intelligent: messages groupes en 1 email sur 30s, logging debug renforce, robustesse accrue (trim, filter emails vides).",
    ],
  },
  {
    version: "v1.5.4",
    timestamp: "19/04/2026 · 17h25",
    details: [
      "Chat: pseudo passe en rouge dans les messages et les reponses pour une meilleure lisibilite.",
      "Stabilite: correction du runtime error 'scrollChatToLatestBoundary before initialization' en supprimant le souci d initialisation.",
    ],
  },
  {
    version: "v1.5.3",
    timestamp: "19/04/2026 · 17h05",
    details: [
      "Notifications email implantees: preference profil (OFF par defaut) + alertes pour nouvelles propositions de date et nouveaux messages du chat.",
    ],
  },
  {
    version: "v1.5.2",
    timestamp: "19/04/2026 · 16h25",
    details: [
      "Correctif mobile iPhone: suppression du scroll horizontal parasite dans le chat, avec adaptation propre des lignes longues a la largeur ecran.",
    ],
  },
  {
    version: "v1.5.1",
    timestamp: "19/04/2026 · 16h10",
    details: [
      "Parties a venir passe en mode premium: info session ultra-discrete, boutons 14h/17h intelligents, bascule auto en Absent et lisibilite immediate des presences partielles.",
      "Finition UX: texte nettoye, accents harmonises, rendu plus propre et plus pro partout.",
    ],
  },
  {
    version: "v1.5.0",
    timestamp: "19/04/2026 · 13h40",
    details: [
      "Profil booste: modal plus large, adresse domiciliee dans Firestore, saisie guidee par Google Places en temps reel.",
      "Experience fiabilisee de bout en bout: selection propre, erreurs gerees, anti-reouverture, et lieu hote cliquable sur Maps.",
    ],
  },
  {
    version: "v1.4.0",
    timestamp: "19/04/2026 · 12h20",
    details: [
      "Resultats entierement repenses: cartes plus nettes, statuts plus lisibles, hierarchie visuelle plus forte sur desktop comme mobile.",
      "Navigation simplifiee et fluide: retours corriges et page Equipe S1 alignee sur un visuel E12 responsive plein ecran.",
    ],
  },
  {
    version: "v1.3.3",
    timestamp: "18/04/2026 · 22h05",
    details: ["Page Résultats en ligne !"],
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
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-28 sm:pb-36">
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
              Version actuelle : <span className="text-white font-bold">v1.5.4</span>
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

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <nav className="border-t border-white/10 bg-[#000a18]/95 backdrop-blur">
          <div className="mx-auto max-w-7xl px-2 py-2">
            <div className="grid grid-cols-5 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={`/dashboard?tab=${item.key}`}
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
              <span className="text-[8px] sm:text-[9px] font-medium tracking-[0.28em] text-white/28 whitespace-normal break-words">
                AB 2026 v1
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
