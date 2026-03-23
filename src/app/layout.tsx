import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const cadillacFont = localFont({
  src: "./fonts/CadillacPersonalUseItalic-K7pny.ttf",
  variable: "--font-cadillac",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EgoLift | 16-Week Program",
  description: "Training program and workout logger for the EgoLift 16-week powerlifting program. Track your squat, bench, and deadlift progress.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#673147",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className={cadillacFont.variable}>
        {children}
      </body>
    </html>
  );
}
