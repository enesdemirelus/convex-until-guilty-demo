import type { Metadata } from "next";
import "./tokens.css";

export const metadata: Metadata = {
  title: "Roll the Ball — Convex Until Proven Guilty",
  description:
    "Watch optimization algorithms race across convex bowls and non-convex hills.",
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
