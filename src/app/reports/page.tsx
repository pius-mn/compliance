"use client";

import { useApp } from "../../context/AppContext";
import { usePageData } from "../../hooks/usePageData";
import ReportingView from "../../views/ReportingView";
import type { ReportingViewProps } from "../../views/ReportingView";

export default function ReportsPage() {
  const appState = useApp();

  // Lazy-load reporting data when this page is visited
  usePageData(async () => {
    await Promise.all([
      appState.fetchProjectsData(),
      appState.fetchTechniciansData(),
      appState.fetchEHSDocumentsData(),
      appState.fetchComplianceFlagsData(),
      appState.fetchMilestonesData(),
      appState.fetchContractorsData(),
      appState.fetchUsersData(),
    ]);
  });

  const viewProps = appState as unknown as ReportingViewProps;

  return (
    <ReportingView
      {...viewProps}
      onTriggerScan={() => appState.refetchData(["complianceFlags", "notifications", "auditLogs"])}
      onResolveFlag={(flagId: number, comments: string) => {
        if (appState.handleResolveComplianceFlag) {
          appState.handleResolveComplianceFlag(flagId, comments);
        }
      }}
    />
  );
}
