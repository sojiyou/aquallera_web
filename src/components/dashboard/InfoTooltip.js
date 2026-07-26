import React from 'react';

const InfoTooltip = ({ description, formula }) => (
  <span className="relative group inline-flex items-center ml-2">
    <span className="w-5 h-5 rounded-full border border-slate-400 text-slate-400 text-[11px] font-bold flex items-center justify-center cursor-help leading-none shrink-0 transition-colors group-hover:border-primary group-hover:text-primary">
      ?
    </span>
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
      <div className="mb-2">
        <span className="font-semibold text-blue-300 block mb-1">What it does</span>
        <p className="m-0 leading-relaxed">{description}</p>
      </div>
      <div>
        <span className="font-semibold text-blue-300 block mb-1">How it's computed</span>
        <p className="m-0 leading-relaxed">{formula}</p>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800"></div>
    </div>
  </span>
);

export default InfoTooltip;
