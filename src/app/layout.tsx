import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const rounded = M_PLUS_Rounded_1c({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-rounded",
  preload: false,
});

export const metadata: Metadata = {
  title: "そらもよう｜ゆるっと天気予報",
  description: "都市名や現在地から、気温・天気・湿度・降水確率をチェックできる天気予報アプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${rounded.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
