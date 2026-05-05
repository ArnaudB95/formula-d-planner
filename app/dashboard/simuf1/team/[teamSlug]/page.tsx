"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TeamPage() {
  const params = useParams<{ teamSlug: string }>();
  const router = useRouter();
  const teamSlug = String(params?.teamSlug || "").trim();

  useEffect(() => {
    if (!teamSlug) {
      router.replace("/dashboard?tab=simuf1");
      return;
    }
    router.replace(`/dashboard?tab=simuf1&team=${encodeURIComponent(teamSlug)}`);
  }, [router, teamSlug]);

  return (
    <main className="min-h-screen bg-[#0f1014] text-white p-6">
      <p className="text-sm text-gray-400">Redirection vers SimuF1...</p>
    </main>
  );
}
