import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Wallet,
  Zap,
  FileText,
  Landmark,
  ArrowRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export default function UserOperationPage({ title, category }) {
  const location = useLocation();
  const path = location.pathname;

  // Determine section meta from path
  const getSectionMeta = () => {
    if (path.includes("/fund/transfer-return-report")) {
      return {
        title: "Transfer & Return Report",
        category: "Fund Management",
        icon: FileText,
      };
    }
    if (path.includes("/fund/transfer-return")) {
      return {
        title: "Fund Transfer & Return",
        category: "Fund Management",
        icon: Wallet,
      };
    }
    if (path.includes("/services/add-money")) {
      return {
        title: "Add Money to Wallet",
        category: "Financial Services",
        icon: Zap,
      };
    }
    if (path.includes("/services/credit-card-bill")) {
      return {
        title: "Credit Card Bill Payment",
        category: "Financial Services",
        icon: Zap,
        description: "Pay and clear corporate and personal credit card statements instantly.",
      };
    }
    if (path.includes("/services/payout")) {
      return {
        title: "Instant Payout Terminal",
        category: "Financial Services",
        icon: Zap,
        description: "Process instant IMPS, NEFT, and RTGS payouts to beneficiary bank accounts.",
      };
    }
    if (path.includes("/services/rupay-upi")) {
      return {
        title: "Rupay UPI Collection",
        category: "Financial Services",
        icon: Zap,
      };
    }
    if (path.includes("/reports/payout")) {
      return {
        title: "Payout Audit Report",
        category: "Transaction Report",
        icon: FileText,
      };
    }
    if (path.includes("/reports/creditcard")) {
      return {
        title: "Credit Card Transaction Report",
        category: "Transaction Report",
        icon: FileText,
      };
    }
    if (path.includes("/reports/pos")) {
      return {
        title: "POS Machine Report",
        category: "Transaction Report",
        icon: FileText,
        description: "Hardware terminal dispatch, daily batch swipe settlements, and POS requests.",
      };
    }
    if (path.includes("/reports/pg")) {
      return {
        title: "Payment Gateway Report",
        category: "Transaction Report",
        icon: FileText,
      };
    }
    if (path.includes("/statement")) {
      return {
        title: "Official Account Statement",
        category: "Banking & Ledger",
        icon: Landmark,
      };
    }
    return {
      title: title || "Operations Terminal",
      category: category || "Management",
      icon: Zap,
    };
  };

  const meta = getSectionMeta();
  const IconComp = meta.icon;

  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("today");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ── Breadcrumb & Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 flex items-center gap-2 mb-1">
            <Link to="/user/dashboard" className="hover:text-blue-600 transition">Dashboard</Link>
            <span>/</span>
            <span>{meta.category}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">{meta.title}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {meta.title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {meta.description}
          </p>
        </div>
      </div>

      {/* ── Filter Toolbar & Table Card ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by reference ID, mobile, or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer shadow-2xs"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date</option>
            </select>

            <button
              type="button"
              onClick={() => toast.info("Refreshing transaction feeds...")}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition cursor-pointer shadow-2xs"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty records placeholder */}
        <div className="p-12 text-center">
          <h4 className="text-sm font-bold text-slate-800">No {meta.title} Entries Found</h4>
          <div className="mt-4">
            <Link
              to="/user/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              <span>Return to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
