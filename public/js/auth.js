(() => {
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const form = loginForm || registerForm;
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await window.Store.ready;
    const message = document.querySelector('#form-message');
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = loginForm ? '/api/auth/login' : '/api/auth/register';

    message.textContent = '';
    button.disabled = true;
    button.textContent = loginForm ? 'Logging in…' : 'Creating account…';
    try {
      await window.Store.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      try {
        await window.Store.syncGuestCart();
      } catch (error) {
        window.Store.showToast(`You are signed in, but your saved bag could not be synced: ${error.message}`, true);
      }
      window.location.href = window.Store.safeRedirect();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = loginForm ? 'Log in' : 'Create account';
    }
  });
})();
