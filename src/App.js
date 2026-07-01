import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home/Home';
import Signup from './components/Auth/Signup';
import Login from './components/Auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import AdminPage from './components/admin/AdminPage';
function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;