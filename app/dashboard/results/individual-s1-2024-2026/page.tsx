import Link from "next/link";

export default function IndividualS120242026ResultsPage() {
  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      <div className="h-1 w-full bg-[#d31f28]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Link href="/dashboard?tab=results" className="shrink-0" aria-label="Aller aux Resultats">
              <img
                src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
                alt="Formula D"
                className="h-7 sm:h-14 w-auto object-contain"
              />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#d31f28]">Resultats</p>
              <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.12em] text-white">
                Championnat Individuel Saison 1 - 2024 / 2026
              </h1>
            </div>
          </div>

          <Link
            href="/dashboard?tab=results"
            className="shrink-0 border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-200 hover:text-white hover:border-white/40 transition"
          >
            Retour
          </Link>
        </header>

        <section className="mt-4 border-l-4 border-[#d31f28] border border-white/10 bg-black/30 p-4 sm:p-6">
          <div className="border border-white/10 bg-[#010d1e] p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#d31f28]">Resultats visuels</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-400">Mobile: pincez pour zoomer ou glissez horizontalement</p>
              <a
                href="/I09.png"
                target="_blank"
                rel="noreferrer"
                className="border border-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-200 hover:text-white hover:border-white/40 transition"
              >
                Ouvrir en plein ecran
              </a>
            </div>

            <div className="mt-3 border border-white/10 bg-black/40 p-2 sm:p-3 overflow-x-auto">
              <img
                src="/I09.png"
                alt="Resultats Championnat Individuel Saison 1"
                className="h-auto w-full min-w-[920px] sm:min-w-0 object-contain"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
