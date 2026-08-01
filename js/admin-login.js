// Vision Invest - Admin Login
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('admin-login-btn');
  const msgEl = document.getElementById('admin-login-error');

  if (btn) {
    btn.addEventListener('click', async () => {
      const username = document.getElementById('admin-username')?.value.trim();
      const password = document.getElementById('admin-password')?.value;

      if (!username || !password) {
        showMsg('Username and password required.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Logging in...';

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = data.redirect || '/admin-dashboard.html';
        } else {
          showMsg(data.error || 'Login failed.', 'error');
          btn.disabled = false;
          btn.textContent = 'Login';
        }
      } catch {
        showMsg('Network error.', 'error');
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });
  }

  function showMsg(msg, type) {
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.style.display = 'block';
    } else alert(msg);
  }
});
