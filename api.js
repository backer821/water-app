 // Configure this to your Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbzSvMNcLGQ5xhpX5ZOg8WPooxSjekkJlRF0_O9NnorMHX6Lq-qlh0sGh4iPxJ8zXVYC3A/exec';

const api = {
  token: null,

  setToken(t) { this.token = t; localStorage.setItem('wbs_token', t || ''); },
  getToken() { return this.token || localStorage.getItem('wbs_token') || ''; },
  clearToken() { this.setToken(''); },

  async call(action, data = {}) {
    const body = { action, token: this.getToken(), data };
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Keep simple CORS (Apps Script generally accepts this)
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API error');
    return json;
  },

  // Public
  async login(username, password) {
    const res = await this.call('auth.login', { username, password });
    this.setToken(res.token);
    return res;
  }
}