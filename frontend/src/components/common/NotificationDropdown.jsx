import React from "react";
import { CheckCircle2, Bell, X } from "lucide-react";

export function NotificationDropdown({
  notificationOpen,
  setNotificationOpen,
  notifications,
  unseenCount,
  onOpenNotifications,
  timeAgo,
}) {
  return (
    <div className="relative">
      <button
        onClick={onOpenNotifications}
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-[18px] h-[18px] text-black" />
        {unseenCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unseenCount}
          </span>
        )}
      </button>

      {/* Notification Popover */}
      {notificationOpen && (
        <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="font-bold text-slate-900 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-medium">
                {notifications.length} total
              </span>
              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No notifications yet
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
              {notifications.map((notif) => (
                <div key={notif.id} className="py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-slate-800 leading-snug">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {timeAgo(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{notif.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              onClick={() => setNotificationOpen(false)}
              className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
