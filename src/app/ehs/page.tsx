"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import EhsView from "../../views/EhsView";
import type { EhsViewProps } from "../../views/EhsView";
import { apiFetchPage } from "../../utils/apiFetch";
import { usePageParam } from "../../hooks/usePageParam";
import { getActiveContractorLabel } from "../../utils/helpers";
import type { TechnicianDocument } from "../../types";

export default function EhsPage() {
  const appState = useApp();
  const [docPage, setDocPage] = usePageParam("page", 1);
  const [docsTotal, setDocsTotal] = useState(0);

  const fetchEHSDocsPage = useCallback(async () => {
    const params: Record<string, string> = {};
    if (appState.docSearch) params.status = appState.docSearch;
    const result = await apiFetchPage<TechnicianDocument>("/api/v1/ehs/documents", docPage || 1, appState.itemsPerPage || 10, params);
    appState.setDocuments(result.data);
    setDocsTotal(result.total);
  }, [docPage, appState.itemsPerPage, appState.docSearch, appState.setDocuments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEHSDocsPage();
  }, [fetchEHSDocsPage]);

  const viewProps = appState as unknown as EhsViewProps;

  return (
    <EhsView
      {...viewProps}
      docPage={docPage}
      setDocPage={setDocPage}
      triggerBannerAlert={appState.triggerBannerAlert}
      filteredDocuments={appState.documents || []}
      paginatedDocuments={appState.documents || []}
      documents={appState.documents || []}
      docsTotal={docsTotal}
      getActiveContractorLabel={getActiveContractorLabel}
      filteredBranches={appState.contractors}
      allDocumentTypes={appState.allDocumentTypes || []}
    />
  );
}
