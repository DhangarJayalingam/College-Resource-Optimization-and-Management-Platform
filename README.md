# College Resource Optimization and Management Platform

AI-powered full-stack SaaS platform for universities to optimize classrooms, laboratories, faculty schedules, equipment, and campus facilities.

## Tech Stack

- Frontend: React + TypeScript + TailwindCSS + Recharts + DnD Kit
- Backend: Spring Boot 3 + Spring Security (JWT) + Validation
- Database: MySQL (30-table schema)
- Auth: JWT + role-based access control

## Role Coverage

- `SUPER_ADMIN`: global governance, users, campuses, analytics, AI settings
- `COLLEGE_ADMIN`: resources, approvals, timetable generation, campus analytics
- `FACULTY`: timetable access, resource requests, material management
- `STUDENT`: timetable, room lookup, announcements, study materials

## Core Platform Capabilities

- Classroom/lab/equipment availability and status tracking
- Drag-and-drop timetable UI + AI timetable generation APIs
- Conflict detection (faculty, room, lab clashes)
- Resource request and booking approval workflows
- Analytics dashboard with utilization, workload, heatmap, idle detection
- Natural-language resource search and AI resource recommendations
- Demand prediction API for capacity planning

## Repository Structure

- `backend/` - Spring Boot API server
- `frontend/` - React dashboard client
- `database/schema.sql` - MySQL schema (30 tables)
- `docs/architecture.md` - system architecture
- `docs/api-reference.md` - REST endpoint catalog

## Quick Start

### 1) Database

1. Start MySQL
2. Run: `database/schema.sql`

### 2) Backend

```bash
cd backend
mvn spring-boot:run
```

Backend URL: `http://localhost:8080`

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

Optional env for frontend API target:

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## Demo Credentials

- Super Admin: `superadmin@collegeopt.com` / `SuperAdmin@123`
- College Admin: `admin@collegeopt.com` / `CollegeAdmin@123`
- Faculty: `faculty@collegeopt.com` / `Faculty@123`
- Student: `student@collegeopt.com` / `Student@123`

## Security Implemented

- JWT access tokens
- Role-based endpoint authorization
- Input validation with Jakarta Validation
- Activity log module for auditable actions

## AI Modules Implemented

- AI timetable generation endpoint
- AI conflict detection endpoint
- AI resource recommendation endpoint
- AI demand prediction endpoint
- Natural language resource search endpoint

## Notes

- Current backend persistence layer is scaffolded in-memory for fast prototyping of API behavior.
- Production hardening next step: map all services to JPA repositories using the provided MySQL schema and add migration scripts.
