// Vision Invest - Deposit
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check
  const check = await fetch('/api/me');
  if (check.status === 401) { window.location.href = '/login.html'; return; }

  const btn = document.getElementById('deposit-btn');
  const msgEl = document.getElementById('deposit-message');

  if (btn) {
    btn.addEventListener('click', async () => {
      const plan = document.getElementById('plan-select')?.value;
      const giftCardType = document.getElementById('gift-card-select')?.value;
      const imageInput = document.getElementById('gift-card-image');

      if (!plan || !giftCardType) {
        showMsg('Please select a plan and gift card type.', 'error');
        return;
      }
      if (!imageInput || !imageInput.files[0]) {
        showMsg('Please upload your gift card image.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Submitting...';

      const formData = new FormData();
      formData.append('plan', plan);
      formData.append('gift_card_type', giftCardType);
      formData.append('gift_card_image', imageInput.files[0]);

      try {
        const res = await fetch('/api/deposits', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          showMsg('Deposit submitted successfully! Awaiting admin approval.', 'success');
          btn.textContent = 'Submitted';
        } else {
          showMsg(data.error || 'Submission failed.', 'error');
          btn.disabled = false;
          btn.textContent = 'Submit Deposit';
        }
      } catch {
        showMsg('Network error. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Submit Deposit';
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
