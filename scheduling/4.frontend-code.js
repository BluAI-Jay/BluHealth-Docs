// package.json
{
  "name": "appointment-scheduler-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.5.1",
    "react-calendar": "^4.6.0",
    "react-hook-form": "^7.47.0",
    "react-toastify": "^9.1.3",
    "date-fns": "^2.30.0",
    "@headlessui/react": "^1.7.17",
    "@heroicons/react": "^2.0.18",
    "js-cookie": "^3.0.5"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.5",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "@types/node": "^20.8.10",
    "typescript": "^5.2.2"
  }
}

// app/layout.js
import './globals.css'
import { Inter } from 'next/font/google'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Medical Appointment Scheduler',
  description: 'Schedule and manage medical appointments',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <ToastContainer position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}

// app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

// contexts/AuthContext.js
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import Cookies from 'js-cookie'
import { useRouter } from 'next/navigation'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = Cookies.get('token')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Verify token and get user data
      fetchUser()
    }
    setLoading(false)
  }, [])

  const fetchUser = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/me')
      setUser(response.data)
    } catch (error) {
      console.error('Error fetching user:', error)
      logout()
    }
  }

  const login = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      })

      const { token, user } = response.data
      Cookies.set('token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(user)
      
      // Redirect based on role
      if (user.role === 'patient') {
        router.push('/patient/dashboard')
      } else if (user.role === 'physician') {
        router.push('/physician/dashboard')
      } else if (user.role === 'staff') {
        router.push('/staff/dashboard')
      }
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    Cookies.remove('token')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
    router.push('/login')
  }

  const value = {
    user,
    login,
    logout,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// app/page.js
'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (user.role === 'patient') {
        router.push('/patient/dashboard')
      } else if (user.role === 'physician') {
        router.push('/physician/dashboard')
      } else if (user.role === 'staff') {
        router.push('/staff/dashboard')
      }
    }
  }, [user, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Medical Appointment Scheduler</h1>
          <p className="mt-2 text-gray-600">Schedule and manage your appointments easily</p>
        </div>
        
        <div className="mt-8 space-y-4">
          <Link href="/login" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Login
          </Link>
          
          <Link href="/register" className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Register
          </Link>
        </div>
      </div>
    </div>
  )
}

// app/login/page.js
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-toastify'
import Link from 'next/link'

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast.success('Login successful!')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                {...register('email', { required: 'Email is required' })}
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                {...register('password', { required: 'Password is required' })}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Don't have an account? Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

// app/patient/dashboard/page.js
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import axios from 'axios'
import { format } from 'date-fns'
import { CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export default function PatientDashboard() {
  const { user, logout } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/appointments')
      setAppointments(response.data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelAppointment = async (id) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await axios.delete(`http://localhost:5000/api/appointments/${id}`)
        fetchAppointments()
      } catch (error) {
        console.error('Error canceling appointment:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Patient Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span>Welcome, {user?.first_name}</span>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Appointments</h2>
            <Link href="/patient/book-appointment" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
              Book New Appointment
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">No appointments scheduled</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-indigo-600 font-medium">
                                {appointment.physician_first_name[0]}{appointment.physician_last_name[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              Dr. {appointment.physician_first_name} {appointment.physician_last_name}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                              {format(new Date(appointment.appointment_date), 'PPP')}
                              <ClockIcon className="flex-shrink-0 ml-3 mr-1.5 h-4 w-4" />
                              {appointment.start_time} - {appointment.end_time}
                              <MapPinIcon className="flex-shrink-0 ml-3 mr-1.5 h-4 w-4" />
                              {appointment.location_name}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Reason: {appointment.reason_for_visit}
                            </div>
                            {appointment.copay_amount > 0 && (
                              <div className="mt-1 text-sm text-gray-600">
                                Copay: ${appointment.copay_amount} ({appointment.payment_status})
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            appointment.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                            appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status}
                          </span>
                          {appointment.status === 'scheduled' && (
                            <>
                              <Link href={`/patient/reschedule/${appointment.id}`} className="text-indigo-600 hover:text-indigo-900 text-sm">
                                Reschedule
                              </Link>
                              <button onClick={() => cancelAppointment(appointment.id)} className="text-red-600 hover:text-red-900 text-sm">
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// app/patient/book-appointment/page.js
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { toast } from 'react-toastify'
import { format } from 'date-fns'

export default function BookAppointment() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [physicians, setPhysicians] = useState([])
  const [selectedPhysician, setSelectedPhysician] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPhysicians()
  }, [])

  useEffect(() => {
    if (selectedPhysician && selectedDate) {
      fetchAvailableSlots()
    }
  }, [selectedPhysician, selectedDate])

  const fetchPhysicians = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/physicians')
      setPhysicians(response.data)
    } catch (error) {
      console.error('Error fetching physicians:', error)
    }
  }

  const fetchAvailableSlots = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/physicians/${selectedPhysician.id}/available-slots`, {
        params: { date: format(selectedDate, 'yyyy-MM-dd') }
      })
      setAvailableSlots(response.data.slots)
    } catch (error) {
      console.error('Error fetching available slots:', error)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await axios.post('http://localhost:5000/api/appointments', {
        physicianId: selectedPhysician.id,
        locationId: 1, // Default location, should be dynamic
        appointmentDate: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        reasonForVisit,
        copayAmount: 25 // Default copay, should be dynamic based on insurance
      })
      toast.success('Appointment booked successfully!')
      router.push('/patient/dashboard')
    } catch (error) {
      toast.error('Failed to book appointment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Book New Appointment</h1>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center">
            <div className={`flex-1 ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-300'} h-2 rounded`}></div>
            <div className={`flex-1 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-300'} h-2 rounded mx-2`}></div>
            <div className={`flex-1 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-300'} h-2 rounded`}></div>
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Select a Physician</h2>
            <div className="grid grid-cols-1 gap-4">
              {physicians.map((physician) => (
                <div
                  key={physician.id}
                  className={`border rounded-lg p-4 cursor-pointer hover:border-indigo-500 ${
                    selectedPhysician?.id === physician.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
                  }`}
                  onClick={() => setSelectedPhysician(physician)}
                >
                  <h3 className="font-medium">Dr. {physician.first_name} {physician.last_name}</h3>
                  <p className="text-sm text-gray-600">{physician.specialization}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedPhysician}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Select Date and Time</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Select Date</h3>
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  minDate={new Date()}
                />
              </div>
              <div>
                <h3 className="font-medium mb-2">Available Time Slots</h3>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {availableSlots.length === 0 ? (
                    <p className="text-gray-500 col-span-2">No available slots for this date</p>
                  ) : (
                    availableSlots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2 text-sm rounded ${
                          selectedSlot === slot
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {slot.start} - {slot.end}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedSlot}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Appointment Details</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Summary</h3>
                <div className="mt-2 bg-gray-50 p-4 rounded">
                  <p><strong>Physician:</strong> Dr. {selectedPhysician.first_name} {selectedPhysician.last_name}</p>
                  <p><strong>Date:</strong> {format(selectedDate, 'PPP')}</p>
                  <p><strong>Time:</strong> {selectedSlot.start} - {selectedSlot.end}</p>
                  <p><strong>Estimated Copay:</strong> $25.00</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reason for Visit
                </label>
                <textarea
                  value={reasonForVisit}
                  onChange