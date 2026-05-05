"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getFirestore } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

type InfoMessage = {
  id: string;
  text: string;
  enabled: boolean;
  createdAt?: any;
};

type CycleSettings = {
  enabled: boolean;
  mode: "sequential" | "random";
  rotationMs: number;
  noRepeatWindow: number;
};

const defaultSettings: CycleSettings = {
  enabled: true,
  mode: "sequential",
  rotationMs: 4200,
  noRepeatWindow: 5,
};

export default function InfoAdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const [messages, setMessages] = useState<InfoMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState<CycleSettings>(defaultSettings);

  useEffect(() => {
    const auth = getAuth();
    const firestore = getFirestore();
    if (!auth || !firestore) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (u) => {
      if (!u?.email) {
        router.replace("/");
        return;
      }

      setUserEmail(u.email);

      const memberRef = doc(firestore, "members", u.email);
      const unsubMember = onSnapshot(memberRef, (snap) => {
        const role = (snap.data() as any)?.role || "member";
        const isAdmin = role === "admin" || role === "superAdmin";
        setAllowed(isAdmin);
        setLoading(false);
        if (!isAdmin) {
          router.replace("/dashboard");
        }
      });

      return () => unsubMember();
    });
  }, [router]);

  useEffect(() => {
    if (!allowed) return;

    const firestore = getFirestore();
    if (!firestore) return;

    const unsubSettings = onSnapshot(doc(firestore, "settings", "infoBanner"), (snap) => {
      const data = (snap.data() as any) || {};
      setSettings({
        enabled: typeof data.enabled === "boolean" ? data.enabled : defaultSettings.enabled,
        mode: data.mode === "random" ? "random" : "sequential",
        rotationMs: Number(data.rotationMs) > 0 ? Number(data.rotationMs) : defaultSettings.rotationMs,
        noRepeatWindow: Number(data.noRepeatWindow) >= 0 ? Number(data.noRepeatWindow) : defaultSettings.noRepeatWindow,
      });
    });

    const q = query(collection(firestore, "infoMessages"), orderBy("createdAt", "desc"));
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setMessages(rows as InfoMessage[]);
    });

    return () => {
      unsubSettings();
      unsubMessages();
    };
  }, [allowed]);

  const enabledCount = useMemo(() => messages.filter((m) => !!m.enabled).length, [messages]);

  const saveSettings = async () => {
    const firestore = getFirestore();
    if (!firestore) return;

    const safeRotation = Math.max(1500, Number(settings.rotationMs) || defaultSettings.rotationMs);
    const safeNoRepeat = Math.max(0, Number(settings.noRepeatWindow) || 0);

    await setDoc(
      doc(firestore, "settings", "infoBanner"),
      {
        enabled: !!settings.enabled,
        mode: settings.mode,
        rotationMs: safeRotation,
        noRepeatWindow: safeNoRepeat,
        updatedBy: userEmail || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const addSingleMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;

    const firestore = getFirestore();
    if (!firestore) return;

    setIsSaving(true);
    try {
      await addDoc(collection(firestore, "infoMessages"), {
        text,
        enabled: true,
        category: "general",
        createdAt: serverTimestamp(),
        createdBy: userEmail || null,
        updatedAt: serverTimestamp(),
      });
      setNewMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const importBulkMessages = async () => {
    const firestore = getFirestore();
    if (!firestore) return;

    const lines = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const uniqueLines = Array.from(new Set(lines));
    const batch = writeBatch(firestore);

    uniqueLines.forEach((text) => {
      const ref = doc(collection(firestore, "infoMessages"));
      batch.set(ref, {
        text,
        enabled: true,
        category: "general",
        createdAt: serverTimestamp(),
        createdBy: userEmail || null,
        updatedAt: serverTimestamp(),
      });
    });

    setIsSaving(true);
    try {
      await batch.commit();
      setBulkInput("");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMessage = async (message: InfoMessage) => {
    const firestore = getFirestore();
    if (!firestore) return;

    await updateDoc(doc(firestore, "infoMessages", message.id), {
      enabled: !message.enabled,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail || null,
    });
  };

  const removeMessage = async (messageId: string) => {
    const firestore = getFirestore();
    if (!firestore) return;

    await deleteDoc(doc(firestore, "infoMessages", messageId));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1014] text-white p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-400">Chargement admin...</p>
      </main>
    );
  }

  if (!allowed) return null;

  return (
    <main className="min-h-screen bg-[#0f1014] text-white">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 pb-24">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="shrink-0" aria-label="Aller au dashboard">
              <img
                src="https://cdn.discordapp.com/attachments/1068885680568148019/1494439845198696489/FD.png?ex=69e29d10&is=69e14b90&hm=fdeba7a50be29eb581e84c0690762d2cf5da649aeb5f6735349f8b6ddbc0ffb9&"
                alt="Formula D"
                className="h-7 sm:h-14 w-auto object-contain"
              />
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#e10600]">Administration</p>
              <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.12em]">Messages infos</h1>
            </div>
          </div>
          <Link
            href="/dashboard/versions"
            className="inline-flex w-auto items-center justify-center border border-[#d65a62]/45 bg-[#5b2024]/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd3d0] transition hover:border-[#ff6f66]/55 hover:bg-[#692329]/45 hover:text-white"
          >
            Retour notes
          </Link>
        </header>

        <section className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="border border-white/10 bg-black/30 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Regles de cycle</p>

              <label className="flex items-center justify-between text-sm text-gray-300 gap-2">
                <span>Bloc info actif</span>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-gray-400 mb-1">Mode</label>
                <select
                  value={settings.mode}
                  onChange={(e) => setSettings((prev) => ({ ...prev, mode: e.target.value as "sequential" | "random" }))}
                  className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm"
                >
                  <option value="sequential" className="bg-[#13151b]">Sequential</option>
                  <option value="random" className="bg-[#13151b]">Random</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-gray-400 mb-1">Intervalle (ms)</label>
                <input
                  type="number"
                  min="1500"
                  step="100"
                  value={settings.rotationMs}
                  onChange={(e) => setSettings((prev) => ({ ...prev, rotationMs: Number(e.target.value) || 1500 }))}
                  className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.14em] text-gray-400 mb-1">Anti repetition (N derniers)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.noRepeatWindow}
                  onChange={(e) => setSettings((prev) => ({ ...prev, noRepeatWindow: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={saveSettings}
                className="w-full bg-[#e10600] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#ba0500] transition"
              >
                Sauvegarder les regles
              </button>
            </div>

            <div className="border border-white/10 bg-black/30 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Ajouter un message</p>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
                className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm"
                placeholder="Ex: Le championnat est lance, verifiez vos votes de disponibilite."
              />
              <button
                type="button"
                onClick={addSingleMessage}
                disabled={isSaving}
                className="w-full border border-white/20 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-200 hover:text-white hover:border-white/40 transition disabled:opacity-60"
              >
                Ajouter
              </button>
            </div>

            <div className="border border-white/10 bg-black/30 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Import en masse</p>
              <p className="text-xs text-gray-500">1 ligne = 1 message</p>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                rows={6}
                className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm"
                placeholder="Message 1\nMessage 2\nMessage 3"
              />
              <button
                type="button"
                onClick={importBulkMessages}
                disabled={isSaving}
                className="w-full bg-[#e10600] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#ba0500] transition disabled:opacity-60"
              >
                Importer
              </button>
            </div>
          </div>

          <div className="border border-white/10 bg-black/30 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Messages</p>
              <p className="text-xs text-gray-500">{enabledCount}/{messages.length} actifs</p>
            </div>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun message pour le moment.</p>
            ) : (
              <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className="border border-white/10 bg-[#121419] px-3 py-2">
                    <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{message.text}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMessage(message)}
                        className={`text-[10px] uppercase tracking-[0.14em] ${message.enabled ? "text-[#47b84f]" : "text-gray-500"}`}
                      >
                        {message.enabled ? "Actif" : "Inactif"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMessage(message.id)}
                        className="text-[10px] uppercase tracking-[0.14em] text-[#ff5f66] hover:text-[#ff8f94]"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

