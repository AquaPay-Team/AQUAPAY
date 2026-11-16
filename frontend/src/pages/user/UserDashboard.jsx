import React, { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Calendar,
  BarChart2,
  BarChart3,
  TrendingUp,
  CreditCard,
  Send,
  QrCode,
  Zap,
  Search,
  Download,
  RefreshCw,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Wallet,
  Landmark,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { getRoleMeta } from "../../constants/roles";
import { fetchBackendUsers } from "../../features/admin/services/adminApi";
import { getKycStatus, getBankDetails } from "../../api/kyc.api";

export default function UserDashboard() {
  const context = useOutletContext();
  const onOpenAddAgent = context?.onOpenAddAgent;

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleId = Number(currentUser.role_id) || 8;
  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Merchant",
    slug: "RT",
  };

  const canManageAgents = roleId >= 2 && roleId <= 7;
  const [downlineCount, setDownlineCount] = useState(0);
  const [kycData, setKycData] = useState(null);
  const [bankData, setBankData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states for All Transaction Report
  const [dateFrom, setDateFrom] = useState("2026-10-12");
  const [dateTo, setDateTo] = useState("2026-10-12");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("50");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadBackendData() {
      setIsLoading(true);
      try {
        const kycRes = await getKycStatus().catch(() => null);
        if (isMounted && kycRes?.data) {
          setKycData(kycRes.data);
        }

        const bankRes = await getBankDetails().catch(() => null);
        if (isMounted && bankRes?.data) {
          setBankData(bankRes.data);
        }

        if (canManageAgents) {
          const usersRes = await fetchBackendUsers().catch(() => null);
          if (isMounted && usersRes?.data && Array.isArray(usersRes.data)) {
            setDownlineCount(usersRes.data.length);
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBackendData();
    return () => {
      isMounted = false;
    };
  }, [canManageAgents]);

  const rawStatus = String(kycData?.status || currentUser.kyc?.status || "pending").toLowerCase();
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
    toast.info(`Fetching live ledger records from ${dateFrom} to ${dateTo}...`);
  };

  const handleExport = () => {
    toast.success("Transaction report export queued.");
  };

  const handleRefresh = () => {
    toast.info("Refreshed transaction records.");
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      {/* KYC Alert Status Banner */}
      {isKycPending && (
        <div className="bg-white border border-amber-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">KYC Verification Incomplete</span>
              <span className="text-slate-500 text-xs">
                Complete your identity and business documentation to activate live counter collection and settlement services.
              </span>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            Complete KYC
          </Link>
        </div>
      )}

      {isKycUnderReview && (
        <div className="bg-white border border-blue-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">KYC Under Compliance Review</span>
              <span className="text-slate-500 text-xs">
                Your onboarding documentation has been submitted and is currently being verified. Payout services will activate once approved.
              </span>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            View Application
          </Link>
        </div>
      )}

      {/* Dashboard Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        {canManageAgents && onOpenAddAgent && (
          <button
            onClick={onOpenAddAgent}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition border border-slate-200 shadow-2xs flex items-center gap-2 cursor-pointer hover:shadow-sm"
          >
            <Plus className="w-4 h-4 text-black" strokeWidth={2.25} />
            <span>Onboard Agent</span>
          </button>
        )}
      </div>

      {/* ── Wallet Cards Row with Background Watermark Icons ─────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Main Wallet */}
        <div className="relative overflow-hidden bg-blue-50/60 rounded-2xl p-6 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          {/* Watermark Icon */}
          <Wallet className="absolute -right-3 -bottom-3 w-24 h-24 text-blue-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform" strokeWidth={1} />
          <span className="text-xs font-semibold text-slate-500 block">Main Wallet</span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              59.3%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            You made an extra <span className="text-blue-500 font-medium">35k</span> this year
          </p>
        </div>

        {/* Settlement Wallet */}
        <div className="relative overflow-hidden bg-amber-50/60 rounded-2xl p-6 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <Landmark className="absolute -right-3 -bottom-3 w-24 h-24 text-amber-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform" strokeWidth={1} />
          <span className="text-xs font-semibold text-slate-500 block">Settlement Wallet</span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              27.4%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            You made an extra <span className="text-amber-500 font-medium">1,943</span> this year
          </p>
        </div>

        {/* UPI Wallet */}
        <div className="relative overflow-hidden bg-purple-50/60 rounded-2xl p-6 border border-purple-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <Smartphone className="absolute -right-3 -bottom-3 w-24 h-24 text-purple-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform" strokeWidth={1} />
          <span className="text-xs font-semibold text-slate-500 block">UPI Wallet</span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              70.5%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            You made an extra <span className="text-purple-500 font-medium">8.9k</span> this year
          </p>
        </div>
      </div>

      {/* ── Services Section ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Services</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
            title="Service options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Service 1: Payout */}
          <div
            onClick={() => handleServiceClick("Payout")}
            className="bg-blue-50/50 border border-blue-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Payout</h3>
              <p className="text-xs text-slate-400 mt-1.5">Instant Transfer</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-blue-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Send className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Service 2: Credit Card 2 */}
          <div
            onClick={() => handleServiceClick("Credit Card 2")}
            className="bg-rose-50/50 border border-rose-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Credit Card 2</h3>
              <p className="text-xs text-slate-400 mt-1.5">Bill Payments</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-rose-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Service 3: Rupay UPI */}
          <div
            onClick={() => handleServiceClick("Rupay UPI")}
            className="bg-amber-50/50 border border-amber-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Rupay UPI</h3>
              <p className="text-xs text-slate-400 mt-1.5">UPI Collection</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-amber-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <QrCode className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Service 4: Add Money */}
          <div
            onClick={() => handleServiceClick("Add Money")}
            className="bg-purple-50/50 border border-purple-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Money</h3>
              <p className="text-xs text-slate-400 mt-1.5">Money Collection</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-purple-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Business Overview — Stats with bar chart ─────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Business Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Today Business */}
          <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Today Business</h4>
                <p className="text-[11px] text-slate-400">Today's Collection</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[20, 35, 15, 45, 30, 50, 10].map((h, i) => (
                <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${h}%`, backgroundColor: i === 6 ? "#10b981" : "#d1fae5" }} />
              ))}
            </div>
            <span className="text-xl font-bold text-emerald-600">₹0</span>
          </div>

          {/* This Month */}
          <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">This Month</h4>
                <p className="text-[11px] text-slate-400">Current Month Business</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[30, 55, 40, 60, 45].map((h, i) => (
                <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${h}%`, backgroundColor: i === 4 ? "#3b82f6" : "#dbeafe" }} />
              ))}
            </div>
            <span className="text-xl font-bold text-blue-600">₹0</span>
          </div>

          {/* Last Month */}
          <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Last Month</h4>
                <p className="text-[11px] text-slate-400">Previous Month Business</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[45, 35, 60, 50, 40].map((h, i) => (
                <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${h}%`, backgroundColor: i === 2 ? "#f59e0b" : "#fef3c7" }} />
              ))}
            </div>
            <span className="text-xl font-bold text-amber-600">₹0</span>
          </div>

          {/* This Year */}
          <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">This Year</h4>
                <p className="text-[11px] text-slate-400">Yearly Business Growth</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[25, 40, 55, 70].map((h, i) => (
                <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${h}%`, backgroundColor: i === 3 ? "#f43f5e" : "#fecdd3" }} />
              ))}
            </div>
            <span className="text-xl font-bold text-rose-600">₹0</span>
          </div>
        </div>
      </div>

      {/* ── All Transaction Report ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden hover:shadow-sm transition-shadow">
        {/* Header with Date Pickers and Fetch Button */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">All Transaction Report</h3>
            <p className="text-xs text-slate-400 mt-1">
              {transactions.length} total records
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleFetchReport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              Fetch
            </button>
          </div>
        </div>

        {/* Search & Action Toolbar */}
        <div className="p-4 sm:p-5 bg-slate-50/40 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search (press Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <span className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold rounded-xl text-xs">
              ₹ 0
            </span>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer hover:shadow-sm"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Export</span>
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer hover:shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-black" />
              <span>Refresh</span>
            </button>
            <button
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer hover:shadow-sm"
            >
              <Filter className="w-4 h-4 text-black" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3.5 px-5 font-bold">DATE</th>
                <th className="py-3.5 px-5 font-bold">USER DETAILS</th>
                <th className="py-3.5 px-5 font-bold">TRANSACTION DETAILS</th>
                <th className="py-3.5 px-5 font-bold">REFERENCE DETAILS</th>
                <th className="py-3.5 px-5 font-bold">AMOUNT</th>
                <th className="py-3.5 px-5 font-bold">STATUS</th>
                <th className="py-3.5 px-5 font-bold text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 font-medium text-sm">
                    No transactions found for selected filters
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-600">
                      <div>{tx.id || "43695"}</div>
                      <div className="text-[11px] text-slate-400">{tx.date || "12/10/26"}</div>
                      <div className="text-[11px] text-slate-400">{tx.time || "16:21"}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800">
                      <div className="font-semibold">{tx.userName || "Chauhan Meet (1524)"}</div>
                      <div className="text-[11px] text-slate-400">{tx.userMobile || "7738647711"}</div>
                      <div className="text-[11px] text-blue-600 font-semibold">{tx.userRole || "Retailer"}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600">
                      <div>Name: {tx.name || "Chauhan Meet"}</div>
                      <div className="text-[11px] text-slate-400">Mob: {tx.mobile || "7738647711"} | Mode: NA</div>
                      <div className="text-[11px] text-slate-400">CC No: NA</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600">
                      <div className="font-mono text-[11px]">TXN ID: {tx.txnId || "T15241791802270865"}</div>
                      <div className="text-[11px] text-slate-400">UTR: NA</div>
                      <div className="text-[11px] text-slate-500">Product: {tx.product || "Diamond 3"}</div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 font-medium">
                      <div>Amount: {tx.amount || "995"}</div>
                      <div className="text-[11px] text-slate-400">Charge: 0</div>
                      <div className="text-[11px] text-slate-400">Opening: 0 | Closing: 0</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
                        {tx.status || "Pending"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Page 1 of {Math.max(1, transactions.length)} records
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                <option value="50">50</option>
                <option value="25">25</option>
                <option value="10">10</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                className="p-1.5 text-slate-300 disabled:opacity-40 cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{transactions.length > 0 ? `1-${transactions.length} of ${transactions.length}` : "0-0 of 0"}</span>
              <button
                disabled
                className="p-1.5 text-slate-300 disabled:opacity-40 cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom All Rights Reserved */}
      <div className="text-left text-xs text-slate-400 pt-2">
        © All rights reserved
      </div>
    </div>
  );
}