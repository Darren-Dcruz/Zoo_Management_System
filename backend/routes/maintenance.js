// routes/maintenance.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        m.*, 
        e.ENCLOSURE_NAME, 
        s.NAME AS staff_name
      FROM maintenance m
      JOIN enclosure e ON m.ENCLOSURE_ID = e.ENCLOSURE_ID
      JOIN staff s ON m.STAFF_ID = s.STAFF_ID
      ORDER BY m.MAINTENANCE_ID
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;