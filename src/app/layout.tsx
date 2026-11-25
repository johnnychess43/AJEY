import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "AJEY — Learn. Plan. Remember. Grow.",
  description: "Your intelligent learning and productivity companion.",
  icons: {
    icon: "/ajey-logo.jpg",
    shortcut: "/ajey-logo.jpg",
    apple: "/ajey-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={jakarta.variable}>{children}</body>
    </html>
  );
}
