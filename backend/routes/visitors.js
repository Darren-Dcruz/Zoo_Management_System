 // routes/visitors.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all visitors
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM visitors 
      ORDER BY VISITORS_ID
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET one visitor
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM visitors WHERE VISITORS_ID = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;


// ────────────────────────────────────────────────
// POST - Create a new visitor
// Expected body (JSON):
// {
//   "membership_type": "Regular" | "Premium" | "VIP",
//   "name": "John Doe",
//   "email": "john@example.com",
//   "phone_no": "9876543210"
// }
router.post('/', async (req, res) => {
  const { membership_type, name, email, phone_no } = req.body;

  // Basic validation
  if (!name || !email || !phone_no) {
    return res.status(400).json({ 
      error: 'Missing required fields: name, email, phone_no are required' 
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO visitors (MEMBERSHIP_TYPE, NAME, EMAIL, PHONE_NO)
       VALUES (?, ?, ?, ?)`,
      [membership_type || 'Regular', name, email, phone_no]
    );

    // Get the newly created visitor
    const [newVisitor] = await db.query(
      'SELECT * FROM visitors WHERE VISITORS_ID = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Visitor created successfully',
      visitor: newVisitor[0]
    });
  } catch (err) {
    console.error('Error creating visitor:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Duplicate entry (email or phone may already exist)' });
    } else {
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  }
});

module.exports = router;


// DELETE - Remove a visitor by ID
// Example: DELETE /api/visitors/11
router.delete('/:id', async (req, res) => {
  const visitorId = req.params.id;

  try {
    const [result] = await db.query(
      'DELETE FROM visitors WHERE VISITORS_ID = ?',
      [visitorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    res.json({ message: `Visitor with ID ${visitorId} deleted successfully` });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Cannot delete visitor - they have associated tickets or other records'
      });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});


// PUT - Update visitor
// Example: PUT /api/visitors/1
// Body: { "membership_type": "VIP", "email": "new@email.com" }
// (partial update - only send fields you want to change)
router.put('/:id', async (req, res) => {
  const visitorId = req.params.id;
  const { membership_type, name, email, phone_no } = req.body;

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  try {
    let query = 'UPDATE visitors SET ';
    const values = [];
    const updates = [];

    if (membership_type !== undefined) {
      updates.push('MEMBERSHIP_TYPE = ?');
      values.push(membership_type);
    }
    if (name !== undefined) {
      updates.push('NAME = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('EMAIL = ?');
      values.push(email);
    }
    if (phone_no !== undefined) {
      updates.push('PHONE_NO = ?');
      values.push(phone_no);
    }

    query += updates.join(', ') + ' WHERE VISITORS_ID = ?';
    values.push(visitorId);

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    // Return updated record
    const [updated] = await db.query('SELECT * FROM visitors WHERE VISITORS_ID = ?', [visitorId]);
    res.json({
      message: 'Visitor updated successfully',
      visitor: updated[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});