// routes/staff.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, d.DEPARTMENT_NAME 
      FROM staff s
      LEFT JOIN departments d ON s.DEPARTMENT_ID = d.DEPARTMENT_ID
      ORDER BY s.STAFF_ID
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;