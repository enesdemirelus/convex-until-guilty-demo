import type { Metadata } from "next";
import "./tokens.css";

export const metadata: Metadata = {
  title: "Convex Until Proven Guilty — Accelerated Optimization",
  description:
    "Interactive benchmark of gradient descent, Nesterov acceleration, and non-convex curvature monitoring.",
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
