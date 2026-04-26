CREATE DATABASE IF NOT EXISTS college_opt_platform;
USE college_opt_platform;

CREATE TABLE tenants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE campuses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_campus_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_campus_code UNIQUE (tenant_id, campus_code)
);

CREATE TABLE departments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    dept_code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_department_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_department_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT uq_department_code UNIQUE (campus_id, dept_code)
);

CREATE TABLE roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT,
    department_id BIGINT,
    user_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_user_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT uq_user_email UNIQUE (tenant_id, email),
    CONSTRAINT uq_user_code UNIQUE (tenant_id, user_code)
);

CREATE TABLE user_roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE faculty_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    designation VARCHAR(100),
    max_weekly_hours INT NOT NULL DEFAULT 20,
    specialization VARCHAR(150),
    office_room VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_faculty_profile_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE student_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    semester INT NOT NULL,
    section_name VARCHAR(20),
    advisor_user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_profile_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_student_profile_advisor FOREIGN KEY (advisor_user_id) REFERENCES users(id)
);

CREATE TABLE buildings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    building_code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    floors INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_building_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_building_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT uq_building_code UNIQUE (campus_id, building_code)
);

CREATE TABLE classrooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    building_id BIGINT NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    room_name VARCHAR(120),
    capacity INT NOT NULL,
    has_projector BOOLEAN NOT NULL DEFAULT FALSE,
    has_ac BOOLEAN NOT NULL DEFAULT FALSE,
    has_smart_board BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_classroom_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_classroom_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_classroom_building FOREIGN KEY (building_id) REFERENCES buildings(id),
    CONSTRAINT uq_classroom_room UNIQUE (building_id, room_number)
);

CREATE TABLE classroom_features (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    classroom_id BIGINT NOT NULL,
    feature_key VARCHAR(80) NOT NULL,
    feature_value VARCHAR(120),
    CONSTRAINT fk_classroom_feature_room FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT uq_classroom_feature UNIQUE (classroom_id, feature_key)
);

CREATE TABLE laboratories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    building_id BIGINT NOT NULL,
    lab_code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    lab_type VARCHAR(80) NOT NULL,
    capacity INT NOT NULL,
    has_projector BOOLEAN NOT NULL DEFAULT FALSE,
    has_ac BOOLEAN NOT NULL DEFAULT FALSE,
    has_smart_board BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lab_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_lab_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_lab_building FOREIGN KEY (building_id) REFERENCES buildings(id),
    CONSTRAINT uq_lab_code UNIQUE (campus_id, lab_code)
);

CREATE TABLE equipment_categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    category_name VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT fk_equipment_category_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_equipment_category UNIQUE (tenant_id, category_name)
);

CREATE TABLE equipment_assets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    asset_tag VARCHAR(80) NOT NULL,
    asset_name VARCHAR(150) NOT NULL,
    serial_number VARCHAR(120),
    status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
    purchase_date DATE,
    warranty_expiry DATE,
    assigned_lab_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipment_asset_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_equipment_asset_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_equipment_asset_category FOREIGN KEY (category_id) REFERENCES equipment_categories(id),
    CONSTRAINT fk_equipment_asset_lab FOREIGN KEY (assigned_lab_id) REFERENCES laboratories(id),
    CONSTRAINT uq_equipment_asset_tag UNIQUE (tenant_id, asset_tag)
);

CREATE TABLE lab_equipment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    lab_id BIGINT NOT NULL,
    equipment_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    allocated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lab_equipment_lab FOREIGN KEY (lab_id) REFERENCES laboratories(id),
    CONSTRAINT fk_lab_equipment_equipment FOREIGN KEY (equipment_id) REFERENCES equipment_assets(id),
    CONSTRAINT uq_lab_equipment UNIQUE (lab_id, equipment_id)
);

CREATE TABLE equipment_maintenance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    equipment_id BIGINT NOT NULL,
    issue_title VARCHAR(180) NOT NULL,
    issue_description TEXT,
    maintenance_status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    assigned_to_user_id BIGINT,
    CONSTRAINT fk_maintenance_equipment FOREIGN KEY (equipment_id) REFERENCES equipment_assets(id),
    CONSTRAINT fk_maintenance_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
);

CREATE TABLE academic_terms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    campus_id BIGINT NOT NULL,
    term_name VARCHAR(80) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_term_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT uq_term_name UNIQUE (campus_id, term_name)
);

CREATE TABLE courses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_id BIGINT NOT NULL,
    course_code VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    credits INT NOT NULL DEFAULT 3,
    requires_lab BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT uq_course_code UNIQUE (department_id, course_code)
);

CREATE TABLE course_sections (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    term_id BIGINT NOT NULL,
    section_code VARCHAR(20) NOT NULL,
    expected_students INT NOT NULL,
    assigned_classroom_id BIGINT NULL,
    assigned_lab_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_section_course FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT fk_section_term FOREIGN KEY (term_id) REFERENCES academic_terms(id),
    CONSTRAINT fk_section_classroom FOREIGN KEY (assigned_classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_section_lab FOREIGN KEY (assigned_lab_id) REFERENCES laboratories(id),
    CONSTRAINT uq_section_code UNIQUE (course_id, term_id, section_code)
);

CREATE TABLE faculty_availability (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    faculty_user_id BIGINT NOT NULL,
    term_id BIGINT NOT NULL,
    day_of_week VARCHAR(15) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_faculty_avail_user FOREIGN KEY (faculty_user_id) REFERENCES users(id),
    CONSTRAINT fk_faculty_avail_term FOREIGN KEY (term_id) REFERENCES academic_terms(id)
);

CREATE TABLE time_slots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    campus_id BIGINT NOT NULL,
    day_of_week VARCHAR(15) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_label VARCHAR(50),
    CONSTRAINT fk_slot_campus FOREIGN KEY (campus_id) REFERENCES campuses(id)
);

CREATE TABLE timetable_entries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    section_id BIGINT NOT NULL,
    faculty_user_id BIGINT NOT NULL,
    slot_id BIGINT NOT NULL,
    classroom_id BIGINT NULL,
    lab_id BIGINT NULL,
    timetable_status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_timetable_section FOREIGN KEY (section_id) REFERENCES course_sections(id),
    CONSTRAINT fk_timetable_faculty FOREIGN KEY (faculty_user_id) REFERENCES users(id),
    CONSTRAINT fk_timetable_slot FOREIGN KEY (slot_id) REFERENCES time_slots(id),
    CONSTRAINT fk_timetable_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_timetable_lab FOREIGN KEY (lab_id) REFERENCES laboratories(id)
);

CREATE TABLE resource_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    requester_user_id BIGINT NOT NULL,
    request_type VARCHAR(40) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    requested_for_date DATE NOT NULL,
    requested_start_time TIME,
    requested_end_time TIME,
    reason VARCHAR(255),
    request_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    approved_by_user_id BIGINT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_request_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_request_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_request_requester FOREIGN KEY (requester_user_id) REFERENCES users(id),
    CONSTRAINT fk_request_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

CREATE TABLE resource_request_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    classroom_id BIGINT NULL,
    lab_id BIGINT NULL,
    equipment_id BIGINT NULL,
    quantity INT NOT NULL DEFAULT 1,
    notes VARCHAR(255),
    CONSTRAINT fk_request_item_request FOREIGN KEY (request_id) REFERENCES resource_requests(id),
    CONSTRAINT fk_request_item_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    CONSTRAINT fk_request_item_lab FOREIGN KEY (lab_id) REFERENCES laboratories(id),
    CONSTRAINT fk_request_item_equipment FOREIGN KEY (equipment_id) REFERENCES equipment_assets(id)
);

CREATE TABLE facility_bookings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id BIGINT NULL,
    booked_by_user_id BIGINT NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id BIGINT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    booking_status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_request FOREIGN KEY (request_id) REFERENCES resource_requests(id),
    CONSTRAINT fk_booking_user FOREIGN KEY (booked_by_user_id) REFERENCES users(id)
);

CREATE TABLE announcements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    campus_id BIGINT NOT NULL,
    department_id BIGINT NULL,
    created_by_user_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    audience_scope VARCHAR(30) NOT NULL DEFAULT 'ALL',
    published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    CONSTRAINT fk_announcement_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_announcement_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_announcement_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE study_materials (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    section_id BIGINT NOT NULL,
    uploaded_by_user_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description VARCHAR(255),
    file_url VARCHAR(255) NOT NULL,
    material_type VARCHAR(40) NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_material_section FOREIGN KEY (section_id) REFERENCES course_sections(id),
    CONSTRAINT fk_material_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
);

CREATE TABLE activity_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NULL,
    user_id BIGINT NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80),
    entity_id BIGINT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_activity_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE ai_insights (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    created_by_user_id BIGINT NULL,
    insight_type VARCHAR(50) NOT NULL,
    input_query TEXT,
    output_payload JSON NOT NULL,
    confidence_score DECIMAL(5,2),
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_insight_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_ai_insight_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_ai_insight_user FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE utilization_snapshots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    campus_id BIGINT NOT NULL,
    department_id BIGINT NULL,
    snapshot_date DATE NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id BIGINT NULL,
    utilization_percent DECIMAL(5,2) NOT NULL,
    total_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
    idle_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_utilization_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_utilization_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
    CONSTRAINT fk_utilization_department FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE bookings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    resource_id BIGINT NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    approved_by BIGINT NULL,
    approved_at TIMESTAMP NULL,
    remarks VARCHAR(255),
    priority_level VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    approval_stage VARCHAR(30) NOT NULL DEFAULT 'COLLEGE_ADMIN',
    recurring_pattern VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_booking_approver FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE booking_approval_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    approval_stage VARCHAR(30) NOT NULL,
    action VARCHAR(30) NOT NULL,
    actor_user_id BIGINT NOT NULL,
    actor_name VARCHAR(120) NOT NULL,
    remarks VARCHAR(255),
    action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_history_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT fk_booking_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE booking_notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(255) NOT NULL,
    notification_type VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_notification_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_tenant_campus ON users (tenant_id, campus_id);
CREATE INDEX idx_classroom_status ON classrooms (campus_id, status, capacity);
CREATE INDEX idx_lab_status ON laboratories (campus_id, status, capacity);
CREATE INDEX idx_equipment_status ON equipment_assets (campus_id, status);
CREATE INDEX idx_timetable_slot ON timetable_entries (slot_id, classroom_id, lab_id);
CREATE INDEX idx_requests_status ON resource_requests (campus_id, request_status, requested_for_date);
CREATE INDEX idx_bookings_resource ON facility_bookings (resource_type, resource_id, booking_date);
CREATE INDEX idx_activity_created_at ON activity_logs (tenant_id, created_at);
CREATE INDEX idx_ai_insight_type ON ai_insights (campus_id, insight_type, generated_at);
CREATE INDEX idx_utilization_date ON utilization_snapshots (campus_id, snapshot_date, resource_type);
CREATE INDEX idx_booking_slot ON bookings (resource_id, booking_date, start_time, end_time, status);
CREATE INDEX idx_booking_user_status ON bookings (user_id, status, booking_date);

INSERT INTO roles (role_name, description) VALUES
('SUPER_ADMIN', 'Global platform owner with full control'),
('COLLEGE_ADMIN', 'Campus and department operations manager'),
('FACULTY', 'Faculty user with timetable and request permissions'),
('STUDENT', 'Student user with read-only timetable and materials access');
