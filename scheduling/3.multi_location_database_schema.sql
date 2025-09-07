-- Enhanced Multi-Location Hospital Appointment Scheduling Database Schema

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS appointment_reminders CASCADE;
DROP TABLE IF EXISTS patient_records CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS physician_location_schedules CASCADE;
DROP TABLE IF EXISTS physician_locations CASCADE;
DROP TABLE IF EXISTS location_resources CASCADE;
DROP TABLE IF EXISTS physicians CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS hospital_systems CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- Hospital Systems (Main hospital networks)
CREATE TABLE hospital_systems (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    headquarters_address TEXT,
    main_phone VARCHAR(20),
    website VARCHAR(255),
    tax_id VARCHAR(50),
    license_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations (Hospitals, satellite offices, outpatient clinics)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    hospital_system_id INTEGER REFERENCES hospital_systems(id),
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('main_hospital', 'satellite_office', 'outpatient_clinic', 'specialty_center', 'urgent_care')),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    parking_available BOOLEAN DEFAULT true,
    parking_cost DECIMAL(10, 2),
    public_transport_access TEXT,
    accessibility_features TEXT[],
    operating_hours JSONB, -- Store flexible hours per day
    services_offered TEXT[],
    emergency_services BOOLEAN DEFAULT false,
    pharmacy_onsite BOOLEAN DEFAULT false,
    lab_services BOOLEAN DEFAULT false,
    imaging_services TEXT[], -- ['xray', 'mri', 'ct', 'ultrasound']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (enhanced for multi-location)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    phone VARCHAR(20),
    mobile_phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'physician', 'nurse', 'staff', 'admin', 'dept_head')),
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Physicians table (enhanced)
CREATE TABLE physicians (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    primary_location_id INTEGER REFERENCES locations(id),
    npi_number VARCHAR(20) UNIQUE,
    license_number VARCHAR(50),
    dea_number VARCHAR(20),
    specialty VARCHAR(100) NOT NULL,
    subspecialty VARCHAR(100),
    board_certifications TEXT[],
    medical_school VARCHAR(255),
    residency VARCHAR(255),
    fellowship VARCHAR(255),
    years_of_experience INTEGER,
    languages_spoken TEXT[],
    consultation_duration INTEGER DEFAULT 30, -- minutes
    follow_up_duration INTEGER DEFAULT 15, -- minutes
    accepts_new_patients BOOLEAN DEFAULT true,
    telemedicine_enabled BOOLEAN DEFAULT false,
    travel_time_buffer INTEGER DEFAULT 15, -- minutes between locations
    bio TEXT,
    profile_image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Physician location assignments (many-to-many)
CREATE TABLE physician_locations (
    id SERIAL PRIMARY KEY,
    physician_id INTEGER REFERENCES physicians(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    is_primary_location BOOLEAN DEFAULT false,
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(physician_id, location_id, start_date)
);

-- Physician schedules per location (replaces simple physician_schedules)
CREATE TABLE physician_location_schedules (
    id SERIAL PRIMARY KEY,
    physician_id INTEGER REFERENCES physicians(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    lunch_start TIME,
    lunch_end TIME,
    break_times JSONB, -- Array of break periods: [{"start": "10:30", "end": "10:45", "type": "break"}]
    max_patients_per_hour INTEGER DEFAULT 2,
    appointment_types TEXT[], -- Types of appointments available at this location/time
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(physician_id, location_id, day_of_week, effective_date)
);

-- Location resources and rooms
CREATE TABLE location_resources (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'exam_room', 'procedure_room', 'equipment'
    resource_name VARCHAR(100) NOT NULL,
    resource_number VARCHAR(20),
    capacity INTEGER DEFAULT 1,
    equipment_list TEXT[],
    accessibility_features TEXT[],
    booking_required BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table (enhanced)
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) UNIQUE, -- Hospital-assigned patient ID
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    ssn_encrypted VARCHAR(255), -- Encrypted SSN
    preferred_location_id INTEGER REFERENCES locations(id),
    primary_care_physician_id INTEGER REFERENCES physicians(id),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    insurance_primary_provider VARCHAR(100),
    insurance_primary_id VARCHAR(50),
    insurance_primary_group VARCHAR(50),
    insurance_secondary_provider VARCHAR(100),
    insurance_secondary_id VARCHAR(50),
    insurance_secondary_group VARCHAR(50),
    allergies TEXT[],
    chronic_conditions TEXT[],
    current_medications TEXT[],
    preferred_communication VARCHAR(20) DEFAULT 'email', -- 'email', 'sms', 'phone', 'mail'
    communication_preferences JSONB, -- Detailed preferences
    accessibility_needs TEXT[],
    transportation_needs VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    appointment_number VARCHAR(50) UNIQUE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    physician_id INTEGER REFERENCES physicians(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES location_resources(id),
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    appointment_type VARCHAR(50) NOT NULL DEFAULT 'consultation',
    visit_type VARCHAR(30) DEFAULT 'in_person', -- 'in_person', 'telemedicine', 'phone'
    priority_level VARCHAR(20) DEFAULT 'routine', -- 'emergency', 'urgent', 'routine'
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    cancellation_reason VARCHAR(255),
    cancellation_date TIMESTAMP,
    cancelled_by INTEGER REFERENCES users(id),
    chief_complaint TEXT,
    appointment_notes TEXT,
    special_instructions TEXT,
    is_follow_up BOOLEAN DEFAULT false,
    parent_appointment_id INTEGER REFERENCES appointments(id),
    follow_up_recommended BOOLEAN DEFAULT false,
    follow_up_weeks INTEGER,
    estimated_copay DECIMAL(10, 2),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no double booking
    CONSTRAINT no_double_booking UNIQUE(physician_id, appointment_date, start_time)
);

-- Enhanced payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id),
    invoice_number VARCHAR(50) UNIQUE,
    service_date DATE NOT NULL,
    total_charges DECIMAL(10, 2) NOT NULL,
    insurance_primary_paid DECIMAL(10, 2) DEFAULT 0,
    insurance_secondary_paid DECIMAL(10, 2) DEFAULT 0,
    adjustment_amount DECIMAL(10, 2) DEFAULT 0,
    patient_responsibility DECIMAL(10, 2) NOT NULL,
    copay_amount DECIMAL(10, 2) DEFAULT 0,
    deductible_amount DECIMAL(10, 2) DEFAULT 0,
    coinsurance_amount DECIMAL(10, 2) DEFAULT 0,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'written_off')),
    payment_method VARCHAR(50),
    payment_date TIMESTAMP,
    payment_reference VARCHAR(100),
    billing_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient records (simplified EMR)
CREATE TABLE patient_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    physician_id INTEGER REFERENCES physicians(id),
    appointment_id INTEGER REFERENCES appointments(id),
    location_id INTEGER REFERENCES locations(id),
    record_date DATE NOT NULL,
    record_type VARCHAR(50) DEFAULT 'visit_note', -- 'visit_note', 'lab_result', 'imaging', 'prescription'
    chief_complaint TEXT,
    history_present_illness TEXT,
    review_of_systems JSONB,
    physical_examination JSONB,
    assessment_plan TEXT,
    diagnosis_codes TEXT[], -- ICD-10 codes
    procedure_codes TEXT[], -- CPT codes
    vital_signs JSONB,
    medications_prescribed JSONB,
    lab_orders JSONB,
    imaging_orders JSONB,
    referrals JSONB,
    follow_up_instructions TEXT,
    provider_notes TEXT,
    is_confidential BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced appointment reminders
CREATE TABLE appointment_reminders (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) CHECK (reminder_type IN ('email', 'sms', 'phone', 'push')),
    reminder_timing INTEGER NOT NULL, -- Hours before appointment
    message_template VARCHAR(500),
    recipient_type VARCHAR(20) DEFAULT 'patient', -- 'patient', 'physician', 'location_staff'
    scheduled_time TIMESTAMP NOT NULL,
    sent_time TIMESTAMP,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    delivery_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced audit log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    location_id INTEGER REFERENCES locations(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'appointment', 'patient', 'physician', etc.
    entity_id INTEGER NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Physician availability exceptions (holidays, sick days, etc.)
CREATE TABLE physician_availability_exceptions (
    id SERIAL PRIMARY KEY,
    physician_id INTEGER REFERENCES physicians(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id),
    exception_date DATE NOT NULL,
    exception_type VARCHAR(30) NOT NULL, -- 'unavailable', 'modified_hours', 'location_change'
    start_time TIME,
    end_time TIME,
    reason VARCHAR(255),
    alternative_location_id INTEGER REFERENCES locations(id),
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR(50), -- 'weekly', 'monthly', 'yearly'
    recurring_end_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(physician_id, location_id, exception_date)
);

-- Waitlist for appointments
CREATE TABLE appointment_waitlist (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    physician_id INTEGER REFERENCES physicians(id),
    location_id INTEGER REFERENCES locations(id),
    preferred_date_start DATE,
    preferred_date_end DATE,
    preferred_time_start TIME,
    preferred_time_end TIME,
    appointment_type VARCHAR(50),
    priority_score INTEGER DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'notified', 'scheduled', 'expired', 'cancelled')),
    notification_method VARCHAR(20) DEFAULT 'email',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Location-specific settings and configurations
CREATE TABLE location_settings (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    setting_name VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(30) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    is_system_setting BOOLEAN DEFAULT false,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, setting_name)
);

-- Create comprehensive indexes for performance
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, appointment_date);
CREATE INDEX idx_appointments_physician_date ON appointments(physician_id, appointment_date);
CREATE INDEX idx_appointments_location_date ON appointments(location_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_physician_location_schedules_physician ON physician_location_schedules(physician_id, location_id);
CREATE INDEX idx_physician_location_schedules_day ON physician_location_schedules(day_of_week);
CREATE INDEX idx_locations_system ON locations(hospital_system_id);
CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);
CREATE INDEX idx_patients_preferred_location ON patients(preferred_location_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_waitlist_patient ON appointment_waitlist(patient_id, status);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patient_records_updated_at BEFORE UPDATE ON patient_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample hospital system and locations
INSERT INTO hospital_systems (name, headquarters_address, main_phone, website) VALUES 
('Metro Health System', '123 Healthcare Blvd, Metro City, ST 12345', '555-0000', 'www.metrohealth.com');

INSERT INTO locations (hospital_system_id, name, location_type, address, city, state, zip_code, phone, latitude, longitude, operating_hours, services_offered, emergency_services, pharmacy_onsite, lab_services, imaging_services) VALUES 
(1, 'Metro General Hospital', 'main_hospital', '123 Healthcare Blvd', 'Metro City', 'ST', '12345', '555-0100', 40.7589, -73.9851, 
 '{"monday": {"open": "00:00", "close": "23:59"}, "tuesday": {"open": "00:00", "close": "23:59"}, "wednesday": {"open": "00:00", "close": "23:59"}, "thursday": {"open": "00:00", "close": "23:59"}, "friday": {"open": "00:00", "close": "23:59"}, "saturday": {"open": "00:00", "close": "23:59"}, "sunday": {"open": "00:00", "close": "23:59"}}',
 ARRAY['emergency', 'surgery', 'cardiology', 'oncology', 'neurology'], true, true, true, ARRAY['xray', 'mri', 'ct', 'ultrasound']),

(1, 'North Side Clinic', 'satellite_office', '456 North Ave', 'Metro City', 'ST', '12346', '555-0200', 40.7829, -73.9654,
 '{"monday": {"open": "08:00", "close": "17:00"}, "tuesday": {"open": "08:00", "close": "17:00"}, "wednesday": {"open": "08:00", "close": "17:00"}, "thursday": {"open": "08:00", "close": "17:00"}, "friday": {"open": "08:00", "close": "17:00"}}',
 ARRAY['family_medicine', 'pediatrics', 'internal_medicine'], false, false, true, ARRAY['xray']),

(1, 'West End Outpatient Center', 'outpatient_clinic', '789 West End Rd', 'Metro City', 'ST', '12347', '555-0300', 40.7505, -74.0134,
 '{"monday": {"open": "07:00", "close": "19:00"}, "tuesday": {"open": "07:00", "close": "19:00"}, "wednesday": {"open": "07:00", "close": "19:00"}, "thursday": {"open": "07:00", "close": "19:00"}, "friday": {"open": "07:00", "close": "19:00"}, "saturday": {"open": "08:00", "close": "16:00"}}',
 ARRAY['cardiology', 'endocrinology', 'rheumatology'], false, true, true, ARRAY['ultrasound', 'ecg']),

(1, 'Downtown Specialty Center', 'specialty_center', '321 Downtown Plaza', 'Metro City', 'ST', '12348', '555-0400', 40.7505, -73.9934,
 '{"monday": {"open": "06:00", "close": "20:00"}, "tuesday": {"open": "06:00", "close": "20:00"}, "wednesday": {"open": "06:00", "close": "20:00"}, "thursday": {"open": "06:00", "close": "20:00"}, "friday": {"open": "06:00", "close": "20:00"}}',
 ARRAY['cardiology', 'neurology', 'orthopedics'], false, false, true, ARRAY['mri', 'ct', 'ultrasound']);

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES 
('dr.smith@metrohealth.com', '$2b$10$encrypted_password_hash', 'John', 'Smith', '555-1001', 'physician'),
('dr.jones@metrohealth.com', '$2b$10$encrypted_password_hash', 'Sarah', 'Jones', '555-1002', 'physician'),
('dr.wilson@metrohealth.com', '$2b$10$encrypted_password_hash', 'Michael', 'Wilson', '555-1003', 'physician'),
('patient1@email.com', '$2b$10$encrypted_password_hash', 'Emily', 'Johnson', '555-2001', 'patient'),
('patient2@email.com', '$2b$10$encrypted_password_hash', 'Robert', 'Davis', '555-2002', 'patient'),
('staff.north@metrohealth.com', '$2b$10$encrypted_password_hash', 'Lisa', 'Brown', '555-3001', 'staff'),
('staff.west@metrohealth.com', '$2b$10$encrypted_password_hash', 'David', 'Miller', '555-3002', 'staff'),
('admin@metrohealth.com', '$2b$10$encrypted_password_hash', 'Admin', 'User', '555-4001', 'admin');

-- Insert sample physicians
INSERT INTO physicians (user_id, primary_location_id, npi_number, license_number, specialty, subspecialty, languages_spoken, accepts_new_patients, telemedicine_enabled) VALUES 
(1, 1, '1234567890', 'MD123456', 'Internal Medicine', 'Gastroenterology', ARRAY['English', 'Spanish'], true, true),
(2, 3, '1234567891', 'MD123457', 'Cardiology', 'Interventional Cardiology', ARRAY['English'], true, false),
(3, 4, '1234567892', 'MD123458', 'Neurology', 'Stroke Medicine', ARRAY['English', 'French'], true, true);

-- Insert physician location assignments
INSERT INTO physician_locations (physician_id, location_id, is_primary_location, start_date) VALUES 
(1, 1, true, '2024-01-01'),   -- Dr. Smith at Main Hospital
(1, 2, false, '2024-01-01'),  -- Dr. Smith at North Side Clinic
(2, 1, false, '2024-01-01'),  -- Dr. Jones at Main Hospital
(2, 3, true, '2024-01-01'),   -- Dr. Jones at West End (primary)
(2, 4, false, '2024-01-01'),  -- Dr. Jones at Downtown Specialty
(3, 1, false, '2024-01-01'),  -- Dr. Wilson at Main Hospital
(3, 4, true, '2024-01-01');   -- Dr. Wilson at Downtown (primary)

-- Insert sample physician schedules across locations
-- Dr. Smith (Internal Medicine) - Main Hospital Mon/Wed/Fri, North Side Tue/Thu
INSERT INTO physician_location_schedules (physician_id, location_id, day_of_week, start_time, end_time, lunch_start, lunch_end) VALUES 
(1, 1, 1, '08:00', '17:00', '12:00', '13:00'), -- Monday at Main Hospital
(1, 1, 3, '08:00', '17:00', '12:00', '13:00'), -- Wednesday at Main Hospital
(1, 1, 5, '08:00', '17:00', '12:00', '13:00'), -- Friday at Main Hospital
(1, 2, 2, '09:00', '16:00', '12:00', '13:00'), -- Tuesday at North Side
(1, 2, 4, '09:00', '16:00', '12:00', '13:00'); -- Thursday at North Side

-- Dr. Jones (Cardiology) - West End Mon/Tue, Downtown Wed/Thu, Main Hospital Fri
INSERT INTO physician_location_schedules (physician_id, location_id, day_of_week, start_time, end_time, lunch_start, lunch_end) VALUES 
(2, 3, 1, '07:00', '15:00', '12:00', '13:00'), -- Monday at West End
(2, 3, 2, '07:00', '15:00', '12:00', '13:00'), -- Tuesday at West End
(2, 4, 3, '08:00', '16:00', '12:00', '13:00'), -- Wednesday at Downtown
(2, 4, 4, '08:00', '16:00', '12:00', '13:00'), -- Thursday at Downtown
(2, 1, 5, '08:00', '16:00', '12:00', '13:00'); -- Friday at Main Hospital

-- Dr. Wilson (Neurology) - Downtown Mon/Wed/Fri, Main Hospital Tue/Thu
INSERT INTO physician_location_schedules (physician_id, location_id, day_of_week, start_time, end_time, lunch_start, lunch_end) VALUES 
(3, 4, 1, '06:00', '14:00', '11:30', '12:30'), -- Monday at Downtown
(3, 4, 3, '06:00', '14:00', '11:30', '12:30'), -- Wednesday at Downtown
(3, 4, 5, '06:00', '14:00', '11:30', '12:30'), -- Friday at Downtown
(3, 1, 2, '10:00', '18:00', '13:00', '14:00'), -- Tuesday at Main Hospital
(3, 1, 4, '10:00', '18:00', '13:00', '14:00'); -- Thursday at Main Hospital

-- Insert sample patients
INSERT INTO patients (user_id, patient_id, date_of_birth, gender, preferred_location_id, insurance_primary_provider, insurance_primary_id, allergies) VALUES 
(4, 'MH001234', '1985-05-15', 'Female', 2, 'Blue Cross Blue Shield', 'BC123456789', ARRAY['Penicillin']),
(5, 'MH001235', '1978-12-03', 'Male', 3, 'Aetna', 'AET987654321', ARRAY[]);

-- Insert sample location resources
INSERT INTO location_resources (location_id, resource_type, resource_name, resource_number, equipment_list) VALUES 
(1, 'exam_room', 'Cardiology Suite A', 'C-101', ARRAY['ECG Machine', 'Echocardiogram', 'Stress Test Equipment']),
(1, 'exam_room', 'Internal Medicine Room', 'IM-201', ARRAY['Examination Table', 'Blood Pressure Monitor', 'Scale']),
(2, 'exam_room', 'Family Practice Room 1', 'FP-01', ARRAY['Examination Table', 'Otoscope', 'Stethoscope']),
(3, 'procedure_room', 'Cardiac Catheterization Lab', 'CCL-1', ARRAY['Catheterization Equipment', 'Imaging System', 'Monitoring Equipment']),
(4, 'exam_room', 'Neurology Consultation Room', 'NC-301', ARRAY['Neurological Testing Equipment', 'EEG Machine']);

-- Insert sample location settings
INSERT INTO location_settings (location_id, setting_name, setting_value, setting_type, description) VALUES 
(1, 'appointment_buffer_time', '15', 'number', 'Minutes between appointments'),
(1, 'max_daily_appointments', '40', 'number', 'Maximum appointments per day'),
(2, 'appointment_buffer_time', '10', 'number', 'Minutes between appointments'),
(2, 'walk_in_appointments', 'true', 'boolean', 'Allow walk-in appointments'),
(3, 'online_booking_enabled', 'true', 'boolean', 'Enable online booking'),
(4, 'specialty_only', 'true', 'boolean', 'Only specialty appointments allowed');

-- Create views for common queries
CREATE VIEW physician_location_availability AS
SELECT 
    p.id as physician_id,
    u.first_name || ' ' || u.last_name as physician_name,
    p.specialty,
    l.id as location_id,
    l.name as location_name,
    l.city,
    pls.day_of_week,
    pls.start_time,
    pls.end_time,
    pls.lunch_start,
    pls.lunch_end
FROM physicians p
JOIN users u ON p.user_id = u.id
JOIN physician_location_schedules pls ON p.id = pls.physician_id
JOIN locations l ON pls.location_id = l.id
WHERE p.is_active = true AND l.is_active = true AND pls.is_active = true;

CREATE VIEW location_summary AS
SELECT 
    l.id,
    l.name,
    l.location_type,
    l.city,
    l.state,
    hs.name as hospital_system_name,
    COUNT(DISTINCT pl.physician_id) as physician_count,
    COUNT(DISTINCT lr.id) as resource_count,
    l.emergency_services,
    l.pharmacy_onsite,
    l.lab_services
FROM locations l
JOIN hospital_systems hs ON l.hospital_system_id = hs.id
LEFT JOIN physician_locations pl ON l.id = pl.location_id
LEFT JOIN location_resources lr ON l.id = lr.location_id
WHERE l.is_active = true
GROUP BY l.id, l.name, l.location_type, l.city, l.state, hs.name, l.emergency_services, l.pharmacy_onsite, l.lab_services;

-- Functions for complex queries
CREATE OR REPLACE FUNCTION get_physician_availability(
    p_physician_id INTEGER,
    p_date DATE,
    p_location_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    location_id INTEGER,
    location_name VARCHAR,
    available_slots TIME[]
) AS $$
BEGIN
    -- This function would calculate available time slots
    -- Implementation would check existing appointments and return available times
    RETURN QUERY
    SELECT 
        l.id::INTEGER,
        l.name::VARCHAR,
        ARRAY[]::TIME[] -- Placeholder - would contain actual available slots
    FROM locations l
    JOIN physician_locations pl ON l.id = pl.location_id
    WHERE pl.physician_id = p_physician_id
    AND (p_location_id IS NULL OR l.id = p_location_id);
END;
$$ LANGUAGE plpgsql;