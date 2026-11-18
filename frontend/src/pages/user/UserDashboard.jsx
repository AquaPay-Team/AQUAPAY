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
  ShieldCheck,
  Plus,
  ArrowUpRight,
  CheckCircle2,
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
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* ── 1. Top Notice Banner (KYC Under Review / Pending) ── */}
      {isKycPending && (
        <div className="bg-white border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-xs block">KYC Verification Incomplete</span>
              <span className="text-slate-500 text-xs">
                Complete your identity and business documentation to activate live counter collection and settlement services.
              </span>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-[#0088ff] hover:bg-blue-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            Complete KYC
          </Link>
        </div>
      )}

      {isKycUnderReview && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs">KYC Under Compliance Review</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Your onboarding documentation has been submitted and is currently being verified. Payout services will activate once approved.
              </p>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-[#0088ff] hover:bg-blue-600 text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            View Application
          </Link>
        </div>
      )}

      {/* ── 2. Dashboard Title Row ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        {canManageAgents && onOpenAddAgent && (
          <button
            onClick={onOpenAddAgent}
            className="bg-white hover:bg-slate-50 text-slate-700 font-medium px-3.5 py-1.5 rounded-lg text-xs transition border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Onboard Agent</span>
          </button>
        )}
      </div>

      {/* ── 3. Wallets 3-Card Row (Corner-Fixed Tilted Icons with Hover Effects) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Main Wallet */}
        <div className="bg-[#f0f9ff]/70 rounded-2xl p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-sky-300/80 transition-all duration-300 ease-out cursor-pointer">
          <span className="text-xs font-semibold text-slate-500 block">Main Wallet</span>
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-[#0284c7] group-hover:scale-105 transition-transform duration-300">
              <ArrowUpRight className="w-3 h-3" />
              59.3%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5">
            You made an extra <span className="text-[#0284c7] font-semibold">35k</span> this year
          </p>
          {/* Tilted Corner-Fixed Icon with Hover Effect */}
          <div className="absolute -right-2 -bottom-2 pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1">
            <Wallet className="w-24 h-24 text-sky-400/25 group-hover:text-sky-500/45 stroke-[1.5] transition-colors duration-300" />
          </div>
        </div>

        {/* Settlement Wallet */}
        <div className="bg-[#fefce8]/30 rounded-2xl p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-amber-300/80 transition-all duration-300 ease-out cursor-pointer">
          <span className="text-xs font-semibold text-slate-500 block">Settlement Wallet</span>
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform duration-300">
              <ArrowUpRight className="w-3 h-3" />
              27.4%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5">
            You made an extra <span className="text-amber-600 font-semibold">1,943</span> this year
          </p>
          {/* Tilted Corner-Fixed Icon with Hover Effect */}
          <div className="absolute -right-2 -bottom-2 pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1">
            <Landmark className="w-24 h-24 text-amber-400/25 group-hover:text-amber-500/45 stroke-[1.5] transition-colors duration-300" />
          </div>
        </div>

        {/* UPI Wallet */}
        <div className="bg-[#f2c8fa]/20 rounded-2xl p-5 border border-slate-200/80 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-purple-300/80 transition-all duration-300 ease-out cursor-pointer">
          <span className="text-xs font-semibold text-slate-500 block">UPI Wallet</span>
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">₹ 0.00</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform duration-300">
              <ArrowUpRight className="w-3 h-3" />
              70.5%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2.5">
            You made an extra <span className="text-purple-600 font-semibold">8.9k</span> this year
          </p>
          {/* Tilted Corner-Fixed Icon with Hover Effect */}
          <div className="absolute -right-2 -bottom-2 pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1">
            <Smartphone className="w-24 h-24 text-purple-400/25 group-hover:text-purple-500/45 stroke-[1.5] transition-colors duration-300" />
          </div>
        </div>
      </div>

      {/* ── 4. Services Section (2x2 Full Width Grid - Exact Match to Image 1) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Services</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer"
            title="Service options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Service 1: Payout */}
          <div
            onClick={() => handleServiceClick("Payout")}
            className="bg-[#f0f9ff]/70 border border-sky-100 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-sky-200 transition-all duration-300 cursor-pointer group"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Payout</h3>
              <p className="text-xs text-slate-400 mt-0.5">Instant Transfer</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
              <Send className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>

          {/* Service 2: Credit Card 2 */}
          <div
            onClick={() => handleServiceClick("Credit Card 2")}
            className="bg-[#fdf2f8]/70 border border-pink-100 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-pink-200 transition-all duration-300 cursor-pointer group"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Credit Card 2</h3>
              <p className="text-xs text-slate-400 mt-0.5">Bill Payments</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <CreditCard className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>

          {/* Service 3: Rupay UPI */}
          <div
            onClick={() => handleServiceClick("Rupay UPI")}
            className="bg-[#fefce8]/30 border border-yellow-100 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition-all duration-300 cursor-pointer group"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rupay UPI</h3>
              <p className="text-xs text-slate-400 mt-0.5">UPI Collection</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
              <QrCode className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>

          {/* Service 4: Add Money */}
          <div
            onClick={() => handleServiceClick("Add Money")}
            className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-300 cursor-pointer group"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Money</h3>
              <p className="text-xs text-slate-400 mt-0.5">Money Collection</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
              <Zap className="w-5 h-5" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Business Overview (4 Full-Width Cards with Mini Bar Charts - Exact Match to Image 2) ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Business Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today Business (Green Theme) */}
          <div className="bg-[#f0fdf4]/70 border border-emerald-100 rounded-2xl p-5 space-y-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-200 transition-all duration-300 cursor-default group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Today Business</h4>
                <p className="text-[11px] text-slate-400">Today's Collection</p>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-10 flex items-end gap-1.5 pt-1">
              <div className="w-full h-3 bg-emerald-100/80 rounded" />
              <div className="w-full h-5 bg-emerald-100/80 rounded" />
              <div className="w-full h-7 bg-emerald-100/80 rounded" />
              <div className="w-full h-4 bg-emerald-100/80 rounded" />
              <div className="w-full h-9 bg-emerald-200 rounded" />
            </div>

            <div className="text-xl font-bold text-emerald-400">₹0</div>
          </div>

          {/* Card 2: This Month (Blue Theme) */}
          <div className="bg-[#eff6ff]/50 border border-blue-100 rounded-2xl p-5 space-y-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all duration-300 cursor-default group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">This Month</h4>
                <p className="text-[11px] text-slate-400">Current Month Business</p>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-10 flex items-end gap-1.5 pt-1">
              <div className="w-full h-4 bg-blue-100/80 rounded" />
              <div className="w-full h-5 bg-blue-100/80 rounded" />
              <div className="w-full h-6 bg-blue-100/80 rounded" />
              <div className="w-full h-7 bg-blue-100/80 rounded" />
              <div className="w-full h-9 bg-blue-200 rounded" />
            </div>

            <div className="text-xl font-bold text-blue-400">₹0</div>
          </div>

          {/* Card 3: Last Month (Amber Theme) */}
          <div className="bg-[#fefce8]/50 border border-amber-100 rounded-2xl p-5 space-y-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition-all duration-300 cursor-default group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <BarChart2 className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Last Month</h4>
                <p className="text-[11px] text-slate-400">Previous Month Business</p>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-10 flex items-end gap-1.5 pt-1">
              <div className="w-full h-4 bg-amber-100/80 rounded" />
              <div className="w-full h-5 bg-amber-100/80 rounded" />
              <div className="w-full h-9 bg-amber-200 rounded" />
              <div className="w-full h-6 bg-amber-100/80 rounded" />
              <div className="w-full h-5 bg-amber-100/80 rounded" />
            </div>

            <div className="text-xl font-bold text-amber-300">₹0</div>
          </div>

          {/* Card 4: This Year (Rose Theme) */}
          <div className="bg-[#fff1f2]/30 border border-rose-100 rounded-2xl p-5 space-y-4 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-rose-200 transition-all duration-300 cursor-default group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">This Year</h4>
                <p className="text-[11px] text-slate-400">Yearly Business Growth</p>
              </div>
            </div>

            {/* Mini Bar Chart */}
            <div className="h-10 flex items-end gap-1.5 pt-1">
              <div className="w-full h-3 bg-rose-100/80 rounded" />
              <div className="w-full h-5 bg-rose-100/80 rounded" />
              <div className="w-full h-6 bg-rose-100/80 rounded" />
              <div className="w-full h-7 bg-rose-100/80 rounded" />
              <div className="w-full h-9 bg-rose-200 rounded" />
            </div>

            <div className="text-xl font-bold text-rose-300">₹0</div>
          </div>
        </div>
      </div>

      {/* ── 6. All Transaction Report (Exact Match to Image 2) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Header with Date Pickers and Fetch Button */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">All Transaction Report</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {transactions.length} total records
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleFetchReport}
              className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-xs px-5 py-2 rounded-xl transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              Fetch
            </button>
          </div>
        </div>

        {/* Search & Action Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50/40 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search (press Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold rounded-lg text-xs">
              ₹ 0
            </span>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-4 font-bold">DATE</th>
                <th className="py-3 px-4 font-bold">USER DETAILS</th>
                <th className="py-3 px-4 font-bold">TRANSACTION DETAILS</th>
                <th className="py-3 px-4 font-bold">REFERENCE DETAILS</th>
                <th className="py-3 px-4 font-bold">AMOUNT</th>
                <th className="py-3 px-4 font-bold">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 font-medium">
                    No transactions found for selected filters
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-600">{tx.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{tx.userName}</td>
                    <td className="py-3 px-4 text-slate-600">{tx.service}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{tx.referenceId}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{tx.amount}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination (Matching Image 2) */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <span>Page 1 of 1 records</span>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <span>0-0 of 0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
