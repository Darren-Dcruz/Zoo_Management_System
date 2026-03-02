# Zoo Management System

A full-stack DBMS mini project for managing zoo data with a custom frontend and live CRUD operations connected to MySQL.

## Live Links

- Frontend (GitHub Pages):  
  https://darren-dcruz.github.io/Zoo_Management_System/
- Backend API (Railway):  
  https://zoomanagementsystem-production.up.railway.app
- Backend Health Check:  
  https://zoomanagementsystem-production.up.railway.app/api/health

## Deployment Architecture

- Frontend is hosted on **GitHub Pages** from the `docs/` folder (`main` branch).
- Backend is hosted on **Railway** as a Node.js service.
- Database is hosted on **Railway MySQL**.
- Backend and MySQL communicate on Railway private network using:
  - `DB_HOST=mysql.railway.internal`
  - `DB_PORT=3306`

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript (single-page behavior with hash routing)
- Backend: Node.js, Express.js
- Database: MySQL
- DB Driver: `mysql2`
- Other backend packages: `dotenv`, `cors`
- Hosting: GitHub Pages (frontend), Railway (backend + MySQL)

## Core Features

- Jungle-themed UI with landing page and dashboard
- Dynamic table navigation based on database metadata
- CRUD support for all configured tables
- Generic admin API that reads schema from `information_schema`
- Row-level actions:
  - Add
  - Edit
  - Delete
- Health endpoint for deployment verification

## Database Tables Covered

- `animals`
- `departments`
- `enclosure`
- `maintenance`
- `medical_records`
- `species`
- `staff`
- `tickets`
- `visitors`

## API Overview

Base URL:
`/api/admin` (or Railway full URL when frontend is on GitHub Pages)

Main endpoints:
- `GET /api/health`
- `GET /api/admin/meta`
- `GET /api/admin/table/:table`
- `POST /api/admin/table/:table`
- `PUT /api/admin/table/:table/:id`
- `DELETE /api/admin/table/:table/:id`

## Project Structure

- `frontend/` -> source frontend used by backend static serving
- `docs/` -> GitHub Pages frontend build copy
- `backend/` -> Express API, DB config, routes
- `backend/routes/admin.js` -> schema-driven generic CRUD routes
- `backend/config/db.js` -> MySQL connection and env resolution

## Environment Variables (Backend)

Set in Railway service variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`

The backend also supports provider-style fallbacks:
- `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- `MYSQL_URL` or `DATABASE_URL`

## Local Development

1. Install dependencies:
   - `npm install`
2. Start backend:
   - `npm start`
3. Dev mode:
   - `npm run dev`
4. Open local app:
   - `http://localhost:5000`

## Deployment Notes

1. Push code to GitHub.
2. GitHub Pages serves `docs/` from `main`.
3. Railway deploys backend service from same repo.
4. Railway MySQL holds production data.
5. Frontend calls Railway backend API.

## Data Migration Used

Local DB data can be exported and imported to Railway MySQL:

- Export:
  - `mysqldump -u root -p --no-create-db zoo_management > zoo_management.sql`
- Import:
  - `mysql -h <RAILWAY_PUBLIC_HOST> -P <RAILWAY_PUBLIC_PORT> -u <RAILWAY_USER> -p --protocol=TCP railway < zoo_management.sql`

## Troubleshooting

- If frontend loads but table actions do not work, check browser console for API/DNS errors.
- If Railway backend is running but not reachable on a device, test DNS resolution and network DNS settings.
- If updates appear in frontend but not local MySQL Workbench, confirm you are connected to Railway MySQL (not local MySQL).

## Contributors

- [Shreya Elizabeth Joseph](https://github.com/hackershay/)
- [P Kamuel Shawn](https://github.com/KamuelShawn/)
- [Darren Samuel D'cruz](https://github.com/Darren-Dcruz/)
- [Joel Jacob Roji](https://github.com/JoelJacobRoji/)
