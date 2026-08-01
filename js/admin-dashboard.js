// Vision Invest - Admin Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/admin/stats');
    if (res.status === 401) { window.location.href = '/admin.html'; return; }
    const stats = await res.json();

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('stat-users', stats.total_users);
    setText('stat-deposits', `$${parseFloat(stats.total_deposits).toFixed(2)}`);
    setText('stat-withdrawals', stats.pending_withdrawals);
    setText('stat-investments', stats.active_investments);
  } catch (err) {
    console.error(err);
  }

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/admin/logout', { method: 'POST' });
      window.location.href = '/admin.html';
    });
  }
});
