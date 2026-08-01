// Vision Invest - Admin Referral Management
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/admin/referrals');
  if (check.status === 401) { window.location.href = '/admin.html'; return; }

  const tbody = document.getElementById('referrals-tbody');
  const msgEl = document.getElementById('referral-update-message');

  async function loadReferrals() {
    const r = await fetch('/api/admin/referrals');
    const users = await r.json();
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!users.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'text-align:center;padding:20px;';
      td.textContent = 'No users found';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');

      [u.username, u.referral_count, '$' + parseFloat(u.referral_earnings).toFixed(2)].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });

      const statusTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${u.status}`;
      badge.textContent = capitalize(u.status);
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      tbody.appendChild(tr);
    });
  }

  await loadReferrals();

  const updateBtn = document.getElementById('update-referral-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      const username = document.getElementById('referral-username')?.value.trim();
      const bonus = document.getElementById('referral-bonus')?.value;
      if (!username || bonus === '') { showMsg('Fill in all fields.', 'error'); return; }

      updateBtn.disabled = true;
      const r = await fetch('/api/admin/referrals/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, bonus })
      });
      const data = await r.json();
      updateBtn.disabled = false;
      if (r.ok) {
        showMsg('Referral bonus updated.', 'success');
        await loadReferrals();
      } else {
        showMsg(data.error || 'Update failed.', 'error');
      }
    });
  }

  function showMsg(msg, type) {
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.className = type === 'success' ? 'msg-success' : 'msg-error';
      msgEl.style.display = 'block';
    } else alert(msg);
  }

  function capitalize(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }
});
