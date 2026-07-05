"use client";

import { useApp } from "../../context/AppContext";
import ContractorsView from "../../views/ContractorsView";

export default function ContractorsPage() {
  const {
    user,
    contractors,
    refetchData,
    triggerBannerAlert,
  } = useApp();

  return (
    <ContractorsView
      user={user}
      contractors={contractors}
      triggerBannerAlert={triggerBannerAlert}
      refetchData={refetchData}
    />
  );
}
