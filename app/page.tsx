"use client";

import { useEffect, useState } from "react";
import { getAuth, getProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Landing() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

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
      await signInWithPopup(auth, getProvider());
    } catch (error: any) {
      console.error("Erreur de connexion Google :", error);
      alert(`Échec de la connexion Google : ${error.code || error.message || error}`);
    }
  };

  return (
    <main className="min-h-screen bg-[#000e22] text-white flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#d31f28] flex items-center justify-center font-bold tracking-[0.2em] text-sm">
          FD
        </div>
        <span className="font-semibold uppercase tracking-[0.2em] text-white/90">Formula D</span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-8 lg:px-10">

        <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-[-0.03em]">
          PLANIFIEZ VOS <br />
          <span className="text-[#d31f28]">PARTIES DE FORMULA D</span>
        </h1>

        <p className="max-w-2xl text-gray-400 text-lg leading-8 mt-5">
          Sondages, chat et gestion d’équipe pour vos sessions Formula D.
        </p>

        <button
          onClick={login}
          className="mt-10 w-full max-w-2xl rounded-3xl bg-[#d31f28] py-4 text-base font-semibold uppercase tracking-[0.12em] text-white shadow-[0_25px_90px_rgba(211,31,40,0.18)] transition hover:bg-[#d31f28]"
        >
          <span className="inline-flex items-center justify-center gap-3">
            <span className="text-xl">G</span>
            CONNEXION GOOGLE
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10 px-6 py-6">
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-[#d31f28] text-2xl mb-4">📊</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">SONDAGES</p>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-[#d31f28] text-2xl mb-4">💬</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">CHAT</p>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center shadow-xl shadow-black/20">
          <div className="text-[#d31f28] text-2xl mb-4">👥</div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">ÉQUIPES</p>
        </div>
      </div>
    </main>
  );
}
