const express = require('express');
const router = express.Router();
const db = require('../config/db');

const TABLE_WHITELIST = new Set([
  'animals',
  'departments',
  'enclosure',
  'maintenance',
  'medical_records',
  'species',
  'staff',
  'tickets',
  'visitors',
]);

function quoteIdentifier(identifier) {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

async function loadSchema() {
  const [columns] = await db.query(
    `
      SELECT
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.COLUMN_TYPE,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_KEY,
        c.EXTRA,
        c.COLUMN_DEFAULT,
        k.REFERENCED_TABLE_NAME,
        k.REFERENCED_COLUMN_NAME
      FROM information_schema.COLUMNS c
      LEFT JOIN information_schema.KEY_COLUMN_USAGE k
        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
       AND c.TABLE_NAME = k.TABLE_NAME
       AND c.COLUMN_NAME = k.COLUMN_NAME
       AND k.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_SCHEMA = DATABASE()
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `,
  );

  const schema = {};

  for (const column of columns) {
    if (!TABLE_WHITELIST.has(column.TABLE_NAME)) {
      continue;
    }

    if (!schema[column.TABLE_NAME]) {
      schema[column.TABLE_NAME] = {
        tableName: column.TABLE_NAME,
        primaryKey: null,
        columns: [],
      };
    }

    const columnMeta = {
      name: column.COLUMN_NAME,
      columnType: column.COLUMN_TYPE,
      dataType: column.DATA_TYPE,
      isNullable: column.IS_NULLABLE === 'YES',
      isPrimary: column.COLUMN_KEY === 'PRI',
      isAutoIncrement: column.EXTRA.includes('auto_increment'),
      defaultValue: column.COLUMN_DEFAULT,
      referencedTable: column.REFERENCED_TABLE_NAME,
      referencedColumn: column.REFERENCED_COLUMN_NAME,
    };

    if (columnMeta.isPrimary) {
      schema[column.TABLE_NAME].primaryKey = columnMeta.name;
    }

    schema[column.TABLE_NAME].columns.push(columnMeta);
  }

  return schema;
}

function normalizeValue(value) {
  if (value === '') {
    return null;
  }
  return value;
}

function handleDbError(res, error, fallbackMessage) {
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ error: 'Invalid foreign key reference.', details: error.message });
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint.', details: error.message });
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({
      error: 'Cannot delete or update this row because dependent records exist.',
      details: error.message,
    });
  }
  return res.status(500).json({ error: fallbackMessage, details: error.message });
}

router.get('/meta', async (_req, res) => {
  try {
    const schema = await loadSchema();
    const tables = Object.values(schema).sort((a, b) =>
      a.tableName.localeCompare(b.tableName),
    );
    res.json({ tables });
  } catch (error) {
    console.error('GET /api/admin/meta error:', error);
    res.status(500).json({ error: 'Failed to load schema metadata.' });
  }
});

router.get('/table/:table', async (req, res) => {
  const { table } = req.params;

  try {
    const schema = await loadSchema();
    const tableMeta = schema[table];

    if (!tableMeta) {
      return res.status(404).json({ error: `Unknown table: ${table}` });
    }

    const tableName = quoteIdentifier(tableMeta.tableName);
    const orderBy = tableMeta.primaryKey
      ? ` ORDER BY ${quoteIdentifier(tableMeta.primaryKey)}`
      : '';

    const [rows] = await db.query(`SELECT * FROM ${tableName}${orderBy}`);
    res.json({ rows });
  } catch (error) {
    console.error(`GET /api/admin/table/${table} error:`, error);
    handleDbError(res, error, 'Failed to fetch table rows.');
  }
});

router.post('/table/:table', async (req, res) => {
  const { table } = req.params;
  const payload = req.body || {};

  try {
    const schema = await loadSchema();
    const tableMeta = schema[table];

    if (!tableMeta) {
      return res.status(404).json({ error: `Unknown table: ${table}` });
    }

    const columnMap = new Map(tableMeta.columns.map((col) => [col.name, col]));
    const insertColumns = [];
    const insertValues = [];
    const placeholders = [];

    for (const [key, rawValue] of Object.entries(payload)) {
      const column = columnMap.get(key);
      if (!column || column.isAutoIncrement) {
        continue;
      }
      insertColumns.push(quoteIdentifier(column.name));
      insertValues.push(normalizeValue(rawValue));
      placeholders.push('?');
    }

    for (const column of tableMeta.columns) {
      const hasValue = Object.prototype.hasOwnProperty.call(payload, column.name);
      if (
        !column.isNullable &&
        !column.isAutoIncrement &&
        column.defaultValue === null &&
        !hasValue
      ) {
        return res.status(400).json({ error: `Missing required field: ${column.name}` });
      }
    }

    if (insertColumns.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for insert.' });
    }

    const [result] = await db.query(
      `INSERT INTO ${quoteIdentifier(tableMeta.tableName)} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      insertValues,
    );

    const pk = tableMeta.primaryKey;
    let pkValue = null;

    if (pk) {
      const pkMeta = columnMap.get(pk);
      if (pkMeta && pkMeta.isAutoIncrement) {
        pkValue = result.insertId;
      } else if (Object.prototype.hasOwnProperty.call(payload, pk)) {
        pkValue = payload[pk];
      }
    }

    if (!pk || pkValue === null || pkValue === undefined) {
      return res.status(201).json({
        message: 'Row created successfully.',
        affectedRows: result.affectedRows,
      });
    }

    const [createdRows] = await db.query(
      `SELECT * FROM ${quoteIdentifier(tableMeta.tableName)} WHERE ${quoteIdentifier(pk)} = ?`,
      [pkValue],
    );

    res.status(201).json({
      message: 'Row created successfully.',
      row: createdRows[0] || null,
    });
  } catch (error) {
    console.error(`POST /api/admin/table/${table} error:`, error);
    handleDbError(res, error, 'Failed to create row.');
  }
});

router.put('/table/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const payload = req.body || {};

  try {
    const schema = await loadSchema();
    const tableMeta = schema[table];

    if (!tableMeta) {
      return res.status(404).json({ error: `Unknown table: ${table}` });
    }
    if (!tableMeta.primaryKey) {
      return res.status(400).json({ error: `Table ${table} has no primary key.` });
    }

    const columnMap = new Map(tableMeta.columns.map((col) => [col.name, col]));
    const updates = [];
    const values = [];

    for (const [key, rawValue] of Object.entries(payload)) {
      const column = columnMap.get(key);
      if (!column || column.isPrimary) {
        continue;
      }
      updates.push(`${quoteIdentifier(column.name)} = ?`);
      values.push(normalizeValue(rawValue));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE ${quoteIdentifier(tableMeta.tableName)} SET ${updates.join(', ')} WHERE ${quoteIdentifier(tableMeta.primaryKey)} = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Row not found.' });
    }

    const [updatedRows] = await db.query(
      `SELECT * FROM ${quoteIdentifier(tableMeta.tableName)} WHERE ${quoteIdentifier(tableMeta.primaryKey)} = ?`,
      [id],
    );

    res.json({
      message: 'Row updated successfully.',
      row: updatedRows[0] || null,
    });
  } catch (error) {
    console.error(`PUT /api/admin/table/${table}/${id} error:`, error);
    handleDbError(res, error, 'Failed to update row.');
  }
});

router.delete('/table/:table/:id', async (req, res) => {
  const { table, id } = req.params;

  try {
    const schema = await loadSchema();
    const tableMeta = schema[table];

    if (!tableMeta) {
      return res.status(404).json({ error: `Unknown table: ${table}` });
    }
    if (!tableMeta.primaryKey) {
      return res.status(400).json({ error: `Table ${table} has no primary key.` });
    }

    const [result] = await db.query(
      `DELETE FROM ${quoteIdentifier(tableMeta.tableName)} WHERE ${quoteIdentifier(tableMeta.primaryKey)} = ?`,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Row not found.' });
    }

    res.json({ message: 'Row deleted successfully.' });
  } catch (error) {
    console.error(`DELETE /api/admin/table/${table}/${id} error:`, error);
    handleDbError(res, error, 'Failed to delete row.');
  }
});

module.exports = router;
