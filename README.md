# Zoo Management System

## Live Deployment
- Backend + integrated frontend (Railway):
  - `https://zoomanagementsystem-production-fad0.up.railway.app/`

## GitHub Pages Frontend (from `main` branch)
This repo includes a `docs/` folder for GitHub Pages publishing.

### Enable Pages
1. Open repo settings: `Settings -> Pages`.
2. Under `Build and deployment`:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
3. Save.

GitHub will generate a public link like:
- `https://darren-dcruz.github.io/Zoo_Management_System/`

The frontend in `docs/` is configured to call the Railway backend API by default.
