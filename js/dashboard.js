// Vision Invest - Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/dashboard');
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data = await res.json();

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('user-name', data.full_name || 'User');
    setText('balance', `$${parseFloat(data.balance || 0).toFixed(2)}`);
    setText('welcome-bonus', data.welcome_bonus_claimed ? '$50.00 (Claimed)' : '$50.00 (Pending First Deposit)');
    setText('active-plan', data.active_plan || 'None');
    setText('referral-earnings', `$${parseFloat(data.referral_earnings || 0).toFixed(2)}`);
    setText('referral-count', data.referral_count || '0');
  } catch (err) {
    console.error('Dashboard error:', err);
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }
});
