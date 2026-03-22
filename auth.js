// ==================== AUTHENTIFICATION ====================
let currentAdmin = null;

function checkAuth() {
    const token = localStorage.getItem('nova_token');
    const admin = localStorage.getItem('nova_admin');
    if (!token || !admin) {
        window.location.href = '/index.html';
        return false;
    }
    authToken = token;
    try {
        currentAdmin = JSON.parse(admin);
        return true;
    } catch(e) {
        console.error('Erreur parsing admin', e);
        return false;
    }
}

function handleLogout() {
    localStorage.removeItem('nova_token');
    localStorage.removeItem('nova_admin');
    window.location.href = '/index.html';
}