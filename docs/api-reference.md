# REST API Reference (v1)

Base URL: `http://localhost:8080/api/v1`

Auth: JWT Bearer token in `Authorization` header for protected routes.

## Auth

- `POST /auth/login` - Login and get JWT
- `POST /auth/verification/send` - Send one-time verification code for registration or password reset
- `POST /auth/register-self` - Self signup with email verification code
- `POST /auth/register` - Register user (`SUPER_ADMIN`)
- `POST /auth/password/forgot` - Send password reset verification code
- `POST /auth/password/reset` - Reset password with verification code
- `POST /auth/social-login` - Social login (`GOOGLE`, `LINKEDIN`)

## Super Admin

- `GET /admin/users` - List users
- `GET /admin/campuses` - List campuses
- `GET /admin/departments` - List departments
- `GET /admin/system-analytics` - Global analytics
- `GET /admin/ai-settings` - Get AI optimization settings
- `POST /admin/ai-settings` - Update AI optimization settings

## College Admin

- `GET /college-admin/dashboard` - College dashboard analytics
- `GET /college-admin/resource-requests` - View resource requests
- `GET /college-admin/conflicts` - View timetable conflicts
- `GET /college-admin/resource-summary` - Resource status summary

## Resources

- `GET /resources/classrooms` - List classrooms
- `GET /resources/laboratories` - List laboratories
- `GET /resources/equipment` - List equipment assets
- `GET /resources/utilization-summary` - Summary widget data
- `POST /resources/classrooms/search` - Search by capacity/tags/time
- `PATCH /resources/classrooms/{id}/status` - Update classroom status (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `PATCH /resources/laboratories/{id}/status` - Update lab status (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `PATCH /resources/equipment/{id}/status` - Update equipment status (`COLLEGE_ADMIN`, `SUPER_ADMIN`)

## Timetable

- `GET /timetable/entries` - List timetable entries
- `POST /timetable/entries` - Create entry (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `GET /timetable/conflicts` - Detect timetable conflicts
- `POST /timetable/generate-ai` - Generate AI timetable (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `GET /timetable/faculty-workload` - Workload chart data
- `GET /timetable/weekly-heatmap` - Weekly heatmap data

## Booking & Requests

- `GET /bookings/requests` - List requests
- `POST /bookings/requests` - Create request
- `POST /bookings/requests/{requestId}/approve` - Approve request (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `POST /bookings/requests/{requestId}/reject` - Reject request (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `GET /bookings/facility` - List facility bookings

## Analytics

- `GET /analytics/dashboard` - Dashboard widget data
- `GET /analytics/system-overview` - Admin summary (`SUPER_ADMIN`, `COLLEGE_ADMIN`)

## AI

- `POST /ai/recommend-resource` - Best-fit resource recommendation
- `GET /ai/detect-conflicts` - AI conflict scan
- `POST /ai/demand-prediction` - Predict resource demand (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `POST /ai/nl-search` - Natural language search
- `POST /ai/generate-timetable` - AI timetable generation (`COLLEGE_ADMIN`, `SUPER_ADMIN`)

## Faculty Portal

- `GET /faculty/timetable` - Faculty-specific timetable
- `POST /faculty/requests` - Submit classroom/lab/equipment request
- `GET /faculty/resource-availability` - Availability summary
- `GET /faculty/materials` - Materials feed

## Student Portal

- `GET /students/timetable` - Student timetable
- `GET /students/classroom-locations` - Room location lookup
- `GET /students/announcements` - Student announcements
- `GET /students/materials` - Study materials

## Announcements & Materials

- `GET /announcements` - List announcements
- `POST /announcements` - Create announcement (`COLLEGE_ADMIN`, `SUPER_ADMIN`)
- `GET /materials` - List study materials
- `POST /materials` - Upload material (`FACULTY`, `COLLEGE_ADMIN`, `SUPER_ADMIN`)

## Activity Logs

- `GET /activity-logs` - List logs (`SUPER_ADMIN`, `COLLEGE_ADMIN`)
- `POST /activity-logs` - Insert log event
