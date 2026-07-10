"use client";

import { useApp } from "../../context/AppContext";
import ContractorsView from "../../views/ContractorsView";

export default function ContractorsPage() {
  const appState = useApp();
  const {
    user,
    contractors,
    triggerBannerAlert,
  } = appState;

  return (
    <ContractorsView
      user={user}
      contractors={contractors}
      triggerBannerAlert={triggerBannerAlert}
    />
  );
}
