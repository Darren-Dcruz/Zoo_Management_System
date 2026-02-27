// routes/animals.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all animals (with joined data) ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.ANIMAL_ID, a.ANIMAL_NAME, a.GENDER, 
        DATE_FORMAT(a.ACQUISITION_DATE, '%Y-%m-%d') AS acquisition_date,
        DATE_FORMAT(a.DATE_OF_BIRTH, '%Y-%m-%d')     AS date_of_birth,
        s.COMMON_NAME, s.SCIENTIFIC_NAME,
        e.ENCLOSURE_NAME, e.LOCATION
      FROM animals a
      JOIN species s ON a.SPECIES_ID = s.SPECIES_ID
      JOIN enclosure e ON a.ENCLOSURE_ID = e.ENCLOSURE_ID
      ORDER BY a.ANIMAL_ID
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /animals error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET single animal ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.*,
        DATE_FORMAT(a.ACQUISITION_DATE, '%Y-%m-%d') AS acquisition_date,
        DATE_FORMAT(a.DATE_OF_BIRTH, '%Y-%m-%d')     AS date_of_birth,
        s.COMMON_NAME, s.SCIENTIFIC_NAME,
        e.ENCLOSURE_NAME, e.LOCATION
      FROM animals a
      JOIN species s ON a.SPECIES_ID = s.SPECIES_ID
      JOIN enclosure e ON a.ENCLOSURE_ID = e.ENCLOSURE_ID
      WHERE a.ANIMAL_ID = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /animals/:id error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST new animal ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    species_id,
    enclosure_id,
    animal_name,
    gender,
    acquisition_date,
    date_of_birth
  } = req.body;

  if (!species_id || !enclosure_id || !animal_name || !gender || !acquisition_date) {
    return res.status(400).json({
      error: 'Missing required fields: species_id, enclosure_id, animal_name, gender, acquisition_date'
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO animals 
       (SPECIES_ID, ENCLOSURE_ID, ANIMAL_NAME, GENDER, ACQUISITION_DATE, DATE_OF_BIRTH)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [species_id, enclosure_id, animal_name, gender, acquisition_date, date_of_birth || null]
    );

    // Return full created record with joins (same as GET)
    const [newAnimal] = await db.query(`
      SELECT 
        a.ANIMAL_ID, a.ANIMAL_NAME, a.GENDER, 
        DATE_FORMAT(a.ACQUISITION_DATE, '%Y-%m-%d') AS acquisition_date,
        DATE_FORMAT(a.DATE_OF_BIRTH, '%Y-%m-%d')     AS date_of_birth,
        s.COMMON_NAME, s.SCIENTIFIC_NAME,
        e.ENCLOSURE_NAME, e.LOCATION
      FROM animals a
      JOIN species s ON a.SPECIES_ID = s.SPECIES_ID
      JOIN enclosure e ON a.ENCLOSURE_ID = e.ENCLOSURE_ID
      WHERE a.ANIMAL_ID = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Animal created successfully',
      animal: newAnimal[0]
    });
  } catch (err) {
    console.error('POST /animals error:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ error: 'Invalid species_id or enclosure_id' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// ← You can add PUT and DELETE later when needed
// Example skeleton for completeness:
// router.put('/:id', async (req, res) => { ... });
// router.delete('/:id', async (req, res) => { ... });

module.exports = router;