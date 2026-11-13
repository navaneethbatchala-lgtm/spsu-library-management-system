/**
 * SPSU LMS - Shared Utilities
 * Toast notifications, date formatting, API helpers
 */

// ─── Toast Notification System ────────────────────────────────────────────────
const ToastManager = (() => {
  let container;
  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${message}</span>`;
    getContainer().appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
    return toast;
  }

  return { success: (m, d) => show(m, 'success', d), error: (m, d) => show(m, 'error', d), warning: (m, d) => show(m, 'warning', d), info: (m, d) => show(m, 'info', d) };
})();

// ─── Date Utilities ───────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr);
  return Math.floor((target - today) / 86400000);
}

function timeAgo(dtStr) {
  if (!dtStr) return '';
  const diff = Date.now() - new Date(dtStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Status Badge Helpers ─────────────────────────────────────────────────────
function issueBadge(status) {
  const map = { ISSUED: 'badge-info', RETURNED: 'badge-success', OVERDUE: 'badge-danger' };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
}

function studentStatusBadge(status) {
  const map = { active: 'badge-success', inactive: 'badge-muted', suspended: 'badge-danger' };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
}

function availabilityBadge(available, total) {
  if (available === 0) return `<span class="avail-indicator"><span class="avail-dot red"></span> Not Available</span>`;
  return `<span class="avail-indicator"><span class="avail-dot green"></span> ${available}/${total} Available</span>`;
}

// ─── API Client ───────────────────────────────────────────────────────────────
const API = {
  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response.' }));
    return { ok: res.ok, status: res.status, ...data };
  },
  get: (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body),
  put: (url, body) => API.request('PUT', url, body),
  delete: (url) => API.request('DELETE', url)
};

// ─── Auth Guard ───────────────────────────────────────────────────────────────
async function guardAuth(requiredRole) {
  try {
    const data = await API.get('/api/auth/me');
    if (!data.success) {
      window.location.href = '/';
      return null;
    }
    // Security: Students cannot access Admin pages
    if (requiredRole === 'admin' && data.user.role !== 'admin') {
      window.location.href = '/pages/student-dashboard.html';
      return null;
    }
    return data.user;
  } catch {
    window.location.href = '/';
    return null;
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function handleLogout() {
  if (!confirm('Are you sure you want to log out?')) return;
  await API.post('/api/auth/logout');
  window.location.href = '/';
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function showConfirm(message) {
  return confirm(message);
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function closeModalOnBg(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

// ─── Escape HTML ─────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Print Table ─────────────────────────────────────────────────────────────
function printSection(title, tableHTML) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${title} - SPSU Library</title>
    <style>
      body { font-family: Segoe UI, sans-serif; padding: 24px; }
      h1 { color: #0B2545; font-size: 20px; margin-bottom: 4px; }
      p { color: #64748B; font-size: 13px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #0B2545; color: white; padding: 10px; text-align: left; }
      td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
      tr:nth-child(even) { background: #F8FAFC; }
    </style></head>
    <body>
      <h1>SPSU Library Management System</h1>
      <p>${title} — Generated on ${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})}</p>
      ${tableHTML}
    </body></html>
  `);
  win.document.close();
  win.print();
}

// ─── Navigation (SPA) ────────────────────────────────────────────────────────
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  const link = document.querySelector(`[data-page="${pageId}"]`);
  if (link) link.classList.add('active');

  // Update page title
  const titles = {
    // Admin Views
    'page-dashboard': 'Dashboard',
    'page-books': 'Book Management',
    'page-students': 'Student Management',
    'page-issue': 'Issue Book',
    'page-return': 'Return Book',
    'page-overdue': 'Overdue Books',
    'page-search': 'Book Search & Availability',
    'page-reports': 'Reports',
    'page-settings': 'Settings',
    // Student Views
    'page-home': 'My Dashboard',
    'page-mybooks': 'My Issued Books',
    'page-history': 'Borrowing History',
    'page-catalog': 'Book Catalog',
    'page-profile': 'My Profile & ID Card'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[pageId] || '';

  // Close mobile sidebar if open
  document.querySelector('.sidebar')?.classList.remove('open');

  // Page-specific lifecycle hook
  if (typeof window.onPageNavigated === 'function') {
    try {
      window.onPageNavigated(pageId);
    } catch (err) {
      console.error('Error in onPageNavigated:', err);
    }
  }
}
