/* app.js
   Attendance manager logic (vanilla JS)
   - Stores students and daily attendance in localStorage
   - Exports to CSV (works with Excel) and JSON
   - Prevents selecting Saturdays and Sundays
   - Includes comments for clarity (as requested)
*/

/* ---------- Utility helpers ---------- */

// Simple DOM helpers
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

// LocalStorage keys
const LS_STUDENTS = 'attendance_students_v1';
const LS_RECORDS = 'attendance_records_v1';

// Format date as YYYY-MM-DD (this is used as the key per day)
function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// Convert records object to CSV text
function toCSV(rows) {
  const headers = ['date','roll','name','present','notes'];
  const lines = [headers.join(',')];
  rows.forEach(r => {
    // Escape commas/newlines in fields by wrapping in quotes and doubling quotes inside
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    // Always include the date field, fallback to dateInput.value if missing
    lines.push([
      esc(r.date || (typeof dateInput !== 'undefined' ? dateInput.value : '')),
      esc(r.roll),
      esc(r.name),
      esc(r.present ? '1' : '0'),
      esc(r.notes || '')
    ].join(','));
  });
  return lines.join('\n');
}

/* ---------- Data models (in-memory) ---------- */

let students = []; // array of {id, name, roll}
let records = {};  // map date -> array of {roll, name, present, notes}

/* ---------- Persistence (localStorage) ---------- */

function loadFromStorage() {
  const s = localStorage.getItem(LS_STUDENTS);
  const r = localStorage.getItem(LS_RECORDS);
  students = s ? JSON.parse(s) : [];
  records = r ? JSON.parse(r) : {};
}

function saveToStorage() {
  localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
  localStorage.setItem(LS_RECORDS, JSON.stringify(records));
}

/* ---------- UI bindings ---------- */

const dateInput = qs('#date');
const loadBtn = qs('#loadBtn');
const studentsTbody = qs('#studentsTbody');
const addStudentBtn = qs('#addStudentBtn');
const modal = qs('#modal');
const modalName = qs('#modalName');
const modalRoll = qs('#modalRoll');
const saveStudentBtn = qs('#saveStudentBtn');
const cancelStudentBtn = qs('#cancelStudentBtn');
const bulkPresentBtn = qs('#bulkPresentBtn');
const bulkAbsentBtn = qs('#bulkAbsentBtn');
const exportCsvBtn = qs('#exportCsvBtn');
const exportJsonBtn = qs('#exportJsonBtn');
const importJsonBtn = qs('#importJsonBtn');
const importFile = qs('#importFile');
const importFileInput = importFile;
const summaryText = qs('#summaryText');

/* ---------- Prevent weekends in date picker ----------
   We set min/max or disable selection using input validation.
   Additionally we'll block loading a weekend and show an alert.
*/
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sunday,6=Saturday
  return day === 0 || day === 6;
}

/* ---------- Rendering ---------- */

function renderStudentTable(dateKey) {
  studentsTbody.innerHTML = '';
  const dayRecords = records[dateKey] || [];

  students.forEach((s, idx) => {
    const existing = dayRecords.find(r => r.roll === s.roll) || {present: false, notes: ''};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${s.name}</td>
      <td>${s.roll}</td>
      <td><input type="checkbox" class="presentChk" data-roll="${s.roll}" ${existing.present ? 'checked' : ''}></td>
      <td><input class="noteInput" data-roll="${s.roll}" value="${existing.notes || ''}" /></td>
      <td>
        <button class="editBtn secondary" data-roll="${s.roll}">Edit</button>
        <button class="delBtn secondary" data-roll="${s.roll}">Delete</button>
      </td>
    `;
    studentsTbody.appendChild(tr);
  });

  // attach listeners for checkboxes and notes
  qsa('.presentChk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const roll = e.target.dataset.roll;
      setAttendanceFor(dateKey, roll, { present: e.target.checked });
    });
  });
  qsa('.noteInput').forEach(inp => {
    inp.addEventListener('blur', (e) => {
      const roll = e.target.dataset.roll;
      setAttendanceFor(dateKey, roll, { notes: e.target.value });
    });
  });
  qsa('.editBtn').forEach(b => {
    b.addEventListener('click', (e) => {
      const roll = e.target.dataset.roll;
      editStudent(roll);
    });
  });
  qsa('.delBtn').forEach(b => {
    b.addEventListener('click', (e) => {
      const roll = e.target.dataset.roll;
      if (confirm('Delete student and their records?')) {
        deleteStudent(roll);
      }
    });
  });

  updateSummary(dateKey);
}

/* ---------- Attendance manipulation ---------- */

function ensureRecordFor(dateKey) {
  if (!records[dateKey]) records[dateKey] = [];
  // ensure each student has an entry
  students.forEach(s => {
    if (!records[dateKey].find(r => r.roll === s.roll)) {
      records[dateKey].push({ roll: s.roll, name: s.name, present: false, notes: '' });
    }
  });
}

function setAttendanceFor(dateKey, roll, patch) {
  ensureRecordFor(dateKey);
  const row = records[dateKey].find(r => r.roll === roll);
  if (!row) return;
  Object.assign(row, patch);
  saveToStorage();
  // update UI summary but don't re-render entire table (keeps focus)
  updateSummary(dateKey);
}

function updateSummary(dateKey) {
  const rows = records[dateKey] || [];
  const total = rows.length;
  const present = rows.filter(r => r.present).length;
  summaryText.innerHTML = `Date: <strong>${dateKey}</strong> — Present: ${present} / ${total}`;
}

/* ---------- Student CRUD ---------- */

let editingRoll = null;
function openModalForAdd() {
  editingRoll = null;
  modalName.value = '';
  modalRoll.value = '';
  modal.classList.remove('hidden');
}
function editStudent(roll) {
  editingRoll = roll;
  const s = students.find(x => x.roll === roll);
  if (!s) return;
  modalName.value = s.name;
  modalRoll.value = s.roll;
  modal.classList.remove('hidden');
}
function saveStudentFromModal() {
  const name = modalName.value.trim();
  const roll = modalRoll.value.trim();
  if (!name || !roll) { alert('Please provide name and roll/ID'); return; }
  // if editing, replace; else add new
  const existsIdx = students.findIndex(s => s.roll === roll);
  if (editingRoll && editingRoll !== roll) {
    // user changed roll while editing; ensure no duplicate
    if (existsIdx !== -1) { alert('Roll already exists. Choose a unique roll/ID.'); return; }
  }
  if (editingRoll) {
    // update existing student (find by editingRoll)
    const idx = students.findIndex(s => s.roll === editingRoll);
    if (idx !== -1) students[idx] = { id: students[idx].id, name, roll };
    // update any existing records that referenced old roll
    Object.keys(records).forEach(d => {
      records[d].forEach(r => { if (r.roll === editingRoll) r.roll = roll; if (r.name !== name) r.name = name; });
    });
  } else {
    // adding new student; ensure unique roll
    if (existsIdx !== -1) { alert('Roll already exists. Choose a unique roll/ID.'); return; }
    students.push({ id: Date.now() + Math.random(), name, roll });
  }
  saveToStorage();
  modal.classList.add('hidden');
  // if a day is loaded, re-render to show change
  if (currentDateKey) renderStudentTable(currentDateKey);
}

function deleteStudent(roll) {
  students = students.filter(s => s.roll !== roll);
  // remove from records
  Object.keys(records).forEach(d => {
    records[d] = records[d].filter(r => r.roll !== roll);
  });
  saveToStorage();
  if (currentDateKey) renderStudentTable(currentDateKey);
}

/* ---------- Bulk actions ---------- */

function markAll(dateKey, present) {
  ensureRecordFor(dateKey);
  records[dateKey].forEach(r => r.present = present);
  saveToStorage();
  renderStudentTable(dateKey); // re-render to reflect change
}

/* ---------- Export / Import ---------- */

// Export attendance for the selected date as a Word (DOCX) file
function exportWordFor(dateKey) {
  const rows = (records[dateKey] || []).map(r => ({ roll: r.roll, name: r.name, present: r.present ? 'Present' : 'Absent', notes: r.notes }));
  let html = `<h2>Attendance for ${dateKey}</h2>`;
  html += `<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">`;
  html += `<tr><th>#</th><th>Name</th><th>Roll / ID</th><th>Status</th><th>Notes</th></tr>`;
  rows.forEach((r, i) => {
    html += `<tr><td>${i+1}</td><td>${r.name}</td><td>${r.roll}</td><td>${r.present}</td><td>${r.notes || ''}</td></tr>`;
  });
  html += `</table>`;
  // Use .doc extension for best compatibility, but set MIME type to application/msword
  const blob = new Blob([
    `<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>${html}</body></html>`
  ], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${dateKey}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
  const payload = { students, records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsvFor(dateKey) {
  const rows = (records[dateKey] || []).map(r => ({ date: dateKey, roll: r.roll, name: r.name, present: r.present ? 1 : 0, notes: r.notes }));
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${dateKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.students || !data.records) { alert('Invalid backup file'); return; }
      // Overwrite after confirmation
      if (!confirm('Import will overwrite current students & records. Continue?')) return;
      students = data.students;
      records = data.records;
      saveToStorage();
      if (currentDateKey) renderStudentTable(currentDateKey);
      alert('Import complete.');
    } catch (err) {
      alert('Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- Loading a selected date ---------- */

let currentDateKey = null;
function loadForSelectedDate() {
  const v = dateInput.value;
  if (!v) { alert('Choose a date'); return; }
  if (isWeekend(v)) { alert('Selected date is a Saturday or Sunday. Please choose a weekday.'); return; }
  currentDateKey = v;
  // ensure records include all students
  ensureRecordFor(currentDateKey);
  saveToStorage();
  renderStudentTable(currentDateKey);
}

/* ---------- Initialization ---------- */

function init() {
  loadFromStorage();
  // set date input to today (if today is weekend, move to previous Friday)
  const today = new Date();
  let pick = new Date(today);
  if (pick.getDay() === 0) pick.setDate(pick.getDate() - 2);
  if (pick.getDay() === 6) pick.setDate(pick.getDate() - 1);
  dateInput.value = formatDate(pick);

  // wire up buttons
  loadBtn.addEventListener('click', loadForSelectedDate);
  addStudentBtn.addEventListener('click', openModalForAdd);
  cancelStudentBtn.addEventListener('click', () => modal.classList.add('hidden'));
  saveStudentBtn.addEventListener('click', saveStudentFromModal);
  bulkPresentBtn.addEventListener('click', () => { if (!currentDateKey) return alert('Load a date first'); markAll(currentDateKey, true); });
  bulkAbsentBtn.addEventListener('click', () => { if (!currentDateKey) return alert('Load a date first'); markAll(currentDateKey, false); });
  exportCsvBtn.addEventListener('click', () => { if (!currentDateKey) return alert('Load a date first'); exportCsvFor(currentDateKey); });
  const exportWordBtn = qs('#exportWordBtn');
  if (exportWordBtn) {
    exportWordBtn.addEventListener('click', () => {
      if (!currentDateKey) return alert('Load a date first');
      exportWordFor(currentDateKey);
    });
  }
  exportJsonBtn.addEventListener('click', exportJson);
  importJsonBtn.addEventListener('click', () => importFile.click());
  importFileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJsonFile(f);
    importFileInput.value = '';
  });

  // initial render (if students exist, load today's date)
  if (students.length > 0) {
    currentDateKey = dateInput.value;
    ensureRecordFor(currentDateKey);
    renderStudentTable(currentDateKey);
  } else {
    summaryText.innerHTML = 'No students yet — click "Add Student" to begin.';
  }
}

// run init on DOM ready
document.addEventListener('DOMContentLoaded', init);
