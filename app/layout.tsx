import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formula D Planner",
  description: "Sondages, chat et gestion d’équipe pour Formula D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
