// routes/medical_records.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        m.*, 
        a.ANIMAL_NAME, 
        s.NAME AS staff_name
      FROM medical_records m
      JOIN animals a ON m.ANIMAL_ID = a.ANIMAL_ID
      JOIN staff s ON m.STAFF_ID = s.STAFF_ID
      ORDER BY m.RECORD_ID
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;