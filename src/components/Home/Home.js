// src/components/Home.js
import React, { useState, useEffect } from 'react';

const Home = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(window.__deferredPrompt || null);
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallWebsite = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (e) {
      // Event already consumed, ignore
    }
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Navigation */}
      <nav className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] fixed w-full top-0 z-[1000]">
        <div className="flex flex-col gap-4 md:flex-row md:gap-4 justify-between items-center px-8 py-4 max-w-[1200px] mx-auto">
          <div className="">
            <h2 className="text-primary m-0 text-3xl">AQUA-LLERA</h2>
            <span className="text-slate-500 text-sm">Water Station Management</span>
          </div>
          <div className="flex gap-4 max-[480px]:flex-col max-[480px]:w-full">
            <button className="px-6 py-2 border-2 border-primary rounded-lg font-semibold cursor-pointer transition-all bg-transparent text-primary hover:bg-primary hover:text-white max-[480px]:w-full" onClick={() => window.location.href = '/login'}>
              Station Login
            </button>
            <button className="px-6 py-2 border-2 border-primary rounded-lg font-semibold cursor-pointer transition-all bg-primary text-white hover:bg-primary-dark hover:border-primary-dark max-[480px]:w-full" onClick={() => window.location.href = '/signup'}>
              Register Station
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-8 pt-52 md:pt-32 pb-16 max-w-[1200px] mx-auto min-h-[80vh] text-center md:text-left">
        <div className="">
          <h1 className="text-4xl md:text-5xl text-slate-800 mb-6 leading-tight">Manage Your Water Station Efficiently</h1>
          <p className="text-xl text-slate-500 mb-8 leading-relaxed">
            Streamline your water delivery business with our comprehensive management system. 
            Handle orders, track deliveries, and grow your customer base all in one place.
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center md:justify-start max-[480px]:flex-col items-stretch">
            <button className="px-3.5 py-2 rounded-lg font-semibold text-xs cursor-pointer transition-all bg-primary text-white hover:bg-primary-dark hover:-translate-y-0.5 max-[480px]:w-full" onClick={() => window.location.href = '/signup'}>
              Get Started Today
            </button>
            <a
              href="https://aquallera-pwa.vercel.app/install"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg font-semibold text-xs cursor-pointer transition-all border-2 border-primary text-primary hover:bg-primary hover:text-white hover:-translate-y-0.5 max-[480px]:w-full no-underline justify-center"
            >
              <img src="/download.svg" alt="" className="w-3.5 h-3.5 select-none" draggable={false} />
              Download App
            </a>
            <button
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-lg font-semibold text-xs cursor-pointer transition-all border-2 max-[480px]:w-full justify-center ${
                isStandalone
                  ? 'border-slate-300 text-slate-400'
                  : 'border-primary text-primary hover:bg-primary hover:text-white hover:-translate-y-0.5'
              }`}
              onClick={handleInstallWebsite}
            >
              <img src="/download.svg" alt="" className="w-3.5 h-3.5 select-none" draggable={false} />
              {isStandalone ? 'Installed' : 'Download Website'}
            </button>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <div className="w-full flex justify-center items-center p-8 animate-[floatLogo_4s_ease-in-out_infinite]">
            <svg
              viewBox="0 0 300 380"
              xmlns="http://www.w3.org/2000/svg"
              className="max-w-[380px] w-full h-auto drop-shadow-[0_18px_36px_rgba(2,100,180,0.28)] drop-shadow-[0_6px_14px_rgba(14,165,233,0.18)] transition-all duration-400 hover:scale-105"
              aria-label="AQUA-LLERA animated logo"
            >
              <defs>
                {/* Drop clip path */}
                <clipPath id="heroDropClip">
                  <path d="M150,22 C150,22 58,105 58,212 A92,92 0 0,0 242,212 C242,105 150,22 150,22Z"/>
                </clipPath>

                {/* Gradients */}
                <linearGradient id="hDropFill" x1="20%" y1="0%" x2="80%" y2="100%">
                  <stop offset="0%" stopColor="#065A82"/>
                  <stop offset="100%" stopColor="#1B3B6F"/>
                </linearGradient>
                <linearGradient id="hSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#e0f7fa"/>
                  <stop offset="100%" stopColor="#b2dfdb"/>
                </linearGradient>
                <linearGradient id="hMountBg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9EB3C2"/>
                  <stop offset="80%" stopColor="#B0BEC5"/>
                </linearGradient>
                <linearGradient id="hMountGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1C7293"/>
                  <stop offset="100%" stopColor="#1B3B6F"/>
                </linearGradient>
                <linearGradient id="hWave1" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1C7293"/>
                  <stop offset="100%" stopColor="#1B3B6F"/>
                </linearGradient>
                <linearGradient id="hWave2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff"/>
                  <stop offset="100%" stopColor="#9EB3C2"/>
                </linearGradient>
                <radialGradient id="hDropShine" cx="35%" cy="28%" r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.22)"/>
                  <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
                </radialGradient>
                <filter id="hGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Ground shadow */}
              <ellipse cx="150" cy="316" rx="70" ry="9" fill="rgba(0,10,50,0.14)">
                <animate attributeName="rx" values="70;60;70" dur="4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.14;0.08;0.14" dur="4s" repeatCount="indefinite"/>
              </ellipse>

              {/* Drop base fill */}
              <path
                d="M150,22 C150,22 58,105 58,212 A92,92 0 0,0 242,212 C242,105 150,22 150,22Z"
                fill="url(#hDropFill)"
              />

              {/* === CLIPPED CONTENT === */}
              <g clipPath="url(#heroDropClip)">

                {/* Sky */}
                <rect x="58" y="22" width="184" height="192" fill="url(#hSkyGrad)"/>

                {/* Background mountain range */}
                <path
                  d="M58,214 L82,178 L102,192 L128,148 L150,172 L164,144 L188,168 L208,150 L232,182 L242,214Z"
                  fill="url(#hMountBg)"
                />
                {/* Snow caps — background */}
                <path d="M128,148 L142,172 L114,172Z" fill="white" opacity="0.92"/>
                <path d="M164,144 L177,166 L151,166Z" fill="white" opacity="0.92">
                  <animate attributeName="opacity" values="0.92;1;0.92" dur="2.8s" repeatCount="indefinite"/>
                </path>
                <path d="M208,150 L220,170 L196,170Z" fill="white" opacity="0.85"/>

                {/* Foreground green mountains */}
                <path d="M58,214 L97,174 L136,214Z" fill="url(#hMountGreen)"/>
                <path d="M110,214 L150,148 L190,214Z" fill="#1C7293"/>
                <path d="M164,214 L205,176 L242,214Z" fill="url(#hMountGreen)"/>
                {/* Center peak lighter tip */}
                <path d="M150,148 L163,170 L137,170Z" fill="#9EB3C2" opacity="0.75">
                  <animate attributeName="opacity" values="0.75;1;0.75" dur="3.2s" repeatCount="indefinite"/>
                </path>

                {/* === ANIMATED WAVES === */}
                {/* Wave 1 — back teal */}
                <path fill="url(#hWave1)" opacity="0.78">
                  <animate
                    attributeName="d"
                    values="
                      M10,196 Q62,180 114,196 Q166,212 218,196 Q262,182 310,196 L310,300 L10,300 Z;
                      M10,188 Q62,204 114,188 Q166,172 218,188 Q262,204 310,188 L310,300 L10,300 Z;
                      M10,196 Q62,180 114,196 Q166,212 218,196 Q262,182 310,196 L310,300 L10,300 Z"
                    dur="3.6s"
                    repeatCount="indefinite"
                  />
                </path>
                {/* Wave 2 — front white-teal */}
                <path fill="url(#hWave2)" opacity="0.92">
                  <animate
                    attributeName="d"
                    values="
                      M10,208 Q75,192 140,208 Q205,224 270,208 Q298,200 320,208 L320,300 L10,300 Z;
                      M10,200 Q75,216 140,200 Q205,184 270,200 Q298,208 320,200 L320,300 L10,300 Z;
                      M10,208 Q75,192 140,208 Q205,224 270,208 Q298,200 320,208 L320,300 L10,300 Z"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>

              {/* Drop inner shine overlay */}
              <path
                d="M150,22 C150,22 58,105 58,212 A92,92 0 0,0 242,212 C242,105 150,22 150,22Z"
                fill="url(#hDropShine)"
              />
              {/* Drop rim */}
              <path
                d="M150,22 C150,22 58,105 58,212 A92,92 0 0,0 242,212 C242,105 150,22 150,22Z"
                fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"
              />

              {/* Tip sparkle */}
              <circle cx="150" cy="22" r="3" fill="white" filter="url(#hGlow)">
                <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
              </circle>

              {/* AQUA-LLERA wordmark */}
              <text
                x="150" y="352"
                textAnchor="middle"
                fill="#1B3B6F"
                fontSize="27"
                fontWeight="800"
                fontFamily="'Segoe UI', Arial, sans-serif"
                letterSpacing="2.5"
              >
                AQUA-LLERA
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-8 bg-slate-100">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-center text-4xl md:text-5xl text-slate-800 mb-12">Why Choose AQUA-LLERA?</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-8">
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-8 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <h3 className="text-white mb-4 text-xl">Real-time Dashboard</h3>
              <p className="text-white leading-relaxed">Monitor your business performance with live statistics and analytics</p>
            </div>
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-4 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-5xl mb-4"></div>
              <h3 className="text-white mb-4 text-xl">Order Management</h3>
              <p className="text-white leading-relaxed">Accept, track, and manage delivery orders efficiently</p>
            </div>
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-8 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-5xl mb-4"></div>
              <h3 className="text-white mb-4 text-xl">Pricing Control</h3>
              <p className="text-white leading-relaxed">Set and update your water prices and delivery fees easily</p>
            </div>
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-8 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-5xl mb-4"></div>
              <h3 className="text-white mb-4 text-xl">Business Hours</h3>
              <p className="text-white leading-relaxed">Manage your operating hours and service availability</p>
            </div>
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-8 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-5xl mb-4"></div>
              <h3 className="text-white mb-4 text-xl">Location Management</h3>
              <p className="text-white leading-relaxed">Update your station location and service areas</p>
            </div>
            <div className="bg-primary-dark border border-gray-300 p-4 md:p-8 rounded-xl text-center shadow-xl transition-transform duration-300 hover:-translate-y-1.5">
              <div className="text-5xl mb-4"></div>
              <h3 className="text-white mb-4 text-xl">Mobile Friendly</h3>
              <p className="text-white leading-relaxed">Manage your station on-the-go with our responsive design</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-8 text-center bg-gradient-to-br from-primary to-primary-dark text-white">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-4xl md:text-5xl mb-4">Ready to Streamline Your Water Business?</h2>
          <p className="text-xl mb-8 opacity-90">Join hundreds of water stations already using AQUA-LLERA</p>
          <button className="px-12 py-5 bg-white text-primary rounded-lg font-semibold text-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]" onClick={() => window.location.href = '/signup'}>
            Register Your Station Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-dark text-white px-8 pt-12 pb-4">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-8 mb-8">
            <div className="">
              <h3 className="mb-4 text-slate-200">AQUA-LLERA</h3>
              <p>Empowering water stations with modern management tools</p>
            </div>
            <div className="">
              <h4 className="mb-4 text-slate-200">Quick Links</h4>
              <ul className="list-none p-0">
                <li className="mb-2"><a href="/login" className="text-slate-400 no-underline transition-colors hover:text-white">Station Login</a></li> 
                <li className="mb-2"><a href="/signup" className="text-slate-400 no-underline transition-colors hover:text-white">Register Station</a></li>
                <li className="mb-2"><a href="/admin" className="text-slate-400 no-underline transition-colors hover:text-white">admin</a></li>
              </ul>
            </div>
            <div className="">
              <h4 className="mb-4 text-slate-200">Support</h4>
              <ul className="list-none p-0">
                <li className="mb-2"><a href="/help" className="text-slate-400 no-underline transition-colors hover:text-white">Help Center</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-slate-700 text-slate-400">
            <p>&copy; 2024 AQUA-LLERA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
