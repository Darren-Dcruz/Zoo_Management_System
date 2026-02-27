(function bootstrapZooFrontend() {
  const TABLE_ORDER = [
    'enclosure',
    'animals',
    'species',
    'staff',
    'visitors',
    'tickets',
    'medical_records',
    'maintenance',
    'departments',
  ];

  const state = {
    apiBase: resolveApiBase(),
    tables: [],
    tableMap: new Map(),
    rowsByTable: new Map(),
    lookupCache: new Map(),
    currentTable: null,
    dialogMode: 'create',
    editingRow: null,
  };

  const elements = {
    landingSection: document.getElementById('landingSection'),
    dashboardSection: document.getElementById('dashboardSection'),
    tableNav: document.getElementById('tableNav'),
    tableCards: document.getElementById('tableCards'),
    tableTitle: document.getElementById('tableTitle'),
    tableMeta: document.getElementById('tableMeta'),
    tableContainer: document.getElementById('tableContainer'),
    statusBar: document.getElementById('statusBar'),
    enterZooBtn: document.getElementById('enterZooBtn'),
    homeButton: document.getElementById('homeButton'),
    homeLink: document.getElementById('homeLink'),
    refreshBtn: document.getElementById('refreshBtn'),
    addRowBtn: document.getElementById('addRowBtn'),
    rowDialog: document.getElementById('rowDialog'),
    rowForm: document.getElementById('rowForm'),
    dialogTitle: document.getElementById('dialogTitle'),
    dialogSubtitle: document.getElementById('dialogSubtitle'),
    formFields: document.getElementById('formFields'),
    formError: document.getElementById('formError'),
    closeDialogBtn: document.getElementById('closeDialogBtn'),
    cancelDialogBtn: document.getElementById('cancelDialogBtn'),
    saveRowBtn: document.getElementById('saveRowBtn'),
  };

  init().catch((error) => {
    setStatus(error.message || 'Failed to initialize frontend.', 'error');
  });

  async function init() {
    bindEvents();
    setStatus(`Connecting to ${state.apiBase}`, 'info');

    await loadSchema();
    renderNavigation();
    renderTableCards();

    if (!window.location.hash) {
      window.location.hash = '#/home';
    } else {
      await handleRouteChange();
    }
  }

  function bindEvents() {
    window.addEventListener('hashchange', () => {
      void handleRouteChange();
    });

    elements.enterZooBtn.addEventListener('click', () => {
      const target = state.tables[0]?.tableName;
      if (!target) {
        setStatus('No tables found in schema.', 'error');
        return;
      }
      window.location.hash = buildTableHash(target);
    });

    elements.homeButton.addEventListener('click', () => {
      window.location.hash = '#/home';
    });

    elements.homeLink.addEventListener('click', () => {
      window.location.hash = '#/home';
    });

    elements.refreshBtn.addEventListener('click', () => {
      if (!state.currentTable) {
        return;
      }
      void renderTable(state.currentTable, { force: true });
    });

    elements.addRowBtn.addEventListener('click', () => {
      if (!state.currentTable) {
        return;
      }
      void openRowDialog('create');
    });

    elements.tableCards.addEventListener('click', (event) => {
      const card = event.target.closest('[data-table-card]');
      if (!card) {
        return;
      }
      window.location.hash = buildTableHash(card.dataset.tableCard);
    });

    elements.tableContainer.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-row-action]');
      if (!actionButton || !state.currentTable) {
        return;
      }

      const action = actionButton.dataset.rowAction;
      const rowId = actionButton.dataset.rowId;

      if (action === 'edit') {
        void openRowDialog('edit', rowId);
      } else if (action === 'delete') {
        void deleteRow(rowId);
      }
    });

    elements.rowForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitRowForm();
    });

    elements.closeDialogBtn.addEventListener('click', closeDialog);
    elements.cancelDialogBtn.addEventListener('click', closeDialog);
  }

  async function loadSchema() {
    const payload = await apiRequest('/meta');
    const tables = Array.isArray(payload.tables) ? payload.tables : [];

    tables.sort((left, right) => {
      const leftIndex = TABLE_ORDER.indexOf(left.tableName);
      const rightIndex = TABLE_ORDER.indexOf(right.tableName);
      if (leftIndex === -1 && rightIndex === -1) {
        return left.tableName.localeCompare(right.tableName);
      }
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    });

    state.tables = tables;
    state.tableMap = new Map(tables.map((table) => [table.tableName, table]));
  }

  function renderNavigation() {
    const fragment = document.createDocumentFragment();
    for (const table of state.tables) {
      const link = document.createElement('a');
      link.href = buildTableHash(table.tableName);
      link.textContent = formatTableName(table.tableName);
      link.dataset.navTable = table.tableName;
      fragment.appendChild(link);
    }
    elements.tableNav.replaceChildren(fragment);
  }

  function renderTableCards() {
    const fragment = document.createDocumentFragment();
    for (const table of state.tables) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'table-card';
      card.dataset.tableCard = table.tableName;

      const title = document.createElement('p');
      title.textContent = formatTableName(table.tableName);

      const rows = state.rowsByTable.get(table.tableName);
      const subtitle = document.createElement('p');
      subtitle.dataset.cardCount = table.tableName;
      subtitle.textContent = rows ? `${rows.length} row(s)` : 'Open to load rows';

      card.appendChild(title);
      card.appendChild(subtitle);
      fragment.appendChild(card);
    }
    elements.tableCards.replaceChildren(fragment);
    highlightActiveNavigation();
  }

  async function handleRouteChange() {
    const hash = window.location.hash || '#/home';
    const parsedTable = parseTableFromHash(hash);

    if (!parsedTable) {
      showLanding();
      return;
    }

    if (!state.tableMap.has(parsedTable)) {
      setStatus(`Unknown table route: ${parsedTable}`, 'error');
      showLanding();
      return;
    }

    showDashboard();
    await renderTable(parsedTable, { force: true });
  }

  async function renderTable(tableName, options = {}) {
    const { force = false } = options;
    const tableMeta = state.tableMap.get(tableName);

    if (!tableMeta) {
      return;
    }

    state.currentTable = tableName;
    highlightActiveNavigation();

    elements.tableTitle.textContent = formatTableName(tableName);
    elements.tableMeta.textContent = `Primary key: ${tableMeta.primaryKey || 'n/a'} | Columns: ${tableMeta.columns.length}`;

    setStatus(`Loading ${formatTableName(tableName)}...`, 'info');
    const rows = await fetchRows(tableName, { force });
    renderDataGrid(tableMeta, rows);
    updateCardCount(tableName, rows.length);

    const suffix = rows.length === 1 ? 'row' : 'rows';
    setStatus(`${rows.length} ${suffix} loaded from ${tableName}.`, 'success');
  }

  async function fetchRows(tableName, options = {}) {
    const { force = false } = options;
    if (!force && state.rowsByTable.has(tableName)) {
      return state.rowsByTable.get(tableName);
    }

    const payload = await apiRequest(`/table/${encodeURIComponent(tableName)}`);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    state.rowsByTable.set(tableName, rows);
    return rows;
  }

  function renderDataGrid(tableMeta, rows) {
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<p>No records found in <strong>${escapeHtml(tableMeta.tableName)}</strong>.</p>`;
      elements.tableContainer.replaceChildren(empty);
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headRow = document.createElement('tr');
    for (const column of tableMeta.columns) {
      const th = document.createElement('th');
      th.textContent = formatColumnName(column.name);
      headRow.appendChild(th);
    }

    const actionHead = document.createElement('th');
    actionHead.textContent = 'Actions';
    headRow.appendChild(actionHead);
    thead.appendChild(headRow);

    const primaryKey = tableMeta.primaryKey;
    for (const row of rows) {
      const bodyRow = document.createElement('tr');

      for (const column of tableMeta.columns) {
        const td = document.createElement('td');
        const value = row[column.name];
        td.textContent = formatCellValue(value, column.dataType);
        bodyRow.appendChild(td);
      }

      const actions = document.createElement('td');
      actions.className = 'actions-cell';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'small-btn edit';
      editBtn.dataset.rowAction = 'edit';
      editBtn.dataset.rowId = String(row[primaryKey]);
      editBtn.textContent = 'Edit';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'small-btn delete';
      deleteBtn.dataset.rowAction = 'delete';
      deleteBtn.dataset.rowId = String(row[primaryKey]);
      deleteBtn.textContent = 'Delete';

      actions.append(editBtn, deleteBtn);
      bodyRow.appendChild(actions);
      tbody.appendChild(bodyRow);
    }

    table.append(thead, tbody);
    elements.tableContainer.replaceChildren(table);
  }

  async function openRowDialog(mode, rowId) {
    if (!state.currentTable) {
      return;
    }

    const tableMeta = state.tableMap.get(state.currentTable);
    const rows = state.rowsByTable.get(state.currentTable) || [];
    const primaryKey = tableMeta.primaryKey;
    const selectedRow =
      mode === 'edit'
        ? rows.find((row) => String(row[primaryKey]) === String(rowId))
        : null;

    if (mode === 'edit' && !selectedRow) {
      setStatus('Could not find the selected row for editing.', 'error');
      return;
    }

    state.dialogMode = mode;
    state.editingRow = selectedRow;
    elements.formError.textContent = '';
    elements.dialogTitle.textContent = `${mode === 'create' ? 'Add' : 'Edit'} ${formatTableName(
      state.currentTable,
    )}`;
    elements.dialogSubtitle.textContent =
      mode === 'create'
        ? 'Fill in the fields below to create a new row.'
        : `Editing row with ${primaryKey}: ${selectedRow[primaryKey]}`;

    elements.formFields.replaceChildren();

    for (const column of tableMeta.columns) {
      if (mode === 'create' && column.isAutoIncrement) {
        continue;
      }
      const field = await buildField(column, selectedRow, mode);
      elements.formFields.appendChild(field);
    }

    openDialog();
  }

  async function buildField(column, row, mode) {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.setAttribute('for', `field-${column.name}`);
    const requiredMarker = !column.isNullable && !column.isAutoIncrement ? ' *' : '';
    label.textContent = `${formatColumnName(column.name)}${requiredMarker}`;

    let control;
    if (column.referencedTable) {
      control = await buildReferenceSelect(column, row);
    } else if (column.dataType === 'text' || column.dataType === 'longtext') {
      control = document.createElement('textarea');
      field.classList.add('full');
    } else {
      control = document.createElement('input');
      control.type = mapInputType(column.dataType);
      if (control.type === 'number') {
        control.step = column.dataType === 'int' || column.dataType === 'bigint' ? '1' : '0.01';
      }
    }

    control.id = `field-${column.name}`;
    control.name = column.name;
    control.required = !column.isNullable && !column.isAutoIncrement;

    if (mode === 'edit' && column.isPrimary) {
      control.readOnly = true;
    }

    const rawValue = row ? row[column.name] : null;
    if (rawValue !== null && rawValue !== undefined) {
      control.value = toInputValue(rawValue, column.dataType);
    }

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = buildHintText(column);

    field.append(label, control, hint);
    return field;
  }

  async function buildReferenceSelect(column, row) {
    const select = document.createElement('select');
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = `Select ${formatTableName(column.referencedTable)}`;
    select.appendChild(emptyOption);

    const options = await getReferenceOptions(column.referencedTable);
    const refId = column.referencedColumn;
    const selectedValue = row ? row[column.name] : null;

    for (const optionRow of options) {
      const option = document.createElement('option');
      option.value = optionRow[refId];
      option.textContent = formatReferenceLabel(optionRow, refId);

      if (selectedValue !== null && String(selectedValue) === String(optionRow[refId])) {
        option.selected = true;
      }

      select.appendChild(option);
    }

    return select;
  }

  async function getReferenceOptions(tableName) {
    if (state.lookupCache.has(tableName)) {
      return state.lookupCache.get(tableName);
    }

    const payload = await apiRequest(`/table/${encodeURIComponent(tableName)}`);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    state.lookupCache.set(tableName, rows);
    return rows;
  }

  async function submitRowForm() {
    if (!state.currentTable) {
      return;
    }

    const tableMeta = state.tableMap.get(state.currentTable);
    const payload = collectFormPayload(tableMeta);

    try {
      elements.saveRowBtn.disabled = true;
      elements.formError.textContent = '';

      if (state.dialogMode === 'create') {
        await apiRequest(`/table/${encodeURIComponent(state.currentTable)}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        const rowId = state.editingRow[tableMeta.primaryKey];
        await apiRequest(
          `/table/${encodeURIComponent(state.currentTable)}/${encodeURIComponent(rowId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          },
        );
      }

      state.lookupCache.clear();
      closeDialog();
      await renderTable(state.currentTable, { force: true });
    } catch (error) {
      elements.formError.textContent = error.message || 'Failed to save row.';
    } finally {
      elements.saveRowBtn.disabled = false;
    }
  }

  function collectFormPayload(tableMeta) {
    const formData = new FormData(elements.rowForm);
    const payload = {};

    for (const column of tableMeta.columns) {
      if (state.dialogMode === 'create' && column.isAutoIncrement) {
        continue;
      }
      if (state.dialogMode === 'edit' && column.isPrimary) {
        continue;
      }
      if (!formData.has(column.name)) {
        continue;
      }

      const raw = formData.get(column.name);
      if (typeof raw !== 'string') {
        continue;
      }

      if (raw.trim() === '') {
        payload[column.name] = null;
        continue;
      }

      if (isNumericDataType(column.dataType)) {
        const numericValue = Number(raw);
        if (Number.isNaN(numericValue)) {
          throw new Error(`Invalid numeric value for ${formatColumnName(column.name)}.`);
        }
        payload[column.name] = numericValue;
      } else {
        payload[column.name] = raw.trim();
      }
    }

    return payload;
  }

  async function deleteRow(rowId) {
    if (!state.currentTable) {
      return;
    }

    const tableMeta = state.tableMap.get(state.currentTable);
    const confirmDelete = window.confirm(
      `Delete row with ${tableMeta.primaryKey} = ${rowId} from ${formatTableName(
        state.currentTable,
      )}?`,
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest(
        `/table/${encodeURIComponent(state.currentTable)}/${encodeURIComponent(rowId)}`,
        { method: 'DELETE' },
      );
      state.lookupCache.clear();
      await renderTable(state.currentTable, { force: true });
    } catch (error) {
      setStatus(error.message || 'Failed to delete row.', 'error');
    }
  }

  function openDialog() {
    if (typeof elements.rowDialog.showModal === 'function') {
      elements.rowDialog.showModal();
      return;
    }
    elements.rowDialog.setAttribute('open', 'open');
  }

  function closeDialog() {
    if (typeof elements.rowDialog.close === 'function') {
      elements.rowDialog.close();
      return;
    }
    elements.rowDialog.removeAttribute('open');
  }

  function showLanding() {
    elements.landingSection.classList.remove('hidden');
    elements.dashboardSection.classList.add('hidden');
    state.currentTable = null;
    highlightActiveNavigation();
    setStatus('Choose "Enter Zoo" to open database tables.', 'info');
  }

  function showDashboard() {
    elements.landingSection.classList.add('hidden');
    elements.dashboardSection.classList.remove('hidden');
  }

  function highlightActiveNavigation() {
    const navLinks = elements.tableNav.querySelectorAll('a[data-nav-table]');
    navLinks.forEach((link) => {
      const isActive = link.dataset.navTable === state.currentTable;
      link.classList.toggle('active', isActive);
    });

    const cards = elements.tableCards.querySelectorAll('[data-table-card]');
    cards.forEach((card) => {
      const isActive = card.dataset.tableCard === state.currentTable;
      card.classList.toggle('active', isActive);
    });
  }

  function updateCardCount(tableName, count) {
    const countNode = elements.tableCards.querySelector(`[data-card-count="${tableName}"]`);
    if (countNode) {
      const suffix = count === 1 ? 'row' : 'rows';
      countNode.textContent = `${count} ${suffix}`;
    }
  }

  function setStatus(message, kind) {
    elements.statusBar.className = `status-bar ${kind || 'info'}`;
    elements.statusBar.textContent = message;
  }

  async function apiRequest(path, options = {}) {
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      ...options,
    };

    let response;
    try {
      response = await fetch(`${state.apiBase}${path}`, config);
    } catch (_networkError) {
      throw new Error(`Cannot connect to backend at ${state.apiBase}.`);
    }

    const payload = await tryReadJson(response);
    if (!response.ok) {
      const errorMessage =
        payload.error || payload.message || `Request failed (${response.status}).`;
      throw new Error(errorMessage);
    }
    return payload;
  }

  async function tryReadJson(response) {
    try {
      return await response.json();
    } catch (_error) {
      return {};
    }
  }

  function parseTableFromHash(hash) {
    const match = hash.match(/^#\/table\/([^/]+)$/);
    if (!match) {
      return null;
    }
    return decodeURIComponent(match[1]);
  }

  function buildTableHash(tableName) {
    return `#/table/${encodeURIComponent(tableName)}`;
  }

  function resolveApiBase() {
    const params = new URLSearchParams(window.location.search);
    const paramOverride = params.get('apiBase');
    if (paramOverride) {
      return paramOverride.replace(/\/$/, '');
    }

    if (window.location.protocol === 'file:') {
      return 'http://localhost:5000/api/admin';
    }

    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost && window.location.port !== '5000') {
      return 'http://localhost:5000/api/admin';
    }

    return '/api/admin';
  }

  function formatTableName(value) {
    return value
      .split('_')
      .join(' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatColumnName(value) {
    return value
      .split('_')
      .join(' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatCellValue(value, dataType) {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (dataType === 'date') {
      return String(value).slice(0, 10);
    }

    if (typeof value === 'string' && value.length > 80) {
      return `${value.slice(0, 77)}...`;
    }

    return String(value);
  }

  function toInputValue(value, dataType) {
    if (value === null || value === undefined) {
      return '';
    }
    if (dataType === 'date') {
      return String(value).slice(0, 10);
    }
    return String(value);
  }

  function mapInputType(dataType) {
    if (dataType === 'date') {
      return 'date';
    }
    if (isNumericDataType(dataType)) {
      return 'number';
    }
    if (dataType === 'email') {
      return 'email';
    }
    return 'text';
  }

  function isNumericDataType(dataType) {
    return ['int', 'bigint', 'decimal', 'float', 'double'].includes(dataType);
  }

  function buildHintText(column) {
    const parts = [column.columnType];
    if (column.referencedTable) {
      parts.push(`FK -> ${column.referencedTable}.${column.referencedColumn}`);
    }
    if (column.isPrimary) {
      parts.push('Primary key');
    }
    if (column.isAutoIncrement) {
      parts.push('Auto-increment');
    }
    return parts.join(' | ');
  }

  function formatReferenceLabel(row, primaryKey) {
    const keys = Object.keys(row);
    const preferred = keys.filter(
      (key) =>
        key !== primaryKey &&
        (key.includes('NAME') ||
          key.includes('TYPE') ||
          key.includes('TITLE') ||
          key.includes('LOCATION') ||
          key.includes('EMAIL')),
    );

    const labelColumn = preferred[0] || keys.find((key) => key !== primaryKey);
    if (!labelColumn) {
      return String(row[primaryKey]);
    }
    return `${row[primaryKey]} - ${row[labelColumn]}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
