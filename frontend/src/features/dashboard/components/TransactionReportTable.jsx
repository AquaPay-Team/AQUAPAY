import React from "react";
import { Search, Download, RefreshCw, Filter, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

export function TransactionReportTable({
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  searchQuery,
  setSearchQuery,
  rowsPerPage,
  setRowsPerPage,
  transactions = [],
  onFetchReport = () => {},
  onExport = () => {},
  onRefresh = () => {},
}) {
  return (
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
            onClick={onFetchReport}
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
            onClick={onExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer hover:shadow-sm"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Export</span>
          </button>
          <button
            onClick={onRefresh}
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
  );
}

export default TransactionReportTable;
