import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光后期｜AI 照片风格创作",
  description: "上传照片，选择喜欢的场景，让 AI 自动完成风格化后期处理。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "拾光后期",
    description: "把普通照片，变成值得留下的一页。",
    images: [{ url: "/og.png", width: 1747, height: 909, alt: "拾光后期的多场景照片创作效果" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
