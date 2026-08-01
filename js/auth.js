// Vision Invest - Auth (login & register)
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type=submit]');
      const err = document.getElementById('login-error');
      btn.disabled = true;
      btn.textContent = 'Logging in...';
      if (err) err.textContent = '';

      const identifier = loginForm.querySelector('input[type=text], input[name=identifier]')?.value.trim();
      const password = loginForm.querySelector('input[type=password]')?.value;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = data.redirect || '/dashboard.html';
        } else {
          if (err) err.textContent = data.error;
          else alert(data.error);
          btn.disabled = false;
          btn.textContent = 'Login';
        }
      } catch {
        if (err) err.textContent = 'Network error. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Login';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = registerForm.querySelector('button[type=submit]');
      const err = document.getElementById('register-error');
      btn.disabled = true;
      btn.textContent = 'Creating account...';
      if (err) err.textContent = '';

      const inputs = registerForm.querySelectorAll('input');
      const full_name = inputs[0]?.value.trim();
      const email = inputs[1]?.value.trim();
      const username = inputs[2]?.value.trim();
      const password = inputs[3]?.value;
      const confirm = inputs[4]?.value;

      if (password !== confirm) {
        if (err) err.textContent = 'Passwords do not match';
        else alert('Passwords do not match');
        btn.disabled = false;
        btn.textContent = 'Register';
        return;
      }

      // Get referral code from URL
      const ref = new URLSearchParams(window.location.search).get('ref') || '';

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, email, username, password, ref })
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = data.redirect || '/dashboard.html';
        } else {
          if (err) err.textContent = data.error;
          else alert(data.error);
          btn.disabled = false;
          btn.textContent = 'Register';
        }
      } catch {
        if (err) err.textContent = 'Network error. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Register';
      }
    });
  }
});
