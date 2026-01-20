// Legal Case Management - Frontend Application

const API = {
    async get(url) {
        const res = await fetch(url);
        return res.json();
    },
    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        return res.json();
    }
};

// State
let constants = { case_statuses: [], task_statuses: [], contact_roles: [] };
let currentView = 'dashboard';

// Toast notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Navigation
function navigate(view, params = {}) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    switch(view) {
        case 'dashboard': renderDashboard(); break;
        case 'cases': renderCases(); break;
        case 'case': renderCaseDetail(params.id); break;
        case 'tasks': renderTasks(); break;
        case 'deadlines': renderDeadlines(); break;
    }
}

// Status badge colors
function getStatusBadge(status) {
    const colors = {
        'Signing Up': 'gray', 'Prospective': 'blue', 'Pre-Filing': 'yellow',
        'Pleadings': 'blue', 'Discovery': 'green', 'Expert Discovery': 'green',
        'Pre-trial': 'yellow', 'Trial': 'red', 'Post-Trial': 'purple',
        'Appeal': 'purple', 'Settl. Pend.': 'purple', 'Stayed': 'gray', 'Closed': 'gray',
        'Pending': 'yellow', 'Active': 'blue', 'Done': 'green',
        'Partially Complete': 'yellow', 'Blocked': 'red', 'Awaiting Atty Review': 'purple'
    };
    return `<span class="badge badge-${colors[status] || 'gray'}">${status}</span>`;
}

function getUrgencyClass(urgency) {
    return `urgency-${urgency}`;
}

// Dashboard
async function renderDashboard() {
    const [stats, tasksRes, deadlinesRes] = await Promise.all([
        API.get('/api/stats'),
        API.get('/api/tasks?status=Pending'),
        API.get('/api/deadlines?status=Pending')
    ]);

    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Dashboard</h2>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.active_cases}</div>
                    <div class="stat-label">Active Cases</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon yellow">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.pending_tasks}</div>
                    <div class="stat-label">Pending Tasks</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.upcoming_deadlines}</div>
                    <div class="stat-label">Upcoming Deadlines</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.urgent_tasks + stats.urgent_deadlines}</div>
                    <div class="stat-label">Urgent Items</div>
                </div>
            </div>
        </div>

        <div class="section-grid">
            <div class="card">
                <div class="card-header">
                    <h3>Recent Tasks</h3>
                    <button class="btn btn-sm btn-secondary" onclick="navigate('tasks')">View All</button>
                </div>
                <div class="card-body">
                    ${tasksRes.tasks.length ? `
                        <table>
                            <tbody>
                                ${tasksRes.tasks.slice(0, 5).map(t => `
                                    <tr class="${getUrgencyClass(t.urgency)} clickable-row" onclick="navigate('case', {id: ${t.case_id}})">
                                        <td><strong>${t.description}</strong><br><small class="text-muted">${t.case_name}</small></td>
                                        <td>${t.due_date || '-'}</td>
                                        <td>${getStatusBadge(t.status)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No pending tasks</p></div>'}
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>Upcoming Deadlines</h3>
                    <button class="btn btn-sm btn-secondary" onclick="navigate('deadlines')">View All</button>
                </div>
                <div class="card-body">
                    ${deadlinesRes.deadlines.length ? `
                        <table>
                            <tbody>
                                ${deadlinesRes.deadlines.slice(0, 5).map(d => `
                                    <tr class="${getUrgencyClass(d.urgency)} clickable-row" onclick="navigate('case', {id: ${d.case_id}})">
                                        <td><strong>${d.description}</strong><br><small class="text-muted">${d.case_name}</small></td>
                                        <td>${d.date}</td>
                                        <td>${getStatusBadge(d.status)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No upcoming deadlines</p></div>'}
                </div>
            </div>
        </div>
    `;
}

// Cases List
async function renderCases() {
    const { cases } = await API.get('/api/cases');
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="page-header">
            <h2>Cases</h2>
            <button class="btn btn-primary" onclick="openCaseModal()">+ New Case</button>
        </div>

        <div class="filter-bar">
            <div class="search-input">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" class="form-control" placeholder="Search cases..." id="case-search" onkeyup="filterCases()">
            </div>
            <select class="form-control" id="status-filter" onchange="filterCases()">
                <option value="">All Statuses</option>
                ${constants.case_statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Case Name</th>
                            <th>Status</th>
                            <th>Court</th>
                            <th>Print Code</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="cases-table">
                        ${cases.map(c => `
                            <tr class="clickable-row case-row" data-name="${c.case_name.toLowerCase()}" data-status="${c.status}">
                                <td onclick="navigate('case', {id: ${c.id}})"><strong>${c.case_name}</strong></td>
                                <td onclick="navigate('case', {id: ${c.id}})">${getStatusBadge(c.status)}</td>
                                <td onclick="navigate('case', {id: ${c.id}})">${c.court || '-'}</td>
                                <td onclick="navigate('case', {id: ${c.id}})">${c.print_code || '-'}</td>
                                <td>
                                    <div class="actions">
                                        <button class="action-btn" onclick="event.stopPropagation(); openCaseModal(${c.id})" title="Edit">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button class="action-btn delete" onclick="event.stopPropagation(); deleteCase(${c.id})" title="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function filterCases() {
    const search = document.getElementById('case-search').value.toLowerCase();
    const status = document.getElementById('status-filter').value;
    document.querySelectorAll('.case-row').forEach(row => {
        const matchSearch = row.dataset.name.includes(search);
        const matchStatus = !status || row.dataset.status === status;
        row.style.display = matchSearch && matchStatus ? '' : 'none';
    });
}

// Case Detail
async function renderCaseDetail(caseId) {
    const caseData = await API.get(`/api/cases/${caseId}`);
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="case-header">
            <div>
                <button class="btn btn-sm btn-secondary" onclick="navigate('cases')" style="margin-bottom: 1rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Cases
                </button>
                <h2 class="case-title">${caseData.case_name}</h2>
                <div class="case-meta">
                    <span>${getStatusBadge(caseData.status)}</span>
                    <span>${caseData.court || 'No court assigned'}</span>
                    ${caseData.print_code ? `<span>Code: ${caseData.print_code}</span>` : ''}
                </div>
            </div>
            <button class="btn btn-primary" onclick="openCaseModal(${caseId})">Edit Case</button>
        </div>

        ${caseData.case_summary ? `<div class="card" style="margin-bottom: 1.5rem;"><div class="card-body"><strong>Summary:</strong> ${caseData.case_summary}</div></div>` : ''}

        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="card-body">
                <div class="form-row">
                    <div><strong>Date of Injury:</strong> ${caseData.date_of_injury || '-'}</div>
                    <div><strong>Claim Due:</strong> ${caseData.claim_due || '-'}</div>
                    <div><strong>Complaint Due:</strong> ${caseData.complaint_due || '-'}</div>
                    <div><strong>Trial Date:</strong> ${caseData.trial_date || '-'}</div>
                </div>
            </div>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="showTab('tasks-tab', this)">Tasks (${caseData.tasks?.length || 0})</div>
            <div class="tab" onclick="showTab('deadlines-tab', this)">Deadlines (${caseData.deadlines?.length || 0})</div>
            <div class="tab" onclick="showTab('clients-tab', this)">Clients (${caseData.clients?.length || 0})</div>
            <div class="tab" onclick="showTab('contacts-tab', this)">Contacts (${caseData.contacts?.length || 0})</div>
            <div class="tab" onclick="showTab('notes-tab', this)">Notes (${caseData.notes?.length || 0})</div>
        </div>

        <div id="tasks-tab" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3>Tasks</h3>
                    <button class="btn btn-sm btn-primary" onclick="openTaskModal(${caseId})">+ Add Task</button>
                </div>
                <div class="card-body">
                    ${caseData.tasks?.length ? `
                        <table>
                            <thead><tr><th>Description</th><th>Due Date</th><th>Status</th><th>Urgency</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${caseData.tasks.map(t => `
                                    <tr class="${getUrgencyClass(t.urgency)}">
                                        <td>${t.description}</td>
                                        <td>${t.due_date || '-'}</td>
                                        <td>${getStatusBadge(t.status)}</td>
                                        <td>${t.urgency}</td>
                                        <td>
                                            <div class="actions">
                                                <button class="action-btn" onclick="openTaskModal(${caseId}, ${t.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                                <button class="action-btn delete" onclick="deleteTask(${t.id}, ${caseId})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No tasks yet</p></div>'}
                </div>
            </div>
        </div>

        <div id="deadlines-tab" class="tab-content" style="display:none;">
            <div class="card">
                <div class="card-header">
                    <h3>Deadlines</h3>
                    <button class="btn btn-sm btn-primary" onclick="openDeadlineModal(${caseId})">+ Add Deadline</button>
                </div>
                <div class="card-body">
                    ${caseData.deadlines?.length ? `
                        <table>
                            <thead><tr><th>Description</th><th>Date</th><th>Status</th><th>Urgency</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${caseData.deadlines.map(d => `
                                    <tr class="${getUrgencyClass(d.urgency)}">
                                        <td>${d.description}${d.calculation_note ? `<br><small style="color: var(--text-muted);">${d.calculation_note}</small>` : ''}</td>
                                        <td>${d.date}</td>
                                        <td>${getStatusBadge(d.status)}</td>
                                        <td>${d.urgency}</td>
                                        <td>
                                            <div class="actions">
                                                <button class="action-btn" onclick="openDeadlineModal(${caseId}, ${d.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                                <button class="action-btn delete" onclick="deleteDeadline(${d.id}, ${caseId})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No deadlines yet</p></div>'}
                </div>
            </div>
        </div>

        <div id="clients-tab" class="tab-content" style="display:none;">
            <div class="card">
                <div class="card-header"><h3>Clients</h3></div>
                <div class="card-body">
                    ${caseData.clients?.length ? `
                        <table>
                            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Contact Method</th></tr></thead>
                            <tbody>
                                ${caseData.clients.map(c => `
                                    <tr>
                                        <td>${c.name}${c.is_primary ? ' <span class="badge badge-blue">Primary</span>' : ''}</td>
                                        <td>${c.phone || '-'}</td>
                                        <td>${c.email || '-'}</td>
                                        <td>${c.contact_directly ? 'Direct' : `Via ${c.contact_via_name} (${c.contact_via_relationship})`}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No clients yet</p></div>'}
                </div>
            </div>
        </div>

        <div id="contacts-tab" class="tab-content" style="display:none;">
            <div class="card">
                <div class="card-header"><h3>Contacts</h3></div>
                <div class="card-body">
                    ${caseData.contacts?.length ? `
                        <table>
                            <thead><tr><th>Name</th><th>Firm</th><th>Role</th><th>Phone</th><th>Email</th></tr></thead>
                            <tbody>
                                ${caseData.contacts.map(c => `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td>${c.firm || '-'}</td>
                                        <td>${getStatusBadge(c.role)}</td>
                                        <td>${c.phone || '-'}</td>
                                        <td>${c.email || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><p>No contacts yet</p></div>'}
                </div>
            </div>
        </div>

        <div id="notes-tab" class="tab-content" style="display:none;">
            <div class="card">
                <div class="card-header">
                    <h3>Notes</h3>
                    <button class="btn btn-sm btn-primary" onclick="openNoteModal(${caseId})">+ Add Note</button>
                </div>
                <div class="card-body">
                    ${caseData.notes?.length ? caseData.notes.map(n => `
                        <div class="note-item">
                            <div class="note-date">${n.created_at}</div>
                            <div class="note-content">${n.content}</div>
                            <button class="action-btn delete" style="margin-top: 0.5rem;" onclick="deleteNote(${n.id}, ${caseId})">Delete</button>
                        </div>
                    `).join('') : '<div class="empty-state"><p>No notes yet</p></div>'}
                </div>
            </div>
        </div>
    `;
}

function showTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    el.classList.add('active');
}

// Tasks List
async function renderTasks() {
    const { tasks } = await API.get('/api/tasks');
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="page-header">
            <h2>All Tasks</h2>
        </div>

        <div class="filter-bar">
            <select class="form-control" id="task-status-filter" onchange="filterTasks()">
                <option value="">All Statuses</option>
                ${constants.task_statuses.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <select class="form-control" id="task-urgency-filter" onchange="filterTasks()">
                <option value="">All Urgencies</option>
                <option value="4">High (4-5)</option>
                <option value="3">Medium+ (3-5)</option>
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr><th>Description</th><th>Case</th><th>Due Date</th><th>Status</th><th>Urgency</th><th>Actions</th></tr></thead>
                    <tbody id="tasks-table">
                        ${tasks.map(t => `
                            <tr class="${getUrgencyClass(t.urgency)} task-row" data-status="${t.status}" data-urgency="${t.urgency}">
                                <td>${t.description}</td>
                                <td><a href="#" onclick="navigate('case', {id: ${t.case_id}}); return false;">${t.case_name}</a></td>
                                <td>${t.due_date || '-'}</td>
                                <td>${getStatusBadge(t.status)}</td>
                                <td>${t.urgency}</td>
                                <td>
                                    <div class="actions">
                                        <button class="action-btn" onclick="openTaskModal(${t.case_id}, ${t.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                        <button class="action-btn delete" onclick="deleteTask(${t.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function filterTasks() {
    const status = document.getElementById('task-status-filter').value;
    const urgency = document.getElementById('task-urgency-filter').value;
    document.querySelectorAll('.task-row').forEach(row => {
        const matchStatus = !status || row.dataset.status === status;
        const matchUrgency = !urgency || parseInt(row.dataset.urgency) >= parseInt(urgency);
        row.style.display = matchStatus && matchUrgency ? '' : 'none';
    });
}

// Deadlines List
async function renderDeadlines() {
    const { deadlines } = await API.get('/api/deadlines');
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="page-header">
            <h2>All Deadlines</h2>
        </div>

        <div class="filter-bar">
            <select class="form-control" id="deadline-status-filter" onchange="filterDeadlines()">
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
            </select>
            <select class="form-control" id="deadline-urgency-filter" onchange="filterDeadlines()">
                <option value="">All Urgencies</option>
                <option value="4">High (4-5)</option>
                <option value="3">Medium+ (3-5)</option>
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table>
                    <thead><tr><th>Description</th><th>Case</th><th>Date</th><th>Status</th><th>Urgency</th><th>Actions</th></tr></thead>
                    <tbody id="deadlines-table">
                        ${deadlines.map(d => `
                            <tr class="${getUrgencyClass(d.urgency)} deadline-row" data-status="${d.status}" data-urgency="${d.urgency}">
                                <td>${d.description}${d.calculation_note ? `<br><small style="color: var(--text-muted);">${d.calculation_note}</small>` : ''}</td>
                                <td><a href="#" onclick="navigate('case', {id: ${d.case_id}}); return false;">${d.case_name}</a></td>
                                <td>${d.date}</td>
                                <td>${getStatusBadge(d.status)}</td>
                                <td>${d.urgency}</td>
                                <td>
                                    <div class="actions">
                                        <button class="action-btn" onclick="openDeadlineModal(${d.case_id}, ${d.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                        <button class="action-btn delete" onclick="deleteDeadline(${d.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function filterDeadlines() {
    const status = document.getElementById('deadline-status-filter').value;
    const urgency = document.getElementById('deadline-urgency-filter').value;
    document.querySelectorAll('.deadline-row').forEach(row => {
        const matchStatus = !status || row.dataset.status === status;
        const matchUrgency = !urgency || parseInt(row.dataset.urgency) >= parseInt(urgency);
        row.style.display = matchStatus && matchUrgency ? '' : 'none';
    });
}

// Modal helpers
function openModal() {
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// Case Modal
async function openCaseModal(caseId = null) {
    let caseData = {};
    if (caseId) {
        caseData = await API.get(`/api/cases/${caseId}`);
    }

    document.getElementById('modal-content').innerHTML = `
        <div class="modal-header">
            <h3>${caseId ? 'Edit Case' : 'New Case'}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="case-form">
                <input type="hidden" id="case-id" value="${caseId || ''}">
                <div class="form-group">
                    <label>Case Name *</label>
                    <input type="text" class="form-control" id="case-name" value="${caseData.case_name || ''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" id="case-status">
                            ${constants.case_statuses.map(s => `<option value="${s}" ${caseData.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Print Code</label>
                        <input type="text" class="form-control" id="case-print-code" value="${caseData.print_code || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Court</label>
                    <input type="text" class="form-control" id="case-court" value="${caseData.court || ''}">
                </div>
                <div class="form-group">
                    <label>Summary</label>
                    <textarea class="form-control" id="case-summary">${caseData.case_summary || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date of Injury</label>
                        <input type="date" class="form-control" id="case-doi" value="${caseData.date_of_injury || ''}">
                    </div>
                    <div class="form-group">
                        <label>Claim Due</label>
                        <input type="date" class="form-control" id="case-claim-due" value="${caseData.claim_due || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Complaint Due</label>
                        <input type="date" class="form-control" id="case-complaint-due" value="${caseData.complaint_due || ''}">
                    </div>
                    <div class="form-group">
                        <label>Trial Date</label>
                        <input type="date" class="form-control" id="case-trial" value="${caseData.trial_date || ''}">
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveCase()">Save</button>
        </div>
    `;
    openModal();
}

async function saveCase() {
    const id = document.getElementById('case-id').value;
    const data = {
        case_name: document.getElementById('case-name').value,
        status: document.getElementById('case-status').value,
        print_code: document.getElementById('case-print-code').value || null,
        court: document.getElementById('case-court').value || null,
        case_summary: document.getElementById('case-summary').value || null,
        date_of_injury: document.getElementById('case-doi').value || null,
        claim_due: document.getElementById('case-claim-due').value || null,
        complaint_due: document.getElementById('case-complaint-due').value || null,
        trial_date: document.getElementById('case-trial').value || null
    };

    if (id) {
        await API.put(`/api/cases/${id}`, data);
        showToast('Case updated');
    } else {
        await API.post('/api/cases', data);
        showToast('Case created');
    }
    closeModal();
    if (id && currentView === 'case') {
        renderCaseDetail(id);
    } else {
        renderCases();
    }
}

async function deleteCase(id) {
    if (confirm('Delete this case and all related data?')) {
        await API.delete(`/api/cases/${id}`);
        showToast('Case deleted');
        renderCases();
    }
}

// Task Modal
async function openTaskModal(caseId, taskId = null) {
    let taskData = {};
    if (taskId) {
        const { tasks } = await API.get(`/api/tasks?case_id=${caseId}`);
        taskData = tasks.find(t => t.id === taskId) || {};
    }

    document.getElementById('modal-content').innerHTML = `
        <div class="modal-header">
            <h3>${taskId ? 'Edit Task' : 'New Task'}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="task-form">
                <input type="hidden" id="task-id" value="${taskId || ''}">
                <input type="hidden" id="task-case-id" value="${caseId}">
                <div class="form-group">
                    <label>Description *</label>
                    <textarea class="form-control" id="task-description" required>${taskData.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Due Date</label>
                        <input type="date" class="form-control" id="task-due-date" value="${taskData.due_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>Urgency (1-5)</label>
                        <select class="form-control" id="task-urgency">
                            ${[1,2,3,4,5].map(u => `<option value="${u}" ${(taskData.urgency || 3) === u ? 'selected' : ''}>${u}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select class="form-control" id="task-status">
                        ${constants.task_statuses.map(s => `<option value="${s}" ${(taskData.status || 'Pending') === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveTask()">Save</button>
        </div>
    `;
    openModal();
}

async function saveTask() {
    const id = document.getElementById('task-id').value;
    const caseId = document.getElementById('task-case-id').value;
    const data = {
        description: document.getElementById('task-description').value,
        due_date: document.getElementById('task-due-date').value || null,
        urgency: parseInt(document.getElementById('task-urgency').value),
        status: document.getElementById('task-status').value
    };

    if (id) {
        await API.put(`/api/tasks/${id}`, data);
        showToast('Task updated');
    } else {
        data.case_id = parseInt(caseId);
        await API.post('/api/tasks', data);
        showToast('Task created');
    }
    closeModal();
    if (currentView === 'case') renderCaseDetail(caseId);
    else renderTasks();
}

async function deleteTask(id, caseId = null) {
    if (confirm('Delete this task?')) {
        await API.delete(`/api/tasks/${id}`);
        showToast('Task deleted');
        if (caseId) renderCaseDetail(caseId);
        else renderTasks();
    }
}

// Deadline Modal
async function openDeadlineModal(caseId, deadlineId = null) {
    let deadlineData = {};
    if (deadlineId) {
        const { deadlines } = await API.get(`/api/deadlines`);
        deadlineData = deadlines.find(d => d.id === deadlineId) || {};
    }

    document.getElementById('modal-content').innerHTML = `
        <div class="modal-header">
            <h3>${deadlineId ? 'Edit Deadline' : 'New Deadline'}</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="deadline-form">
                <input type="hidden" id="deadline-id" value="${deadlineId || ''}">
                <input type="hidden" id="deadline-case-id" value="${caseId}">
                <div class="form-group">
                    <label>Description *</label>
                    <textarea class="form-control" id="deadline-description" required>${deadlineData.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" class="form-control" id="deadline-date" value="${deadlineData.date || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Urgency (1-5)</label>
                        <select class="form-control" id="deadline-urgency">
                            ${[1,2,3,4,5].map(u => `<option value="${u}" ${(deadlineData.urgency || 3) === u ? 'selected' : ''}>${u}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" id="deadline-status">
                            <option value="Pending" ${deadlineData.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Complete" ${deadlineData.status === 'Complete' ? 'selected' : ''}>Complete</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Calculation Note</label>
                        <input type="text" class="form-control" id="deadline-calc" value="${deadlineData.calculation_note || ''}" placeholder="e.g., Filing + 60 days">
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveDeadline()">Save</button>
        </div>
    `;
    openModal();
}

async function saveDeadline() {
    const id = document.getElementById('deadline-id').value;
    const caseId = document.getElementById('deadline-case-id').value;
    const data = {
        description: document.getElementById('deadline-description').value,
        date: document.getElementById('deadline-date').value,
        urgency: parseInt(document.getElementById('deadline-urgency').value),
        status: document.getElementById('deadline-status').value,
        calculation_note: document.getElementById('deadline-calc').value || null
    };

    if (id) {
        await API.put(`/api/deadlines/${id}`, data);
        showToast('Deadline updated');
    } else {
        data.case_id = parseInt(caseId);
        await API.post('/api/deadlines', data);
        showToast('Deadline created');
    }
    closeModal();
    if (currentView === 'case') renderCaseDetail(caseId);
    else renderDeadlines();
}

async function deleteDeadline(id, caseId = null) {
    if (confirm('Delete this deadline?')) {
        await API.delete(`/api/deadlines/${id}`);
        showToast('Deadline deleted');
        if (caseId) renderCaseDetail(caseId);
        else renderDeadlines();
    }
}

// Note Modal
function openNoteModal(caseId) {
    document.getElementById('modal-content').innerHTML = `
        <div class="modal-header">
            <h3>Add Note</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <form id="note-form">
                <input type="hidden" id="note-case-id" value="${caseId}">
                <div class="form-group">
                    <label>Note Content *</label>
                    <textarea class="form-control" id="note-content" required style="min-height: 150px;"></textarea>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="saveNote()">Save</button>
        </div>
    `;
    openModal();
}

async function saveNote() {
    const caseId = document.getElementById('note-case-id').value;
    await API.post('/api/notes', {
        case_id: parseInt(caseId),
        content: document.getElementById('note-content').value
    });
    showToast('Note added');
    closeModal();
    renderCaseDetail(caseId);
}

async function deleteNote(id, caseId) {
    if (confirm('Delete this note?')) {
        await API.delete(`/api/notes/${id}`);
        showToast('Note deleted');
        renderCaseDetail(caseId);
    }
}

// Initialize
async function init() {
    constants = await API.get('/api/constants');
    navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
