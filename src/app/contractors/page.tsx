"use client";

import { useEffect } from "react";
import { useApp } from "../../context/AppContext";
import ContractorsView from "../../views/ContractorsView";

export default function ContractorsPage() {
  const appState = useApp();
  const {
    user,
    contractors,
    refetchData,
    triggerBannerAlert,
  } = appState;

  // Fetch contractors once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    appState.fetchContractorsData();
  }, []);

  return (
    <ContractorsView
      user={user}
      contractors={contractors}
      triggerBannerAlert={triggerBannerAlert}
      refetchData={refetchData}
    />
  );
}
