import React from 'react';
import { useNavigate } from 'react-router-dom';

const HelpCenter = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen font-sans">
      <nav className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] fixed w-full top-0 z-[1000]">
        <div className="flex justify-between items-center px-8 py-4 max-w-[1200px] mx-auto">
          <div>
            <h2 className="text-primary m-0 text-3xl">AQUA-LLERA</h2>
            <span className="text-slate-500 text-sm">Help Center</span>
          </div>
          <button className="px-6 py-2 border-2 border-primary rounded-lg font-semibold cursor-pointer transition-all bg-transparent text-primary hover:bg-primary hover:text-white" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </nav>

      <section className="pt-32 pb-16 px-8 max-w-[800px] mx-auto">
        <h1 className="text-4xl text-slate-800 mb-8">Help Center</h1>

        <div className="space-y-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-l-primary">
            <h2 className="text-xl text-slate-800 mb-3">Registration & Approval</h2>
            <p className="text-slate-600 mb-2">After registering, your station will be reviewed by an admin. This typically takes 24-48 hours. You'll receive an email once approved.</p>
            <p className="text-slate-600">If your application is rejected, you'll receive a reason and can reapply with corrected information.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-l-secondary">
            <h2 className="text-xl text-slate-800 mb-3">Forgot Password</h2>
            <p className="text-slate-600 mb-2">If you forgot your password, please contact the admin at <a href="mailto:aquallera.main@gmail.com" className="text-primary">aquallera.main@gmail.com</a> to retrieve your account credentials.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-l-secondary">
            <h2 className="text-xl text-slate-800 mb-3">Contact Support</h2>
            <p className="text-slate-600 mb-2">Need further assistance? Reach out to us:</p>
            <p className="text-slate-600">Email: <a href="mailto:aquallera.main@gmail.com" className="text-primary">aquallera.main@gmail.com</a></p>
          </div>
        </div>
      </section>

      <footer className="bg-primary-dark text-slate-400 px-8 py-6 text-center text-sm">
        <p className="m-0">&copy; {new Date().getFullYear()} AQUA-LLERA. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HelpCenter;
