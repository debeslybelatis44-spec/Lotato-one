// ==================== COMMUNICATION API ====================
let authToken = null;

async function apiCall(url, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (authToken) {
        headers['x-auth-token'] = authToken;
    }
    const options = {
        method,
        headers
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            handleLogout();
            return null;
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: response.ok };
        }
    } catch (error) {
        console.error('Erreur API:', error);
        return null;
    }
}