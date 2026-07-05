"use client";

import React from "react";
import { Toaster } from "react-hot-toast";
import { AppProvider } from "../context/AppContext";
import AppLayout from "./AppLayout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {/* Global Toaster — mounted outside AppLayout so it survives login/logout cycles */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontSize: "12px",
            fontWeight: 600,
          },
        }}
      />
      <AppLayout>{children}</AppLayout>
    </AppProvider>
  );
}
