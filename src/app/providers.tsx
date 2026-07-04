"use client";

import React from "react";
import { AppProvider } from "../context/AppContext";
import AppLayout from "./AppLayout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppLayout>{children}</AppLayout>
    </AppProvider>
  );
}
