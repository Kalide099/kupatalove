/**
 * KupataLove Auth Page Logic
 * Handles login + multi-step registration with language selection
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { api, setTokens, setUser, getUser } = window.KL_API;
  const { initI18n, SUPPORTED_LANGS, t } = window.KL_I18n;

  // Redirect if already logged in
  if (getUser() && localStorage.getItem('kl_access_token')) {
    window.location.href = '/app.html';
    return;
  }

  // Init i18n with stored preference
  await initI18n();

  // ─── Tab Switching ──────────────────────────────────────────
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const registerWizard = document.getElementById('form-register');

  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerWizard.classList.add('hidden');
  });
  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerWizard.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // ─── Login ──────────────────────────────────────────────────
  const loginBtn = document.getElementById('btn-login');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const toggleLoginPwd = document.getElementById('toggle-login-pwd');

  toggleLoginPwd?.addEventListener('click', () => {
    loginPassword.type = loginPassword.type === 'password' ? 'text' : 'password';
    toggleLoginPwd.textContent = loginPassword.type === 'password' ? '👁️' : '🙈';
  });

  loginBtn?.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    loginError.textContent = '';
    if (!email || !password) { loginError.textContent = t('error_fill_all'); return; }

    loginBtn.disabled = true;
    loginBtn.textContent = '...';
    try {
      const data = await api.post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      // Save language from server profile
      localStorage.setItem('kl_language', data.user.language || 'en');
      window.location.href = '/app.html';
    } catch (err) {
      loginError.textContent = err.message || t('error_invalid_credentials');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = t('login');
    }
  });

  // Allow Enter key on login
  [loginEmail, loginPassword].forEach(el => {
    el?.addEventListener('keypress', e => { if (e.key === 'Enter') loginBtn.click(); });
  });

  // ─── Registration Wizard ─────────────────────────────────────
  let regStep = 1;
  const totalSteps = 4;
  let selectedLang = localStorage.getItem('kl_language') || 'en';
  let selectedGender = '';
  let selectedInterestedIn = 'everyone';

  const progressBar = document.getElementById('reg-progress');
  const stepDots = document.querySelectorAll('.step-dot');

  const showStep = (n) => {
    document.querySelectorAll('.reg-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${n}`)?.classList.add('active');
    if (progressBar) progressBar.style.width = `${(n / totalSteps) * 100}%`;
    stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i + 1 < n) dot.classList.add('done');
      else if (i + 1 === n) dot.classList.add('active');
    });
    regStep = n;
  };

  // Build language grid
  const langGrid = document.getElementById('lang-grid');
  if (langGrid) {
    SUPPORTED_LANGS.forEach(lang => {
      const btn = document.createElement('div');
      btn.className = 'lang-option' + (lang.code === selectedLang ? ' selected' : '');
      btn.dataset.code = lang.code;
      btn.innerHTML = `<span class="lang-flag">${lang.flag}</span><span>${lang.nativeName}</span>`;
      btn.addEventListener('click', () => {
        langGrid.querySelectorAll('.lang-option').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        selectedLang = lang.code;
        initI18n(lang.code);
      });
      langGrid.appendChild(btn);
    });
  }

  // Gender options
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedGender = btn.dataset.gender;
    });
  });

  // Interested in options
  document.querySelectorAll('.interest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.interest-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedInterestedIn = btn.dataset.interest;
    });
  });

  // Password strength
  const regPassword = document.getElementById('reg-password');
  const strengthBar = document.getElementById('password-strength');
  regPassword?.addEventListener('input', () => {
    const val = regPassword.value;
    const strength = val.length < 6 ? 'weak' : val.length < 10 ? 'medium' : 'strong';
    strengthBar.className = `password-strength strength-${strength}`;
  });

  // Toggle register password
  document.getElementById('toggle-reg-pwd')?.addEventListener('click', function() {
    regPassword.type = regPassword.type === 'password' ? 'text' : 'password';
    this.textContent = regPassword.type === 'password' ? '👁️' : '🙈';
  });

  // Step navigation
  document.getElementById('step1-next')?.addEventListener('click', () => {
    const email = document.getElementById('reg-email').value.trim();
    const password = regPassword?.value || '';
    const name = document.getElementById('reg-name').value.trim();
    const err = document.getElementById('step1-error');
    if (!name || !email || !password) { err.textContent = t('error_fill_all'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { err.textContent = t('error_invalid_email'); return; }
    if (password.length < 8) { err.textContent = t('error_password_short'); return; }
    err.textContent = '';
    showStep(2);
  });

  document.getElementById('step2-next')?.addEventListener('click', () => {
    const birthdate = document.getElementById('reg-birthdate').value;
    const err = document.getElementById('step2-error');
    if (!selectedGender) { err.textContent = t('error_select_gender'); return; }
    if (!birthdate) { err.textContent = t('error_enter_birthdate'); return; }
    const age = (Date.now() - new Date(birthdate)) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) { err.textContent = t('error_must_be_18'); return; }
    err.textContent = '';
    showStep(3);
  });
  document.getElementById('step2-back')?.addEventListener('click', () => showStep(1));

  document.getElementById('step3-next')?.addEventListener('click', () => {
    showStep(4);
  });
  document.getElementById('step3-back')?.addEventListener('click', () => showStep(2));
  document.getElementById('step4-back')?.addEventListener('click', () => showStep(3));

  // Submit registration
  const registerBtn = document.getElementById('btn-register');
  const registerError = document.getElementById('register-error');

  registerBtn?.addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const birthdate = document.getElementById('reg-birthdate').value;
    const city = document.getElementById('reg-city').value.trim();
    const bio = document.getElementById('reg-bio').value.trim();

    if (!name || !email || !password || !birthdate || !selectedGender) {
      registerError.textContent = t('error_fill_all');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = '...';
    registerError.textContent = '';

    try {
      const data = await api.post('/auth/register', {
        name, email, password,
        birthdate, city, bio,
        gender: selectedGender,
        interested_in: selectedInterestedIn,
        language: selectedLang,
      });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      localStorage.setItem('kl_language', selectedLang);
      window.location.href = '/app.html';
    } catch (err) {
      registerError.textContent = err.message || t('error_registration_failed');
      registerBtn.disabled = false;
      registerBtn.textContent = t('create_account');
    }
  });

  showStep(1);
});
