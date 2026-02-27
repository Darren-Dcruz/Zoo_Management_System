 // routes/tickets.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all tickets (with visitor info)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        t.TICKET_ID, t.VISIT_DATE, t.TICKET_TYPE, t.PRICE,
        v.NAME AS visitor_name, v.MEMBERSHIP_TYPE
      FROM tickets t
      JOIN visitors v ON t.VISITORS_ID = v.VISITORS_ID
      ORDER BY t.TICKET_ID
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET one ticket
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM tickets WHERE TICKET_ID = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;


// POST - Create a new ticket
// Expected JSON body example:
// {
//   "visitors_id": 1,             ← must exist in visitors table
//   "visit_date": "2025-03-15",
//   "ticket_type": "Adult",
//   "price": 150.00
// }
router.post('/', async (req, res) => {
  const { visitors_id, visit_date, ticket_type, price } = req.body;

  // Required fields validation
  if (!visitors_id || !visit_date || !ticket_type || price == null) {
    return res.status(400).json({
      error: 'Missing required fields: visitors_id, visit_date, ticket_type, price'
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO tickets (VISITORS_ID, VISIT_DATE, TICKET_TYPE, PRICE)
       VALUES (?, ?, ?, ?)`,
      [visitors_id, visit_date, ticket_type, price]
    );

    // Fetch the newly created ticket
    const [newTicket] = await db.query(
      `SELECT 
         t.*, 
         v.NAME AS visitor_name, 
         v.MEMBERSHIP_TYPE
       FROM tickets t
       JOIN visitors v ON t.VISITORS_ID = v.VISITORS_ID
       WHERE t.TICKET_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket: newTicket[0]
    });
  } catch (err) {
    console.error('Error creating ticket:', err);

    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({
        error: 'Invalid visitors_id - this visitor does not exist'
      });
    }

    res.status(500).json({
      error: 'Database error',
      details: err.message
    });
  }
});