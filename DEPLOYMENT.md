# Zoo Management System - GitHub + Public Hosting

This project is configured so one Node.js service serves both:
- backend API (`/api/*`)
- frontend static files (`/`)

## 1) Push to GitHub

Run these commands from project root:

```powershell
git add .
git commit -m "Add full-stack frontend, generic CRUD API, and deployment setup"
git branch -M main
git remote add origin https://github.com/Darren-Dcruz/Zoo_Management_System.git
git push -u origin main
```

If remote already exists:

```powershell
git remote set-url origin https://github.com/Darren-Dcruz/Zoo_Management_System.git
git push -u origin main
```

## 2) Create a hosted MySQL database

Use Railway MySQL (recommended for this repo layout), Aiven, PlanetScale, or any public MySQL provider.

If using Railway MySQL service in the same project, it provides:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`
- `MYSQL_URL`

## 3) Move your local DB to hosted MySQL

Export local DB:

```powershell
mysqldump -u root -p zoo_management > zoo_management.sql
```

Import into hosted DB:

```powershell
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < zoo_management.sql
```

## 4) Deploy app publicly on Railway

1. Log in to Railway.
2. Create a new project.
3. Select "Deploy from GitHub repo".
4. Choose `Darren-Dcruz/Zoo_Management_System`.
5. Add a MySQL service (`+ New` -> Database -> MySQL).
6. In your app service variables, add:
   - `DB_HOST=${{MySQL.MYSQLHOST}}`
   - `DB_USER=${{MySQL.MYSQLUSER}}`
   - `DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}`
   - `DB_NAME=${{MySQL.MYSQLDATABASE}}`
   - `PORT=5000`
   Replace `MySQL` with your actual DB service name if different.
7. Deploy.
8. In app service Settings -> Networking -> Generate Domain (public URL).

The repo already includes:
- root `package.json` with `start` script
- `railway.json` for deployment command

## 5) Verify public app

After deploy, open:
- `https://<your-domain>/` -> frontend
- `https://<your-domain>/api/health` -> backend health check
- `https://<your-domain>/api/admin/meta` -> DB schema metadata

## 6) Update local env safely

Keep real secrets only in local `backend/.env` and cloud env variables.

Use `backend/.env.example` as template for teammates.

## 7) Pricing note

Railway is usage-based. Check current plans before deploying long term.
