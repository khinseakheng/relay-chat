const elements = {
  loginForm: document.querySelector('#login-form'),
  loginButton: document.querySelector('#login-button'),
  loginMessage: document.querySelector('#login-message'),
  profile: document.querySelector('#profile'),
  profileMessage: document.querySelector('#profile-message'),
  identity: document.querySelector('#identity'),
  openChat: document.querySelector('#open-chat'),
};

window.RelayChat = window.RelayChat || function (...args) {
  (window.RelayChat.q = window.RelayChat.q || []).push(args);
};
let widgetLoaded = false;
let widgetConfig;

async function jsonRequest(path, options) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

async function loadWidget() {
  if (widgetLoaded) return;
  const config = widgetConfig || (await jsonRequest('/api/config'));
  const script = document.createElement('script');
  script.src = `${config.relayApiUrl}/widget.js`;
  script.dataset.siteId = config.relaySiteId;
  script.async = true;
  document.body.appendChild(script);
  widgetLoaded = true;
}

async function authenticateChat() {
  elements.profileMessage.textContent = 'Connecting authenticated chat…';
  try {
    const { token } = await jsonRequest('/api/relay-chat-session');
    window.RelayChat('authenticate', { token });
    elements.profileMessage.textContent = 'Authenticated chat is ready.';
    elements.openChat.disabled = false;
  } catch (error) {
    elements.profileMessage.textContent = error.message;
    elements.openChat.disabled = true;
  }
}

function renderUser(user) {
  const signedIn = Boolean(user);
  elements.loginForm.style.display = signedIn ? 'none' : 'block';
  elements.profile.style.display = signedIn ? 'block' : 'none';
  elements.identity.classList.toggle('online', signedIn);
  elements.identity.querySelector('span').textContent = signedIn ? user.name : 'Signed out';
  elements.openChat.disabled = !signedIn;
  if (!user) return;
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#profile-id').textContent = user.id;
  document.querySelector('#profile-plan').textContent = user.plan;
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.loginButton.disabled = true;
  elements.loginMessage.textContent = '';
  try {
    const result = await jsonRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#email').value,
        password: document.querySelector('#password').value,
      }),
    });
    renderUser(result.user);
    await loadWidget();
    await authenticateChat();
  } catch (error) {
    elements.loginMessage.textContent = error.message;
  } finally {
    elements.loginButton.disabled = false;
  }
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  window.RelayChat('logout');
  await jsonRequest('/api/logout', { method: 'POST' });
  window.location.reload();
});

elements.openChat.addEventListener('click', () => window.RelayChat('open'));

async function initialize() {
  try {
    widgetConfig = await jsonRequest('/api/config');
    const { user } = await jsonRequest('/api/me');
    renderUser(user);
    if (widgetConfig.enabled && (user || widgetConfig.authenticationMode !== 'authenticated')) {
      await loadWidget();
    }
    if (user) {
      await authenticateChat();
    }
  } catch (error) {
    elements.loginMessage.textContent = error.message;
  }
}

void initialize();
