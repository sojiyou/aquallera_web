import React, { useState, useEffect, useRef } from 'react';
import { database } from '../config/Firebase';
import { ref, onValue, off, remove } from 'firebase/database';
import { auth } from '../config/Firebase';
import { onAuthStateChanged } from 'firebase/auth';

const getTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [toast, setToast] = useState(null);
  const [userId, setUserId] = useState(null);
  const knownIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const notifRef = ref(database, `waterStations/${userId}/notifications`);
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    const handler = (snapshot) => {
      const now = Date.now();
      const data = snapshot.val();
      const items = [];
      const deletePromises = [];

      if (data) {
        Object.entries(data).forEach(([id, notif]) => {
          const createdAt = new Date(notif.createdAt).getTime();
          if (now - createdAt > THIRTY_DAYS) {
            deletePromises.push(remove(ref(database, `waterStations/${userId}/notifications/${id}`)));
          } else {
            items.push({ id, ...notif });
          }
        });
      }

      if (deletePromises.length > 0) {
        Promise.all(deletePromises).catch(console.error);
      }

      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const newItems = items.filter(n => !knownIdsRef.current.has(n.id));
      if (!isInitialLoadRef.current && newItems.length > 0) {
        setToast(newItems[0]);
      }

      knownIdsRef.current = new Set(items.map(n => n.id));
      isInitialLoadRef.current = false;
      setNotifications(items);
      if (items.length > 0) setHasUnread(true);
    };

    onValue(notifRef, handler);
    return () => off(notifRef);
  }, [userId]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDelete = (id) => {
    remove(ref(database, `waterStations/${userId}/notifications/${id}`)).catch(console.error);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative group">
        <button
          onClick={() => {
            setIsOpen(prev => !prev);
            if (!isOpen) setHasUnread(false);
          }}
          className="relative border-none p-1.5 rounded cursor-pointer select-none hover:bg-slate-100 transition-colors"
        >
          <img draggable={false} src="/notification.svg" alt="Notifications" className="w-5 h-5 sm:w-6 sm:h-6" />
          {hasUnread && notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full w-4 h-4 sm:w-4.5 sm:h-4.5 flex items-center justify-center">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Notifications
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 z-50 w-[calc(100vw-2rem)] sm:w-80 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No new notifications</div>
          ) : (
            notifications.map(n => {
              const isStock = n.type === 'stock';
              return (
              <div key={n.id} className={`flex items-start gap-3 p-3 border-b border-slate-50 hover:bg-slate-50 group ${isStock ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isStock ? 'text-red-700' : 'text-slate-800'}`}>{n.customerName}</p>
                  <p className={`text-xs ${isStock ? 'text-red-600' : 'text-slate-500'}`}>{n.orderType}{!isStock ? ' order' : ''}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{getTimeAgo(n.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Remove notification"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
            })
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">New Order!</p>
              <p className="text-xs text-slate-600">{toast.customerName} - {toast.orderType}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
