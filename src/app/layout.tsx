import React from "react";
import { Providers } from "./providers";
import "../index.css";

export const metadata = {
  title: "Safaricom EHS Compliance Portal",
  description: "Unified safety, site registry, and compliance tracking",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-red-500 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
