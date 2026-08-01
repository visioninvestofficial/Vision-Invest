// Vision Invest - Profile
document.addEventListener('DOMContentLoaded', async () => {
  const check = await fetch('/api/me');
  if (check.status === 401) { window.location.href = '/login.html'; return; }
  const user = await check.json();

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  setText('profile-name', user.full_name);
  setText('profile-username', user.username);
  setText('profile-email', user.email);
  setText('profile-joined', new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  setText('profile-status', capitalize(user.status));

  setVal('profile-name-input', user.full_name);
  setVal('profile-username-input', user.username);
  setVal('profile-email-input', user.email);
  setVal('profile-joined-input', new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
});
