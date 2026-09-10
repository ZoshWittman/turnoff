import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const kid = Nunito({
  variable: "--font-kid",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const display = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "WonderFact Kids",
  description: "Fun, safe trivia for kids ages 5 to 10. Swipe, listen, and surprise yourself with WonderFacts.",
  applicationName: "WonderFact Kids",
  appleWebApp: {
    capable: true,
    title: "WonderFact Kids",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFD166",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${kid.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
