import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './admindashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [users, setUsers] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [aboutEntries, setAboutEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  // Filters for Users tab
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Edit User modal/drawer state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'Driver',
    profilePictureUrl: '',
    newPassword: '',
    sponsorId: '',
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Create User form state
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Driver',
    sponsorId: '',
    newCompanyName: '',
    profilePictureUrl: '',
  });

  // Operations tab: Driver Points & Driver Assignment/Drop & Sponsor Org Management
  const [pointForm, setPointForm] = useState({
    driverId: '',
    pointChange: '',
    reason: '',
  });
  const [affiliationForm, setAffiliationForm] = useState({
    driverId: '',
    sponsorId: '',
    reason: '',
  });
  const [newSponsorForm, setNewSponsorForm] = useState({
    companyName: '',
    pointValue: '0.01',
  });

  // Audit Log filter state
  const [logFilters, setLogFilters] = useState({
    category: 'All',
    role: 'All',
    startDate: '',
    endDate: '',
  });

  // About Page form state
  const [aboutForm, setAboutForm] = useState({
    teamNumber: '03',
    versionNumber: '',
    releaseDate: new Date().toISOString().slice(0, 10),
    productName: 'Good Driver Incentive Program',
    productDescription: '',
  });

  const getToken = () => sessionStorage.getItem('authToken');

  const clearFeedback = () => setFeedback({ error: '', success: '' });

  const loadAdminData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, sponsorsRes, logsRes, aboutRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/users`, { headers }),
        fetch(`${API_BASE_URL}/api/admin/sponsors`, { headers }),
        fetch(`${API_BASE_URL}/api/audit-logs`, { headers }),
        fetch(`${API_BASE_URL}/api/about`),
      ]);

      if (usersRes.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      if (usersRes.status === 403) {
        navigate('/', { replace: true });
        return;
      }

      const [usersData, sponsorsData, logsData, aboutData] = await Promise.all([
        usersRes.json(),
        sponsorsRes.json(),
        logsRes.json(),
        aboutRes.json(),
      ]);

      if (Array.isArray(usersData)) setUsers(usersData);
      if (Array.isArray(sponsorsData)) setSponsors(sponsorsData);
      if (Array.isArray(logsData)) setAuditLogs(logsData);
      if (Array.isArray(aboutData)) setAboutEntries(aboutData);
    } catch (error) {
      setFeedback({
        error: error.message || 'Unable to load administrator data.',
        success: '',
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // --- Impersonation ("View Site As") Handlers ---
  const handleViewAsUser = async (targetUserId) => {
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not switch view');

      sessionStorage.setItem('userRole', data.role);
      if (data.role === 'Sponsor') navigate('/sponsor-dashboard');
      else if (data.role === 'Driver') navigate('/driver-dashboard');
      else navigate('/editprofile');
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  const handleQuickViewAsRole = async (targetRole) => {
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ targetRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not switch view');

      sessionStorage.setItem('userRole', data.role);
      if (data.role === 'Sponsor') navigate('/sponsor-dashboard');
      else navigate('/driver-dashboard');
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- User Editing & Role Removal ---
  const openEditUserModal = (user) => {
    clearFeedback();
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'Driver',
      profilePictureUrl: user.profilePictureUrl || '',
      newPassword: '',
      sponsorId: user.sponsorId ? String(user.sponsorId) : '',
    });
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    clearFeedback();
    setIsSavingUser(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${editingUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            name: editForm.name,
            email: editForm.email,
            role: editForm.role,
            profilePictureUrl: editForm.profilePictureUrl,
            newPassword: editForm.newPassword || undefined,
            sponsorId: editForm.sponsorId ? Number(editForm.sponsorId) : null,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Update failed');

      setFeedback({ error: '', success: data.message });
      setEditingUser(null);
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleTakeAwayRole = async (user) => {
    clearFeedback();
    if (
      !window.confirm(
        `Take away the ${user.role} role from ${user.name}? Their role will be set to None and active role affiliations will be removed.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${user.id}/role`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not remove role');

      setFeedback({ error: '', success: data.message });
      if (editingUser?.id === user.id) setEditingUser(null);
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  const handleSendPasswordResetEmail = async (email) => {
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to send reset link');
      setFeedback({
        error: '',
        success: `Password reset email triggered for ${email}.`,
      });
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- Create New User ---
  const handleCreateUser = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(newUserForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create user');

      setFeedback({ error: '', success: data.message });
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'Driver',
        sponsorId: '',
        newCompanyName: '',
        profilePictureUrl: '',
      });
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- Driver Point Adjustment (Sponsor/Admin Operation) ---
  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const selectedDriver = users.find(
        (u) => u.id === Number(pointForm.driverId)
      );
      const response = await fetch(`${API_BASE_URL}/api/driver-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          driver_id: Number(pointForm.driverId),
          sponsor_id: selectedDriver?.sponsorId || null,
          point_change: Number(pointForm.pointChange),
          reason: pointForm.reason,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || data.message || 'Failed to update points');

      setFeedback({
        error: '',
        success: `${selectedDriver?.name || 'Driver'}'s points updated by ${
          pointForm.pointChange
        }. New balance: ${data.total_points} pts.`,
      });
      setPointForm({ driverId: '', pointChange: '', reason: '' });
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- Assign or Drop Driver ---
  const handleAssignDriver = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/drivers/${affiliationForm.driverId}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            sponsorId: Number(affiliationForm.sponsorId),
            reason: affiliationForm.reason || 'Assigned by Admin',
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to assign driver');
      setFeedback({ error: '', success: data.message });
      setAffiliationForm({ driverId: '', sponsorId: '', reason: '' });
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  const handleDropDriver = async (driverId, driverName) => {
    clearFeedback();
    const reason = window.prompt(
      `Enter a reason for dropping ${driverName} from their sponsor (an automated alert will be sent):`,
      'Dropped by Administrator'
    );
    if (!reason) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/drivers/${driverId}/drop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ reason }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to drop driver');
      setFeedback({ error: '', success: data.message });
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- Create Sponsor Organization ---
  const handleCreateSponsor = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sponsors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(newSponsorForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create sponsor');
      setFeedback({ error: '', success: data.message });
      setNewSponsorForm({ companyName: '', pointValue: '0.01' });
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // --- Audit Log Filtering & CSV Download ---
  const handleFilterAuditLogs = async (e) => {
    if (e) e.preventDefault();
    clearFeedback();
    try {
      const params = new URLSearchParams();
      if (logFilters.category !== 'All')
        params.set('category', logFilters.category);
      if (logFilters.role !== 'All') params.set('role', logFilters.role);
      if (logFilters.startDate) params.set('startDate', logFilters.startDate);
      if (logFilters.endDate) params.set('endDate', logFilters.endDate);

      const response = await fetch(
        `${API_BASE_URL}/api/audit-logs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not filter logs');
      setAuditLogs(data);
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  const handleDownloadAuditCsv = () => {
    if (!auditLogs.length) return;
    const headers = ['Log ID', 'Date', 'Username', 'Category', 'Status', 'Details'];
    const rows = auditLogs.map((log) => [
      log.log_id,
      new Date(log.event_date).toISOString(),
      log.username || 'System',
      log.event_category,
      log.status || '',
      `"${String(log.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Update About Page Sprint Info ---
  const handleAddAboutEntry = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/about`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(aboutForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update About page');
      setFeedback({ error: '', success: data.message });
      setAboutForm((prev) => ({
        ...prev,
        versionNumber: '',
        productDescription: '',
      }));
      await loadAdminData();
    } catch (error) {
      setFeedback({ error: error.message, success: '' });
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const query = userSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.affiliatedOrganization?.toLowerCase().includes(query);
    return matchesRole && matchesSearch;
  });

  const driverUsers = users.filter((u) => u.role === 'Driver');
  const sponsorUsers = users.filter((u) => u.role === 'Sponsor');
  const adminUsers = users.filter((u) => u.role === 'Admin');

  return (
    <main className="admin-page">
      <div className="admin-content">
        {/* Top Header */}
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">System administration</p>
            <h1 className="admin-title">Admin Control Panel</h1>
            <p className="admin-subtitle">
              Manage roles, user accounts, sponsor affiliations, driver points, and system audit logs.
            </p>
          </div>
          <nav className="admin-top-actions" aria-label="Admin navigation">
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => handleQuickViewAsRole('Driver')}
            >
              View as Standard Driver
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => handleQuickViewAsRole('Sponsor')}
            >
              View as Standard Sponsor
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => navigate('/editprofile')}
            >
              My Profile
            </button>
            <LogoutButton />
          </nav>
        </header>

        {/* Summary Metrics */}
        <section className="admin-stats-grid" aria-label="Platform statistics">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total Users</span>
            <strong className="admin-stat-value">{users.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Drivers</span>
            <strong className="admin-stat-value">{driverUsers.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Sponsor Users</span>
            <strong className="admin-stat-value">{sponsorUsers.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Sponsor Orgs</span>
            <strong className="admin-stat-value">{sponsors.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Admins</span>
            <strong className="admin-stat-value">{adminUsers.length}</strong>
          </div>
        </section>

        {/* Feedback Messages */}
        {feedback.error && (
          <div className="admin-feedback admin-feedback-error" role="alert">
            {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="admin-feedback admin-feedback-success" role="status">
            {feedback.success}
          </div>
        )}

        {/* Section Tabs */}
        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            className={`admin-tab ${activeTab === 'users' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users, Roles &amp; Affiliations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'operations'}
            className={`admin-tab ${activeTab === 'operations' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            Driver &amp; Sponsor Operations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            className={`admin-tab ${activeTab === 'audit' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Audit Logs &amp; CSV Export
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'about'}
            className={`admin-tab ${activeTab === 'about' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Sprint / About Page
          </button>
        </div>

        {loading ? (
          <p className="admin-loading" role="status">
            Loading control panel data…
          </p>
        ) : (
          <>
            {/* ============================================================
                TAB 1: USERS, ROLES & AFFILIATIONS
               ============================================================ */}
            {activeTab === 'users' && (
              <div className="admin-section-stack">
                <section className="admin-card" aria-labelledby="users-heading">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Directory &amp; permissions</p>
                      <h2 id="users-heading">All User Accounts</h2>
                    </div>
                    <div className="admin-filter-bar">
                      <input
                        type="search"
                        placeholder="Search name, email, or organization…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        aria-label="Search users"
                      />
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        aria-label="Filter by role"
                      >
                        <option value="All">All Roles</option>
                        <option value="Driver">Drivers</option>
                        <option value="Sponsor">Sponsors</option>
                        <option value="Admin">Admins</option>
                        <option value="None">No Role (Revoked)</option>
                      </select>
                    </div>
                  </header>

                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Affiliated Organization</th>
                          <th>Points</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="5">No matching user accounts found.</td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => (
                            <tr key={user.id}>
                              <td>
                                <div className="admin-user-cell">
                                  {user.profilePictureUrl ? (
                                    <img
                                      src={user.profilePictureUrl}
                                      alt=""
                                      className="admin-avatar"
                                    />
                                  ) : (
                                    <div className="admin-avatar-placeholder">
                                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <div>
                                    <div className="admin-user-name">{user.name}</div>
                                    <div className="admin-user-email">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`admin-badge admin-badge-${(
                                    user.role || 'none'
                                  ).toLowerCase()}`}
                                >
                                  {user.role}
                                </span>
                              </td>
                              <td>
                                {user.role === 'Sponsor' || user.role === 'Driver' ? (
                                  <strong>{user.affiliatedOrganization}</strong>
                                ) : (
                                  <span className="admin-muted">—</span>
                                )}
                              </td>
                              <td>
                                {user.role === 'Driver' ? (
                                  `${user.totalPoints.toLocaleString()} pts`
                                ) : (
                                  <span className="admin-muted">—</span>
                                )}
                              </td>
                              <td>
                                <div className="admin-row-actions">
                                  <button
                                    type="button"
                                    className="admin-btn-small"
                                    onClick={() => openEditUserModal(user)}
                                  >
                                    Edit / Role
                                  </button>
                                  {(user.role === 'Driver' ||
                                    user.role === 'Sponsor') && (
                                    <button
                                      type="button"
                                      className="admin-btn-small admin-btn-outline"
                                      onClick={() => handleViewAsUser(user.id)}
                                    >
                                      View As {user.role}
                                    </button>
                                  )}
                                  {user.role !== 'None' && (
                                    <button
                                      type="button"
                                      className="admin-btn-small admin-btn-danger"
                                      onClick={() => handleTakeAwayRole(user)}
                                    >
                                      Revoke Role
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Edit User Drawer/Card */}
                {editingUser && (
                  <section
                    className="admin-card admin-highlight-card"
                    aria-labelledby="edit-user-heading"
                  >
                    <header className="admin-card-header">
                      <div>
                        <p className="admin-eyebrow">Editing account</p>
                        <h2 id="edit-user-heading">
                          Update {editingUser.name} ({editingUser.email})
                        </h2>
                      </div>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        onClick={() => setEditingUser(null)}
                      >
                        Cancel
                      </button>
                    </header>

                    <form className="admin-form-grid" onSubmit={handleSaveUserEdit}>
                      <div className="admin-field">
                        <label htmlFor="edit-name">Full Name</label>
                        <input
                          id="edit-name"
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="admin-field">
                        <label htmlFor="edit-email">Email Address</label>
                        <input
                          id="edit-email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm({ ...editForm, email: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="admin-field">
                        <label htmlFor="edit-role">Assigned Role</label>
                        <select
                          id="edit-role"
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm({ ...editForm, role: e.target.value })
                          }
                        >
                          <option value="Driver">Driver</option>
                          <option value="Sponsor">Sponsor</option>
                          <option value="Admin">Admin</option>
                          <option value="None">None (Role Revoked)</option>
                        </select>
                      </div>

                      {(editForm.role === 'Sponsor' ||
                        editForm.role === 'Driver') && (
                        <div className="admin-field">
                          <label htmlFor="edit-sponsor">
                            Affiliated Sponsor Organization
                          </label>
                          <select
                            id="edit-sponsor"
                            value={editForm.sponsorId}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                sponsorId: e.target.value,
                              })
                            }
                          >
                            <option value="">-- Unassigned --</option>
                            {sponsors.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                {sp.companyName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="admin-field">
                        <label htmlFor="edit-pic">Profile Picture URL</label>
                        <div className="admin-inline-input">
                          <input
                            id="edit-pic"
                            type="url"
                            placeholder="https://example.com/photo.jpg"
                            value={editForm.profilePictureUrl}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                profilePictureUrl: e.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            className="admin-btn-small admin-btn-outline"
                            onClick={() =>
                              setEditForm({ ...editForm, profilePictureUrl: '' })
                            }
                          >
                            Reset Picture
                          </button>
                        </div>
                      </div>

                      <div className="admin-field">
                        <label htmlFor="edit-password">
                          Set New Password (leave blank to keep current)
                        </label>
                        <div className="admin-inline-input">
                          <input
                            id="edit-password"
                            type="password"
                            placeholder="Enter new password to reset directly"
                            value={editForm.newPassword}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                newPassword: e.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            className="admin-btn-small admin-btn-outline"
                            onClick={() =>
                              handleSendPasswordResetEmail(editingUser.email)
                            }
                          >
                            Send Reset Email
                          </button>
                        </div>
                      </div>

                      <div className="admin-form-footer">
                        <button
                          type="submit"
                          className="admin-btn-primary"
                          disabled={isSavingUser}
                        >
                          {isSavingUser ? 'Saving…' : 'Save Account Changes'}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {/* Create New User Card */}
                <section
                  className="admin-card"
                  aria-labelledby="create-user-heading"
                >
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Provisioning</p>
                      <h2 id="create-user-heading">
                        Create New User (Driver, Sponsor, or Admin)
                      </h2>
                    </div>
                  </header>

                  <form className="admin-form-grid" onSubmit={handleCreateUser}>
                    <div className="admin-field">
                      <label htmlFor="new-name">Full Name</label>
                      <input
                        id="new-name"
                        type="text"
                        value={newUserForm.name}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, name: e.target.value })
                        }
                        placeholder="Jane Doe"
                        required
                      />
                    </div>

                    <div className="admin-field">
                      <label htmlFor="new-email">Email Address</label>
                      <input
                        id="new-email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            email: e.target.value,
                          })
                        }
                        placeholder="jane@example.com"
                        required
                      />
                    </div>

                    <div className="admin-field">
                      <label htmlFor="new-password">Initial Password</label>
                      <input
                        id="new-password"
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            password: e.target.value,
                          })
                        }
                        placeholder="Strong password"
                        required
                      />
                    </div>

                    <div className="admin-field">
                      <label htmlFor="new-role">Role</label>
                      <select
                        id="new-role"
                        value={newUserForm.role}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, role: e.target.value })
                        }
                      >
                        <option value="Driver">Driver</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    {(newUserForm.role === 'Sponsor' ||
                      newUserForm.role === 'Driver') && (
                      <div className="admin-field">
                        <label htmlFor="new-user-sponsor">
                          Sponsor Organization
                        </label>
                        <select
                          id="new-user-sponsor"
                          value={newUserForm.sponsorId}
                          onChange={(e) =>
                            setNewUserForm({
                              ...newUserForm,
                              sponsorId: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            {newUserForm.role === 'Sponsor'
                              ? '-- Create New Organization Below --'
                              : '-- Unassigned --'}
                          </option>
                          {sponsors.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.companyName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {newUserForm.role === 'Sponsor' && !newUserForm.sponsorId && (
                      <div className="admin-field">
                        <label htmlFor="new-company-name">
                          New Sponsor Company Name
                        </label>
                        <input
                          id="new-company-name"
                          type="text"
                          value={newUserForm.newCompanyName}
                          onChange={(e) =>
                            setNewUserForm({
                              ...newUserForm,
                              newCompanyName: e.target.value,
                            })
                          }
                          placeholder="e.g., Swift Logistics"
                          required
                        />
                      </div>
                    )}

                    <div className="admin-form-footer">
                      <button type="submit" className="admin-btn-primary">
                        Create {newUserForm.role} Account
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {/* ============================================================
                TAB 2: DRIVER & SPONSOR OPERATIONS
               ============================================================ */}
            {activeTab === 'operations' && (
              <div className="admin-section-stack">
                {/* Award / Deduct Points */}
                <section className="admin-card" aria-labelledby="points-op-heading">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Incentive management</p>
                      <h2 id="points-op-heading">
                        Add or Deduct Driver Points
                      </h2>
                    </div>
                  </header>

                  <form className="admin-form-grid" onSubmit={handleAdjustPoints}>
                    <div className="admin-field">
                      <label htmlFor="op-driver">Select Driver</label>
                      <select
                        id="op-driver"
                        value={pointForm.driverId}
                        onChange={(e) =>
                          setPointForm({ ...pointForm, driverId: e.target.value })
                        }
                        required
                      >
                        <option value="">-- Choose a Driver --</option>
                        {driverUsers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.email}) · {d.affiliatedOrganization} ·{' '}
                            {d.totalPoints} pts
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-field">
                      <label htmlFor="op-points">
                        Point Change (use negative to deduct, e.g. -25)
                      </label>
                      <input
                        id="op-points"
                        type="number"
                        value={pointForm.pointChange}
                        onChange={(e) =>
                          setPointForm({
                            ...pointForm,
                            pointChange: e.target.value,
                          })
                        }
                        placeholder="e.g. 50 or -25"
                        required
                      />
                    </div>

                    <div className="admin-field">
                      <label htmlFor="op-reason">Reason for Point Change</label>
                      <input
                        id="op-reason"
                        type="text"
                        value={pointForm.reason}
                        onChange={(e) =>
                          setPointForm({ ...pointForm, reason: e.target.value })
                        }
                        placeholder="On-time delivery / Safe driving inspection"
                        required
                      />
                    </div>

                    <div className="admin-form-footer">
                      <button type="submit" className="admin-btn-primary">
                        Apply Point Change
                      </button>
                    </div>
                  </form>
                </section>

                {/* Assign or Drop Driver from Sponsor */}
                <section
                  className="admin-card"
                  aria-labelledby="affiliation-op-heading"
                >
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Driver roster management</p>
                      <h2 id="affiliation-op-heading">
                        Assign or Drop Drivers from Sponsors
                      </h2>
                    </div>
                  </header>

                  <form className="admin-form-grid" onSubmit={handleAssignDriver}>
                    <div className="admin-field">
                      <label htmlFor="aff-driver">Select Driver</label>
                      <select
                        id="aff-driver"
                        value={affiliationForm.driverId}
                        onChange={(e) =>
                          setAffiliationForm({
                            ...affiliationForm,
                            driverId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">-- Choose a Driver --</option>
                        {driverUsers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} (Current: {d.affiliatedOrganization})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-field">
                      <label htmlFor="aff-sponsor">
                        Target Sponsor Organization
                      </label>
                      <select
                        id="aff-sponsor"
                        value={affiliationForm.sponsorId}
                        onChange={(e) =>
                          setAffiliationForm({
                            ...affiliationForm,
                            sponsorId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">-- Choose a Sponsor --</option>
                        {sponsors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.companyName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-field">
                      <label htmlFor="aff-reason">Reason</label>
                      <input
                        id="aff-reason"
                        type="text"
                        value={affiliationForm.reason}
                        onChange={(e) =>
                          setAffiliationForm({
                            ...affiliationForm,
                            reason: e.target.value,
                          })
                        }
                        placeholder="Application approved by Admin"
                        required
                      />
                    </div>

                    <div className="admin-form-footer">
                      <button type="submit" className="admin-btn-primary">
                        Assign Driver to Sponsor
                      </button>
                    </div>
                  </form>

                  <div className="admin-table-wrapper" style={{ marginTop: '16px' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Current Sponsor</th>
                          <th>Total Points</th>
                          <th>Roster Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverUsers.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <strong>{d.name}</strong> ({d.email})
                            </td>
                            <td>{d.affiliatedOrganization}</td>
                            <td>{d.totalPoints.toLocaleString()} pts</td>
                            <td>
                              {d.sponsorId ? (
                                <button
                                  type="button"
                                  className="admin-btn-small admin-btn-danger"
                                  onClick={() => handleDropDriver(d.id, d.name)}
                                >
                                  Drop from Sponsor
                                </button>
                              ) : (
                                <span className="admin-muted">
                                  Not currently sponsored
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Sponsor Organizations Directory & Creation */}
                <section
                  className="admin-card"
                  aria-labelledby="sponsor-orgs-heading"
                >
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Organizations</p>
                      <h2 id="sponsor-orgs-heading">Sponsor Organizations</h2>
                    </div>
                  </header>

                  <form className="admin-form-grid" onSubmit={handleCreateSponsor}>
                    <div className="admin-field">
                      <label htmlFor="sp-name">New Sponsor Company Name</label>
                      <input
                        id="sp-name"
                        type="text"
                        value={newSponsorForm.companyName}
                        onChange={(e) =>
                          setNewSponsorForm({
                            ...newSponsorForm,
                            companyName: e.target.value,
                          })
                        }
                        placeholder="e.g., JB Hunt Transport"
                        required
                      />
                    </div>

                    <div className="admin-field">
                      <label htmlFor="sp-value">
                        Point Dollar Value (Default $0.01)
                      </label>
                      <input
                        id="sp-value"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newSponsorForm.pointValue}
                        onChange={(e) =>
                          setNewSponsorForm({
                            ...newSponsorForm,
                            pointValue: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="admin-form-footer">
                      <button type="submit" className="admin-btn-primary">
                        Add Sponsor Organization
                      </button>
                    </div>
                  </form>

                  <div className="admin-table-wrapper" style={{ marginTop: '16px' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Company Name</th>
                          <th>Point Value</th>
                          <th>Sponsor Users</th>
                          <th>Sponsored Drivers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sponsors.map((sp) => (
                          <tr key={sp.id}>
                            <td>
                              <strong>{sp.companyName}</strong>
                            </td>
                            <td>${Number(sp.pointValue || 0.01).toFixed(2)}</td>
                            <td>{sp.sponsorUserCount}</td>
                            <td>{sp.driverCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================
                TAB 3: AUDIT LOGS & CSV EXPORT
               ============================================================ */}
            {activeTab === 'audit' && (
              <section className="admin-card" aria-labelledby="audit-heading">
                <header className="admin-card-header">
                  <div>
                    <p className="admin-eyebrow">Security &amp; compliance</p>
                    <h2 id="audit-heading">System Audit Logs</h2>
                  </div>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={handleDownloadAuditCsv}
                    disabled={auditLogs.length === 0}
                  >
                    Download CSV ({auditLogs.length})
                  </button>
                </header>

                <form
                  className="admin-form-grid"
                  onSubmit={handleFilterAuditLogs}
                >
                  <div className="admin-field">
                    <label htmlFor="log-category">Audit Category</label>
                    <select
                      id="log-category"
                      value={logFilters.category}
                      onChange={(e) =>
                        setLogFilters({ ...logFilters, category: e.target.value })
                      }
                    >
                      <option value="All">All Categories</option>
                      <option value="Login Attempt">Login Attempt</option>
                      <option value="Password Change">Password Change</option>
                      <option value="Point Change">Point Change</option>
                      <option value="Driver Application">
                        Driver Application
                      </option>
                    </select>
                  </div>

                  <div className="admin-field">
                    <label htmlFor="log-role">User Role</label>
                    <select
                      id="log-role"
                      value={logFilters.role}
                      onChange={(e) =>
                        setLogFilters({ ...logFilters, role: e.target.value })
                      }
                    >
                      <option value="All">All Roles</option>
                      <option value="Driver">Drivers Only</option>
                      <option value="Sponsor">Sponsors Only</option>
                      <option value="Admin">Admins Only</option>
                    </select>
                  </div>

                  <div className="admin-field">
                    <label htmlFor="log-start">Start Date</label>
                    <input
                      id="log-start"
                      type="date"
                      value={logFilters.startDate}
                      onChange={(e) =>
                        setLogFilters({
                          ...logFilters,
                          startDate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="admin-field">
                    <label htmlFor="log-end">End Date</label>
                    <input
                      id="log-end"
                      type="date"
                      value={logFilters.endDate}
                      onChange={(e) =>
                        setLogFilters({ ...logFilters, endDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="admin-form-footer">
                    <button type="submit" className="admin-btn-primary">
                      Apply Filters
                    </button>
                  </div>
                </form>

                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Category</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5">No audit logs match these filters.</td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.log_id}>
                            <td>{formatDateTime(log.event_date)}</td>
                            <td>
                              <strong>{log.event_category}</strong>
                            </td>
                            <td>{log.username || 'System'}</td>
                            <td>{log.status}</td>
                            <td>{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ============================================================
                TAB 4: SPRINT / ABOUT PAGE MANAGER
               ============================================================ */}
            {activeTab === 'about' && (
              <section className="admin-card" aria-labelledby="about-mgr-heading">
                <header className="admin-card-header">
                  <div>
                    <p className="admin-eyebrow">Sprint metadata</p>
                    <h2 id="about-mgr-heading">Update About Page Data</h2>
                  </div>
                </header>

                <form className="admin-form-grid" onSubmit={handleAddAboutEntry}>
                  <div className="admin-field">
                    <label htmlFor="abt-team">Team #</label>
                    <input
                      id="abt-team"
                      type="text"
                      value={aboutForm.teamNumber}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          teamNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="admin-field">
                    <label htmlFor="abt-version">Version / Sprint #</label>
                    <input
                      id="abt-version"
                      type="text"
                      placeholder="e.g., Sprint 4"
                      value={aboutForm.versionNumber}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          versionNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="admin-field">
                    <label htmlFor="abt-date">Release Date</label>
                    <input
                      id="abt-date"
                      type="date"
                      value={aboutForm.releaseDate}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          releaseDate: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="admin-field">
                    <label htmlFor="abt-name">Product Name</label>
                    <input
                      id="abt-name"
                      type="text"
                      value={aboutForm.productName}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          productName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="abt-desc">Product Description</label>
                    <input
                      id="abt-desc"
                      type="text"
                      placeholder="Description of current sprint features…"
                      value={aboutForm.productDescription}
                      onChange={(e) =>
                        setAboutForm({
                          ...aboutForm,
                          productDescription: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="admin-form-footer">
                    <button type="submit" className="admin-btn-primary">
                      Publish Sprint Release Info
                    </button>
                  </div>
                </form>

                <div className="admin-table-wrapper" style={{ marginTop: '16px' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Team</th>
                        <th>Release Date</th>
                        <th>Product Name</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aboutEntries.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.version_number}</strong>
                          </td>
                          <td>{row.team_number}</td>
                          <td>
                            {row.release_date
                              ? String(row.release_date).slice(0, 10)
                              : '—'}
                          </td>
                          <td>{row.product_name}</td>
                          <td>{row.product_description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default AdminDashboard;