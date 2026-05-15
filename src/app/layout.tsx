import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets:  ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets:  ["latin"],
});

export const metadata: Metadata = {
  title:       "Cubify",
  description: "3D material playground",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      {/* overflow-hidden prevents the Three.js canvas from briefly pushing
          the body to a scrollable size during window resize events. */}
      <body className="h-full overflow-hidden bg-[#0f0f0f] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
