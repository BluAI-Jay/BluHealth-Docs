// package.json
{
  "name": "appointment-scheduler-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-validator": "^7.0.1",
    "moment": "^2.29.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

// .env
DATABASE_URL=postgresql://username:password@localhost:5432/appointment_scheduler
JWT_SECRET=your-secret-key-here
PORT=5000

// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const physicianRoutes = require('./routes/physicians');
const patientRoutes = require('./routes/patients');
const financialRoutes = require('./routes/financials');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/physicians', physicianRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/financials', financialRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['patient', 'physician', 'staff']),
  body('firstName').notEmpty(),
  body('lastName').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, role, firstName, lastName, ...additionalData } = req.body;

  try {
    // Check if user exists
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, role]
    );

    const userId = newUser.rows[0].id;

    // Create role-specific record
    if (role === 'patient') {
      await db.query(
        'INSERT INTO patients (user_id, first_name, last_name, phone, insurance_provider, insurance_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, firstName, lastName, additionalData.phone, additionalData.insuranceProvider, additionalData.insuranceId]
      );
    } else if (role === 'physician') {
      await db.query(
        'INSERT INTO physicians (user_id, first_name, last_name, specialization, license_number) VALUES ($1, $2, $3, $4, $5)',
        [userId, firstName, lastName, additionalData.specialization, additionalData.licenseNumber]
      );
    } else if (role === 'staff') {
      await db.query(
        'INSERT INTO staff (user_id, first_name, last_name, department) VALUES ($1, $2, $3, $4)',
        [userId, firstName, lastName, additionalData.department]
      );
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Get user
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user details based on role
    let userDetails;
    if (user.rows[0].role === 'patient') {
      userDetails = await db.query('SELECT * FROM patients WHERE user_id = $1', [user.rows[0].id]);
    } else if (user.rows[0].role === 'physician') {
      userDetails = await db.query('SELECT * FROM physicians WHERE user_id = $1', [user.rows[0].id]);
    } else if (user.rows[0].role === 'staff') {
      userDetails = await db.query('SELECT * FROM staff WHERE user_id = $1', [user.rows[0].id]);
    }

    // Create token
    const token = jwt.sign(
      { 
        id: user.rows[0].id, 
        email: user.rows[0].email, 
        role: user.rows[0].role,
        roleId: userDetails.rows[0].id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        ...userDetails.rows[0]
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// routes/physicians.js
const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/db');
const moment = require('moment');

const router = express.Router();

// Get physician schedule
router.get('/:id/schedule', auth, async (req, res) => {
  try {
    const schedule = await db.query(
      `SELECT ps.*, l.name as location_name 
       FROM physician_schedules ps
       JOIN locations l ON ps.location_id = l.id
       WHERE ps.physician_id = $1 AND ps.is_active = true
       ORDER BY ps.day_of_week`,
      [req.params.id]
    );

    res.json(schedule.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create/Update physician schedule
router.post('/:id/schedule', auth, async (req, res) => {
  const { locationId, dayOfWeek, startTime, endTime, lunchStart, lunchEnd } = req.body;

  try {
    // Check if schedule exists
    const existing = await db.query(
      'SELECT * FROM physician_schedules WHERE physician_id = $1 AND day_of_week = $2 AND location_id = $3',
      [req.params.id, dayOfWeek, locationId]
    );

    if (existing.rows.length > 0) {
      // Update
      await db.query(
        `UPDATE physician_schedules 
         SET start_time = $1, end_time = $2, lunch_start = $3, lunch_end = $4, is_active = true
         WHERE id = $5`,
        [startTime, endTime, lunchStart, lunchEnd, existing.rows[0].id]
      );
    } else {
      // Create
      await db.query(
        `INSERT INTO physician_schedules (physician_id, location_id, day_of_week, start_time, end_time, lunch_start, lunch_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, locationId, dayOfWeek, startTime, endTime, lunchStart, lunchEnd]
      );
    }

    res.json({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add time off
router.post('/:id/time-off', auth, async (req, res) => {
  const { startDate, endDate, reason } = req.body;

  try {
    await db.query(
      'INSERT INTO physician_time_off (physician_id, start_date, end_date, reason) VALUES ($1, $2, $3, $4)',
      [req.params.id, startDate, endDate, reason]
    );

    // TODO: Notify affected patients

    res.json({ message: 'Time off added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available time slots
router.get('/:id/available-slots', async (req, res) => {
  const { date, duration = 30 } = req.query;
  const requestedDate = moment(date);
  const dayOfWeek = requestedDate.day();

  try {
    // Get physician schedule for that day
    const schedule = await db.query(
      `SELECT * FROM physician_schedules 
       WHERE physician_id = $1 AND day_of_week = $2 AND is_active = true`,
      [req.params.id, dayOfWeek]
    );

    if (schedule.rows.length === 0) {
      return res.json({ slots: [] });
    }

    const { start_time, end_time, lunch_start, lunch_end } = schedule.rows[0];

    // Check if physician is off that day
    const timeOff = await db.query(
      'SELECT * FROM physician_time_off WHERE physician_id = $1 AND $2::date BETWEEN start_date AND end_date',
      [req.params.id, date]
    );

    if (timeOff.rows.length > 0) {
      return res.json({ slots: [] });
    }

    // Get existing appointments
    const appointments = await db.query(
      'SELECT start_time, end_time FROM appointments WHERE physician_id = $1 AND appointment_date = $2 AND status != $3',
      [req.params.id, date, 'cancelled']
    );

    // Generate available slots
    const slots = [];
    let currentTime = moment(`${date} ${start_time}`, 'YYYY-MM-DD HH:mm:ss');
    const endMoment = moment(`${date} ${end_time}`, 'YYYY-MM-DD HH:mm:ss');
    const lunchStartMoment = moment(`${date} ${lunch_start}`, 'YYYY-MM-DD HH:mm:ss');
    const lunchEndMoment = moment(`${date} ${lunch_end}`, 'YYYY-MM-DD HH:mm:ss');

    while (currentTime.isBefore(endMoment)) {
      const slotEnd = currentTime.clone().add(duration, 'minutes');

      // Check if slot overlaps with lunch
      if (currentTime.isSameOrAfter(lunchStartMoment) && currentTime.isBefore(lunchEndMoment)) {
        currentTime = lunchEndMoment.clone();
        continue;
      }

      // Check if slot overlaps with existing appointments
      const isBooked = appointments.rows.some(apt => {
        const aptStart = moment(`${date} ${apt.start_time}`, 'YYYY-MM-DD HH:mm:ss');
        const aptEnd = moment(`${date} ${apt.end_time}`, 'YYYY-MM-DD HH:mm:ss');
        return currentTime.isBefore(aptEnd) && slotEnd.isAfter(aptStart);
      });

      if (!isBooked) {
        slots.push({
          start: currentTime.format('HH:mm'),
          end: slotEnd.format('HH:mm')
        });
      }

      currentTime.add(duration, 'minutes');
    }

    res.json({ slots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all physicians
router.get('/', async (req, res) => {
  const { specialization, locationId } = req.query;

  try {
    let query = `
      SELECT DISTINCT p.*, u.email 
      FROM physicians p
      JOIN users u ON p.user_id = u.id
    `;
    
    const params = [];
    const conditions = [];

    if (specialization) {
      conditions.push(`p.specialization = $${params.length + 1}`);
      params.push(specialization);
    }

    if (locationId) {
      query += ' JOIN physician_schedules ps ON p.id = ps.physician_id';
      conditions.push(`ps.location_id = $${params.length + 1} AND ps.is_active = true`);
      params.push(locationId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const physicians = await db.query(query, params);
    res.json(physicians.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// routes/appointments.js
const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/db');

const router = express.Router();

// Get appointments
router.get('/', auth, async (req, res) => {
  const { date, physicianId, patientId, status } = req.query;

  try {
    let query = `
      SELECT a.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             ph.first_name as physician_first_name, ph.last_name as physician_last_name,
             l.name as location_name,
             af.copay_amount, af.amount_due, af.payment_status
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN physicians ph ON a.physician_id = ph.id
      JOIN locations l ON a.location_id = l.id
      LEFT JOIN appointment_financials af ON a.id = af.appointment_id
      WHERE 1=1
    `;

    const params = [];

    if (date) {
      query += ` AND a.appointment_date = $${params.length + 1}`;
      params.push(date);
    }

    if (physicianId) {
      query += ` AND a.physician_id = $${params.length + 1}`;
      params.push(physicianId);
    }

    if (patientId) {
      query += ` AND a.patient_id = $${params.length + 1}`;
      params.push(patientId);
    }

    if (status) {
      query += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    // Role-based filtering
    if (req.user.role === 'patient') {
      query += ` AND a.patient_id = $${params.length + 1}`;
      params.push(req.user.roleId);
    } else if (req.user.role === 'physician') {
      query += ` AND a.physician_id = $${params.length + 1}`;
      params.push(req.user.roleId);
    }

    query += ' ORDER BY a.appointment_date, a.start_time';

    const appointments = await db.query(query, params);
    res.json(appointments.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create appointment
router.post('/', auth, async (req, res) => {
  const { 
    patientId, 
    physicianId, 
    locationId, 
    appointmentDate, 
    startTime, 
    endTime, 
    reasonForVisit,
    copayAmount 
  } = req.body;

  try {
    // Validate slot availability
    const existing = await db.query(
      `SELECT * FROM appointments 
       WHERE physician_id = $1 AND appointment_date = $2 
       AND status != 'cancelled'
       AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4))`,
      [physicianId, appointmentDate, startTime, endTime]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Time slot not available' });
    }

    // Create appointment
    const appointment = await db.query(
      `INSERT INTO appointments (patient_id, physician_id, location_id, appointment_date, start_time, end_time, reason_for_visit)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [patientId || req.user.roleId, physicianId, locationId, appointmentDate, startTime, endTime, reasonForVisit]
    );

    const appointmentId = appointment.rows[0].id;

    // Create financial record
    await db.query(
      `INSERT INTO appointment_financials (appointment_id, copay_amount, amount_due, payment_status)
       VALUES ($1, $2, $2, 'pending')`,
      [appointmentId, copayAmount || 0]
    );

    res.status(201).json({ id: appointmentId, message: 'Appointment created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reschedule appointment
router.post('/:id/reschedule', auth, async (req, res) => {
  const { appointmentDate, startTime, endTime } = req.body;

  try {
    // Get original appointment
    const original = await db.query(
      'SELECT * FROM appointments WHERE id = $1',
      [req.params.id]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Validate new slot
    const existing = await db.query(
      `SELECT * FROM appointments 
       WHERE physician_id = $1 AND appointment_date = $2 
       AND status != 'cancelled' AND id != $3
       AND ((start_time <= $4 AND end_time > $4) OR (start_time < $5 AND end_time >= $5))`,
      [original.rows[0].physician_id, appointmentDate, req.params.id, startTime, endTime]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'New time slot not available' });
    }

    // Update appointment
    await db.query(
      `UPDATE appointments 
       SET appointment_date = $1, start_time = $2, end_time = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [appointmentDate, startTime, endTime, req.params.id]
    );

    res.json({ message: 'Appointment rescheduled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel appointment
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      "UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// routes/patients.js
const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/db');

const router = express.Router();

// Get patient details
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await db.query(
      `SELECT p.*, u.email 
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Launch patient record (EHR integration)
router.get('/:id/ehr', auth, async (req, res) => {
  try {
    // This would integrate with your EHR system
    // For now, returning a mock URL
    res.json({
      ehrUrl: `https://ehr.yoursystem.com/patients/${req.params.id}`,
      token: 'temporary-access-token'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// routes/financials.js
const express = require('express');
const auth = require('../middleware/auth');
const db = require('../config/db');

const router = express.Router();

// Get appointment financials
router.get('/appointment/:id', auth, async (req, res) => {
  try {
    const financials = await db.query(
      'SELECT * FROM appointment_financials WHERE appointment_id = $1',
      [req.params.id]
    );

    if (financials.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }

    res.json(financials.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update payment
router.post('/appointment/:id/payment', auth, async (req, res) => {
  const { amountPaid } = req.body;

  try {
    const financial = await db.query(
      'SELECT * FROM appointment_financials WHERE appointment_id = $1',
      [req.params.id]
    );

    if (financial.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }

    const currentDue = parseFloat(financial.rows[0].amount_due);
    const newDue = currentDue - amountPaid;
    const paymentStatus = newDue <= 0 ? 'paid' : 'partial';

    await db.query(
      `UPDATE appointment_financials 
       SET amount_due = $1, payment_status = $2, payment_date = CURRENT_DATE
       WHERE appointment_id = $3`,
      [Math.max(0, newDue), paymentStatus, req.params.id]
    );

    res.json({ message: 'Payment processed successfully', remainingBalance: Math.max(0, newDue) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;