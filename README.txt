Attendance Manager (Weekdays Only)
==================================

Files:
- index.html    : Main page
- styles.css    : Styling
- app.js        : JavaScript logic (localStorage, export/import, UI)
- README.txt    : This file

How it works (simple):
- Open index.html in any modern browser.
- Add students using "Add Student".
- Select a date (weekdays only — Saturdays and Sundays are blocked by the UI).
- Click "Load Day". The system will create an attendance record for that date.
- Mark present/absent using the checkboxes. Notes field is available per student.
- Export CSV for the selected date (CSV opens in Excel).
- Export JSON to backup full data (students + all dates).
- Import JSON to restore/transfer data (overwrites current data when you confirm).

Storage:
- Data is stored in your browser's localStorage. No server required.
- You can backup with "Export JSON".

Tips to manage:
- Keep a master backup by exporting JSON periodically.
- To move data between devices, use Export JSON and then Import JSON on the other device.
- For printing, open the CSV in Excel and use Excel's print layout.

Limitations:
- Offline-only: this is a purely client-side solution (no server).
- If you want multi-device real-time sync, you'll need a simple server or Google Sheets integration.
