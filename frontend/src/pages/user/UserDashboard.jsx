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
  CheckCircle2
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
      {/* KYC Alert Status Banner */}
      {isKycPending && (
        <div className="bg-white border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
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
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            Complete KYC
          </Link>
        </div>
      )}

      {isKycUnderReview && (
        <div className="bg-white border border-blue-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-xs block">KYC Under Compliance Review</span>
              <span className="text-slate-500 text-xs">
                Your onboarding documentation has been submitted and is currently being verified. Payout services will activate once approved.
              </span>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-2xs shrink-0 text-center"
          >
            View Application
          </Link>
        </div>
      )}

      {/* Dashboard Page Header (Matching Screenshot) */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Dashboard</h1>
        {canManageAgents && onOpenAddAgent && (
          <button
            onClick={onOpenAddAgent}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.25} />
            <span>Onboard Agent</span>
          </button>
        )}
      </div>

      {/* Top Main Section: Wallets + Services (Left 3/4) & Business Overview (Right 1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column (Wallets Row + Services Grid) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Wallets 3-Card Row (Exact Match to Screenshots 1 & 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Main Wallet */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-medium text-slate-500 block">Main Wallet</span>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-600">
                  <ArrowUpRight className="w-3 h-3" />
                  59.3%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                You made an extra <span className="text-blue-500 font-medium">35k</span> this year
              </p>
            </div>

            {/* Settlement Wallet */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-medium text-slate-500 block">Settlement Wallet</span>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-600">
                  <ArrowUpRight className="w-3 h-3" />
                  27.4%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                You made an extra <span className="text-amber-500 font-medium">1,943</span> this year
              </p>
            </div>

            {/* UPI Wallet */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-medium text-slate-500 block">UPI Wallet</span>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-600">
                  <ArrowUpRight className="w-3 h-3" />
                  70.5%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                You made an extra <span className="text-blue-500 font-medium">8.9k</span> this year
              </p>
            </div>
          </div>

          {/* Services Section (Matching Screenshots 1 & 5) */}
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
              {/* Service 1: Payout (Screenshot 5) */}
              <div
                onClick={() => handleServiceClick("Payout")}
                className="bg-gradient-to-r from-blue-50/80 to-blue-50/20 border border-blue-100/90 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Payout</h3>
                  <p className="text-xs text-slate-400 mt-1">Instant Transfer</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-blue-100/80 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" strokeWidth={2.25} />
                </div>
              </div>

              {/* Service 2: Credit Card 2 (Screenshot 1 & 5) */}
              <div
                onClick={() => handleServiceClick("Credit Card 2")}
                className="bg-gradient-to-r from-rose-50/80 to-rose-50/20 border border-rose-100/90 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Credit Card 2</h3>
                  <p className="text-xs text-slate-400 mt-1">Bill Payments</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-rose-100/80 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5" strokeWidth={2.25} />
                </div>
              </div>

              {/* Service 3: Rupay UPI (Screenshot 1 & 5) */}
              <div
                onClick={() => handleServiceClick("Rupay UPI")}
                className="bg-gradient-to-r from-amber-50/80 to-amber-50/20 border border-amber-100/90 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Rupay UPI</h3>
                  <p className="text-xs text-slate-400 mt-1">UPI Collection</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-amber-100/80 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5" strokeWidth={2.25} />
                </div>
              </div>

              {/* Service 4: Add Money (Screenshot 1 & 5) */}
              <div
                onClick={() => handleServiceClick("Add Money")}
                className="bg-gradient-to-r from-purple-50/80 to-purple-50/20 border border-purple-100/90 rounded-2xl p-5 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Money</h3>
                  <p className="text-xs text-slate-400 mt-1">Money Collection</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white shadow-2xs border border-purple-100/80 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5" strokeWidth={2.25} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Business Overview Vertical Card (Exact Match to Screenshots 1 & 5) */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          {/* Today Business */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Today Business</h4>
                <p className="text-[11px] text-slate-400">Today's Collection</p>
              </div>
            </div>
            <span className="text-sm font-bold text-emerald-600">₹0</span>
          </div>

          {/* This Month */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart2 className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">This Month</h4>
                <p className="text-[11px] text-slate-400">Current Month Business</p>
              </div>
            </div>
            <span className="text-sm font-bold text-blue-600">₹0</span>
          </div>

          {/* Last Month */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Last Month</h4>
                <p className="text-[11px] text-slate-400">Previous Month Business</p>
              </div>
            </div>
            <span className="text-sm font-bold text-amber-600">₹0</span>
          </div>

          {/* This Year */}
          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" strokeWidth={2.25} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">This Year</h4>
                <p className="text-[11px] text-slate-400">Yearly Business Growth</p>
              </div>
            </div>
            <span className="text-sm font-bold text-rose-600">₹0</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: All Transaction Report (Exact Match to Screenshots 1, 5, 6, 8, 13) */}
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
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleFetchReport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              Fetch
            </button>
          </div>
        </div>

        {/* Search & Action Toolbar (Matching Screenshots 1, 6, 13) */}
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
                <th className="py-3 px-4 font-bold text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {transactions.length === 0 ? (
                /* Empty state matching Screenshot 8 */
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No transactions found for selected filters
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      <div>{tx.id || "43695"}</div>
                      <div className="text-[11px] text-slate-400">{tx.date || "12/10/26"}</div>
                      <div className="text-[11px] text-slate-400">{tx.time || "16:21"}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div className="font-semibold">{tx.userName || "Chauhan Meet (1524)"}</div>
                      <div className="text-[11px] text-slate-400">{tx.userMobile || "7738647711"}</div>
                      <div className="text-[11px] text-blue-600 font-semibold">{tx.userRole || "Retailer"}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>Name: {tx.name || "Chauhan Meet"}</div>
                      <div className="text-[11px] text-slate-400">Mob: {tx.mobile || "7738647711"} | Mode: NA</div>
                      <div className="text-[11px] text-slate-400">CC No: NA</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="font-mono text-[11px]">TXN ID: {tx.txnId || "T15241791802270865"}</div>
                      <div className="text-[11px] text-slate-400">UTR: NA</div>
                      <div className="text-[11px] text-slate-500">Product: {tx.product || "Diamond 3"}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      <div>Amount: {tx.amount || "995"}</div>
                      <div className="text-[11px] text-slate-400">Charge: 0</div>
                      <div className="text-[11px] text-slate-400">Opening: 0 | Closing: 0</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
                        {tx.status || "Pending"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer (Matching Screenshot 6 & 13) */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Page 1 of {Math.max(1, transactions.length)} records
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value="50">50</option>
                <option value="25">25</option>
                <option value="10">10</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                className="p-1 text-slate-300 disabled:opacity-40 cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{transactions.length > 0 ? `1-${transactions.length} of ${transactions.length}` : "0-0 of 0"}</span>
              <button
                disabled
                className="p-1 text-slate-300 disabled:opacity-40 cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom All Rights Reserved (Exact match to all screenshots) */}
      <div className="text-left text-xs text-slate-400 pt-1">
        © All rights reserved
      </div>
    </div>
  );
}
