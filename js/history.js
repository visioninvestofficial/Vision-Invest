// Vision Invest - Transaction History
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/me');
  if (check.status === 401) { window.location.href = '/login.html'; return; }

  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/transactions');
    const txns = await res.json();

    tbody.innerHTML = '';

    if (!txns.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'text-align:center;padding:20px;';
      td.textContent = 'No transactions yet';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    txns.forEach(t => {
      const tr = document.createElement('tr');

      const dateTd = document.createElement('td');
      dateTd.textContent = new Date(t.created_at).toLocaleDateString();

      const typeTd = document.createElement('td');
      typeTd.textContent = t.type;

      const amountTd = document.createElement('td');
      amountTd.textContent = '$' + parseFloat(t.amount).toFixed(2);

      const statusTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${t.status}`;
      badge.textContent = capitalize(t.status);
      statusTd.appendChild(badge);

      tr.appendChild(dateTd);
      tr.appendChild(typeTd);
      tr.appendChild(amountTd);
      tr.appendChild(statusTd);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'Failed to load transactions';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function capitalize(str) { return String(str).charAt(0).toUpperCase() + String(str).slice(1); }
});
