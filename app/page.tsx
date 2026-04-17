"use client";

import { useEffect, useState } from "react";
import { getAuth, getProvider } from "@/lib/firebase";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Landing() {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        router.push("/dashboard");
      }
    });

    return () => unsub();
  }, [router]);

  const login = async () => {
    const auth = getAuth();
    if (!auth) {
      alert("Firebase n'est pas configuré. Vérifie le fichier .env.local et redémarre l'application.");
      return;
    }

    try {
      setIsSigningIn(true);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, getProvider());
    } catch (error: any) {
      console.error("Erreur de connexion Google :", error);

      if (error?.code === "auth/unauthorized-domain") {
        alert(
          "Domaine non autorisé pour Google Auth. Ajoute ce domaine dans Firebase Console > Authentication > Settings > Authorized domains."
        );
        return;
      }

      if (error?.code === "auth/popup-blocked") {
        alert("La popup Google a été bloquée par le navigateur. Autorise les popups pour ce site et réessaie.");
        return;
      }

      alert(`Échec de la connexion Google : ${error.code || error.message || error}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#000e22] text-white">
      <div className="h-1 w-full bg-[#d31f28]" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-3xl">
          <img
            src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
            alt="Formula D"
            className="h-12 sm:h-14 w-auto mb-4 object-contain"
          />
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] sm:tracking-[0.4em] text-[#d31f28] uppercase mb-2">Formula D</p>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-[-0.02em] leading-[0.95] uppercase">
            PLANIFIEZ VOS <br />
            <span className="text-[#d31f28]">PARTIES</span>
          </h1>
        </div>

        <button
          onClick={login}
          disabled={isSigningIn}
          className="mt-8 sm:mt-10 w-full max-w-2xl bg-[#d31f28] px-6 py-4 sm:py-5 text-xs sm:text-base font-black uppercase tracking-[0.18em] sm:tracking-[0.3em] text-white shadow-[0_25px_90px_rgba(211,31,40,0.2)] transition hover:bg-[#b81d23]"
        >
          <span className="inline-flex items-center justify-center gap-3 sm:gap-4">
            <span className="text-xl leading-none">G</span>
            {isSigningIn ? "CONNEXION..." : "CONNEXION GOOGLE"}
          </span>
        </button>
      </div>
    </main>
  );
}
