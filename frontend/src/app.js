// ─── Configuración global ────────────────────────────────────────────────────
const API = 'https://find-pets-production.up.railway.app/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getToken()    { return localStorage.getItem('token'); }
function getNombre()   { return localStorage.getItem('nombre'); }
function getUsuarioId(){ return localStorage.getItem('usuarioId'); }
function isLoggedIn()  { return !!getToken(); }

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('nombre');
    localStorage.removeItem('usuarioId');
    window.location.href = '/src/index.html';
}

// ─── Actualizar navbar según estado de sesión ─────────────────────────────────
function actualizarNav() {
    const token = getToken();
    const saludo      = document.getElementById('saludo');
    const btnLogout   = document.getElementById('btn-logout');
    const btnLogin    = document.getElementById('btn-login');
    const btnSignup   = document.getElementById('btn-signup');
    const btnReportar = document.getElementById('btn-reportar');
    const btnPerfil   = document.getElementById('btn-perfil');

    if (token) {
        if (saludo)      { saludo.textContent = 'Hola, ' + getNombre(); saludo.classList.remove('hidden'); }
        if (btnLogout)   btnLogout.classList.remove('hidden');
        if (btnReportar) btnReportar.classList.remove('hidden');
        if (btnPerfil)   btnPerfil.classList.remove('hidden');
        if (btnLogin)    btnLogin.classList.add('hidden');
        if (btnSignup)   btnSignup.classList.add('hidden');
    } else {
        if (saludo)      saludo.classList.add('hidden');
        if (btnLogout)   btnLogout.classList.add('hidden');
        if (btnReportar) btnReportar.classList.add('hidden');
        if (btnPerfil)   btnPerfil.classList.add('hidden');
        if (btnLogin)    btnLogin.classList.remove('hidden');
        if (btnSignup)   btnSignup.classList.remove('hidden');
    }
}

// ─── Fetch con auth ───────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (getToken()) headers['Authorization'] = 'Bearer ' + getToken();
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

    const res = await fetch(API + url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// ─── Formato de fecha ─────────────────────────────────────────────────────────
function formatFecha(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── URL de foto ──────────────────────────────────────────────────────────────
function fotoUrl(foto) {
    return foto
        ? `http://localhost:3000/uploads/${foto}`
        : '../assets/images/icon.png';
}

// ─── Badge de estado ──────────────────────────────────────────────────────────
function badgeEstado(estado, resuelto) {
    if (resuelto) return '<span class="badge badge-resuelto">✅ Resuelto</span>';
    const map = {
        perdido:    '<span class="badge badge-perdido">🔍 Perdido</span>',
        encontrado: '<span class="badge badge-encontrado">✅ Encontrado</span>',
        adopcion:   '<span class="badge badge-adopcion">🏠 En adopción</span>',
    };
    return map[estado] || '';
}

document.addEventListener('DOMContentLoaded', actualizarNav);
