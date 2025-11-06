function loadHeader() {
    fetch('header.html')
    .then(response => response.text())
    .then(html => {
        document.getElementById('header-placeholder').innerHTML = html;
        showWelcomeMessage();
    });
}

function decodeJWT(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded;
    } catch (e) {
        console.log('JWT decode failed:', e);
        return null;
    }
}

function showWelcomeMessage() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        console.log('JWT token found');
        const payload = decodeJWT(token);
        if (payload && payload.userId) {
            document.getElementById('welcome-message').textContent = `Welcome, ${payload.userId}`;
        } else {
            console.log('No payload or userId:', payload);
        }
    } else {
        console.log('No JWT token in localStorage');
    }
}

// Run when script loads
loadHeader();