// server.js - Enhanced Multi-Location Hospital System Backend
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced database connection with connection pooling
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'appointment_system',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Enhanced authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    // Get user details including location permissions
    try {
      const userDetails = await pool.query(
        'SELECT u.*, p.primary_location_id FROM users u LEFT JOIN physicians p ON u.id = p.user_id WHERE u.id = $1',
        [user.userId]
      );
      
      if (userDetails.rows.length === 0) {
        return res.status(403).json({ error: 'User not found' });
      }
      
      req.user = { ...user, ...userDetails.rows[0] };
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  });
};

// Location-based authorization middleware
const authorizeLocation = (req, res, next) => {
  const { locationId } = req.params;
  const userRole = req.user.role;
  
  // Admin and physicians can access all locations
  if (userRole === 'admin' || userRole === 'physician') {
    return next();
  }
  
  // Staff can only access their assigned location (would need staff_locations table)
  // For now, allowing all staff access
  if (userRole === 'staff') {
    return next();
  }
  
  // Patients can access all locations for booking
  if (userRole === 'patient') {
    return next();
  }
  
  res.status(403).json({ error: 'Insufficient permissions for this location' });
};

// AUTHENTICATION ROUTES
app.post('/api/auth/register', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { email, password, firstName, lastName, phone, role, additionalInfo } = req.body;
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    const userExists = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName, phone, role]
    );

    const userId = newUser.rows[0].id;

    // Create role-specific record
    if (role === 'patient') {
      await client.query(
        `INSERT INTO patients (user_id, patient_id, date_of_birth, gender, preferred_location_id, 
         insurance_primary_provider, insurance_primary_id, allergies) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId, 
          `PT${String(userId).padStart(6, '0')}`,
          additionalInfo?.dateOfBirth, 
          additionalInfo?.gender, 
          additionalInfo?.preferredLocationId,
          additionalInfo?.insuranceProvider, 
          additionalInfo?.insuranceId,
          additionalInfo?.allergies || []
        ]
      );
    } else if (role === 'physician') {
      await client.query(
        `INSERT INTO physicians (user_id, primary_location_id, npi_number, license_number, 
         specialty, subspecialty, languages_spoken) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId, 
          additionalInfo?.primaryLocationId, 
          additionalInfo?.npiNumber,
          additionalInfo?.licenseNumber, 
          additionalInfo?.specialty, 
          additionalInfo?.subspecialty,
          additionalInfo?.languagesSpoken || []
        ]
      );
    }

    await client.query('COMMIT');
    
    const token = jwt.sign({ userId: userId, role: role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: newUser.rows[0] });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user with role-specific details
    const user = await pool.query(`
      SELECT u.*, p.id as patient_id, ph.id as physician_id, ph.primary_location_id
      FROM users u 
      LEFT JOIN patients p ON u.id = p.user_id 
      LEFT JOIN physicians ph ON u.id = ph.user_id 
      WHERE u.email = $1 AND u.is_active = true
    `, [email]);
    
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.rows[0].id]);

    const token = jwt.sign({ 
      userId: user.rows[0].id, 
      role: user.rows[0].role 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        firstName: user.rows[0].first_name,
        lastName: user.rows[0].last_name,
        role: user.rows[0].role,
        patientId: user.rows[0].patient_id,
        physicianId: user.rows[0].physician_id,
        primaryLocationId: user.rows[0].primary_location_id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// LOCATION ROUTES
app.get('/api/locations', async (req, res) => {
  try {
    const { type, hospitalSystemId, city, services } = req.query;
    
    let query = `
      SELECT l.*, hs.name as hospital_system_name,
             COUNT(DISTINCT pl.physician_id) as physician_count
      FROM locations l
      JOIN hospital_systems hs ON l.hospital_system_id = hs.id
      LEFT JOIN physician_locations pl ON l.id = pl.location_id
      WHERE l.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    if (type) {
      query += ` AND l.location_type = $${++paramCount}`;
      params.push(type);
    }
    
    if (hospitalSystemId) {
      query += ` AND l.hospital_system_id = $${++paramCount}`;
      params.push(hospitalSystemId);
    }
    
    if (city) {
      query += ` AND l.city ILIKE $${++paramCount}`;
      params.push(`%${city}%`);
    }
    
    if (services) {
      query += ` AND l.services_offered && $${++paramCount}`;
      params.push(services.split(','));
    }

    query += ' GROUP BY l.id, hs.name ORDER BY l.name';

    const locations = await pool.query(query, params);
    res.json(locations.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.get('/api/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const location = await pool.query(`
      SELECT l.*, hs.name as hospital_system_name,
             json_agg(DISTINCT jsonb_build_object(
               'id', lr.id,
               'type', lr.resource_type,
               'name', lr.resource_name,
               'number', lr.resource_number
             )) FILTER (WHERE lr.id IS NOT NULL) as resources
      FROM locations l
      JOIN hospital_systems hs ON l.hospital_system_id = hs.id
      LEFT JOIN location_resources lr ON l.id = lr.location_id AND lr.is_active = true
      WHERE l.id = $1 AND l.is_active = true
      GROUP BY l.id, hs.name
    `, [id]);

    if (location.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch location details' });
  }
});

// PHYSICIAN ROUTES
app.get('/api/physicians', async (req, res) => {
  try {
    const { locationId, specialty, search, availableDate } = req.query;
    
    let query = `
      SELECT DISTINCT p.id, u.first_name, u.last_name, p.specialty, p.subspecialty,
             p.languages_spoken, p.accepts_new_patients, p.telemedicine_enabled,
             p.primary_location_id, pl_primary.name as primary_location_name,
             array_agg(DISTINCT jsonb_build_object(
               'location_id', pl.location_id,
               'location_name', l.name,
               'location_type', l.location_type,
               'city', l.city
             )) as all_locations
      FROM physicians p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN locations pl_primary ON p.primary_location_id = pl_primary.id
      LEFT JOIN physician_locations pl ON p.id = pl.physician_id
      LEFT JOIN locations l ON pl.location_id = l.id
      WHERE p.is_active = true AND u.is_active = true
    `;
    const params = [];
    let paramCount = 0;

    if (locationId) {
      query += ` AND EXISTS (
        SELECT 1 FROM physician_locations pl2 
        WHERE pl2.physician_id = p.id AND pl2.location_id = $${++paramCount}
      )`;
      params.push(locationId);
    }
    
    if (specialty) {
      query += ` AND (p.specialty ILIKE $${++paramCount} OR p.subspecialty ILIKE $${paramCount})`;
      params.push(`%${specialty}%`);
    }
    
    if (search) {
      query += ` AND (u.first_name ILIKE $${++paramCount} OR u.last_name ILIKE $${paramCount} OR p.specialty ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' GROUP BY p.id, u.first_name, u.last_name, p.specialty, p.subspecialty, p.languages_spoken, p.accepts_new_patients, p.telemedicine_enabled, p.primary_location_id, pl_primary.name ORDER BY u.last_name, u.first_name';

    const physicians = await pool.query(query, params);
    res.json(physicians.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch physicians' });
  }
});

// Get physician availability across all locations
app.get('/api/physicians/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, locationId } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const dayOfWeek = moment(date).day();
    
    // Get physician schedules for the date
    let scheduleQuery = `
      SELECT pls.*, l.name as location_name, l.id as location_id
      FROM physician_location_schedules pls
      JOIN locations l ON pls.location_id = l.id
      WHERE pls.physician_id = $1 AND pls.day_of_week = $2 AND pls.is_active = true
    `;
    const scheduleParams = [id, dayOfWeek];
    
    if (locationId) {
      scheduleQuery += ' AND pls.location_id = $3';
      scheduleParams.push(locationId);
    }

    const schedules = await pool.query(scheduleQuery, scheduleParams);
    
    if (schedules.rows.length === 0) {
      return res.json({ available: false, locations: [] });
    }

    // Get existing appointments for the date
    const appointments = await pool.query(
      `SELECT start_time, end_time, location_id 
       FROM appointments 
       WHERE physician_id = $1 AND appointment_date = $2 
       AND status NOT IN ('cancelled', 'no_show')`,
      [id, date]
    );

    // Check for availability exceptions
    const exceptions = await pool.query(
      `SELECT * FROM physician_availability_exceptions 
       WHERE physician_id = $1 AND exception_date = $2`,
      [id, date]
    );

    const locationAvailability = schedules.rows.map(schedule => {
      const locationAppointments = appointments.rows.filter(apt => 
        apt.location_id === schedule.location_id
      );
      
      const locationException = exceptions.rows.find(exc => 
        exc.location_id === schedule.location_id
      );
      
      // If physician is unavailable at this location
      if (locationException && locationException.exception_type === 'unavailable') {
        return {
          location_id: schedule.location_id,
          location_name: schedule.location_name,
          available: false,
          slots: [],
          reason: locationException.reason
        };
      }
      
      // Generate available slots
      const slots = generateTimeSlots(schedule, locationAppointments);
      
      return {
        location_id: schedule.location_id,
        location_name: schedule.location_name,
        available: slots.length > 0,
        slots: slots
      };
    });
    
    res.json({ 
      available: locationAvailability.some(loc => loc.available),
      locations: locationAvailability
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Generate time slots helper function (enhanced for multi-location)
function generateTimeSlots(schedule, bookedAppointments, slotDuration = 30) {
  const slots = [];
  const startTime = moment(schedule.start_time, 'HH:mm');
  const endTime = moment(schedule.end_time, 'HH:mm');
  const lunchStart = schedule.lunch_start ? moment(schedule.lunch_start, 'HH:mm') : null;
  const lunchEnd = schedule.lunch_end ? moment(schedule.lunch_end, 'HH:mm') : null;

  let currentTime = startTime.clone();

  while (currentTime.isBefore(endTime)) {
    const slotEnd = currentTime.clone().add(slotDuration, 'minutes');
    
    // Skip if slot would extend past end time
    if (slotEnd.isAfter(endTime)) {
      break;
    }
    
    // Skip lunch time
    if (lunchStart && lunchEnd && 
        (currentTime.isBetween(lunchStart, lunchEnd, 'minute', '[)') ||
         slotEnd.isBetween(lunchStart, lunchEnd, 'minute', '(]'))) {
      currentTime.add(slotDuration, 'minutes');
      continue;
    }

    // Check if slot is booked
    const isBooked = bookedAppointments.some(apt => {
      const aptStart = moment(apt.start_time, 'HH:mm:ss');
      const aptEnd = moment(apt.end_time, 'HH:mm:ss');
      return currentTime.isBetween(aptStart, aptEnd, 'minute', '[)') ||
             slotEnd.isBetween(aptStart, aptEnd, 'minute', '(]') ||
             (currentTime.isSameOrBefore(aptStart) && slotEnd.isSameOrAfter(aptEnd));
    });

    if (!isBooked) {
      slots.push({
        start: currentTime.format('HH:mm'),
        end: slotEnd.format('HH:mm'),
        available: true
      });
    }

    currentTime.add(slotDuration, 'minutes');
  }

  return slots;
}

// APPOINTMENT ROUTES
app.post('/api/appointments', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      physicianId, 
      locationId, 
      appointmentDate, 
      startTime, 
      endTime, 
      appointmentType, 
      visitType = 'in_person',
      notes,
      resourceId 
    } = req.body;
    
    // Get patient ID
    let patientId;
    if (req.user.role === 'patient') {
      const patient = await client.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      if (patient.rows.length === 0) {
        return res.status(400).json({ error: 'Patient profile not found' });
      }
      patientId = patient.rows[0].id;
    } else {
      patientId = req.body.patientId;
    }

    // Validate physician works at this location
    const physicianLocation = await client.query(
      'SELECT * FROM physician_locations WHERE physician_id = $1 AND location_id = $2',
      [physicianId, locationId]
    );
    
    if (physicianLocation.rows.length === 0) {
      return res.status(400).json({ error: 'Physician not available at this location' });
    }

    // Check slot availability
    const existingAppointment = await client.query(
      `SELECT * FROM appointments 
       WHERE physician_id = $1 AND location_id = $2 AND appointment_date = $3 
       AND start_time = $4 AND status NOT IN ('cancelled', 'no_show')`,
      [physicianId, locationId, appointmentDate, startTime]
    );

    if (existingAppointment.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot is no longer available' });
    }

    // Generate appointment number
    const appointmentNumber = `APT${Date.now()}`;
    
    // Calculate duration
    const duration = moment.duration(moment(endTime, 'HH:mm').diff(moment(startTime, 'HH:mm'))).asMinutes();

    // Create appointment
    const newAppointment = await client.query(
      `INSERT INTO appointments 
       (appointment_number, patient_id, physician_id, location_id, resource_id,
        appointment_date, start_time, end_time, duration_minutes, appointment_type, 
        visit_type, notes, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING *`,
      [appointmentNumber, patientId, physicianId, locationId, resourceId,
       appointmentDate, startTime, endTime, duration, appointmentType, 
       visitType, notes, req.user.id]
    );

    // Estimate copay (simplified calculation)
    const estimatedCopay = appointmentType === 'consultation' ? 50.00 : 
                          appointmentType === 'follow_up' ? 30.00 : 40.00;

    // Create payment record
    await client.query(
      `INSERT INTO payments 
       (appointment_id, patient_id, location_id, service_date, total_charges, 
        patient_responsibility, copay_amount, estimated_copay) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [newAppointment.rows[0].id, patientId, locationId, appointmentDate, 
       estimatedCopay * 3, estimatedCopay, estimatedCopay]
    );

    // Create appointment reminders
    const reminderTimes = [24, 2]; // 24 hours and 2 hours before
    for (const hours of reminderTimes) {
      const reminderTime = moment(`${appointmentDate} ${startTime}`)
        .subtract(hours, 'hours')
        .toISOString();
      
      await client.query(
        `INSERT INTO appointment_reminders 
         (appointment_id, reminder_type, reminder_timing, scheduled_time, recipient_type) 
         VALUES ($1, $2, $3, $4, $5)`,
        [newAppointment.rows[0].id, 'email', hours, reminderTime, 'patient']
      );
    }

    await client.query('COMMIT');
    
    // Return appointment with location details
    const appointmentWithDetails = await pool.query(
      `SELECT a.*, l.name as location_name, l.address as location_address,
              u.first_name as physician_first_name, u.last_name as physician_last_name
       FROM appointments a
       JOIN locations l ON a.location_id = l.id
       JOIN physicians p ON a.physician_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE a.id = $1`,
      [newAppointment.rows[0].id]
    );

    res.json(appointmentWithDetails.rows[0]);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  } finally {
    client.release();
  }
});

// Get appointments with enhanced filtering
app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const { date, locationId, status, physicianId } = req.query;
    
    let query = `
      SELECT a.*, 
             pt.patient_id as patient_number,
             pu.first_name as patient_first_name, pu.last_name as patient_last_name, pu.phone as patient_phone,
             du.first_name as physician_first_name, du.last_name as physician_last_name,
             ph.specialty as physician_specialty,
             l.name as location_name, l.address as location_address, l.phone as location_phone,
             pay.patient_responsibility, pay.amount_paid, pay.payment_status, pay.estimated_copay,
             lr.resource_name, lr.resource_number
      FROM appointments a
      JOIN patients pt ON a.patient_id = pt.id
      JOIN users pu ON pt.user_id = pu.id
      JOIN physicians ph ON a.physician_id = ph.id
      JOIN users du ON ph.user_id = du.id
      JOIN locations l ON a.location_id = l.id
      LEFT JOIN payments pay ON a.id = pay.appointment_id
      LEFT JOIN location_resources lr ON a.resource_id = lr.id
    `;
    
    const params = [];
    let whereClause = '';
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'patient') {
      const patient = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      if (patient.rows.length === 0) {
        return res.status(400).json({ error: 'Patient profile not found' });
      }
      whereClause = 'WHERE a.patient_id = $1';
      params.push(patient.rows[0].id);
      paramCount = 1;
    } else if (req.user.role === 'physician') {
      const physician = await pool.query('SELECT id FROM physicians WHERE user_id = $1', [req.user.id]);
      if (physician.rows.length === 0) {
        return res.status(400).json({ error: 'Physician profile not found' });
      }
      whereClause = 'WHERE a.physician_id = $1';
      params.push(physician.rows[0].id);
      paramCount = 1;
    } else {
      whereClause = 'WHERE 1=1'; // Staff/admin can see all
    }

    // Additional filters
    if (date) {
      whereClause += ` AND a.appointment_date = ${++paramCount}`;
      params.push(date);
    }
    
    if (locationId) {
      whereClause += ` AND a.location_id = ${++paramCount}`;
      params.push(locationId);
    }
    
    if (status) {
      whereClause += ` AND a.status = ${++paramCount}`;
      params.push(status);
    }
    
    if (physicianId) {
      whereClause += ` AND a.physician_id = ${++paramCount}`;
      params.push(physicianId);
    }

    query += ' ' + whereClause + ' ORDER BY a.appointment_date, a.start_time';

    const appointments = await pool.query(query, params);
    res.json(appointments.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Update appointment (reschedule/cancel) with location change support
app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { 
      status, 
      appointmentDate, 
      startTime, 
      endTime, 
      locationId,
      physicianId,
      notes,
      cancellationReason 
    } = req.body;

    // Get current appointment
    const currentAppointment = await client.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );
    
    if (currentAppointment.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = currentAppointment.rows[0];
    
    // Authorization check
    if (req.user.role === 'patient') {
      const patient = await client.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      if (patient.rows.length === 0 || patient.rows[0].id !== appointment.patient_id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    let updateQuery = 'UPDATE appointments SET updated_at = CURRENT_TIMESTAMP, updated_by = $1';
    const params = [req.user.id];
    let paramCount = 1;

    if (status) {
      updateQuery += `, status = ${++paramCount}`;
      params.push(status);
      
      if (status === 'cancelled' && cancellationReason) {
        updateQuery += `, cancellation_reason = ${++paramCount}, cancellation_date = CURRENT_TIMESTAMP, cancelled_by = $1`;
        params.push(cancellationReason);
      }
    }

    // Handle rescheduling with potential location change
    if (appointmentDate || startTime || locationId || physicianId) {
      const newPhysicianId = physicianId || appointment.physician_id;
      const newLocationId = locationId || appointment.location_id;
      const newDate = appointmentDate || appointment.appointment_date;
      const newStartTime = startTime || appointment.start_time;
      const newEndTime = endTime || appointment.end_time;

      // Validate physician works at new location if location changed
      if (locationId && locationId !== appointment.location_id) {
        const physicianLocation = await client.query(
          'SELECT * FROM physician_locations WHERE physician_id = $1 AND location_id = $2',
          [newPhysicianId, newLocationId]
        );
        
        if (physicianLocation.rows.length === 0) {
          return res.status(400).json({ error: 'Physician not available at the selected location' });
        }
      }

      // Check for conflicts at new time/location
      const conflictCheck = await client.query(
        `SELECT * FROM appointments 
         WHERE physician_id = $1 AND location_id = $2 AND appointment_date = $3 
         AND start_time = $4 AND status NOT IN ('cancelled', 'no_show') AND id != $5`,
        [newPhysicianId, newLocationId, newDate, newStartTime, id]
      );

      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Time slot is no longer available' });
      }

      if (appointmentDate) {
        updateQuery += `, appointment_date = ${++paramCount}`;
        params.push(appointmentDate);
      }

      if (startTime) {
        updateQuery += `, start_time = ${++paramCount}`;
        params.push(startTime);
      }

      if (endTime) {
        updateQuery += `, end_time = ${++paramCount}`;
        params.push(endTime);
      }

      if (locationId) {
        updateQuery += `, location_id = ${++paramCount}`;
        params.push(locationId);
        
        // Update payment record location
        await client.query(
          'UPDATE payments SET location_id = $1 WHERE appointment_id = $2',
          [locationId, id]
        );
      }

      if (physicianId) {
        updateQuery += `, physician_id = ${++paramCount}`;
        params.push(physicianId);
      }
    }

    if (notes) {
      updateQuery += `, notes = ${++paramCount}`;
      params.push(notes);
    }

    updateQuery += ` WHERE id = ${++paramCount} RETURNING *`;
    params.push(id);

    const updatedAppointment = await client.query(updateQuery, params);
    
    // Log the change
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        'appointment_update',
        'appointment',
        id,
        JSON.stringify(appointment),
        JSON.stringify(updatedAppointment.rows[0])
      ]
    );

    await client.query('COMMIT');
    res.json(updatedAppointment.rows[0]);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  } finally {
    client.release();
  }
});

// Get alternative appointment slots across locations
app.get('/api/appointments/:id/alternatives', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { preferredLocationId, dateRange = 14 } = req.query;

    // Get current appointment details
    const appointment = await pool.query(
      `SELECT a.*, p.specialty FROM appointments a 
       JOIN physicians ph ON a.physician_id = ph.id 
       WHERE a.id = $1`,
      [id]
    );

    if (appointment.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const currentAppt = appointment.rows[0];
    const startDate = moment().format('YYYY-MM-DD');
    const endDate = moment().add(dateRange, 'days').format('YYYY-MM-DD');

    // Find alternative physicians in same specialty
    let alternativePhysicians = await pool.query(
      `SELECT DISTINCT p.id, u.first_name, u.last_name, p.specialty,
              pl.location_id, l.name as location_name
       FROM physicians p
       JOIN users u ON p.user_id = u.id
       JOIN physician_locations pl ON p.id = pl.physician_id
       JOIN locations l ON pl.location_id = l.id
       WHERE p.specialty = $1 AND p.is_active = true
       ${preferredLocationId ? 'AND pl.location_id = $2' : ''}
       ORDER BY u.last_name, u.first_name`,
      preferredLocationId ? [currentAppt.specialty, preferredLocationId] : [currentAppt.specialty]
    );

    // For each physician, get their next available slots
    const alternatives = [];
    for (const physician of alternativePhysicians.rows) {
      // Get availability for next few days
      for (let i = 0; i < dateRange; i++) {
        const checkDate = moment().add(i, 'days').format('YYYY-MM-DD');
        const dayOfWeek = moment(checkDate).day();

        // Get schedule for this day/location
        const schedule = await pool.query(
          `SELECT * FROM physician_location_schedules 
           WHERE physician_id = $1 AND location_id = $2 AND day_of_week = $3 AND is_active = true`,
          [physician.id, physician.location_id, dayOfWeek]
        );

        if (schedule.rows.length > 0) {
          // Get existing appointments
          const existing = await pool.query(
            `SELECT start_time, end_time FROM appointments 
             WHERE physician_id = $1 AND location_id = $2 AND appointment_date = $3 
             AND status NOT IN ('cancelled', 'no_show')`,
            [physician.id, physician.location_id, checkDate]
          );

          const slots = generateTimeSlots(schedule.rows[0], existing.rows, 30);
          
          if (slots.length > 0) {
            alternatives.push({
              physician_id: physician.id,
              physician_name: `${physician.first_name} ${physician.last_name}`,
              specialty: physician.specialty,
              location_id: physician.location_id,
              location_name: physician.location_name,
              date: checkDate,
              available_slots: slots.slice(0, 3) // First 3 available slots
            });
            
            if (alternatives.length >= 10) break; // Limit results
          }
        }
      }
      if (alternatives.length >= 10) break;
    }

    res.json(alternatives);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alternatives' });
  }
});

// PAYMENT ROUTES
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, patientId, locationId, status } = req.query;
    
    let query = `
      SELECT p.*, a.appointment_date, a.appointment_type,
             pt.patient_id as patient_number,
             pu.first_name as patient_first_name, pu.last_name as patient_last_name,
             l.name as location_name
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      JOIN patients pt ON p.patient_id = pt.id
      JOIN users pu ON pt.user_id = pu.id
      JOIN locations l ON p.location_id = l.id
    `;
    
    const params = [];
    let whereClause = '';
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'patient') {
      const patient = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
      if (patient.rows.length === 0) {
        return res.status(400).json({ error: 'Patient profile not found' });
      }
      whereClause = 'WHERE p.patient_id = $1';
      params.push(patient.rows[0].id);
      paramCount = 1;
    } else {
      whereClause = 'WHERE 1=1'; // Staff/admin can see all
    }

    // Additional filters
    if (appointmentId) {
      whereClause += ` AND p.appointment_id = ${++paramCount}`;
      params.push(appointmentId);
    }
    
    if (patientId) {
      whereClause += ` AND p.patient_id = ${++paramCount}`;
      params.push(patientId);
    }
    
    if (locationId) {
      whereClause += ` AND p.location_id = ${++paramCount}`;
      params.push(locationId);
    }
    
    if (status) {
      whereClause += ` AND p.payment_status = ${++paramCount}`;
      params.push(status);
    }

    query += ' ' + whereClause + ' ORDER BY p.created_at DESC';

    const payments = await pool.query(query, params);
    res.json(payments.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { appointmentId, amount, paymentMethod, paymentReference } = req.body;

    // Get payment record
    const paymentRecord = await client.query(
      'SELECT * FROM payments WHERE appointment_id = $1',
      [appointmentId]
    );

    if (paymentRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const payment = paymentRecord.rows[0];
    const newAmountPaid = parseFloat(payment.amount_paid) + parseFloat(amount);
    const patientResponsibility = parseFloat(payment.patient_responsibility);

    let newStatus = 'partial';
    if (newAmountPaid >= patientResponsibility) {
      newStatus = 'paid';
    }

    const updatedPayment = await client.query(
      `UPDATE payments 
       SET amount_paid = $1, payment_method = $2, payment_date = CURRENT_TIMESTAMP, 
           payment_status = $3, payment_reference = $4, updated_at = CURRENT_TIMESTAMP
       WHERE appointment_id = $5 
       RETURNING *`,
      [newAmountPaid, paymentMethod, newStatus, paymentReference, appointmentId]
    );

    // Log payment transaction
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'payment_processed',
        'payment',
        payment.id,
        JSON.stringify({ amount, paymentMethod, paymentReference })
      ]
    );

    await client.query('COMMIT');
    res.json(updatedPayment.rows[0]);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

// REPORTING AND ANALYTICS ROUTES
app.get('/api/reports/location-summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    
    let query = `
      SELECT 
        l.id, l.name, l.location_type, l.city,
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.id END) as cancelled_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'no_show' THEN a.id END) as no_shows,
        COUNT(DISTINCT a.patient_id) as unique_patients,
        COUNT(DISTINCT a.physician_id) as active_physicians,
        COALESCE(SUM(p.amount_paid), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN p.payment_status = 'pending' THEN p.patient_responsibility - p.amount_paid END), 0) as outstanding_balance
      FROM locations l
      LEFT JOIN appointments a ON l.id = a.location_id
      LEFT JOIN payments p ON a.id = p.appointment_id
    `;
    
    const params = [];
    let whereClause = 'WHERE l.is_active = true';
    let paramCount = 0;

    if (startDate && endDate) {
      whereClause += ` AND a.appointment_date BETWEEN ${++paramCount} AND ${++paramCount}`;
      params.push(startDate, endDate);
    }
    
    if (locationId) {
      whereClause += ` AND l.id = ${++paramCount}`;
      params.push(locationId);
    }

    query += ' ' + whereClause + ' GROUP BY l.id, l.name, l.location_type, l.city ORDER BY l.name';

    const report = await pool.query(query, params);
    res.json(report.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate location summary' });
  }
});

app.get('/api/reports/physician-utilization', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    
    let query = `
      SELECT 
        p.id, u.first_name, u.last_name, p.specialty,
        l.id as location_id, l.name as location_name,
        COUNT(a.id) as total_appointments,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_shows,
        AVG(EXTRACT(MINUTE FROM (a.end_time - a.start_time))) as avg_appointment_duration,
        COUNT(DISTINCT a.patient_id) as unique_patients
      FROM physicians p
      JOIN users u ON p.user_id = u.id
      JOIN physician_locations pl ON p.id = pl.physician_id
      JOIN locations l ON pl.location_id = l.id
      LEFT JOIN appointments a ON p.id = a.physician_id AND a.location_id = l.id
    `;
    
    const params = [];
    let whereClause = 'WHERE p.is_active = true';
    let paramCount = 0;

    if (startDate && endDate) {
      whereClause += ` AND a.appointment_date BETWEEN ${++paramCount} AND ${++paramCount}`;
      params.push(startDate, endDate);
    }
    
    if (locationId) {
      whereClause += ` AND l.id = ${++paramCount}`;
      params.push(locationId);
    }

    query += ' ' + whereClause + ' GROUP BY p.id, u.first_name, u.last_name, p.specialty, l.id, l.name ORDER BY completed_appointments DESC';

    const report = await pool.query(query, params);
    res.json(report.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate physician utilization report' });
  }
});

// WAITLIST MANAGEMENT
app.post('/api/waitlist', authenticateToken, async (req, res) => {
  try {
    const { 
      physicianId, 
      locationId, 
      preferredDateStart, 
      preferredDateEnd, 
      preferredTimeStart, 
      preferredTimeEnd, 
      appointmentType 
    } = req.body;

    // Get patient ID
    const patient = await pool.query('SELECT id FROM patients WHERE user_id = $1', [req.user.id]);
    if (patient.rows.length === 0) {
      return res.status(400).json({ error: 'Patient profile not found' });
    }

    const waitlistEntry = await pool.query(
      `INSERT INTO appointment_waitlist 
       (patient_id, physician_id, location_id, preferred_date_start, preferred_date_end,
        preferred_time_start, preferred_time_end, appointment_type, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        patient.rows[0].id, physicianId, locationId, preferredDateStart, preferredDateEnd,
        preferredTimeStart, preferredTimeEnd, appointmentType,
        moment().add(30, 'days').toISOString() // 30-day expiry
      ]
    );

    res.json(waitlistEntry.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to waitlist' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Multi-Location Hospital Appointment System server running on port ${PORT}`);
});

module.exports = app;