// Vision Invest - Admin Investment Plans
document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api/admin/plans');
  if (res.status === 401) { window.location.href = '/admin.html'; return; }
  const plans = await res.json();

  const tbody = document.getElementById('plans-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  plans.forEach(p => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = p.name;

    const amountTd = document.createElement('td');
    amountTd.textContent = '$' + p.amount;

    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-badge status-active';
    badge.textContent = p.status;
    statusTd.appendChild(badge);

    tr.appendChild(nameTd);
    tr.appendChild(amountTd);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  });
});
