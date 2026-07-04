"use client";

import { useApp } from "../../context/AppContext";
import ContractorsView from "../../views/ContractorsView";

export default function ContractorsPage() {
  const {
    user,
    contractors,
    refetchData,
    setSysAlert,
  } = useApp();

  return (
    <ContractorsView
      user={user}
      contractors={contractors}
      triggerBannerAlert={(type: string, msg: string) => setSysAlert({ type, message: msg })}
      refetchData={refetchData}
    />
  );
}
