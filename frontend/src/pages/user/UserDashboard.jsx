import React, { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Wallet,
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Store,
  CheckCircle2,
  Clock,
  Plus,
  Zap,
  Smartphone,
  CreditCard,
  Receipt,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getRoleMeta } from "../../constants/roles";
import { fetchBackendUsers } from "../../features/admin/services/adminApi";

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

  useEffect(() => {
    if (canManageAgents) {
      fetchBackendUsers()
        .then((res) => {
          if (res?.data && Array.isArray(res.data)) {
            setDownlineCount(res.data.length);
          }
        })
        .catch(() => {});
    }
  }, [canManageAgents]);

  const kycStatus = String(currentUser.kyc?.status || "pending").toLowerCase();
  const isKycVerified = ["approved", "completed", "verified", "submitted"].includes(kycStatus);

  const handleServiceClick = (name) => {
    toast.info(`${name} terminal is active and ready for transactions.`);
  };

  const recentTransactions = [
    {
      id: "TXN-902184",
      service: "AEPS Cash Out",
      customer: "9876543210",
      amount: "₹ 2,500.00",
      commission: "+ ₹ 8.50",
      status: "Success",
      time: "12m ago"
    },
    {
      id: "TXN-902181",
      service: "BBPS Electricity",
      customer: "9812345678",
      amount: "₹ 1,480.00",
      commission: "+ ₹ 3.20",
      status: "Success",
      time: "35m ago"
    },
    {
      id: "TXN-902175",
      service: "Money Transfer (IMPS)",
      customer: "9765432109",
      amount: "₹ 5,000.00",
      commission: "+ ₹ 15.00",
      status: "Success",
      time: "1h ago"
    },
    {
      id: "TXN-902168",
      service: "Prepaid Recharge (Jio)",
      customer: "9988776655",
      amount: "₹ 299.00",
      commission: "+ ₹ 6.00",
      status: "Success",
      time: "2h ago"
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-semibold text-blue-100">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            Verified {roleMeta.name} Terminal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {currentUser.name || "Partner"}!
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            Account: <span className="font-mono font-bold text-white">AQP-{roleMeta.slug}-{currentUser.id || "101"}</span> • Outlet: {currentUser.shopname || "AquaPay Digital Center"} • {currentUser.city || "Retail Outlet"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          {canManageAgents && onOpenAddAgent && (
            <button
              onClick={onOpenAddAgent}
              className="bg-white hover:bg-blue-50 text-blue-700 font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Onboard Downline Agent
            </button>
          )}
          <button
            onClick={() => toast.info("Instant Settlement: Payout processing to your registered bank account.")}
            className="bg-blue-800/80 hover:bg-blue-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition border border-white/20 shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            Bank Settlement
          </button>
        </div>
      </div>

      {/* KYC Alert Banner if not verified */}
      {!isKycVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">KYC Verification Incomplete</span>
              <span className="text-amber-700">Please complete all 7 steps of identity verification to unlock full transaction limits.</span>
            </div>
          </div>
          <Link
            to="/user/kyc"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shrink-0"
          >
            Complete KYC
          </Link>
        </div>
      )}

      {/* 4 Financial & Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Wallet */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Main Wallet
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
            ₹ 24,850.50
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500 flex items-center justify-between">
            <span>Utility & DMT Funds</span>
            <span
              className="text-blue-600 font-bold hover:underline cursor-pointer"
              onClick={() => toast.info("UPI top-up active")}
            >
              + Topup
            </span>
          </div>
        </div>

        {/* AEPS Settlement */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AEPS Settlement
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 tracking-tight">
            ₹ 12,420.00
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-700 flex items-center justify-between">
            <span>Aadhaar Cash Out Funds</span>
            <span
              className="font-bold underline cursor-pointer"
              onClick={() => toast.info("Instant settlement initiated")}
            >
              Settle
            </span>
          </div>
        </div>

        {/* Network / Today's Business */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {canManageAgents ? "My Downline" : "Today's Business"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {canManageAgents ? <Users className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
            {canManageAgents ? downlineCount : "₹ 48,930.00"}
          </div>
          <div className="mt-2 text-xs font-medium text-indigo-600 flex items-center justify-between">
            <span>{canManageAgents ? "Onboarded Child Agents" : "29 Transactions"}</span>
            {canManageAgents && (
              <Link to="/user/team" className="font-bold hover:underline">
                View Team &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Commission */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Earnings
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-amber-600 tracking-tight">
            ₹ 412.50
          </div>
          <div className="mt-2 text-xs font-medium text-amber-700">
            Instant Commission Credited
          </div>
        </div>
      </div>

      {/* Banking & Payment Services Terminal Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Banking & Payment Services
            </h2>
            <p className="text-xs text-slate-500">
              Live customer transactions available on your terminal
            </p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Terminal Live
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div
            onClick={() => handleServiceClick("AEPS Cash Out")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">AEPS Cash Out</span>
            <span className="text-[10px] text-slate-400 mt-1">Aadhaar Cash</span>
          </div>

          <div
            onClick={() => handleServiceClick("AEPS Balance Enquiry")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">Balance Check</span>
            <span className="text-[10px] text-slate-400 mt-1">Mini Statement</span>
          </div>

          <div
            onClick={() => handleServiceClick("Domestic Money Transfer")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">Money Transfer</span>
            <span className="text-[10px] text-slate-400 mt-1">Instant IMPS/NEFT</span>
          </div>

          <div
            onClick={() => handleServiceClick("BBPS Utility Bill Payments")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 group-hover:bg-amber-600 text-amber-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <Zap className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">BBPS Bills</span>
            <span className="text-[10px] text-slate-400 mt-1">Power, Gas, Water</span>
          </div>

          <div
            onClick={() => handleServiceClick("Prepaid Mobile Recharge")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-50 group-hover:bg-rose-600 text-rose-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">Recharges</span>
            <span className="text-[10px] text-slate-400 mt-1">Prepaid & DTH</span>
          </div>

          <div
            onClick={() => handleServiceClick("Micro-ATM Swipes")}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="font-bold text-slate-900 text-xs">Micro-ATM</span>
            <span className="text-[10px] text-slate-400 mt-1">Card Cash Out</span>
          </div>
        </div>
      </div>

      {/* Recent Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Transactions</h3>
            <p className="text-xs text-slate-500">Live ledger of settlements executed on this terminal</p>
          </div>
          <span className="text-xs font-semibold text-blue-600">Real-time Settlement</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">TRANSACTION ID</th>
                <th className="py-3 px-4">SERVICE</th>
                <th className="py-3 px-4">CUSTOMER</th>
                <th className="py-3 px-4">AMOUNT</th>
                <th className="py-3 px-4">COMMISSION</th>
                <th className="py-3 px-4 text-center">STATUS</th>
                <th className="py-3 px-4 text-right">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-800">{tx.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{tx.service}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{tx.customer}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{tx.amount}</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600">{tx.commission}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
