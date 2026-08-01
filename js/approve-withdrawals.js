// Vision Invest - Admin Approve Withdrawals
document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/admin/withdrawals');
  if (res.status === 401) { window.location.href = '/admin.html'; return; }

  const tbody = document.getElementById('withdrawals-tbody');
  if (!tbody) return;

  async function loadWithdrawals() {
    const r = await fetch('/api/admin/withdrawals');
    const list = await r.json();

    tbody.innerHTML = '';

    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.cssText = 'text-align:center;padding:20px;';
      td.textContent = 'No withdrawals found';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach(w => {
      const tr = document.createElement('tr');

      // Safe text cells
      [w.username, '$' + parseFloat(w.amount).toFixed(2), w.method].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });

      // Status badge (only class value from our own data)
      const statusTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${w.status}`;
      badge.textContent = capitalize(w.status);
      statusTd.appendChild(badge);
      tr.appendChild(statusTd);

      // Actions
      const actionTd = document.createElement('td');
      if (w.status === 'pending') {
        const appBtn = document.createElement('button');
        appBtn.className = 'btn-approve';
        appBtn.textContent = 'Approve';
        appBtn.onclick = () => handleWithdrawal(w.id, 'approve');

        const rejBtn = document.createElement('button');
        rejBtn.className = 'btn-reject';
        rejBtn.style.marginLeft = '4px';
        rejBtn.textContent = 'Reject';
        rejBtn.onclick = () => handleWithdrawal(w.id, 'reject');

        actionTd.appendChild(appBtn);
        actionTd.appendChild(rejBtn);
      } else {
        actionTd.textContent = '—';
      }
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
  }

  await loadWithdrawals();

  window.handleWithdrawal = async (id, action) => {
    if (!confirm(capitalize(action) + ' this withdrawal?')) return;
    const r = await fetch(`/api/admin/withdrawals/${id}/${action}`, { method: 'POST' });
    const data = await r.json();
    if (r.ok) {
      await loadWithdrawals();
    } else {
      alert(data.error || 'Action failed');
    }
  };

  function capitalize(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }
});
