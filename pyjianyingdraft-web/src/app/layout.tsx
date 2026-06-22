import type { Metadata } from "next";
import './globals.css';

export const metadata: Metadata = {
  title: "pyJianYingDraft Web",
  description: "Web interface for pyJianYingDraft",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // HeroUI v3 无需 Provider，主题通过 CSS 变量 + html class 控制
  return (
    <html lang="zh-CN" className="light" data-theme="light" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
