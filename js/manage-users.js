// Vision Invest - Admin Manage Users
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/admin/users');
  if (check.status === 401) { window.location.href = '/admin.html'; return; }

  const tbody = document.getElementById('users-tbody');
  const msgEl = document.getElementById('update-message');

  async function loadUsers() {
    const r = await fetch('/api/admin/users');
    const users = await r.json();
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!users.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.cssText = 'text-align:center;padding:20px;';
      td.textContent = 'No users found';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');

      // Safe text cells
      [u.username, '$' + parseFloat(u.balance).toFixed(2), u.active_plan || 'None'].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });

      // Status badge
      const statusTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${u.status}`;
      badge.textContent = capitalize(u.status);
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      // Action button
      const actionTd = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = u.status === 'active' ? 'btn-reject' : 'btn-approve';
      btn.textContent = u.status === 'active' ? 'Suspend' : 'Activate';
      btn.onclick = () => toggleStatus(u.id, u.status);
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
  }

  await loadUsers();

  // Update balance
  const updateBtn = document.getElementById('update-balance-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      const username = document.getElementById('update-username')?.value.trim();
      const balance = document.getElementById('update-balance')?.value;
      if (!username || balance === '') { showMsg('Fill in all fields.', 'error'); return; }

      updateBtn.disabled = true;
      const r = await fetch('/api/admin/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, balance })
      });
      const data = await r.json();
      updateBtn.disabled = false;
      if (r.ok) {
        showMsg('Balance updated successfully.', 'success');
        await loadUsers();
      } else {
        showMsg(data.error || 'Update failed.', 'error');
      }
    });
  }

  window.toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!confirm(capitalize(newStatus) + ' this user?')) return;
    await fetch(`/api/admin/users/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    await loadUsers();
  };

  function showMsg(msg, type) {
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.className = type === 'success' ? 'msg-success' : 'msg-error';
      msgEl.style.display = 'block';
    } else alert(msg);
  }

  function capitalize(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }
});
