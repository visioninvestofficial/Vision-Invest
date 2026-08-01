// Vision Invest - Admin Approve Deposits
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/admin/deposits');
  if (res.status === 401) { window.location.href = '/admin.html'; return; }

  const tbody = document.getElementById('deposits-tbody');
  if (!tbody) return;

  async function loadDeposits() {
    const r = await fetch('/api/admin/deposits');
    const deposits = await r.json();

    if (!deposits.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No deposits found</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    deposits.forEach(d => {
      const tr = document.createElement('tr');
      tr.dataset.id = d.id;

      const statusBadge = `<span class="status-badge status-${esc(d.status)}">${esc(capitalize(d.status))}</span>`;

      let actions = '—';
      if (d.status === 'pending') {
        const appBtn = document.createElement('button');
        appBtn.className = 'btn-approve';
        appBtn.textContent = 'Approve';
        appBtn.onclick = () => handleDeposit(d.id, 'approve');

        const rejBtn = document.createElement('button');
        rejBtn.className = 'btn-reject';
        rejBtn.style.marginLeft = '4px';
        rejBtn.textContent = 'Reject';
        rejBtn.onclick = () => handleDeposit(d.id, 'reject');

        const cell = document.createElement('td');
        cell.appendChild(appBtn);
        cell.appendChild(rejBtn);

        if (d.image_path) {
          const link = document.createElement('a');
          link.href = '/api/uploads/' + encodeURIComponent(d.image_path);
          link.target = '_blank';
          link.textContent = ' View';
          link.style.marginLeft = '8px';
          cell.appendChild(link);
        }

        // Build row using safe DOM methods for user data, innerHTML only for badge
        const cells = [d.username, d.plan, '$' + parseFloat(d.amount).toFixed(2), d.gift_card_type].map(val => {
          const td = document.createElement('td');
          td.textContent = val;
          return td;
        });
        const statusTd = document.createElement('td');
        statusTd.innerHTML = statusBadge;

        cells.forEach(td => tr.appendChild(td));
        tr.appendChild(statusTd);
        tr.appendChild(cell);
      } else {
        // No pending actions
        const cells = [d.username, d.plan, '$' + parseFloat(d.amount).toFixed(2), d.gift_card_type].map(val => {
          const td = document.createElement('td');
          td.textContent = val;
          return td;
        });
        const statusTd = document.createElement('td');
        statusTd.innerHTML = statusBadge;
        const actionTd = document.createElement('td');
        if (d.image_path) {
          const link = document.createElement('a');
          link.href = '/api/uploads/' + encodeURIComponent(d.image_path);
          link.target = '_blank';
          link.textContent = 'View';
          actionTd.appendChild(link);
        } else {
          actionTd.textContent = '—';
        }
        cells.forEach(td => tr.appendChild(td));
        tr.appendChild(statusTd);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });
  }

  await loadDeposits();

  window.handleDeposit = async (id, action) => {
    if (!confirm(capitalize(action) + ' this deposit?')) return;
    const r = await fetch(`/api/admin/deposits/${id}/${action}`, { method: 'POST' });
    const data = await r.json();
    if (r.ok) {
      await loadDeposits();
    } else {
      alert(data.error || 'Action failed');
    }
  };

  function capitalize(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }
});
