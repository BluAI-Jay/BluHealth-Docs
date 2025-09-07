// pages/_app.js
import { useState, useEffect, createContext, useContext } from 'react';
import '../styles/globals.css';

// Create context for user and location data
const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
};

function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize app data
    const initializeApp = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
        await fetchLocations();
      }
      setLoading(false);
    };

    initializeApp();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const contextValue = {
    user,
    setUser,
    locations,
    setLocations,
    fetchLocations
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Component {...pageProps} />
    </AppContext.Provider>
  );
}

export default MyApp;

// pages/index.js
import { useAppContext } from './_app';
import Login from '../components/Login';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const { user } = useAppContext();

  return (
    <div>
      {user ? <Dashboard /> : <Login />}
    </div>
  );
}

// components/Login.js
import { useState } from 'react';
import { useAppContext } from '../pages/_app';

const Login = () => {
  const { setUser, fetchLocations } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'patient',
    additionalInfo: {}
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        await fetchLocations();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('additional.')) {
      const field = name.replace('additional.', '');
      setFormData({
        ...formData,
        additionalInfo: {
          ...formData.additionalInfo,
          [field]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Metro Health System
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create new account'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    name="firstName"
                    type="text"
                    required
                    className="form-input"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                  <input
                    name="lastName"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
                </div>
                <input
                  name="phone"
                  type="tel"
                  className="form-input"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleChange}
                />
                <select
                  name="role"
                  className="form-input"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="patient">Patient</option>
                  <option value="physician">Physician</option>
                  <option value="staff">Staff</option>
                </select>
              </>
            )}
            
            <input
              name="email"
              type="email"
              required
              className="form-input"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
            />
            <input
              name="password"
              type="password"
              required
              className="form-input"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-indigo-600 hover:text-indigo-500 text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

// components/Dashboard.js
import { useState } from 'react';
import { useAppContext } from '../pages/_app';
import PatientDashboard from './PatientDashboard';
import PhysicianDashboard from './PhysicianDashboard';
import StaffDashboard from './StaffDashboard';
import LocationSelector from './LocationSelector';

const Dashboard = () => {
  const { user, setUser } = useAppContext();
  const [selectedLocation, setSelectedLocation] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const renderDashboard = () => {
    switch (user.role) {
      case 'patient':
        return <PatientDashboard selectedLocation={selectedLocation} />;
      case 'physician':
        return <PhysicianDashboard selectedLocation={selectedLocation} />;
      case 'staff':
      case 'admin':
        return <StaffDashboard selectedLocation={selectedLocation} />;
      default:
        return <div>Invalid user role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Navigation Header */}
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-bold text-indigo-600">Metro Health System</h1>
                </div>
                <div className="ml-6">
                  <span className="text-sm text-gray-500">Multi-Location Network</span>
                </div>
              </div>
              
              {/* Location Selector */}
              <LocationSelector 
                selectedLocation={selectedLocation}
                onLocationChange={setSelectedLocation}
                userRole={user.role}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="text-gray-600">Welcome, </span>
                <span className="font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4">
        {renderDashboard()}
      </main>
    </div>
  );
};

export default Dashboard;

// components/LocationSelector.js
import { useState, useEffect } from 'react';
import { useAppContext } from '../pages/_app';

const LocationSelector = ({ selectedLocation, onLocationChange, userRole }) => {
  const { locations } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  // Filter locations based on user role
  const getAvailableLocations = () => {
    if (userRole === 'admin') {
      return locations; // Admin can see all locations
    }
    return locations; // For now, all users can see all locations
  };

  const availableLocations = getAvailableLocations();

  useEffect(() => {
    // Auto-select first location if none selected
    if (!selectedLocation && availableLocations.length > 0) {
      onLocationChange(availableLocations[0]);
    }
  }, [availableLocations, selectedLocation, onLocationChange]);

  const getLocationTypeIcon = (type) => {
    switch (type) {
      case 'main_hospital':
        return '🏥';
      case 'satellite_office':
        return '🏢';
      case 'outpatient_clinic':
        return '🏪';
      case 'specialty_center':
        return '⚕️';
      default:
        return '📍';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className="text-sm">
          {selectedLocation ? (
            <span className="flex items-center">
              <span className="mr-2">{getLocationTypeIcon(selectedLocation.location_type)}</span>
              {selectedLocation.name}
            </span>
          ) : (
            'Select Location'
          )}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-80 bg-white shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {availableLocations.map((location) => (
            <button
              key={location.id}
              onClick={() => {
                onLocationChange(location);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-start space-x-3 ${
                selectedLocation?.id === location.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-900'
              }`}
            >
              <span className="text-lg">{getLocationTypeIcon(location.location_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{location.name}</div>
                <div className="text-sm text-gray-500 truncate">{location.city}, {location.state}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {location.location_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                  {location.physician_count} physicians
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// components/PatientDashboard.js
import { useState, useEffect } from 'react';
import { useAppContext } from '../pages/_app';
import MultiLocationAppointmentBooking from './MultiLocationAppointmentBooking';
import AppointmentList from './AppointmentList';
import PaymentsList from './PaymentsList';

const PatientDashboard = ({ selectedLocation }) => {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/appointments', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setAppointments(data);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'appointments', label: 'My Appointments', count: appointments.length },
    { id: 'book', label: 'Book Appointment' },
    { id: 'payments', label: 'Payments', count: appointments.filter(apt => apt.payment_status !== 'paid').length }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-gray-600">
            Manage your appointments across all Metro Health locations
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id 
                    ? 'bg-indigo-100 text-indigo-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'appointments' && (
          <AppointmentList 
            appointments={appointments} 
            onRefresh={fetchAppointments}
            userRole="patient"
            selectedLocation={selectedLocation}
          />
        )}
        {activeTab === 'book' && (
          <MultiLocationAppointmentBooking 
            onSuccess={fetchAppointments}
            selectedLocation={selectedLocation}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsList 
            appointments={appointments}
            selectedLocation={selectedLocation}
          />
        )}
      </div>
    </div>
  );
};

// components/MultiLocationAppointmentBooking.js
import { useState, useEffect } from 'react';
import { useAppContext } from '../pages/_app';

const MultiLocationAppointmentBooking = ({ onSuccess, selectedLocation }) => {
  const { locations } = useAppContext();
  const [step, setStep] = useState(1);
  const [physicians, setPhysicians] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedPhysician, setSelectedPhysician] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(selectedLocation?.id || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [visitType, setVisitType] = useState('in_person');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchSpecialty, setSearchSpecialty] = useState('');

  useEffect(() => {
    if (selectedLocation) {
      setSelectedLocationId(selectedLocation.id);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocationId || searchSpecialty) {
      fetchPhysicians();
    }
  }, [selectedLocationId, searchSpecialty]);

  const fetchPhysicians = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedLocationId) params.append('locationId', selectedLocationId);
      if (searchSpecialty) params.append('specialty', searchSpecialty);

      const response = await fetch(`http://localhost:5000/api/physicians?${params}`);
      const data = await response.json();
      setPhysicians(data);
    } catch (err) {
      console.error('Error fetching physicians:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (physicianId, date, locationId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/physicians/${physicianId}/availability?date=${date}&locationId=${locationId}`
      );
      const data = await response.json();
      
      if (data.available) {
        const locationSlots = data.locations.find(loc => loc.location_id == locationId);
        setAvailableSlots(locationSlots ? locationSlots.slots : []);
      } else {
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      setAvailableSlots([]);
    }
  };

  const handleLocationSelect = (locationId) => {
    setSelectedLocationId(locationId);
    setSelectedPhysician('');
    setStep(2);
  };

  const handlePhysicianSelect = (physicianId) => {
    setSelectedPhysician(physicianId);
    setStep(3);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    const selectedPhysicianData = physicians.find(p => p.id == selectedPhysician);
    if (selectedPhysicianData) {
      // Check if physician is available at selected location on this date
      const physicianLocation = selectedPhysicianData.all_locations.find(
        loc => loc.location_id == selectedLocationId
      );
      if (physicianLocation) {
        fetchAvailableSlots(selectedPhysician, date, selectedLocationId);
        setStep(4);
      }
    }
  };

  const handleBookAppointment = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const slot = availableSlots.find(s => s.start === selectedSlot);
      
      const response = await fetch('http://localhost:5000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          physicianId: selectedPhysician,
          locationId: selectedLocationId,
          appointmentDate: selectedDate,
          startTime: slot.start,
          endTime: slot.end,
          appointmentType,
          visitType,
          notes
        }),
      });

      if (response.ok) {
        const appointment = await response.json();
        alert(`Appointment booked successfully at ${appointment.location_name}!`);
        onSuccess();
        // Reset form
        setStep(1);
        setSelectedPhysician('');
        setSelectedDate('');
        setSelectedSlot('');
        setNotes('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to book appointment');
      }
    } catch (err) {
      alert('Error booking appointment');
    } finally {
      setLoading(false);
    }
  };

  const getNext30Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Skip weekends for most appointments
      if (appointmentType !== 'emergency' && (date.getDay() === 0 || date.getDay() === 6)) {
        continue;
      }
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const getLocationIcon = (type) => {
    switch (type) {
      case 'main_hospital': return '🏥';
      case 'satellite_office': return '🏢';
      case 'outpatient_clinic': return '🏪';
      case 'specialty_center': return '⚕️';
      default: return '📍';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Book New Appointment</h2>
        
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNumber}
                </div>
                {stepNumber < 5 && (
                  <div className={`w-16 h-1 ${
                    step > stepNumber ? 'bg-indigo-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Location</span>
            <span>Physician</span>
            <span>Date</span>
            <span>Time</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Step 1: Select Location */}
        {step >= 1 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">1. Select Location</h3>
            
            {/* Specialty Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by specialty (e.g., Cardiology, Internal Medicine)"
                value={searchSpecialty}
                onChange={(e) => setSearchSpecialty(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleLocationSelect(location.id)}
                  className={`p-4 border-2 rounded-lg text-left hover:shadow-md transition-all ${
                    selectedLocationId == location.id 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{getLocationIcon(location.location_type)}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{location.name}</h4>
                      <p className="text-sm text-gray-600 truncate">{location.city}, {location.state}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {location.location_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                        <span>{location.physician_count} physicians</span>
                        {location.emergency_services && <span>🚨 Emergency</span>}
                        {location.pharmacy_onsite && <span>💊 Pharmacy</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Physician */}
        {step >= 2 && selectedLocationId && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">2. Select Physician</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading physicians...</p>
              </div>
            ) : physicians.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {physicians.map((physician) => {
                  const locationInfo = physician.all_locations.find(
                    loc => loc.location_id == selectedLocationId
                  );
                  
                  return (
                    <button
                      key={physician.id}
                      onClick={() => handlePhysicianSelect(physician.id)}
                      className={`p-4 border-2 rounded-lg text-left hover:shadow-md transition-all ${
                        selectedPhysician == physician.id 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h4 className="font-medium text-gray-900">
                        Dr. {physician.first_name} {physician.last_name}
                      </h4>
                      <p className="text-sm text-indigo-600">{physician.specialty}</p>
                      {physician.subspecialty && (
                        <p className="text-sm text-gray-600">{physician.subspecialty}</p>
                      )}
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        {physician.languages_spoken && physician.languages_spoken.map((lang, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                            {lang}
                          </span>
                        ))}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        <div>Available at multiple locations:</div>
                        <div className="mt-1">
                          {physician.all_locations.slice(0, 2).map((loc, idx) => (
                            <span key={idx} className="mr-2">
                              {getLocationIcon(loc.location_type)} {loc.location_name}
                            </span>
                          ))}
                          {physician.all_locations.length > 2 && (
                            <span>+{physician.all_locations.length - 2} more</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-2 text-xs">
                        {physician.accepts_new_patients && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">New Patients</span>
                        )}
                        {physician.telemedicine_enabled && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">Telemedicine</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No physicians found at this location</p>
                {searchSpecialty && (
                  <p className="text-sm">Try searching for a different specialty</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Date */}
        {step >= 3 && selectedPhysician && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">3. Select Date</h3>
            <div className="grid grid-cols-7 gap-2">
              {getNext30Days().map((date) => {
                const dateObj = new Date(date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNumber = dateObj.getDate();
                const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                
                return (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className={`p-3 border rounded-lg text-center hover:shadow-md transition-all ${
                      selectedDate === date 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xs text-gray-500">{dayName}</div>
                    <div className="font-medium">{dayNumber}</div>
                    <div className="text-xs text-gray-500">{monthName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Select Time */}
        {step >= 4 && selectedDate && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">4. Select Time</h3>
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot.start)}
                    className={`p-3 border rounded-lg text-center hover:shadow-md transition-all ${
                      selectedSlot === slot.start 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{slot.start}</div>
                    <div className="text-xs text-gray-500">30 min</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No available slots for this date.</p>
                <p className="text-sm">Please select a different date.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Appointment Details */}
        {selectedSlot && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">5. Appointment Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Appointment Type</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="check_up">Annual Check-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="procedure">Procedure</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Visit Type</label>
                  <select
                    value={visitType}
                    onChange={(e) => setVisitType(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="in_person">In-Person</option>
                    <option value="telemedicine">Telemedicine</option>
                    <option value="phone">Phone Consultation</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows="3"
                  placeholder="Any additional information about your visit..."
                />
              </div>
              
              {/* Appointment Summary */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium text-gray-900 mb-3">Appointment Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Doctor:</span>
                    <span className="font-medium">
                      Dr. {physicians.find(p => p.id == selectedPhysician)?.first_name} {physicians.find(p => p.id == selectedPhysician)?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Specialty:</span>
                    <span>{physicians.find(p => p.id == selectedPhysician)?.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span>{locations.find(l => l.id == selectedLocationId)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date & Time:</span>
                    <span>{new Date(selectedDate).toLocaleDateString()} at {selectedSlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span>{appointmentType} ({visitType})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Duration:</span>
                    <span>30 minutes</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Estimated Copay:</span>
                    <span className="font-medium text-green-600">
                      ${appointmentType === 'consultation' ? '50.00' : 
                        appointmentType === 'follow_up' ? '30.00' : '40.00'}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleBookAppointment}
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? 'Booking Appointment...' : 'Book Appointment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// components/AppointmentList.js (Enhanced for multi-location)
import { useState } from 'react';

const AppointmentList = ({ appointments, onRefresh, userRole, selectedLocation }) => {
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [filter, setFilter] = useState('all');

  const handleCancel = async (appointmentId) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            status: 'cancelled',
            cancellationReason: 'Cancelled by patient'
          }),
        });

        if (response.ok) {
          onRefresh();
        } else {
          alert('Failed to cancel appointment');
        }
      } catch (err) {
        alert('Error cancelling appointment');
      }
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        onRefresh();
      } else {
        alert('Failed to update appointment');
      }
    } catch (err) {
      alert('Error updating appointment');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      checked_in: 'bg-purple-100 text-purple-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800',
      rescheduled: 'bg-indigo-100 text-indigo-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getLocationIcon = (type) => {
    switch (type) {
      case 'main_hospital': return '🏥';
      case 'satellite_office': return '🏢';
      case 'outpatient_clinic': return '🏪';
      case 'specialty_center': return '⚕️';
      default: return '📍';
    }
  };

  // Filter appointments
  const filteredAppointments = appointments.filter(appointment => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') {
      const appointmentDate = new Date(appointment.appointment_date);
      const today = new Date();
      return appointmentDate >= today && appointment.status !== 'cancelled';
    }
    if (filter === 'past') {
      const appointmentDate = new Date(appointment.appointment_date);
      const today = new Date();
      return appointmentDate < today || appointment.status === 'completed';
    }
    return appointment.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {userRole === 'patient' ? 'My Appointments' : 'Appointments'}
        </h2>
        
        {/* Filter Options */}
        <div className="flex space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Appointments</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <button
            onClick={onRefresh}
            className="btn-secondary"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            📅
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all' 
              ? "You don't have any appointments yet."
              : `No ${filter} appointments found.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {getLocationIcon(appointment.location_type)}
                        </span>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {userRole === 'patient' 
                              ? `Dr. ${appointment.physician_first_name} ${appointment.physician_last_name}`
                              : `${appointment.patient_first_name} ${appointment.patient_last_name}`
                            }
                          </h3>
                          <p className="text-sm text-gray-600">
                            {appointment.location_name}
                            {appointment.physician_specialty && ` • ${appointment.physician_specialty}`}
                          </p>
                        </div>
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">Date:</span>
                        <div className="text-gray-900">
                          {new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-500">Time:</span>
                        <div className="text-gray-900">
                          {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-500">Type:</span>
                        <div className="text-gray-900 capitalize">
                          {appointment.appointment_type.replace('_', ' ')}
                          {appointment.visit_type !== 'in_person' && (
                            <span className="ml-1 text-blue-600">({appointment.visit_type})</span>
                          )}
                        </div>
                      </div>
                      
                      {appointment.patient_responsibility && (
                        <div>
                          <span className="font-medium text-gray-500">Payment:</span>
                          <div className="text-gray-900">
                            ${appointment.patient_responsibility}
                            <span className={`ml-2 text-xs px-2 py-1 rounded ${
                              appointment.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                              appointment.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {appointment.payment_status?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {appointment.notes && (
                      <div className="mt-3">
                        <span className="font-medium text-sm text-gray-500">Notes:</span>
                        <p className="text-sm text-gray-700 mt-1">{appointment.notes}</p>
                      </div>
                    )}
                    
                    {appointment.resource_name && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">
                          Room: {appointment.resource_name} {appointment.resource_number}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-6">
                    {userRole === 'patient' && ['scheduled', 'confirmed'].includes(appointment.status) && (
                      <>
                        <button
                          onClick={() => setSelectedAppointment(appointment)}
                          className="btn-secondary text-sm"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(appointment.id)}
                          className="btn-danger text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {(userRole === 'physician' || userRole === 'staff') && (
                      <div className="space-y-2">
                        {appointment.status === 'scheduled' && (
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                            className="btn-secondary text-sm w-full"
                          >
                            Confirm
                          </button>
                        )}
                        {appointment.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'checked_in')}
                            className="btn-info text-sm w-full"
                          >
                            Check In
                          </button>
                        )}
                        {appointment.status === 'checked_in' && (
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'completed')}
                            className="btn-success text-sm w-full"
                          >
                            Complete
                          </button>
                        )}
                        {userRole === 'physician' && (
                          <button
                            onClick={() => window.open(`/patient-records/${appointment.patient_id}`, '_blank')}
                            className="btn-info text-sm w-full"
                          >
                            View Records
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;