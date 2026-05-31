// ============================================================
// NoteShare - Global JavaScript Controller
// All pages wire through this single script.js
// ============================================================

// ─── CONSTANTS ─────────────────────────────────────────────
const PRIMARY = '#6366f1';
const BOT_REPLIES = [
  "Haan bhai, sun raha hoon! 😄",
  "Interesting! Aur kuch batao?",
  "Acha acha, samajh gaya!",
  "Bilkul sahi keh rahe ho 👍",
  "LOL 😂 teri baat hi alag hai!",
  "Sach mein? Mujhe nahi pata tha!",
  "Chal bhai, notes share karte hain?",
  "Ekdum bakwaas! (affectionately 😄)",
  "Theek hai yaar, dekha jayega.",
  "Arey wah! Kya baat hai 🎉",
];

// ─── UTILITIES ─────────────────────────────────────────────

/** Show a floating toast notification */
function showToast(message, type = 'success') {
  const existing = document.querySelectorAll('.ns-toast');
  existing.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'ns-toast';
  toast.style.cssText = `
    position:fixed; bottom:32px; right:32px; z-index:9999;
    padding:14px 24px; border-radius:16px; color:#fff; font-weight:700;
    font-size:14px; display:flex; align-items:center; gap:10px;
    box-shadow:0 8px 32px rgba(0,0,0,0.18);
    background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#f59e0b'};
    transform:translateY(80px); opacity:0;
    transition:all 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });
  });

  setTimeout(() => {
    toast.style.transform = 'translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

/** Generate a random 6-char alphanumeric ID */
function generateId(prefix = '') {
  return prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Get current page filename */
function currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}

// ─── LOCAL STORAGE HELPERS ─────────────────────────────────
const DB = {
  get: (key, def = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  remove: (key) => localStorage.removeItem(key),
};

const API_ROOT = window.location.origin + '/api';

function getSession() { return DB.get('ns_session'); }
function getToken() { return DB.get('ns_token'); }
function setSession(user, token) {
  DB.set('ns_session', user);
  DB.set('ns_token', token);
}
function clearSession() {
  DB.remove('ns_session');
  DB.remove('ns_token');
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  
  // Only set Content-Type to application/json if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_ROOT}${path}`, { credentials: 'include', ...options, headers });
  return response;
}

async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Server error');
  }
  return data;
}

function getUsers() { return DB.get('ns_users', []); }
function saveUsers(users) { DB.set('ns_users', users); }

// ─── DATABASE BOOTSTRAP ─────────────────────────────────────
function bootstrap() {
  if (!DB.get('ns_bootstrapped')) {
    // Seed demo users
    const demoUsers = [
      { id: 'DEMO01', name: 'Ayush Tripathi', email: 'ayush@example.com', password: 'password123', avatar: 'AT' },
      { id: 'DEMO02', name: 'Rahul Sharma',   email: 'rahul@example.com', password: 'rahul123',    avatar: 'RS' },
      { id: 'DEMO03', name: 'Priya Singh',    email: 'priya@example.com', password: 'priya123',    avatar: 'PS' },
    ];
    saveUsers(demoUsers);

    // Seed demo notes for Ayush
    DB.set('ns_notes_DEMO01', [
      { id: generateId('N'), tag: 'AI/ML', title: 'Neural Networks Basics', content: 'A neural network is a series of algorithms that try to recognize patterns in data through a process that mimics how the human brain works.\n\nKey concepts:\n- Neurons and layers\n- Activation functions (ReLU, Sigmoid)\n- Backpropagation\n- Loss functions', createdAt: Date.now() - 86400000 * 3 },
      { id: generateId('N'), tag: 'COA',   title: 'Cache Memory Notes',     content: 'Cache memory is a small, high-speed memory located close to the CPU.\n\nTypes:\n- L1 Cache: Fastest, smallest (32-64 KB)\n- L2 Cache: Slower than L1, larger (256 KB - 1 MB)\n- L3 Cache: Shared across cores (4-16 MB)\n\nMapping techniques: Direct, Associative, Set Associative', createdAt: Date.now() - 86400000 },
      { id: generateId('N'), tag: 'SE',    title: 'Agile Methodology',       content: 'Agile is an iterative approach to project management and software development.\n\nKey principles:\n1. Customer collaboration over contract negotiation\n2. Responding to change over following a plan\n3. Individuals and interactions over processes and tools\n\nScrum framework: Sprints, Daily standups, Retrospectives', createdAt: Date.now() },
    ]);

    // Seed demo friends & requests
    DB.set('ns_friends_DEMO01', ['DEMO02']);
    DB.set('ns_requests_DEMO01', [{ from: 'DEMO03', name: 'Priya Singh', avatar: 'PS' }]);
    DB.set('ns_friends_DEMO02', ['DEMO01']);
    DB.set('ns_requests_DEMO02', []);
    DB.set('ns_friends_DEMO03', []);
    DB.set('ns_requests_DEMO03', []);

    // Seed demo chats
    const chatKey = ['DEMO01', 'DEMO02'].sort().join('_');
    DB.set(`ns_chat_${chatKey}`, [
      { from: 'DEMO02', text: 'Bhai notes share kiye kya?', ts: Date.now() - 60000 * 30 },
      { from: 'DEMO01', text: 'Haan, dashboard pe check kar!', ts: Date.now() - 60000 * 25 },
      { from: 'DEMO02', text: 'Thanks yaar! 🙌', ts: Date.now() - 60000 * 20 },
    ]);

    DB.set('ns_bootstrapped', true);
  }
}

// ─── NAV AUTH SECTION RENDERER ──────────────────────────────
function renderNav() {
  const section = document.getElementById('nav-auth-section');
  if (!section) return;

  const session = getSession();
  const authNavLinks = document.getElementById('authNavLinks');
  if (authNavLinks) {
    if (session) authNavLinks.classList.remove('hidden');
    else authNavLinks.classList.add('hidden');
  }

  if (session) {
    section.innerHTML = `
      <div class="relative">
        <button id="avatarBtn" class="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shadow-lg hover:opacity-90 transition text-sm">
          ${session.avatar}
        </button>
        <div id="avatarDropdown" class="hidden absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-50">
            <p class="font-bold text-slate-800 text-sm truncate">${session.name}</p>
            <p class="text-xs text-gray-400 truncate">${session.email}</p>
          </div>
          <a href="dashboard.html" class="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 transition">
            <i class="fas fa-tachometer-alt w-4 text-center text-indigo-400"></i> Dashboard
          </a>
          <a href="friends.html" class="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 transition">
            <i class="fas fa-user-friends w-4 text-center text-indigo-400"></i> Friends
          </a>
          <button id="logoutBtn" class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition border-t border-gray-50">
            <i class="fas fa-sign-out-alt w-4 text-center"></i> Logout
          </button>
        </div>
      </div>
    `;

    document.getElementById('avatarBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('avatarDropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      document.getElementById('avatarDropdown')?.classList.add('hidden');
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      clearSession();
      showToast('Logged out successfully!', 'success');
      setTimeout(() => window.location.href = 'index.html', 800);
    });
  } else {
    section.innerHTML = `
      <a href="auth.html" class="text-indigo-600 px-5 py-2 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-50 transition text-sm">Login</a>
      <a href="auth.html" class="px-5 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:opacity-90 transition shadow-lg shadow-indigo-200 text-sm">Signup</a>
    `;
  }
}

// ─── ROUTE GUARD ─────────────────────────────────────────────
function guardRoute() {
  const protectedPages = ['dashboard.html', 'friends.html', 'chat.html'];
  const page = currentPage();
  if (protectedPages.includes(page) && !getSession()) {
    showToast('Please login to continue!', 'error');
    setTimeout(() => window.location.href = 'auth.html', 800);
    return false;
  }
  return true;
}

// ============================================================
// ─── AUTH PAGE ───────────────────────────────────────────────
// ============================================================
function initAuthPage() {
  // Tab switching
  const loginTab   = document.getElementById('loginTab');
  const signupTab  = document.getElementById('signupTab');
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  if (loginTab && signupTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('text-primary-custom', 'border-primary-custom');
      loginTab.classList.remove('text-gray-400');
      signupTab.classList.remove('text-primary-custom', 'border-primary-custom');
      signupTab.classList.add('text-gray-400');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
    });
    signupTab.addEventListener('click', () => {
      signupTab.classList.add('text-primary-custom', 'border-primary-custom');
      signupTab.classList.remove('text-gray-400');
      loginTab.classList.remove('text-primary-custom', 'border-primary-custom');
      loginTab.classList.add('text-gray-400');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
  }

  // If already logged in, redirect
  if (getSession()) {
    window.location.href = 'dashboard.html';
    return;
  }

  // ── Login ──
  const loginBtn = document.getElementById('loginSubmitBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email    = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value.trim();
      if (!email || !password) { showToast('Please fill all fields', 'error'); return; }
      try {
        const data = await apiJson('/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setSession(data.user, data.token);
        showToast(`Welcome back, ${data.user.name.split(' ')[0]}! 🎉`, 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      } catch (err) {
        showToast(err.message || 'Invalid email or password', 'error');
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) { emailInput.style.border = '2px solid #ef4444'; setTimeout(() => emailInput.style.border = '', 1500); }
      }
    });
  }

  const signupBtn = document.getElementById('signupSubmitBtn');
  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const name     = document.getElementById('signupName')?.value.trim();
      const email    = document.getElementById('signupEmail')?.value.trim();
      const password = document.getElementById('signupPassword')?.value.trim();
      if (!name || !email || !password) { showToast('Please fill all fields', 'error'); return; }
      if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
      try {
        const data = await apiJson('/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        setSession(data.user, data.token);
        showToast(`Account created! Welcome, ${data.user.name.split(' ')[0]}! 🎊`, 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      } catch (err) {
        showToast(err.message || 'Unable to register', 'error');
      }
    });
  }

  // ── Google Auth (mock) ──
  const googleBtn = document.getElementById('googleAuthBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      showToast('Google sign-in coming soon!', 'info');
    });
  }

  // Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (!loginForm?.classList.contains('hidden')) loginBtn?.click();
      else signupBtn?.click();
    }
  });
}

// ============================================================
// ─── DASHBOARD PAGE ──────────────────────────────────────────
// ============================================================
async function initDashboardPage() {
  const session = getSession();
  if (!session) return;

  let notes = [];
  let editingNoteId = null;

  function getFriendCount() {
    return (DB.get(`ns_friends_${session.id}`, [])).length;
  }

  function updateStats() {
    const notesCountEl = document.getElementById('statNotesCount');
    const friendsCountEl = document.getElementById('statFriendsCount');
    if (notesCountEl) notesCountEl.textContent = notes.length;
    if (friendsCountEl) friendsCountEl.textContent = getFriendCount();
  }

  function renderNotes(filter = null) {
    const container = document.getElementById('notesContainer');
    if (!container) return;

    let filteredNotes = notes;
    const filterIndicator = document.getElementById('filterIndicator');
    const filterLabel = document.getElementById('filterLabel');

    if (filter) {
      filteredNotes = notes.filter(n => n.tag?.toLowerCase() === filter.toLowerCase());
      if (filterIndicator) { filterIndicator.classList.remove('hidden'); filterLabel.textContent = `Tag: ${filter}`; }
    } else {
      if (filterIndicator) filterIndicator.classList.add('hidden');
    }

    if (filteredNotes.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 text-center py-20 text-gray-300">
          <i class="fas fa-sticky-note text-5xl mb-4 block opacity-40"></i>
          <p class="font-bold text-lg text-gray-400">${filter ? 'No notes for this tag' : 'No notes yet'}</p>
          <p class="text-sm text-gray-300 mt-1">${filter ? 'Try a different filter' : 'Click "+ Upload Note" to get started!'}</p>
        </div>`;
      return;
    }

    const tagColors = {
      'AI/ML': 'bg-purple-100 text-purple-700',
      'COA': 'bg-blue-100 text-blue-700',
      'SE': 'bg-green-100 text-green-700',
      'DAA': 'bg-orange-100 text-orange-700',
      'MATH': 'bg-red-100 text-red-700',
    };

    container.innerHTML = filteredNotes.map(note => {
      const tagClass = tagColors[note.tag?.toUpperCase()] || 'bg-indigo-100 text-indigo-700';
      const preview = note.content.length > 120 ? note.content.substring(0, 120) + '...' : note.content;
      const date = new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return `
        <div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col gap-3" data-note-id="${note.id}">
          <div class="flex items-center justify-between">
            <span class="inline-block px-3 py-1 ${tagClass} text-[11px] font-bold rounded-md">${note.tag || 'General'}</span>
            <span class="text-xs text-gray-300">${date}</span>
          </div>
          <h4 class="font-bold text-slate-800 text-lg leading-tight">${note.title}</h4>
          <p class="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap flex-grow">${preview}</p>
          ${note.attachmentUrl ? `<p class="text-xs text-indigo-600 font-semibold"><a href="${note.attachmentUrl}" target="_blank" rel="noreferrer">Attachment: ${note.attachmentName || 'Download'}</a></p>` : ''}
          <div class="flex items-center gap-3 pt-2 border-t border-gray-50 mt-auto">
            <button class="view-note-btn flex-grow py-2 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-sm hover:bg-indigo-100 transition" data-id="${note.id}">
              <i class="fas fa-eye mr-1"></i> View
            </button>
            <button class="edit-note-btn px-4 py-2 rounded-xl bg-slate-50 text-slate-500 font-bold text-sm hover:bg-slate-100 transition" data-id="${note.id}">
              <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="delete-note-btn px-4 py-2 rounded-xl bg-red-50 text-red-400 font-bold text-sm hover:bg-red-100 transition" data-id="${note.id}">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.view-note-btn').forEach(btn => {
      btn.addEventListener('click', () => openViewModal(btn.dataset.id));
    });
    container.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteNote(btn.dataset.id));
    });
  }

  function openNoteModal(mode = 'add', note = null) {
    const modal = document.getElementById('noteModal');
    const title = document.getElementById('noteModalTitle');
    const tagInput = document.getElementById('noteTag');
    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const attachmentInput = document.getElementById('noteAttachment');
    const attachmentPreview = document.getElementById('noteAttachmentPreview');
    if (!modal) return;

    editingNoteId = null;
    if (mode === 'edit' && note) {
      title.textContent = 'Edit Note';
      tagInput.value = note.tag || '';
      titleInput.value = note.title || '';
      contentInput.value = note.content || '';
      editingNoteId = note.id;
      if (attachmentPreview) {
        attachmentPreview.innerHTML = note.attachmentUrl ? `Current attachment: <a href="${note.attachmentUrl}" target="_blank" rel="noreferrer">${note.attachmentName || 'Download'}</a>` : 'No attachment uploaded yet.';
      }
    } else {
      title.textContent = 'Upload Note';
      tagInput.value = '';
      titleInput.value = '';
      contentInput.value = '';
      if (attachmentInput) attachmentInput.value = '';
      if (attachmentPreview) attachmentPreview.textContent = 'Upload a PDF or image file if needed.';
    }
    modal.classList.add('active');
    setTimeout(() => titleInput.focus(), 50);
  }

  function closeNoteModal() {
    const modal = document.getElementById('noteModal');
    if (!modal) return;
    modal.classList.remove('active');
  }

  function openEditModal(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) openNoteModal('edit', note);
  }

  function openViewModal(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const modal = document.getElementById('viewModal');
    const viewTag = document.getElementById('viewModalTag');
    const viewTitle = document.getElementById('viewModalTitle');
    const viewContent = document.getElementById('viewModalContent');
    const viewAttachment = document.getElementById('viewModalAttachment');
    if (!modal) return;
    if (viewTag) viewTag.textContent = note.tag || 'General';
    if (viewTitle) viewTitle.textContent = note.title;
    if (viewContent) viewContent.textContent = note.content;
    if (viewAttachment) {
      viewAttachment.innerHTML = note.attachmentUrl ? `Attachment: <a href="${note.attachmentUrl}" target="_blank" rel="noreferrer">${note.attachmentName || 'Download'}</a>` : '';
    }
    modal.classList.add('active');
  }

  function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (!modal) return;
    modal.classList.remove('active');
  }

  async function loadNotes() {
    try {
      const data = await apiJson('/notes');
      notes = data.notes || [];
      renderNotes();
      updateStats();
    } catch (err) {
      showToast(err.message || 'Unable to load notes', 'error');
    }
  }

  async function deleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    try {
      await apiJson(`/notes/${noteId}`, { method: 'DELETE' });
      notes = notes.filter(n => n.id !== noteId);
      renderNotes();
      updateStats();
      showToast('Note deleted', 'error');
    } catch (err) {
      showToast(err.message || 'Unable to delete note', 'error');
    }
  }

  document.getElementById('uploadNoteBtn')?.addEventListener('click', () => openNoteModal('add'));
  document.getElementById('noteModalCancel')?.addEventListener('click', closeNoteModal);

  document.getElementById('noteModalSave')?.addEventListener('click', async () => {
    const tag = document.getElementById('noteTag')?.value.trim();
    const title = document.getElementById('noteTitle')?.value.trim();
    const content = document.getElementById('noteContent')?.value.trim();
    const attachmentInput = document.getElementById('noteAttachment');
    if (!title) { showToast('Please enter a title', 'error'); return; }

    const formData = new FormData();
    formData.append('tag', tag);
    formData.append('title', title);
    formData.append('content', content);
    if (attachmentInput?.files?.[0]) {
      formData.append('attachment', attachmentInput.files[0]);
    }

    try {
      if (editingNoteId) {
        await apiJson(`/notes/${editingNoteId}`, {
          method: 'PUT',
          body: formData,
        });
        showToast('Note updated!', 'success');
      } else {
        await apiJson('/notes', {
          method: 'POST',
          body: formData,
        });
        showToast('Note saved!', 'success');
      }
      closeNoteModal();
      await loadNotes();
    } catch (err) {
      showToast(err.message || 'Unable to save note', 'error');
    }
  });

  document.getElementById('viewModalClose')?.addEventListener('click', closeViewModal);
  document.getElementById('viewModalCloseBtn')?.addEventListener('click', closeViewModal);

  document.getElementById('noteModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'noteModal') closeNoteModal();
  });
  document.getElementById('viewModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'viewModal') closeViewModal();
  });

  document.getElementById('clearFilterBtn')?.addEventListener('click', () => renderNotes());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeNoteModal(); closeViewModal(); }
  });

  await loadNotes();
}

// ============================================================
// ─── FRIENDS PAGE ─────────────────────────────────────────────
// ============================================================
function initFriendsPage() {
  const session = getSession();
  if (!session) return;

  const myId = session.id;
  let users = [];
  let friends = [];
  let requests = [];

  async function loadFriendData() {
    [friends, requests, users] = await Promise.all([
      apiJson('/friends').then(data => data.friends || []).catch(() => []),
      apiJson('/requests').then(data => data.requests || []).catch(() => []),
      apiJson('/users').then(data => data.users || []).catch(() => []),
    ]);
    renderRequests();
    renderFriends();
  }

  // Show my ID
  const friendIdEl = document.getElementById('friendId');
  if (friendIdEl) friendIdEl.textContent = myId;

  // Copy ID
  document.getElementById('copyIdBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(myId).then(() => {
      showToast('Friend ID copied! 📋', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = myId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Friend ID copied! 📋', 'success');
    });
  });

  document.getElementById('addFriendBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('friendSearchId');
    const targetId = input?.value.trim().toUpperCase();
    if (!targetId) { showToast('Enter a Friend ID', 'error'); return; }
    if (targetId === myId) { showToast("You can't add yourself!", 'error'); return; }

    try {
      const response = await apiJson('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ targetId }),
      });
      input.value = '';

      if (response.accepted) {
        showToast(`Friend request accepted automatically! 🎉`, 'success');
      } else {
        showToast('Friend request sent! 🙌', 'success');
      }
      await loadFriendData();
    } catch (error) {
      showToast(error.message || 'Unable to send request', 'error');
    }
  });

  function renderRequests() {
    const container = document.getElementById('incomingRequestsContainer');
    if (!container) return;
    if (!requests.length) {
      container.innerHTML = `<p class="text-gray-300 text-sm py-2">No incoming requests</p>`;
      return;
    }

    container.innerHTML = requests.map(req => `
      <div class="flex items-center justify-between p-4 rounded-2xl border border-indigo-50 bg-indigo-50/30" data-req-from="${req.fromId}">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">${req.avatar}</div>
          <div>
            <p class="font-bold text-slate-700 text-sm">${req.name}</p>
            <p class="text-xs text-gray-400">ID: ${req.fromId}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="accept-req-btn px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition" data-from="${req.fromId}">Accept</button>
          <button class="reject-req-btn px-4 py-2 bg-red-100 text-red-500 text-sm font-bold rounded-xl hover:bg-red-200 transition" data-from="${req.fromId}">Decline</button>
        </div>
      </div>`).join('');

    container.querySelectorAll('.accept-req-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fromId = btn.dataset.from;
        try {
          await apiJson(`/friends/requests/${fromId}/accept`, { method: 'POST' });
          showToast('Friend request accepted! 🎉', 'success');
          await loadFriendData();
        } catch (error) {
          showToast(error.message || 'Unable to accept request', 'error');
        }
      });
    });

    container.querySelectorAll('.reject-req-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fromId = btn.dataset.from;
        try {
          await apiJson(`/friends/requests/${fromId}/reject`, { method: 'POST' });
          showToast('Request declined', 'info');
          await loadFriendData();
        } catch (error) {
          showToast(error.message || 'Unable to decline request', 'error');
        }
      });
    });
  }

  function renderFriends() {
    const container = document.getElementById('friendsListContainer');
    if (!container) return;
    if (!friends.length) {
      container.innerHTML = `<p class="text-gray-300 text-sm py-2">No friends yet. Add some! 😊</p>`;
      return;
    }

    container.innerHTML = friends.map(friend => `
      <div class="flex items-center justify-between p-4 rounded-2xl border border-indigo-50 bg-white hover:shadow-sm transition">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">${friend.avatar}</div>
          <div>
            <p class="font-bold text-slate-700 text-sm">${friend.name}</p>
            <p class="text-xs text-gray-400">ID: ${friend.id}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <a href="chat.html?with=${friend.id}" class="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-100 transition">
            <i class="fas fa-comment-alt mr-1"></i> Chat
          </a>
          <a href="dashboard.html?friendTag=${friend.id}" class="px-4 py-2 bg-slate-50 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-100 transition">
            <i class="fas fa-sticky-note mr-1"></i> Notes
          </a>
        </div>
      </div>`).join('');
  }

  loadFriendData();
}

// ============================================================
// ─── CHAT PAGE ───────────────────────────────────────────────
// ============================================================
function initChatPage() {
  const session = getSession();
  if (!session) return;

  const users   = getUsers();
  const myId    = session.id;
  let activeFriendId = null;

  function getFriends() { return DB.get(`ns_friends_${myId}`, []); }

  function getChatKey(uid1, uid2) {
    return 'ns_chat_' + [uid1, uid2].sort().join('_');
  }
  function getMessages(friendId) { return DB.get(getChatKey(myId, friendId), []); }
  function saveMessages(friendId, msgs) { DB.set(getChatKey(myId, friendId), msgs); }

  // Render friend list in sidebar
  function renderSidebar() {
    const container = document.getElementById('chatListContainer');
    if (!container) return;
    const friends = getFriends();

    if (friends.length === 0) {
      container.innerHTML = `<div class="p-6 text-white/40 text-sm text-center">No friends yet. <a href="friends.html" class="underline text-indigo-300">Add some!</a></div>`;
      return;
    }

    container.innerHTML = friends.map(fId => {
      const friend = users.find(u => u.id === fId);
      if (!friend) return '';
      const msgs = getMessages(fId);
      const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
      const lastText = lastMsg ? (lastMsg.text.length > 28 ? lastMsg.text.substring(0, 28) + '...' : lastMsg.text) : 'No messages yet';
      const isActive = fId === activeFriendId;
      return `
        <button class="chat-friend-btn w-full flex items-center gap-4 px-6 py-4 hover:bg-white/10 transition text-left ${isActive ? 'bg-white/15 border-r-4 border-indigo-400' : ''}" data-fid="${fId}">
          <div class="w-10 h-10 min-w-[40px] rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-sm">${friend.avatar}</div>
          <div class="overflow-hidden">
            <p class="font-bold text-white text-sm truncate">${friend.name}</p>
            <p class="text-white/50 text-xs truncate">${lastText}</p>
          </div>
        </button>`;
    }).join('');

    container.querySelectorAll('.chat-friend-btn').forEach(btn => {
      btn.addEventListener('click', () => selectFriend(btn.dataset.fid));
    });
  }

  // Select friend & render chat
  function selectFriend(friendId) {
    activeFriendId = friendId;
    const friend = users.find(u => u.id === friendId);
    if (!friend) return;

    // Update header
    const header = document.getElementById('chatHeader');
    if (header) {
      header.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">${friend.avatar}</div>
        <div>
          <p class="font-bold text-slate-800">${friend.name}</p>
          <p class="text-xs text-yellow-500 font-medium">● Real-time chat is coming soon</p>
        </div>`;
    }

    renderSidebar();
    renderMessages();
    document.getElementById('chatInput')?.focus();
  }

  // Render messages
  function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container || !activeFriendId) return;

    const msgs = getMessages(activeFriendId);
    if (msgs.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-300 text-center py-20">
          <i class="fas fa-comment-dots text-5xl mb-4 opacity-30"></i>
          <p class="font-bold text-gray-400">No messages yet</p>
          <p class="text-sm text-gray-300 mt-1">Say hi! 👋</p>
        </div>`;
      return;
    }

    container.innerHTML = msgs.map(msg => {
      const isMe = msg.from === myId;
      const time = new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
          <div class="max-w-xs lg:max-w-md">
            <div class="px-5 py-3 rounded-2xl ${isMe
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-white text-slate-700 border border-gray-100 rounded-bl-sm shadow-sm'
            }">
              <p class="text-sm">${msg.text}</p>
            </div>
            <p class="text-[10px] text-gray-300 mt-1 ${isMe ? 'text-right' : 'text-left'}">${time}</p>
          </div>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  // Send message
  function sendMessage() {
    if (!activeFriendId) { showToast('Select a friend to chat!', 'info'); return; }
    const input = document.getElementById('chatInput');
    const text  = input?.value.trim();
    if (!text) return;

    const msgs = getMessages(activeFriendId);
    msgs.push({ from: myId, text, ts: Date.now() });
    saveMessages(activeFriendId, msgs);
    input.value = '';
    renderMessages();
    renderSidebar();

    // Simulated reply
    const typingIndicator = document.createElement('div');
    typingIndicator.id    = 'typingIndicator';
    typingIndicator.className = 'flex justify-start';
    typingIndicator.innerHTML = `
      <div class="px-5 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm text-slate-400 text-sm italic flex items-center gap-2">
        <span class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
      </div>`;
    document.getElementById('messagesContainer')?.appendChild(typingIndicator);
    document.getElementById('messagesContainer').scrollTop = 99999;

    const delay = 1200 + Math.random() * 1200;
    setTimeout(() => {
      typingIndicator.remove();
      const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      const updatedMsgs = getMessages(activeFriendId);
      updatedMsgs.push({ from: activeFriendId, text: reply, ts: Date.now() });
      saveMessages(activeFriendId, updatedMsgs);
      renderMessages();
      renderSidebar();
    }, delay);
  }

  document.getElementById('sendChatBtn')?.addEventListener('click', sendMessage);
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Check URL param ?with=
  const withId = new URLSearchParams(window.location.search).get('with');

  renderSidebar();

  // Auto-select friend from URL param or first friend
  const friends = getFriends();
  if (withId && friends.includes(withId)) {
    selectFriend(withId);
  } else if (friends.length > 0) {
    selectFriend(friends[0]);
  } else {
    // No friends state
    const header = document.getElementById('chatHeader');
    if (header) {
      header.innerHTML = `<p class="text-gray-400 text-sm">Add friends to start chatting!</p>`;
    }
    const mc = document.getElementById('messagesContainer');
    if (mc) {
      mc.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-300 text-center py-20">
          <i class="fas fa-user-friends text-5xl mb-4 opacity-30"></i>
          <p class="font-bold text-gray-400">No friends yet!</p>
          <a href="friends.html" class="mt-3 text-indigo-400 font-bold text-sm hover:underline">Go add some friends →</a>
        </div>`;
    }
  }
}

// ============================================================
// ─── LANDING PAGE ─────────────────────────────────────────────
// ============================================================
function initIndexPage() {
  // Hero typing effect
  const typingElement = document.querySelector('#typing-text');
  if (typingElement) {
    const phrases = ['Share Notes.', 'Collaborate.', 'Ace Exams.', 'Learn Together.'];
    let i = 0, j = 0, currentPhrase = [], isDeleting = false, isEnd = false;
    function loop() {
      isEnd = false;
      typingElement.innerHTML = currentPhrase.join('');
      if (i < phrases.length) {
        if (!isDeleting && j < phrases[i].length) { currentPhrase.push(phrases[i][j]); j++; }
        if (isDeleting && j > 0) { currentPhrase.pop(); j--; }
        if (j === phrases[i].length) { isEnd = true; isDeleting = true; }
        if (isDeleting && j === 0) { currentPhrase = []; isDeleting = false; i++; if (i === phrases.length) i = 0; }
      }
      const spedUp = Math.random() * 80 + 50;
      const normalSpeed = Math.random() * 300 + 200;
      setTimeout(loop, isEnd ? 2000 : isDeleting ? spedUp : normalSpeed);
    }
    loop();
  }

  // Scroll to top button
  const scrollBtn = document.querySelector('#scrollToTop');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.style.opacity = window.scrollY > 500 ? '1' : '0';
      scrollBtn.style.transform = window.scrollY > 500 ? 'translateY(0)' : 'translateY(80px)';
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Parallax
  document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.parallax').forEach(el => {
      const speed = parseFloat(el.getAttribute('data-speed') || '0.05');
      el.style.transform = `translateX(${(window.innerWidth / 2 - e.pageX) * speed / 10}px) translateY(${(window.innerHeight / 2 - e.pageY) * speed / 10}px)`;
    });
  });
}

// ============================================================
// ─── MAIN ENTRY POINT ─────────────────────────────────────────
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  bootstrap();     // Seed data if first visit
  renderNav();     // Render navbar auth section

  if (!guardRoute()) return;   // Redirect if unauthenticated on protected pages

  const page = currentPage();

  if (page === 'auth.html')      initAuthPage();
  if (page === 'dashboard.html') initDashboardPage();
  if (page === 'friends.html')   initFriendsPage();
  if (page === 'chat.html')      initChatPage();
  if (page === '' || page === 'index.html') initIndexPage();
});
