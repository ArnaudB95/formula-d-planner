"use client";

import { useEffect, useState } from "react";
import { auth, provider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Landing() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (u) {
        router.push("/dashboard");
      }
    });

    return () => unsub();
  }, []);

  const login = async () => {
    await signInWithPopup(auth, provider);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">

      {/* HEADER */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-600 flex items-center justify-center font-bold">
          FD
        </div>
        <span className="font-bold">FORMULA D</span>
      </div>

      {/* HERO */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <p className="text-xs text-gray-400 mb-2">APP MOBILE</p>

        <h1 className="text-4xl font-bold leading-tight">
          PLANIFIEZ VOS <br />
          <span className="text-red-500">PARTIES F1</span>
        </h1>

        <p className="text-gray-400 mt-4">
          Sondages, chat et gestion d’équipe pour vos sessions Formula D.
        </p>

        {/* LOGIN BUTTON */}
        <button
          onClick={login}
          className="mt-8 bg-red-600 w-full py-4 font-bold text-white"
        >
          🔴 CONNEXION GOOGLE
        </button>
      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-3 border-t border-gray-800">
        <div className="p-4 text-center">
          <p className="text-xs text-gray-400">📊</p>
          <p className="text-sm">SONDAGES</p>
        </div>

        <div className="p-4 text-center border-l border-r border-gray-800">
          <p className="text-xs text-gray-400">💬</p>
          <p className="text-sm">CHAT</p>
        </div>

        <div className="p-4 text-center">
          <p className="text-xs text-gray-400">👥</p>
          <p className="text-sm">ÉQUIPES</p>
        </div>
      </div>

    </main>
  );
}