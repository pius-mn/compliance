"use client";

import { useApp } from "../../context/AppContext";
import ReportingView from "../../views/ReportingView";
import type { ReportingViewProps } from "../../views/ReportingView";

export default function ReportsPage() {
  const appState = useApp();

  const viewProps = appState as unknown as ReportingViewProps;

  return (
    <ReportingView
      {...viewProps}
      onTriggerScan={() => {}}
      onResolveFlag={(flagId: number, comments: string) => {
        if (appState.handleResolveComplianceFlag) {
          appState.handleResolveComplianceFlag(flagId, comments);
        }
      }}
    />
  );
}
