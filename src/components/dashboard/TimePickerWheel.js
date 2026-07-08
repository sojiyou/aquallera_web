import React, { useState, useRef, useEffect } from 'react';

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;

const WheelColumn = ({ options, value, onChange }) => {
  const currentIndex = options.indexOf(value);
  const columnRef = useRef(null);
  const touchStartY = useRef(0);
  const touchOffset = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const newIndex = Math.max(0, Math.min(options.length - 1, currentIndex + delta));
      if (newIndex !== currentIndex) onChange(options[newIndex]);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [options, currentIndex, onChange]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchOffset.current = 0;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    touchOffset.current = e.touches[0].clientY - touchStartY.current;
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const threshold = ITEM_HEIGHT / 3;
    const steps = Math.round(touchOffset.current / threshold);

    if (steps !== 0) {
      const newIndex = Math.max(0, Math.min(options.length - 1, currentIndex - steps));
      if (newIndex !== currentIndex) onChange(options[newIndex]);
    }
    touchOffset.current = 0;
  };

  const visibleItems = [];
  for (let i = currentIndex - 2; i <= currentIndex + 2; i++) {
    if (i >= 0 && i < options.length) {
      visibleItems.push({ index: i, opt: options[i], offset: i - currentIndex });
    }
  }

  const paddingTop = currentIndex < 2 ? (2 - currentIndex) * ITEM_HEIGHT : 0;
  const paddingBottom = currentIndex > options.length - 3 ? (currentIndex - (options.length - 3)) * ITEM_HEIGHT : 0;

  return (
    <div
      ref={columnRef}
      className="flex-1 flex flex-col items-center overflow-hidden select-none min-w-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ height: paddingTop }} />
      {visibleItems.map(({ opt, index, offset }) => (
        <div
          key={opt}
          onClick={() => { if (index !== currentIndex) onChange(opt); }}
          className="flex items-center justify-center w-full cursor-pointer"
          style={{
            height: ITEM_HEIGHT,
            opacity: offset === 0 ? 1 : Math.max(0.15, 1 - Math.abs(offset) * 0.35),
            transform: `scale(${offset === 0 ? 1 : Math.max(0.65, 1 - Math.abs(offset) * 0.12)})`,
            transition: 'opacity 0.1s, transform 0.1s',
          }}
        >
          <span
            className={`text-[15px] leading-none select-none transition-colors duration-100 ${
              index === currentIndex
                ? 'font-bold text-gray-900'
                : 'text-gray-300'
            }`}
          >
            {String(opt).padStart(2, '0')}
          </span>
        </div>
      ))}
      <div style={{ height: paddingBottom }} />
    </div>
  );
};

const TimePickerWheel = ({ value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [hour24, minute] = value.split(':');
  const hourNum = parseInt(hour24, 10);
  const displayHour = hourNum % 12 || 12;
  const period = hourNum >= 12 ? 'PM' : 'AM';

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const periods = ['AM', 'PM'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHourChange = (h) => {
    let h24 = parseInt(h, 10);
    if (period === 'PM' && h24 !== 12) h24 += 12;
    if (period === 'AM' && h24 === 12) h24 = 0;
    onChange(`${String(h24).padStart(2, '0')}:${minute}`);
  };

  const handleMinuteChange = (m) => {
    onChange(`${hour24}:${m}`);
  };

  const handlePeriodChange = (p) => {
    let h = parseInt(hour24, 10);
    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h >= 12) h -= 12;
    onChange(`${String(h).padStart(2, '0')}:${minute}`);
  };

  const displayTime = `${displayHour}:${minute} ${period}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-4 py-3 border-2 rounded-lg text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(2,128,144,0.1)] ${
          disabled
            ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200'
            : 'bg-white border-slate-200 hover:border-primary'
        }`}
      >
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className={`flex-1 text-left font-semibold ${disabled ? 'text-slate-500' : 'text-gray-800'}`}>{displayTime}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
          <div className="relative px-1 py-2">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-10 h-9 border-t border-b border-blue-200 bg-blue-50/40" />

            <div className="flex items-center" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
              <WheelColumn
                options={hours}
                value={String(displayHour)}
                onChange={handleHourChange}
              />

              <div className="flex items-center justify-center w-5 flex-shrink-0">
                <span className="text-xl font-bold text-gray-700">:</span>
              </div>

              <WheelColumn
                options={minutes}
                value={minute}
                onChange={handleMinuteChange}
              />

              <WheelColumn
                options={periods}
                value={period}
                onChange={handlePeriodChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePickerWheel;
