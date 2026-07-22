import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "宝宝饱饱｜把辅食视频变成宝宝专属步骤",
  description: "粘贴辅食视频，按宝宝档案查看适配结果，并在厨房里一步步完成制作。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
