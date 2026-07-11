import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const STATUS_CONFIG = {
  pending: { dot: '#f59e0b', bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  confirmed: { dot: '#3b82f6', bg: '#dbeafe', color: '#1e40af', label: 'Confirmed' },
  preparing: { dot: '#8b5cf6', bg: '#ede9fe', color: '#5b21b6', label: 'Preparing' },
  on_delivery: { dot: '#06b6d4', bg: '#cffafe', color: '#155e75', label: 'For Delivery' },
  ready: { dot: '#10b981', bg: '#d1fae5', color: '#065f46', label: 'For Pickup' },
  completed: { dot: '#64748b', bg: '#e2e8f0', color: '#475569', label: 'Completed' },
  delivered: { dot: '#64748b', bg: '#e2e8f0', color: '#475569', label: 'Delivered' },
  cancelled: { dot: '#ef4444', bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
};

const toDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatCurrency = (amount) => {
  return `₱${parseFloat(amount || 0).toFixed(2)}`;
};

const getStatus = (status) => {
  const key = (status || '').toLowerCase();
  return STATUS_CONFIG[key] || { dot: '#94a3b8', bg: '#f1f5f9', color: '#475569', label: status || 'Unknown' };
};

const convertTo12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
};

const getNextStatusAction = (ordersInGroup) => {
  const statusCounts = {};
  ordersInGroup.forEach(o => {
    const s = (o.status || '').toLowerCase();
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const sorted = Object.entries(statusCounts).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return null;

  const commonStatus = sorted[0][0];

  const nextMap = {
    pending: { status: 'confirmed', label: 'Mark All as Confirmed' },
    confirmed: { status: 'preparing', label: 'Mark All as Preparing' },
    preparing: { status: 'on_delivery', label: 'Mark All as Out for Delivery' },
    on_delivery: { status: 'completed', label: 'Mark All as Completed' },
  };

  return nextMap[commonStatus] || null;
};

const CalendarView = ({ orders, onOrderClick, onBulkStatusUpdate, isUpdating }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const ordersByDate = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const dateStr = order.date;
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(order);
    });
    return map;
  }, [orders]);

  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);
  const selectedOrders = useMemo(() => ordersByDate[selectedDateStr] || [], [ordersByDate, selectedDateStr]);

  const groupedByTime = useMemo(() => {
    const groups = {};
    selectedOrders.forEach(order => {
      const t = order.time || '00:00';
      if (!groups[t]) groups[t] = [];
      groups[t].push(order);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedOrders]);

  const getOrdersCount = (date) => {
    const str = toDateStr(date);
    return ordersByDate[str] ? ordersByDate[str].length : 0;
  };

  const getStatusesForDate = (date) => {
    const str = toDateStr(date);
    const dayOrders = ordersByDate[str];
    if (!dayOrders) return [];
    const seen = new Set();
    return dayOrders.reduce((acc, o) => {
      const key = (o.status || '').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        acc.push(key);
      }
      return acc;
    }, []);
  };

  const formatDateHeading = (date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const count = getOrdersCount(date);
    if (count === 0) return null;
    return 'calendar-has-orders';
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const count = getOrdersCount(date);
    if (count === 0) return null;
    const statuses = getStatusesForDate(date);
    return (
      <div className="flex gap-0.5 justify-center mt-0.5">
        {statuses.map(s => (
          <div
            key={s}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: STATUS_CONFIG[s]?.dot || '#94a3b8' }}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="react-calendar-wrapper">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileContent={tileContent}
            tileClassName={tileClassName}
            locale="en-US"
          />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-white text-lg font-semibold mb-3">
          Orders for {formatDateHeading(selectedDate)}
          {selectedOrders.length > 0 && (
            <span className="text-white/60 text-sm font-normal ml-2">
              ({selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''})
            </span>
          )}
        </h3>

        {selectedOrders.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
            <p className="text-white/60 m-0">No orders for this date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByTime.map(([time, timeOrders]) => {
              const nextAction = getNextStatusAction(timeOrders);

              return (
                <div key={time} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">{convertTo12Hour(time)}</h4>
                        <span className="text-xs text-slate-500">{timeOrders.length} order{timeOrders.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {nextAction && (
                      <button
                        onClick={() => onBulkStatusUpdate(timeOrders, nextAction.status)}
                        disabled={isUpdating === time}
                        className="px-4 py-2 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold text-xs transition-all hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isUpdating === time ? 'Updating...' : nextAction.label}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {timeOrders.map(order => {
                      const orderId = order.orderId || order.id || 'N/A';
                      const customerName = order.customerName || 'N/A';
                      const grandTotal = order.grandTotal || (order.waterSubtotal || 0) + (order.transactionFee || 0);
                      const status = getStatus(order.status);

                      return (
                        <div
                          key={orderId}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => onOrderClick(order)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm truncate">{customerName}</span>
                              <span className="text-primary font-mono text-[10px]">#{orderId}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500">{order.customerPhone || ''}</span>
                              <span className="font-bold text-slate-700 text-xs">{formatCurrency(grandTotal)}</span>
                            </div>
                          </div>
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap shadow-sm"
                            style={{ backgroundColor: status.bg, color: status.color }}
                          >
                            {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .react-calendar {
          width: 100%;
          border: none;
          font-family: inherit;
        }
        .react-calendar__navigation {
          margin-bottom: 0;
          padding: 12px 16px 8px;
        }
        .react-calendar__navigation button {
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
        }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: #f0fdfa;
          border-radius: 8px;
        }
        .react-calendar__month-view__weekdays {
          padding: 0 8px;
        }
        .react-calendar__month-view__weekdays__weekday {
          padding: 8px 0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none;
        }
        .react-calendar__tile {
          padding: 10px 4px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          border-radius: 8px;
          transition: all 0.15s ease;
          position: relative;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: #f0fdfa;
        }
        .react-calendar__tile--now {
          background: #f0fdfa;
          font-weight: 700;
          color: #028090;
        }
        .react-calendar__tile--now:enabled:hover,
        .react-calendar__tile--now:enabled:focus {
          background: #ccfbf1;
        }
        .react-calendar__tile--active {
          background: #028090 !important;
          color: white !important;
          font-weight: 700;
        }
        .react-calendar__tile--active:enabled:hover,
        .react-calendar__tile--active:enabled:focus {
          background: #0f766e !important;
        }
        .react-calendar__tile.calendar-has-orders {
          font-weight: 700;
          color: #0f172a;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: #cbd5e1;
        }
        .react-calendar__month-view__days__day--weekend {
          color: #475569;
        }
        .react-calendar__year-view__months__month,
        .react-calendar__decade-view__years__year {
          font-size: 13px;
          padding: 12px 8px;
        }
      `}</style>
    </div>
  );
};

export default CalendarView;
