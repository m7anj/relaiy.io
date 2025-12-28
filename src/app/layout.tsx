import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "relaiy.io",
  description:
    "Automate Gmail workflows effortlessly using plain English, with safe and reviewable execution.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
