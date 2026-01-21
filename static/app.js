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

// Human-readable date formatting
function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const formatted = date.toLocaleDateString('en-US', options);

    // Add relative indicator for upcoming dates
    if (diffDays === 0) return `${formatted} (Today)`;
    if (diffDays === 1) return `${formatted} (Tomorrow)`;
    if (diffDays === -1) return `${formatted} (Yesterday)`;
    if (diffDays > 0 && diffDays <= 7) return `${formatted} (in ${diffDays} days)`;
    if (diffDays < 0 && diffDays >= -7) return `${formatted} (${Math.abs(diffDays)} days ago)`;

    return formatted;
}

function formatDateTime(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

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
        'Partially Complete': 'yellow', 'Blocked': 'red', 'Awaiting Atty Review': 'purple',
        'Complete': 'green'
    };
    return `<span class="badge badge-${colors[status] || 'gray'}">${status}</span>`;
}

function getUrgencyBadge(urgency) {
    const labels = { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Critical' };
    const colors = { 1: 'green', 2: 'green', 3: 'yellow', 4: 'red', 5: 'red' };
    return `<span class="badge badge-${colors[urgency]}">${labels[urgency]}</span>`;
}

function getUrgencyClass(urgency) {
    return `urgency-${urgency}`;
}

// Dashboard
async function renderDashboard() {
    const [stats, tasksRes, deadlinesRes, casesRes] = await Promise.all([
        API.get('/api/v1/stats'),
        API.get('/api/v1/tasks?status=Pending'),
        API.get('/api/v1/deadlines?status=Pending'),
        API.get('/api/v1/cases')
    ]);

    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Dashboard</h2>
            <button class="btn btn-primary" onclick="openCaseModal()">+ New Case</button>
        </div>

        <div class="stats-grid">
            <div class="stat-card" onclick="navigate('cases')" style="cursor:pointer">
                <div class="stat-icon blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.active_cases}</div>
                    <div class="stat-label">Active Cases</div>
                </div>
            </div>
            <div class="stat-card" onclick="navigate('tasks')" style="cursor:pointer">
                <div class="stat-icon yellow">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.pending_tasks}</div>
                    <div class="stat-label">Pending Tasks</div>
                </div>
            </div>
            <div class="stat-card" onclick="navigate('deadlines')" style="cursor:pointer">
                <div class="stat-icon green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.upcoming_deadlines}</div>
                    <div class="stat-label">Upcoming Deadlines</div>
                </div>
            </div>
            <div class="stat-card urgent">
                <div class="stat-icon red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div class="stat-content">
                    <div class="stat-value">${stats.urgent_tasks + stats.urgent_deadlines}</div>
                    <div class="stat-label">Urgent Items</div>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="dashboard-main">
                <div class="card">
                    <div class="card-header">
                        <h3>Pending Tasks</h3>
                        <button class="btn btn-sm btn-secondary" onclick="navigate('tasks')">View All</button>
                    </div>
                    <div class="card-body no-padding">
                        ${tasksRes.tasks.length ? `
                            <div class="list-view">
                                ${tasksRes.tasks.slice(0, 8).map(t => `
                                    <div class="list-item ${getUrgencyClass(t.urgency)}" onclick="navigate('case', {id: ${t.case_id}})">
                                        <div class="list-item-main">
                                            <div class="list-item-title">${t.description}</div>
                                            <div class="list-item-meta">
                                                <span class="meta-case">${t.case_name}</span>
                                                ${t.due_date ? `<span class="meta-date">${formatDate(t.due_date)}</span>` : ''}
                                            </div>
                                        </div>
                                        <div class="list-item-side">
                                            ${getUrgencyBadge(t.urgency)}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="empty-state"><p>No pending tasks</p></div>'}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3>Upcoming Deadlines</h3>
                        <button class="btn btn-sm btn-secondary" onclick="navigate('deadlines')">View All</button>
                    </div>
                    <div class="card-body no-padding">
                        ${deadlinesRes.deadlines.length ? `
                            <div class="list-view">
                                ${deadlinesRes.deadlines.slice(0, 8).map(d => `
                                    <div class="list-item ${getUrgencyClass(d.urgency)}" onclick="navigate('case', {id: ${d.case_id}})">
                                        <div class="list-item-main">
                                            <div class="list-item-title">${d.description}</div>
                                            <div class="list-item-meta">
                                                <span class="meta-case">${d.case_name}</span>
                                                <span class="meta-date">${formatDate(d.date)}</span>
                                            </div>
                                        </div>
                                        <div class="list-item-side">
                                            ${getUrgencyBadge(d.urgency)}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="empty-state"><p>No upcoming deadlines</p></div>'}
                    </div>
                </div>
            </div>

            <div class="dashboard-sidebar">
                <div class="card">
                    <div class="card-header">
                        <h3>Recent Cases</h3>
                    </div>
                    <div class="card-body no-padding">
                        <div class="case-list">
                            ${casesRes.cases.slice(0, 6).map(c => `
                                <div class="case-list-item" onclick="navigate('case', {id: ${c.id}})">
                                    <div class="case-list-name">${c.case_name}</div>
                                    <div class="case-list-status">${getStatusBadge(c.status)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Cases List
async function renderCases() {
    const { cases } = await API.get('/api/v1/cases');
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

        <div class="cases-grid">
            ${cases.map(c => `
                <div class="case-card case-row" data-name="${c.case_name.toLowerCase()}" data-status="${c.status}" onclick="navigate('case', {id: ${c.id}})">
                    <div class="case-card-header">
                        <h3 class="case-card-title">${c.case_name}</h3>
                        <div class="case-card-actions" onclick="event.stopPropagation()">
                            <button class="action-btn" onclick="openCaseModal(${c.id})" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="action-btn delete" onclick="deleteCase(${c.id})" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="case-card-body">
                        <div class="case-card-meta">
                            ${getStatusBadge(c.status)}
                            ${c.court ? `<span class="meta-court">${c.court}</span>` : ''}
                        </div>
                        ${c.print_code ? `<div class="case-card-code">Code: ${c.print_code}</div>` : ''}
                    </div>
                </div>
            `).join('')}
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

// Case Detail - All sections visible, no tabs
async function renderCaseDetail(caseId) {
    const caseData = await API.get(`/api/cases/${caseId}`);
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="case-detail">
            <div class="case-detail-header">
                <button class="btn btn-sm btn-secondary back-btn" onclick="navigate('cases')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back
                </button>
                <div class="case-detail-title-row">
                    <div>
                        <h1 class="case-detail-title">${caseData.case_name}</h1>
                        <div class="case-detail-meta">
                            ${getStatusBadge(caseData.status)}
                            ${caseData.court ? `<span class="meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg> ${caseData.court}</span>` : ''}
                            ${caseData.print_code ? `<span class="meta-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${caseData.print_code}</span>` : ''}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="openCaseModal(${caseId})">Edit Case</button>
                </div>
            </div>

            ${caseData.case_summary ? `
                <div class="case-summary">
                    <h4>Summary</h4>
                    <p>${caseData.case_summary}</p>
                </div>
            ` : ''}

            <div class="key-dates-grid">
                <div class="key-date ${getDueDateClass(caseData.date_of_injury)}">
                    <div class="key-date-label">Date of Injury</div>
                    <div class="key-date-value">${formatDate(caseData.date_of_injury) || 'Not set'}</div>
                </div>
                <div class="key-date ${getDueDateClass(caseData.claim_due)}">
                    <div class="key-date-label">Claim Due</div>
                    <div class="key-date-value">${formatDate(caseData.claim_due) || 'Not set'}</div>
                </div>
                <div class="key-date ${getDueDateClass(caseData.complaint_due)}">
                    <div class="key-date-label">Complaint Due</div>
                    <div class="key-date-value">${formatDate(caseData.complaint_due) || 'Not set'}</div>
                </div>
                <div class="key-date ${getDueDateClass(caseData.trial_date)}">
                    <div class="key-date-label">Trial Date</div>
                    <div class="key-date-value">${formatDate(caseData.trial_date) || 'Not set'}</div>
                </div>
            </div>

            <!-- Tasks Section -->
            <section class="case-section">
                <div class="section-header">
                    <h2>Tasks <span class="count">${caseData.tasks?.length || 0}</span></h2>
                    <button class="btn btn-sm btn-primary" onclick="openTaskModal(${caseId})">+ Add Task</button>
                </div>
                ${caseData.tasks?.length ? `
                    <div class="section-content">
                        ${caseData.tasks.map(t => `
                            <div class="item-card ${getUrgencyClass(t.urgency)}">
                                <div class="item-card-main">
                                    <div class="item-card-title">${t.description}</div>
                                    <div class="item-card-details">
                                        ${t.due_date ? `<span class="detail-date">${formatDate(t.due_date)}</span>` : '<span class="detail-date no-date">No due date</span>'}
                                        ${getStatusBadge(t.status)}
                                        ${getUrgencyBadge(t.urgency)}
                                    </div>
                                </div>
                                <div class="item-card-actions">
                                    <button class="action-btn" onclick="openTaskModal(${caseId}, ${t.id})" title="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button class="action-btn delete" onclick="deleteTask(${t.id}, ${caseId})" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-section">No tasks yet</div>'}
            </section>

            <!-- Deadlines Section -->
            <section class="case-section">
                <div class="section-header">
                    <h2>Deadlines <span class="count">${caseData.deadlines?.length || 0}</span></h2>
                    <button class="btn btn-sm btn-primary" onclick="openDeadlineModal(${caseId})">+ Add Deadline</button>
                </div>
                ${caseData.deadlines?.length ? `
                    <div class="section-content">
                        ${caseData.deadlines.map(d => `
                            <div class="item-card ${getUrgencyClass(d.urgency)}">
                                <div class="item-card-main">
                                    <div class="item-card-title">${d.description}</div>
                                    ${d.calculation_note ? `<div class="item-card-note">${d.calculation_note}</div>` : ''}
                                    <div class="item-card-details">
                                        <span class="detail-date">${formatDate(d.date)}</span>
                                        ${getStatusBadge(d.status)}
                                        ${getUrgencyBadge(d.urgency)}
                                    </div>
                                </div>
                                <div class="item-card-actions">
                                    <button class="action-btn" onclick="openDeadlineModal(${caseId}, ${d.id})" title="Edit">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button class="action-btn delete" onclick="deleteDeadline(${d.id}, ${caseId})" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-section">No deadlines yet</div>'}
            </section>

            <!-- Clients Section -->
            <section class="case-section">
                <div class="section-header">
                    <h2>Clients <span class="count">${caseData.clients?.length || 0}</span></h2>
                </div>
                ${caseData.clients?.length ? `
                    <div class="people-grid">
                        ${caseData.clients.map(c => `
                            <div class="person-card">
                                <div class="person-avatar">${c.name.charAt(0).toUpperCase()}</div>
                                <div class="person-info">
                                    <div class="person-name">
                                        ${c.name}
                                        ${c.is_primary ? '<span class="badge badge-blue">Primary</span>' : ''}
                                    </div>
                                    <div class="person-details">
                                        ${c.phone ? `<div class="person-detail"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${c.phone}</div>` : ''}
                                        ${c.email ? `<div class="person-detail"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${c.email}</div>` : ''}
                                        <div class="person-contact-method">
                                            ${c.contact_directly ? 'Contact directly' : `Contact via ${c.contact_via_name} (${c.contact_via_relationship})`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-section">No clients yet</div>'}
            </section>

            <!-- Contacts Section -->
            <section class="case-section">
                <div class="section-header">
                    <h2>Contacts <span class="count">${caseData.contacts?.length || 0}</span></h2>
                </div>
                ${caseData.contacts?.length ? `
                    <div class="people-grid">
                        ${caseData.contacts.map(c => `
                            <div class="person-card">
                                <div class="person-avatar contact">${c.name.charAt(0).toUpperCase()}</div>
                                <div class="person-info">
                                    <div class="person-name">
                                        ${c.name}
                                        ${getStatusBadge(c.role)}
                                    </div>
                                    ${c.firm ? `<div class="person-firm">${c.firm}</div>` : ''}
                                    <div class="person-details">
                                        ${c.phone ? `<div class="person-detail"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${c.phone}</div>` : ''}
                                        ${c.email ? `<div class="person-detail"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${c.email}</div>` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-section">No contacts yet</div>'}
            </section>

            <!-- Notes Section -->
            <section class="case-section">
                <div class="section-header">
                    <h2>Notes <span class="count">${caseData.notes?.length || 0}</span></h2>
                    <button class="btn btn-sm btn-primary" onclick="openNoteModal(${caseId})">+ Add Note</button>
                </div>
                ${caseData.notes?.length ? `
                    <div class="notes-list">
                        ${caseData.notes.map(n => `
                            <div class="note-card">
                                <div class="note-header">
                                    <span class="note-date">${formatDateTime(n.created_at)}</span>
                                    <button class="action-btn delete" onclick="deleteNote(${n.id}, ${caseId})" title="Delete">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                <div class="note-content">${n.content}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-section">No notes yet</div>'}
            </section>
        </div>
    `;
}

function getDueDateClass(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'soon';
    return '';
}

// Tasks List
async function renderTasks() {
    const { tasks } = await API.get('/api/v1/tasks');
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
                <option value="5">Critical (5)</option>
                <option value="4">High+ (4-5)</option>
                <option value="3">Medium+ (3-5)</option>
            </select>
        </div>

        <div class="list-view card">
            ${tasks.length ? tasks.map(t => `
                <div class="list-item ${getUrgencyClass(t.urgency)} task-row" data-status="${t.status}" data-urgency="${t.urgency}">
                    <div class="list-item-main">
                        <div class="list-item-title">${t.description}</div>
                        <div class="list-item-meta">
                            <a href="#" class="meta-case" onclick="navigate('case', {id: ${t.case_id}}); return false;">${t.case_name}</a>
                            ${t.due_date ? `<span class="meta-date">${formatDate(t.due_date)}</span>` : '<span class="meta-date no-date">No due date</span>'}
                        </div>
                    </div>
                    <div class="list-item-side">
                        ${getStatusBadge(t.status)}
                        ${getUrgencyBadge(t.urgency)}
                        <div class="actions">
                            <button class="action-btn" onclick="openTaskModal(${t.case_id}, ${t.id})" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="action-btn delete" onclick="deleteTask(${t.id})" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') : '<div class="empty-state"><p>No tasks</p></div>'}
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
    const { deadlines } = await API.get('/api/v1/deadlines');
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
                <option value="5">Critical (5)</option>
                <option value="4">High+ (4-5)</option>
                <option value="3">Medium+ (3-5)</option>
            </select>
        </div>

        <div class="list-view card">
            ${deadlines.length ? deadlines.map(d => `
                <div class="list-item ${getUrgencyClass(d.urgency)} deadline-row" data-status="${d.status}" data-urgency="${d.urgency}">
                    <div class="list-item-main">
                        <div class="list-item-title">${d.description}</div>
                        ${d.calculation_note ? `<div class="list-item-note">${d.calculation_note}</div>` : ''}
                        <div class="list-item-meta">
                            <a href="#" class="meta-case" onclick="navigate('case', {id: ${d.case_id}}); return false;">${d.case_name}</a>
                            <span class="meta-date">${formatDate(d.date)}</span>
                        </div>
                    </div>
                    <div class="list-item-side">
                        ${getStatusBadge(d.status)}
                        ${getUrgencyBadge(d.urgency)}
                        <div class="actions">
                            <button class="action-btn" onclick="openDeadlineModal(${d.case_id}, ${d.id})" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="action-btn delete" onclick="deleteDeadline(${d.id})" title="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') : '<div class="empty-state"><p>No deadlines</p></div>'}
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
        await API.post('/api/v1/cases', data);
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
                        <label>Urgency</label>
                        <select class="form-control" id="task-urgency">
                            <option value="1" ${(taskData.urgency || 3) === 1 ? 'selected' : ''}>1 - Low</option>
                            <option value="2" ${(taskData.urgency || 3) === 2 ? 'selected' : ''}>2 - Low</option>
                            <option value="3" ${(taskData.urgency || 3) === 3 ? 'selected' : ''}>3 - Medium</option>
                            <option value="4" ${(taskData.urgency || 3) === 4 ? 'selected' : ''}>4 - High</option>
                            <option value="5" ${(taskData.urgency || 3) === 5 ? 'selected' : ''}>5 - Critical</option>
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
        await API.post('/api/v1/tasks', data);
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
                        <label>Urgency</label>
                        <select class="form-control" id="deadline-urgency">
                            <option value="1" ${(deadlineData.urgency || 3) === 1 ? 'selected' : ''}>1 - Low</option>
                            <option value="2" ${(deadlineData.urgency || 3) === 2 ? 'selected' : ''}>2 - Low</option>
                            <option value="3" ${(deadlineData.urgency || 3) === 3 ? 'selected' : ''}>3 - Medium</option>
                            <option value="4" ${(deadlineData.urgency || 3) === 4 ? 'selected' : ''}>4 - High</option>
                            <option value="5" ${(deadlineData.urgency || 3) === 5 ? 'selected' : ''}>5 - Critical</option>
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
        await API.post('/api/v1/deadlines', data);
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
    await API.post('/api/v1/notes', {
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
    constants = await API.get('/api/v1/constants');
    navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
