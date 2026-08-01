// Vision Invest - Withdraw
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/me');
  if (check.status === 401) { window.location.href = '/login.html'; return; }
  const me = await check.json();

  // Pre-fill name and email
  const nameInput = document.getElementById('withdraw-name');
  const emailInput = document.getElementById('withdraw-email');
  if (nameInput) nameInput.value = me.full_name || '';
  if (emailInput) emailInput.value = me.email || '';

  const btn = document.getElementById('withdraw-btn');
  const msgEl = document.getElementById('withdraw-message');

  if (btn) {
    btn.addEventListener('click', async () => {
      const full_name = document.getElementById('withdraw-name')?.value.trim();
      const email = document.getElementById('withdraw-email')?.value.trim();
      const amount = document.getElementById('withdraw-amount')?.value;
      const method = document.getElementById('withdraw-method')?.value;
      const account_address = document.getElementById('withdraw-address')?.value.trim();

      if (!full_name || !email || !amount || !method || !account_address) {
        showMsg('All fields are required.', 'error');
        return;
      }
      if (parseFloat(amount) < 800) {
        showMsg('Minimum withdrawal is $800.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const res = await fetch('/api/withdrawals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, email, amount, method, account_address })
        });
        const data = await res.json();
        if (res.ok) {
          showMsg('Withdrawal request submitted! Awaiting admin approval.', 'success');
          btn.textContent = 'Submitted';
        } else {
          showMsg(data.error || 'Failed to submit.', 'error');
          btn.disabled = false;
          btn.textContent = 'Request Withdrawal';
        }
      } catch {
        showMsg('Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Request Withdrawal';
      }
    });
  }

  function showMsg(msg, type) {
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.className = type === 'success' ? 'msg-success' : 'msg-error';
      msgEl.style.display = 'block';
    } else {
      alert(msg);
    }
  }
});
