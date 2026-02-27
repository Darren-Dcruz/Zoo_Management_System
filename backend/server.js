const express = require('express');
const cors = require('cors');
const path = require('path');

const animalsRouter = require('./routes/animals');
const visitorsRouter = require('./routes/visitors');
const ticketsRouter = require('./routes/tickets');
const staffRouter = require('./routes/staff');
const medicalRouter = require('./routes/medical_records');
const maintenanceRouter = require('./routes/maintenance');
const adminRouter = require('./routes/admin');

const app = express();

app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
  }),
);
app.use(express.json());

app.use('/api/animals', animalsRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/medical-records', medicalRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ message: 'Zoo Management Backend is running' });
});

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  return res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
