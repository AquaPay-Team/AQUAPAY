import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { getKycStatus } from "@/api/kyc.api";
import { useAuth } from "@/features/auth";
import {
  KycAlertBanner,
  WalletCards,
  ServicesGrid,
  BusinessOverviewCards,
  TransactionReportTable,
} from "@/features/dashboard";

export default function UserDashboard() {
  const { user } = useAuth();
  const [kycData, setKycData] = useState(null);

  // Filter & Search states for Transaction Report
  const [dateFrom, setDateFrom] = useState("2026-10-12");
  const [dateTo, setDateTo] = useState("2026-10-12");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("50");
  const [transactions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    getKycStatus()
      .then((res) => {
        if (isMounted && res?.data) setKycData(res.data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const rawStatus = String(kycData?.status || user?.kyc?.status || "pending").toLowerCase();
  const isKycApproved = rawStatus === "approved" || rawStatus === "completed" || rawStatus === "verified";
  const isKycUnderReview = rawStatus === "submitted" || rawStatus === "under_review";
  const isKycPending = !isKycApproved && !isKycUnderReview;

  const handleServiceClick = (name) => {
    if (!isKycApproved) {
      toast.error(`Service Locked: ${name} will activate once your KYC verification is approved by compliance.`);
      return;
    }
    toast.info(`${name} terminal is active and ready for live processing.`);
  };

  const handleFetchReport = () => {
    toast.error(`Transaction records are not available for ${dateFrom} through ${dateTo}.`);
  };

  const handleExport = () => {
    toast.error("No transaction records are available to export.");
  };

  const handleRefresh = () => {
    toast.error("Transaction report refresh is not available yet.");
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      <KycAlertBanner isKycPending={isKycPending} isKycUnderReview={isKycUnderReview} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
      </div>

      <WalletCards />
      <ServicesGrid onServiceClick={handleServiceClick} />
      <BusinessOverviewCards />

      <TransactionReportTable
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
        transactions={transactions}
        onFetchReport={handleFetchReport}
        onExport={handleExport}
        onRefresh={handleRefresh}
      />

      <div className="text-left text-xs text-slate-400 pt-2">
        © All rights reserved
      </div>
    </div>
  );
}
