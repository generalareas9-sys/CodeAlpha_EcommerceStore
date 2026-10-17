(() => {
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');
  const form = loginForm || registerForm;
  if (!form) return;

  form.querySelectorAll('.password-field').forEach((wrapper) => {
    const input = wrapper.querySelector('input');
    const toggle = document.createElement('button');
    toggle.className = 'password-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Show';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      toggle.textContent = reveal ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} password`);
      toggle.setAttribute('aria-pressed', String(reveal));
      input.focus();
    });
    wrapper.append(toggle);
  });

  form.querySelectorAll('input').forEach((input) => {
    const feedback = document.createElement('small');
    feedback.className = 'field-feedback';
    feedback.id = `${input.name}-feedback`;
    feedback.setAttribute('aria-live', 'polite');
    input.setAttribute('aria-describedby', feedback.id);
    input.after(feedback);

    input.addEventListener('blur', () => {
      if (input.value && !input.validity.valid) {
        feedback.textContent = input.validationMessage;
        input.setAttribute('aria-invalid', 'true');
      }
    });
    input.addEventListener('input', () => {
      if (input.validity.valid) {
        feedback.textContent = '';
        input.removeAttribute('aria-invalid');
      } else if (input.getAttribute('aria-invalid') === 'true') {
        feedback.textContent = input.validationMessage;
      }
    });
  });

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
      sessionStorage.setItem('small-hours-login-notice', loginForm ? 'Welcome back.' : 'Your account is ready. Welcome to Small Hours.');
      window.location.href = window.Store.safeRedirect();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = loginForm ? 'Log in' : 'Create account';
    }
  });
})();
