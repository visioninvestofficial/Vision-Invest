// Vision Invest - Referral
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/me');
  if (check.status === 401) { window.location.href = '/login.html'; return; }

  try {
    const res = await fetch('/api/referral');
    const data = await res.json();

    const baseUrl = window.location.origin;
    const refLink = `${baseUrl}/register.html?ref=${encodeURIComponent(data.username)}`;

    const linkInput = document.getElementById('referral-link');
    if (linkInput) linkInput.value = refLink;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setText('referral-count', data.referral_count || '0');
    setText('referral-earnings', '$' + parseFloat(data.referral_earnings || 0).toFixed(2));

    // Referral list — safe DOM construction
    const list = document.getElementById('referral-list');
    if (list) {
      list.innerHTML = '';
      const referrals = Array.isArray(data.referrals) ? data.referrals : [];
      if (referrals.length) {
        referrals.forEach(r => {
          const li = document.createElement('li');
          li.textContent = `${r.username} — joined ${new Date(r.created_at).toLocaleDateString()}`;
          list.appendChild(li);
        });
      }
    }

    // Copy button
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(refLink).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Referral Link'; }, 2000);
        }).catch(() => {
          if (linkInput) { linkInput.select(); document.execCommand('copy'); }
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Referral Link'; }, 2000);
        });
      });
    }
  } catch (err) {
    console.error('Referral error:', err);
  }
});
