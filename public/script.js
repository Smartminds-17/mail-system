// API base URL
const API_BASE = '/api';
const PREFERENCES_KEY = 'sendchap_preferences';
const DEFAULT_PREFERENCES = { accent: 'indigo', showSms: true };
const ACCENT_PRESETS = {
    indigo: { brand: '#5b5cf0', dark: '#4849d8', soft: '#eeeeff' },
    blue: { brand: '#1570ef', dark: '#175cd3', soft: '#eff8ff' },
    emerald: { brand: '#079455', dark: '#067647', soft: '#ecfdf3' },
    rose: { brand: '#e31b54', dark: '#c01048', soft: '#fff1f3' }
};

function getPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY));
        return {
            accent: ACCENT_PRESETS[saved?.accent] ? saved.accent : DEFAULT_PREFERENCES.accent,
            showSms: typeof saved?.showSms === 'boolean' ? saved.showSms : DEFAULT_PREFERENCES.showSms
        };
    } catch (error) {
        return { ...DEFAULT_PREFERENCES };
    }
}

function applyPreferences(preferences) {
    const colors = ACCENT_PRESETS[preferences.accent] || ACCENT_PRESETS.indigo;
    const root = document.documentElement;
    root.style.setProperty('--brand', colors.brand);
    root.style.setProperty('--brand-dark', colors.dark);
    root.style.setProperty('--brand-soft', colors.soft);
    document.querySelectorAll('[data-page="sms"]').forEach(link => { link.hidden = !preferences.showSms; });
}

applyPreferences(getPreferences());

async function loadAppVersion() {
    const labels = document.querySelectorAll('[data-app-version]');
    if (!labels.length) return;
    try {
        const response = await fetch(`${API_BASE}/version`);
        if (!response.ok) return;
        const { version } = await response.json();
        labels.forEach(label => { label.textContent = `Version ${version}`; });
    } catch (error) {
        // Version metadata is non-critical; keep the quiet fallback label.
    }
}

loadAppVersion();

if (window.Chart) {
    Chart.defaults.font.family = "'Hanken Grotesk', sans-serif";
    Chart.defaults.color = '#667085';
    Chart.defaults.borderColor = '#e4e7ec';
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

// Check if user is logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Show/hide loading
function showLoading(element) {
    element.innerHTML = '<div class="loading">Loading...</div>';
}

function hideLoading(element) {
    const loading = element.querySelector('.loading');
    if (loading) loading.remove();
}

// Show message
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);

    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// API calls
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };

    // Don't set Content-Type for FormData (file uploads)
    if (!(options.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
    }

    return response.json();
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            window.location.href = '/dashboard';
        } else {
            showMessage(response.error || 'Login failed', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// Register form handler
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    if (data.password !== data.confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    delete data.confirmPassword;

    try {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            window.location.href = '/login';
        } else {
            showMessage(response.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
});

// Load dashboard
async function loadDashboard() {
    if (!checkAuth()) return;

    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('userName').textContent = `Welcome, ${user.name}`;

    const campaignsList = document.getElementById('campaignsList');
    showLoading(campaignsList);

    try {
        const campaigns = await apiCall('/emails/campaigns');

        if (campaigns.length === 0) {
            campaignsList.innerHTML = '<p>No campaigns yet. Create your first campaign!</p>';
            return;
        }

        campaignsList.innerHTML = campaigns.map(campaign => `
            <div class="campaign-card">
                <div class="campaign-copy">
                    <h3>${escapeHtml(campaign.subject)} <span class="campaign-status">${escapeHtml(campaign.status || 'draft')}</span></h3>
                    <div class="campaign-meta">${campaign.status === 'scheduled' ? `Scheduled ${new Date(campaign.scheduled_at).toLocaleString()}` : `Created ${new Date(campaign.created_at).toLocaleDateString()}`}</div>
                </div>
                <div class="campaign-actions">
                    ${['draft', 'scheduled'].includes(campaign.status || 'draft') ? `<button class="btn-send" onclick="sendCampaign(${campaign.id})">Send Now</button>` : ''}
                    ${['draft', 'scheduled'].includes(campaign.status || 'draft') ? `<button class="btn-secondary" onclick="scheduleCampaign(${campaign.id})">Schedule</button>` : ''}
                    ${campaign.status === 'scheduled' ? `<button class="btn-secondary" onclick="cancelCampaign(${campaign.id})">Cancel schedule</button>` : ''}
                    <button class="btn-view" onclick="viewLogs(${campaign.id})">View Logs</button>
                    <button class="btn-danger" onclick="deleteCampaign(${campaign.id})">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        campaignsList.innerHTML = '<p>Error loading campaigns. Please refresh the page.</p>';
    }
}

// New campaign modal
const modal = document.getElementById('campaignModal');
const newCampaignBtn = document.getElementById('newCampaignBtn');

// Open modal
newCampaignBtn?.addEventListener('click', () => {
    modal.style.display = 'block';
});

// Close modal
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Campaign form handler
const campaignForm = document.getElementById('campaignForm');
const campaignReview = document.getElementById('campaignReview');
const createCampaignBtn = document.getElementById('createCampaignBtn');
let campaignReviewed = false;

function invalidateCampaignReview() {
    campaignReviewed = false;
    if (createCampaignBtn) createCampaignBtn.disabled = true;
}

campaignForm?.addEventListener('input', invalidateCampaignReview);
campaignForm?.addEventListener('change', invalidateCampaignReview);

document.getElementById('reviewCampaignBtn')?.addEventListener('click', async () => {
    if (!campaignForm.reportValidity()) return;
    const reviewButton = document.getElementById('reviewCampaignBtn');
    reviewButton.disabled = true;
    reviewButton.textContent = 'Reviewing…';

    try {
        const response = await apiCall('/emails/campaigns/analyze', {
            method: 'POST',
            body: new FormData(campaignForm)
        });
        if (response.error) {
            showMessage(response.error, 'error');
            return;
        }

        document.getElementById('reviewStats').innerHTML = [
            ['Rows', response.totalRows], ['Valid', response.validRows],
            ['Invalid', response.invalidRows], ['Duplicates', response.duplicates]
        ].map(([label, value]) => `<div class="review-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

        const issues = document.getElementById('reviewIssues');
        issues.className = response.issues.length ? 'review-issues' : '';
        issues.innerHTML = response.issues.length
            ? response.issues.map(issue => `<p>Row ${issue.row}: ${escapeHtml(issue.email || 'missing email')} — ${escapeHtml(issue.reason)}</p>`).join('')
            : '<p>Every recipient row is valid.</p>';

        const preview = document.getElementById('emailPreview');
        preview.hidden = !response.preview;
        if (response.preview) {
            preview.querySelector('.preview-recipient').textContent = `Preview for ${response.preview.recipient.name} <${response.preview.recipient.email}>`;
            preview.querySelector('.preview-subject').textContent = response.preview.subject;
            preview.querySelector('iframe').srcdoc = response.preview.html;
        }

        campaignReview.hidden = false;
        campaignReviewed = response.validRows > 0;
        createCampaignBtn.disabled = !campaignReviewed;
    } catch (error) {
        showMessage('Could not review this CSV file.', 'error');
    } finally {
        reviewButton.disabled = false;
        reviewButton.textContent = 'Review recipients';
    }
});

document.getElementById('testEmailBtn')?.addEventListener('click', async () => {
    const subjectInput = document.getElementById('campaignSubject');
    const bodyInput = document.getElementById('campaignBody');
    if (!subjectInput.reportValidity() || !bodyInput.reportValidity()) return;
    const response = await apiCall('/emails/campaigns/test-send', {
        method: 'POST',
        body: JSON.stringify({
            subject: document.getElementById('campaignSubject').value,
            body: document.getElementById('campaignBody').value
        })
    });
    showMessage(response.message || response.error, response.message ? 'success' : 'error');
});

campaignForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!campaignReviewed) {
        showMessage('Review recipients before creating the campaign.', 'error');
        return;
    }

    const formData = new FormData(e.target);

    try {
        const response = await apiCall('/emails/campaigns', {
            method: 'POST',
            body: formData
        });

        if (response.jobId) {
            showMessage(`Campaign created successfully! ${response.recipientCount} recipients loaded.`, 'success');
            modal.style.display = 'none';
            e.target.reset();
            campaignReview.hidden = true;
            invalidateCampaignReview();
            loadDashboard();
        } else {
            showMessage(response.error || 'Failed to create campaign', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// Send campaign
async function sendCampaign(jobId) {
    if (!confirm('Are you sure you want to send this campaign?')) return;

    try {
        const response = await apiCall(`/emails/campaigns/${jobId}/send`, {
            method: 'POST'
        });

        if (response.message) {
            showMessage(response.message, response.failed || response.skipped ? 'error' : 'success');
            loadDashboard();
        } else {
            showMessage(response.error || 'Failed to send campaign', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

// Delete campaign
async function deleteCampaign(jobId) {
    if (!await confirmDestructiveAction()) return;

    try {
        await apiCall(`/emails/campaigns/${jobId}`, { method: 'DELETE' });
        showMessage('Campaign deleted successfully', 'success');
        loadDashboard();
    } catch (error) {
        showMessage('Error deleting campaign', 'error');
    }
}

function confirmDestructiveAction() {
    const dialog = document.getElementById('confirmModal');
    dialog.style.display = 'block';
    document.getElementById('confirmCancel').focus();
    return new Promise(resolve => {
        const finish = value => { dialog.style.display = 'none'; resolve(value); };
        document.getElementById('confirmCancel').onclick = () => finish(false);
        document.getElementById('confirmDelete').onclick = () => finish(true);
    });
}

function scheduleCampaign(jobId) {
    const dialog = document.getElementById('scheduleModal');
    const input = document.getElementById('scheduleTime');
    dialog.style.display = 'block';
    input.min = new Date(Date.now() + 60000).toISOString().slice(0, 16);
    input.focus();
    document.getElementById('scheduleCancel').onclick = () => { dialog.style.display = 'none'; };
    document.getElementById('scheduleSave').onclick = async () => {
        if (!input.reportValidity() || !input.value) return;
        const response = await apiCall(`/emails/campaigns/${jobId}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt: new Date(input.value).toISOString() }) });
        showMessage(response.message || response.error, response.message ? 'success' : 'error');
        if (response.message) { dialog.style.display = 'none'; loadDashboard(); }
    };
}

async function cancelCampaign(jobId) {
    const response = await apiCall(`/emails/campaigns/${jobId}/cancel`, { method: 'POST' });
    showMessage(response.message || response.error, response.message ? 'success' : 'error');
    if (response.message) loadDashboard();
}

// View logs
async function viewLogs(jobId) {
    try {
        const logs = await apiCall(`/emails/campaigns/${jobId}/logs`);

        const logsHtml = logs.map(log => `
            <tr>
                <td><input type="checkbox" class="recipient-checkbox" data-id="${log.id}"></td>
                <td>${escapeHtml(log.recipient_name)}</td>
                <td>${escapeHtml(log.recipient_email)}</td>
                <td><span class="status-${escapeHtml(log.status)}">${escapeHtml(log.status)}</span></td>
                <td>${log.opened ? 'Yes' : 'No'}</td>
                <td>${log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}</td>
                <td>
                    <div class="dropdown">
                        <button class="dropbtn">⋮</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="resendRecipient(${jobId}, ${log.id})">Resend</a>
                            <a href="#" onclick="deleteRecipient(${jobId}, ${log.id})">Delete</a>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        const logsModal = document.createElement('div');
        logsModal.className = 'modal';
        logsModal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3>Campaign Logs</h3>
                    <button type="button" class="close-modal" aria-label="Close campaign logs">&times;</button>
                </div>
                <div style="padding: 1.5rem;">
                    <div class="bulk-actions" style="margin-bottom: 1rem;">
                        <button id="selectAllBtn" class="btn-secondary">Select All</button>
                        <button id="resendSelectedBtn" class="btn-primary">Resend Selected</button>
                        <button id="deleteSelectedBtn" class="btn-danger">Delete Selected</button>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;"><input type="checkbox" id="selectAllCheckbox"></th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Name</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Email</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Status</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Opened</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Sent At</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(logsModal);
        logsModal.style.display = 'block';

        // Select all functionality
        const selectAllCheckbox = logsModal.querySelector('#selectAllCheckbox');
        const selectAllBtn = logsModal.querySelector('#selectAllBtn');
        const checkboxes = logsModal.querySelectorAll('.recipient-checkbox');

        selectAllCheckbox.addEventListener('change', () => {
            checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        });

        selectAllBtn.addEventListener('click', () => {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
            selectAllCheckbox.checked = !allChecked;
        });

        // Bulk actions
        logsModal.querySelector('#resendSelectedBtn').addEventListener('click', () => {
            const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
            if (selectedIds.length === 0) return alert('Select recipients first');
            resendSelected(jobId, selectedIds);
        });

        logsModal.querySelector('#deleteSelectedBtn').addEventListener('click', () => {
            const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
            if (selectedIds.length === 0) return alert('Select recipients first');
            deleteSelected(jobId, selectedIds);
        });

        // Close modal
        logsModal.querySelector('.close-modal').addEventListener('click', () => {
            logsModal.remove();
        });

        logsModal.addEventListener('click', (e) => {
            if (e.target === logsModal) {
                logsModal.remove();
            }
        });
    } catch (error) {
        showMessage('Error loading logs', 'error');
    }
}

// Resend single recipient
async function resendRecipient(jobId, recipientId) {
    if (!confirm('Resend email to this recipient?')) return;
    try {
        await apiCall(`/emails/campaigns/${jobId}/recipients/${recipientId}/resend`, { method: 'POST' });
        showMessage('Email resent successfully', 'success');
        // Refresh logs
        document.querySelector('.modal').remove();
        viewLogs(jobId);
    } catch (error) {
        showMessage('Error resending email', 'error');
    }
}

// Delete single recipient
async function deleteRecipient(jobId, recipientId) {
    if (!confirm('Delete this recipient?')) return;
    try {
        await apiCall(`/emails/campaigns/${jobId}/recipients/${recipientId}`, { method: 'DELETE' });
        showMessage('Recipient deleted successfully', 'success');
        // Refresh logs
        document.querySelector('.modal').remove();
        viewLogs(jobId);
    } catch (error) {
        showMessage('Error deleting recipient', 'error');
    }
}

// Bulk resend
async function resendSelected(jobId, recipientIds) {
    if (!confirm(`Resend to ${recipientIds.length} recipients?`)) return;
    try {
        for (const id of recipientIds) {
            await apiCall(`/emails/campaigns/${jobId}/recipients/${id}/resend`, { method: 'POST' });
        }
        showMessage('Emails resent successfully', 'success');
        document.querySelector('.modal').remove();
        viewLogs(jobId);
    } catch (error) {
        showMessage('Error resending emails', 'error');
    }
}

// Bulk delete
async function deleteSelected(jobId, recipientIds) {
    if (!confirm(`Delete ${recipientIds.length} recipients?`)) return;
    try {
        for (const id of recipientIds) {
            await apiCall(`/emails/campaigns/${jobId}/recipients/${id}`, { method: 'DELETE' });
        }
        showMessage('Recipients deleted successfully', 'success');
        document.querySelector('.modal').remove();
        viewLogs(jobId);
    } catch (error) {
        showMessage('Error deleting recipients', 'error');
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const analytics = await apiCall('/emails/analytics');

        // Update stats
        document.getElementById('totalSent').textContent = analytics.totalSent;
        document.getElementById('totalOpened').textContent = analytics.totalOpened;
        document.getElementById('openRate').textContent = `${analytics.openRate}%`;

        // Prepare data for time chart
        const dates = analytics.timeData.map(item => item.date);
        const sentData = analytics.timeData.map(item => item.sent);
        const openedData = analytics.timeData.map(item => item.opened);

        // Time chart
        const timeCtx = document.getElementById('timeChart').getContext('2d');
        new Chart(timeCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Sent',
                    data: sentData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.1
                }, {
                    label: 'Opened',
                    data: openedData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Pie chart
        const pieCtx = document.getElementById('pieChart').getContext('2d');
        new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: ['Opened', 'Not Opened'],
                datasets: [{
                    data: [analytics.totalOpened, analytics.totalSent - analytics.totalOpened],
                    backgroundColor: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Load SMS campaigns
async function loadSmsCampaigns() {
    if (!checkAuth()) return;

    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('userName').textContent = `Welcome, ${user.name}`;

    const campaignsList = document.getElementById('smsCampaignsList');
    showLoading(campaignsList);

    try {
        const campaigns = await apiCall('/sms/campaigns');

        if (campaigns.length === 0) {
            campaignsList.innerHTML = '<p>No SMS campaigns yet. Create your first campaign!</p>';
            return;
        }

        campaignsList.innerHTML = campaigns.map(campaign => `
            <div class="campaign-card">
                <div class="campaign-copy">
                    <h3>${escapeHtml(campaign.subject)}</h3>
                    <div class="campaign-meta">Created ${new Date(campaign.created_at).toLocaleDateString()}</div>
                </div>
                <div class="campaign-actions">
                    <button class="btn-send" onclick="sendSmsCampaign(${campaign.id})">Send Now</button>
                    <button class="btn-view" onclick="viewSmsLogs(${campaign.id})">View Logs</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        campaignsList.innerHTML = '<p>Error loading campaigns. Please refresh the page.</p>';
    }
}

// New SMS modal
const smsModal = document.getElementById('smsModal');
const newSmsBtn = document.getElementById('newSmsBtn');

// Open modal
if (newSmsBtn) {
    newSmsBtn.addEventListener('click', () => {
        smsModal.style.display = 'block';
    });
}

// Close modal
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        smsModal.style.display = 'none';
    });
});

// Close modal when clicking outside
if (smsModal) {
    window.addEventListener('click', (e) => {
        if (e.target === smsModal) {
            smsModal.style.display = 'none';
        }
    });
}

// SMS form handler
document.getElementById('smsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    try {
        const response = await apiCall('/sms/campaigns', {
            method: 'POST',
            body: formData
        });

        if (response.jobId) {
            showMessage(`SMS campaign created successfully! ${response.recipientCount} recipients loaded.`, 'success');
            smsModal.style.display = 'none';
            e.target.reset();
            loadSmsCampaigns();
        } else {
            showMessage(response.error || 'Failed to create campaign', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
});

// Send SMS campaign
async function sendSmsCampaign(jobId) {
    if (!confirm('Are you sure you want to send this SMS campaign?')) return;

    try {
        const response = await apiCall(`/sms/campaigns/${jobId}/send`, {
            method: 'POST'
        });

        if (response.message) {
            showMessage(`SMS campaign sent! ${response.sent} sent, ${response.failed} failed.`, 'success');
            loadSmsCampaigns();
        } else {
            showMessage(response.error || 'Failed to send campaign', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

// View SMS logs
async function viewSmsLogs(jobId) {
    try {
        const logs = await apiCall(`/sms/campaigns/${jobId}/logs`);

        const logsHtml = logs.map(log => `
            <tr>
                <td><input type="checkbox" class="recipient-checkbox" data-id="${log.id}"></td>
                <td>${escapeHtml(log.recipient_name)}</td>
                <td>${escapeHtml(log.recipient_phone)}</td>
                <td><span class="status-${escapeHtml(log.status)}">${escapeHtml(log.status)}</span></td>
                <td>${log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}</td>
                <td>
                    <div class="dropdown">
                        <button class="dropbtn">⋮</button>
                        <div class="dropdown-content">
                            <a href="#" onclick="resendSmsRecipient(${jobId}, ${log.id})">Resend</a>
                            <a href="#" onclick="deleteSmsRecipient(${jobId}, ${log.id})">Delete</a>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('');

        const logsModal = document.createElement('div');
        logsModal.className = 'modal';
        logsModal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3>SMS Campaign Logs</h3>
                    <button type="button" class="close-modal" aria-label="Close SMS campaign logs">&times;</button>
                </div>
                <div style="padding: 1.5rem;">
                    <div class="bulk-actions" style="margin-bottom: 1rem;">
                        <button id="selectAllBtn" class="btn-secondary">Select All</button>
                        <button id="resendSelectedSmsBtn" class="btn-primary">Resend Selected</button>
                        <button id="deleteSelectedSmsBtn" class="btn-danger">Delete Selected</button>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;"><input type="checkbox" id="selectAllSmsCheckbox"></th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Name</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Phone</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Status</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Sent At</th>
                                <th style="border: 1px solid #ddd; padding: 0.5rem;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(logsModal);
        logsModal.style.display = 'block';

        // Select all functionality
        const selectAllSmsCheckbox = logsModal.querySelector('#selectAllSmsCheckbox');
        const selectAllSmsBtn = logsModal.querySelector('#selectAllBtn');
        const checkboxes = logsModal.querySelectorAll('.recipient-checkbox');

        selectAllSmsCheckbox.addEventListener('change', () => {
            checkboxes.forEach(cb => cb.checked = selectAllSmsCheckbox.checked);
        });

        selectAllSmsBtn.addEventListener('click', () => {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
            selectAllSmsCheckbox.checked = !allChecked;
        });

        // Bulk actions
        logsModal.querySelector('#resendSelectedSmsBtn').addEventListener('click', () => {
            const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
            if (selectedIds.length === 0) return alert('Select recipients first');
            resendSelectedSms(jobId, selectedIds);
        });

        logsModal.querySelector('#deleteSelectedSmsBtn').addEventListener('click', () => {
            const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
            if (selectedIds.length === 0) return alert('Select recipients first');
            deleteSelectedSms(jobId, selectedIds);
        });

        // Close modal
        logsModal.querySelector('.close-modal').addEventListener('click', () => {
            logsModal.remove();
        });

        logsModal.addEventListener('click', (e) => {
            if (e.target === logsModal) {
                logsModal.remove();
            }
        });
    } catch (error) {
        showMessage('Error loading logs', 'error');
    }
}

// Resend single SMS recipient
async function resendSmsRecipient(jobId, recipientId) {
    if (!confirm('Resend SMS to this recipient?')) return;
    try {
        await apiCall(`/sms/campaigns/${jobId}/recipients/${recipientId}/resend`, { method: 'POST' });
        showMessage('SMS resent successfully', 'success');
        // Refresh logs
        document.querySelector('.modal').remove();
        viewSmsLogs(jobId);
    } catch (error) {
        showMessage('Error resending SMS', 'error');
    }
}

// Delete single SMS recipient
async function deleteSmsRecipient(jobId, recipientId) {
    if (!confirm('Delete this recipient?')) return;
    try {
        await apiCall(`/sms/campaigns/${jobId}/recipients/${recipientId}`, { method: 'DELETE' });
        showMessage('Recipient deleted successfully', 'success');
        // Refresh logs
        document.querySelector('.modal').remove();
        viewSmsLogs(jobId);
    } catch (error) {
        showMessage('Error deleting recipient', 'error');
    }
}

// Bulk resend SMS
async function resendSelectedSms(jobId, recipientIds) {
    if (!confirm(`Resend to ${recipientIds.length} recipients?`)) return;
    try {
        for (const id of recipientIds) {
            await apiCall(`/sms/campaigns/${jobId}/recipients/${id}/resend`, { method: 'POST' });
        }
        showMessage('SMS resent successfully', 'success');
        document.querySelector('.modal').remove();
        viewSmsLogs(jobId);
    } catch (error) {
        showMessage('Error resending SMS', 'error');
    }
}

// Bulk delete SMS
async function deleteSelectedSms(jobId, recipientIds) {
    if (!confirm(`Delete ${recipientIds.length} recipients?`)) return;
    try {
        for (const id of recipientIds) {
            await apiCall(`/sms/campaigns/${jobId}/recipients/${id}`, { method: 'DELETE' });
        }
        showMessage('Recipients deleted successfully', 'success');
        document.querySelector('.modal').remove();
        viewSmsLogs(jobId);
    } catch (error) {
        showMessage('Error deleting recipients', 'error');
    }
}

// Initialize dashboard if on dashboard page
if (window.location.pathname === '/dashboard') {
    loadDashboard();
    loadAnalytics();
}

// Initialize SMS page
if (window.location.pathname === '/sms') {
    loadSmsCampaigns();
}

const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');

function closeSettings() {
    if (settingsModal) settingsModal.style.display = 'none';
}

function openSettings() {
    if (!settingsModal || !settingsForm) return;
    const preferences = getPreferences();
    const accentInput = settingsForm.querySelector(`[name="accent"][value="${preferences.accent}"]`);
    if (accentInput) accentInput.checked = true;
    settingsForm.querySelector('#showSmsPreference').checked = preferences.showSms;
    settingsModal.style.display = 'block';
    settingsModal.querySelector('input:checked')?.focus();
}

settingsForm?.addEventListener('submit', event => {
    event.preventDefault();
    const preferences = {
        accent: new FormData(settingsForm).get('accent') || DEFAULT_PREFERENCES.accent,
        showSms: settingsForm.querySelector('#showSmsPreference').checked
    };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    applyPreferences(preferences);
    closeSettings();
    showMessage('Workspace preferences saved.', 'success');
});

document.querySelectorAll('.settings-close, .settings-cancel').forEach(button => button.addEventListener('click', closeSettings));
settingsModal?.addEventListener('click', event => { if (event.target === settingsModal) closeSettings(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSettings(); });

// Sidebar links use real URLs so navigation still works without JavaScript.
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        if (link.dataset.page === 'settings') {
            e.preventDefault();
            openSettings();
        }
    });
});

// Navigation handlers
document.getElementById('loginBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/login';
});

document.getElementById('registerBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/register';
});
