// src/components/admin/AlertCard.js
import React, { useState } from 'react';

// ─── Icons per type ───────────────────────────────────────────────────────────
const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  confirm: '❓',
  prompt:  '✏️',
};

const TITLES = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  confirm: 'Confirm Action',
  prompt:  'Input Required',
};

// ─── AlertCard component ──────────────────────────────────────────────────────
/**
 * Props:
 *   type        – 'success' | 'error' | 'warning' | 'confirm' | 'prompt'
 *   title       – optional override for the header title
 *   message     – the body text (supports \n line breaks)
 *   onClose     – called when the user dismisses (OK / Cancel / backdrop)
 *   onConfirm   – (confirm/prompt) called with (true) or (inputValue)
 *   placeholder – (prompt) input placeholder text
 */
const AlertCard = ({
  type = 'success',
  title,
  message,
  onClose,
  onConfirm,
  placeholder = 'Type here...',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleOk = () => {
    if (type === 'prompt') {
      if (onConfirm) onConfirm(inputValue);
    } else if (type === 'confirm') {
      if (onConfirm) onConfirm(true);
    } else {
      if (onClose) onClose();
    }
  };

  const handleCancel = () => {
    if (type === 'confirm' && onConfirm) onConfirm(false);
    if (onClose) onClose();
  };

  const handleBackdropClick = (e) => {
    // Only close on backdrop click (not card click)
    if (e.target === e.currentTarget) handleCancel();
  };

  const showCancel = type === 'confirm' || type === 'prompt';

  const borderTopClass = type === 'success' ? 'border-t-4 border-t-emerald-500' : type === 'error' ? 'border-t-4 border-t-red-500' : type === 'warning' ? 'border-t-4 border-t-amber-500' : type === 'confirm' ? 'border-t-4 border-t-blue-500' : type === 'prompt' ? 'border-t-4 border-t-purple-500' : '';
  const iconBgClass = type === 'success' ? 'bg-emerald-100' : type === 'error' ? 'bg-red-100' : type === 'warning' ? 'bg-amber-100' : type === 'confirm' ? 'bg-blue-100' : type === 'prompt' ? 'bg-purple-100' : '';
  const titleColorClass = type === 'success' ? 'text-emerald-800' : type === 'error' ? 'text-red-800' : type === 'warning' ? 'text-amber-800' : type === 'confirm' ? 'text-blue-800' : type === 'prompt' ? 'text-purple-800' : '';
  const okBtnClass = type === 'success' ? 'bg-emerald-600 text-white min-w-[80px] hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(5,150,105,0.35)]' : type === 'error' ? 'bg-red-600 text-white min-w-[80px] hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(220,38,38,0.35)]' : type === 'warning' ? 'bg-amber-600 text-white min-w-[80px] hover:bg-amber-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(217,119,6,0.35)]' : type === 'confirm' ? 'bg-blue-600 text-white min-w-[80px] hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)]' : type === 'prompt' ? 'bg-purple-600 text-white min-w-[80px] hover:bg-purple-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(147,51,234,0.35)]' : '';

  return (
    <div className="fixed inset-0 bg-[rgba(10,20,50,0.55)] backdrop-blur-sm flex items-center justify-center z-[9999] animate-[backdropIn_0.2s_ease]" onClick={handleBackdropClick}>
      <div className={`bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.22),0_8px_20px_rgba(0,0,0,0.12)] w-full max-w-[440px] mx-auto overflow-hidden animate-[cardSlideIn_0.28s_cubic-bezier(0.34,1.56,0.64,1)] ${borderTopClass}`} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 pb-4 border-b border-gray-100">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${iconBgClass}`}>{ICONS[type]}</div>
          <h3 className={`text-lg font-bold m-0 leading-tight ${titleColorClass}`}>{title || TITLES[type]}</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed m-0 mb-1 whitespace-pre-line">{message}</p>

          {type === 'prompt' && (
            <textarea
              className="w-full mt-3.5 p-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all resize-y min-h-[80px] font-sans box-border focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 pb-5 pt-3.5">
          {showCancel && (
            <button className="px-5 py-2 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button className={`px-5 py-2 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all ${okBtnClass}`} onClick={handleOk}>
            {type === 'confirm' ? 'Confirm' : 'OK'}
          </button>
        </div>

      </div>
    </div>
  );
};

// ─── useAlert hook ────────────────────────────────────────────────────────────
/**
 * Convenience hook that manages alert state.
 * Returns: [alertProps, showAlert, closeAlert]
 *
 * Usage:
 *   const [alertProps, showAlert, closeAlert] = useAlert();
 *
 *   // Simple message:
 *   showAlert({ type: 'success', message: 'Done!' });
 *
 *   // Confirm dialog:
 *   showAlert({
 *     type: 'confirm',
 *     message: 'Are you sure?',
 *     onConfirm: (yes) => { if (yes) doSomething(); }
 *   });
 *
 *   // Prompt dialog:
 *   showAlert({
 *     type: 'prompt',
 *     message: 'Enter reason:',
 *     placeholder: 'Reason...',
 *     onConfirm: (value) => { handleValue(value); }
 *   });
 *
 *   // In JSX:
 *   {alertProps && <AlertCard {...alertProps} onClose={closeAlert} />}
 */
export const useAlert = () => {
  const [alertProps, setAlertProps] = useState(null);

  const showAlert = (props) => setAlertProps(props);
  const closeAlert = () => setAlertProps(null);

  return [alertProps, showAlert, closeAlert];
};

export default AlertCard;
