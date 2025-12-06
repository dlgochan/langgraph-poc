import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LangGraph HITL POC",
  description: "Human-in-the-Loop 워크플로우 데모 - Next.js + LangGraph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
