import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function App() {
  // Authentication & View Management States
  const [token, setToken] = useState(localStorage.getItem('xwz_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('xwz_user')) || null);
  const [currentTab, setCurrentTab] = useState('dashboard'); // Tabs: dashboard, book, monitoring, auth
  const [authMode, setAuthMode] = useState('login'); // login or register

  // Application Domain States
  const [locations, setLocations] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [realtimeStats, setRealtimeStats] = useState(null);

  // Form Fields State
  const [regForm, setRegForm] = useState({ full_name: '', email: '', password: '', phone_number: '', role: 'Driver' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [bookingForm, setBookingForm] = useState({ location_id: '', plate_number: '', duration_minutes: 60 });
  
  const [message, setMessage] = useState({ text: '', isError: false });

  // Persistent Auth Configuration Tracking
  useEffect(() => {
    fetchParkingData();
    if (token) {
      fetchUserBookings();
    }
  }, [token]);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage({ text: '', isError: false }), 5000);
  };

  const fetchParkingData = async () => {
    try {
      const locRes = await axios.get(`${API_URL}/parking/locations`);
      setLocations(locRes.data);
      const reportRes = await axios.get(`${API_URL}/parking/realtime-report`);
      setRealtimeStats(reportRes.data);
    } catch (err) {
      console.error("Error loading structural metrics", err);
    }
  };

  const fetchUserBookings = async () => {
    try {
      const res = await axios.get(`${API_URL}/parking/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyBookings(res.data);
    } catch (err) {
      console.error("Error loading historical duration tracking", err);
    }
  };

  // Auth Submit Handlers
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, regForm);
      showMessage("Registration successful! Please Sign In below.");
      setAuthMode('login');
    } catch (err) {
      showMessage(err.response?.data?.message || "Registration failed", true);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, loginForm);
      localStorage.setItem('xwz_token', res.token || res.data.token);
      localStorage.setItem('xwz_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      showMessage(`Welcome back, ${res.data.user.full_name}!`);
      setCurrentTab('dashboard');
    } catch (err) {
      showMessage(err.response?.data?.message || "Invalid email or password credential parameters", true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('xwz_token');
    localStorage.removeItem('xwz_user');
    setToken('');
    setUser(null);
    setCurrentTab('dashboard');
    showMessage("Logged out successfully");
  };

  // Transaction Booking Submission Handler
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showMessage("Please access your account profile space or Sign Up first to book", true);
      setCurrentTab('auth');
      return;
    }

    // Dynamic fee estimation calculation rule: 500 RWF per hour (approx 8.3 RWF per minute)
    const estimatedFee = Math.round(bookingForm.duration_minutes * 8.33);

    try {
      await axios.post(`${API_URL}/parking/book`, {
        ...bookingForm,
        fee_paid: estimatedFee
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showMessage(`Space locked successfully! Fee Charged: ${estimatedFee} RWF`);
      setBookingForm({ location_id: '', plate_number: '', duration_minutes: 60 });
      fetchParkingData();
      fetchUserBookings();
      setCurrentTab('monitoring');
    } catch (err) {
      showMessage(err.response?.data?.message || "Booking step rejected", true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Horizontal Top Navigation Bar Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500 text-slate-900 font-black px-3 py-1 rounded text-xl tracking-wider">XWZ</span>
            <h1 className="text-xl font-bold tracking-tight">Kigali City Smart Parking Management Hub</h1>
          </div>
          
          <nav className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentTab('dashboard')} 
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentTab === 'dashboard' ? 'bg-emerald-500 text-slate-900' : 'hover:bg-slate-800 text-slate-300'}`}>
              Live Analytics & Status
            </button>
            <button 
              onClick={() => setCurrentTab('book')} 
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentTab === 'book' ? 'bg-emerald-500 text-slate-900' : 'hover:bg-slate-800 text-slate-300'}`}>
              Book Parking Space
            </button>
            {token && (
              <button 
                onClick={() => setCurrentTab('monitoring')} 
                className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${currentTab === 'monitoring' ? 'bg-emerald-500 text-slate-900' : 'hover:bg-slate-800 text-slate-300'}`}>
                Duration Monitoring
              </button>
            )}
            {token ? (
              <div className="flex items-center gap-3 pl-2 ml-2 border-l border-slate-700">
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-800/30">
                  {user?.full_name} ({user?.role})
                </span>
                <button onClick={handleLogout} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all">
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setCurrentTab('auth'); setAuthMode('login'); }} 
                className={`ml-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-bold transition-all`}>
                Sign Up / Login
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Render Container Wrapper */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Status Messages */}
        {message.text && (
          <div className={`p-4 mb-6 rounded-lg font-semibold text-center border shadow-sm transition-all ${message.isError ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {message.text}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: LIVE ANALYTICS & MONITORING STATUS */}
        {/* ========================================== */}
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Realtime KPI Matrix */}
            {realtimeStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cars Currently Parked</p>
                  <p className="text-3xl font-black text-slate-900 mt-2">{realtimeStats.summary?.active_parked_cars || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue Collected</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{realtimeStats.summary?.total_revenue_collected || 0} RWF</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered System Drivers</p>
                  <p className="text-3xl font-black text-blue-600 mt-2">{realtimeStats.summary?.registered_drivers || 0}</p>
                </div>
              </div>
            )}

            {/* Parking Location Cards with Conditional Styling Warnings */}
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 mb-4 tracking-tight">Kigali Zone Parking Availability Feeds</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {locations.map((loc) => {
                  const spaceRatio = loc.available_spaces / loc.total_spaces;
                  // Conditional styling variables for critical alerts
                  const isLowStock = loc.available_spaces <= 5;
                  
                  return (
                    <div 
                      key={loc.id} 
                      className={`bg-white rounded-xl border shadow-xs overflow-hidden transition-all duration-200 ${isLowStock ? 'border-rose-400 ring-2 ring-rose-500/10' : 'border-slate-200'}`}
                    >
                      <div className={`p-4 ${isLowStock ? 'bg-rose-50' : 'bg-slate-50'} border-b border-inherit`}>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{loc.location_name}</h4>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${loc.type === 'Private' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {loc.type}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-baseline mb-2">
                          <span className="text-xs font-medium text-slate-500">Available Slots</span>
                          <span className={`text-2xl font-black ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                            {loc.available_spaces} <span className="text-xs font-normal text-slate-400">/ {loc.total_spaces}</span>
                          </span>
                        </div>
                        
                        {/* Status Notification Badges */}
                        {isLowStock ? (
                          <div className="mt-4 bg-rose-600 text-white text-[11px] font-bold text-center py-1 rounded animate-pulse">
                            CRITICAL: CRITICAL FILL WARNING
                          </div>
                        ) : (
                          <div className="mt-4 bg-emerald-100 text-emerald-800 text-[11px] font-bold text-center py-1 rounded">
                            Spaces Available
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: SPACE BOOKING & TRANSACTION WORKFLOW */}
        {/* ========================================== */}
        {currentTab === 'book' && (
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Book a Secured Parking Slot</h3>
            <p className="text-sm text-slate-500 mb-6">Lock your spot across Kigali municipal street lines and private garages seamlessly.</p>
            
            <form onSubmit={handleBookingSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Target Facility Location</label>
                <select 
                  required
                  value={bookingForm.location_id}
                  onChange={(e) => setBookingForm({...bookingForm, location_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500">
                  <option value="">-- Choose Terminal Location --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id} disabled={l.available_spaces === 0}>
                      {l.location_name} ({l.available_spaces} Slots Left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Automobile Plate Number</label>
                <input 
                  type="text" 
                  placeholder="e.g., RAE 123 A"
                  required
                  value={bookingForm.plate_number}
                  onChange={(e) => setBookingForm({...bookingForm, plate_number: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Duration Reservation (Minutes)</label>
                <input 
                  type="number" 
                  min="15" 
                  max="1440"
                  required
                  value={bookingForm.duration_minutes}
                  onChange={(e) => setBookingForm({...bookingForm, duration_minutes: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500" 
                />
                <p className="text-xs text-slate-400 mt-1">Pricing Configuration Matrix Base: ~8.3 RWF / Minute.</p>
              </div>

              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/50 my-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-600">Calculated Cost Parameter:</span>
                  <span className="text-xl font-black text-emerald-600">{Math.round(bookingForm.duration_minutes * 8.33) || 0} RWF</span>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-lg text-sm transition-all shadow-xs">
                Authorize Space Reservation & Payment
              </button>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: DURATION MONITORING MODULE */}
        {/* ========================================== */}
        {currentTab === 'monitoring' && token && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Your Tracked Vehicles & Active Durations</h3>
            
            {myBookings.length === 0 ? (
              <p className="text-slate-500 text-sm bg-white p-6 rounded-xl border border-slate-200">No active tracking records logged under this driver profile credential set.</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Plate Number</th>
                      <th className="p-4">Location Garage</th>
                      <th className="p-4">Allocated Duration</th>
                      <th className="p-4">Check-In Timestamp</th>
                      <th className="p-4">Transaction Fee</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {myBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-700">{b.plate_number}</td>
                        <td className="p-4">{b.location_name}</td>
                        <td className="p-4 font-semibold">{b.duration_minutes} Mins</td>
                        <td className="p-4 text-xs text-slate-500">{new Date(b.start_time).toLocaleString()}</td>
                        <td className="p-4 font-bold text-emerald-600">{b.fee_paid} RWF</td>
                        <td className="p-4">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: AUTHENTICATION MODULE (REGISTER/LOGIN) */}
        {/* ========================================== */}
        {currentTab === 'auth' && (
          <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="flex border-b border-slate-200 mb-6">
              <button 
                onClick={() => setAuthMode('login')} 
                className={`flex-1 pb-3 text-sm font-bold border-b-2 tracking-wide ${authMode === 'login' ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
                Sign In
              </button>
              <button 
                onClick={() => setAuthMode('register')} 
                className={`flex-1 pb-3 text-sm font-bold border-b-2 tracking-wide ${authMode === 'register' ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
                Create Profile (Register)
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" required value={loginForm.email} onChange={(e)=>setLoginForm({...loginForm, email:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Security Password</label>
                  <input type="password" required value={loginForm.password} onChange={(e)=>setLoginForm({...loginForm, password:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-xs mt-2">
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" required value={regForm.full_name} onChange={(e)=>setRegForm({...regForm, full_name:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" required value={regForm.email} onChange={(e)=>setRegForm({...regForm, email:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input type="text" placeholder="e.g., 078XXXXXXX" required value={regForm.phone_number} onChange={(e)=>setRegForm({...regForm, phone_number:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Security Password</label>
                  <input type="password" required value={regForm.password} onChange={(e)=>setRegForm({...regForm, password:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">System Assignment Role</label>
                  <select value={regForm.role} onChange={(e)=>setRegForm({...regForm, role:e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500">
                    <option value="Driver">Driver / Operator</option>
                    <option value="Admin">System Administrator</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all shadow-xs mt-2">
                  Complete Registration & Sign Up
                </button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}