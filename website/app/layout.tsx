import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { ThemeRegistry } from "@/lib/theme";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "课伴 KeBan · 熵减 — 潜入深海，拾起认知的微光",
  description:
    "课伴（熵减）是一款基于认知科学的学习伴侣应用。番茄钟、智能笔记、闪卡复习、费曼学习法——在无序的时光里，陪你慢慢生长。",
  keywords: ["课伴", "KeBan", "熵减", "学习工具", "番茄钟", "闪卡", "费曼学习法", "认知科学"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="dark" data-scroll-behavior="smooth">
      <body className={`${notoSans.variable} ${notoSerif.variable} antialiased`}>
        <ThemeRegistry>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </ThemeRegistry>
      </body>
    </html>
  );
}
