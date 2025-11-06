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
        loadTaskStats(token);
    } else {
        console.log('No JWT token in localStorage');
    }
}

function loadTaskStats(token) {
    fetch('/tasktracker', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Failed to fetch stats');
        }
    })
    .then(stats => {
        const statsDiv = document.getElementById('task-stats');
        const timeDisplay = stats.windowMinutes >= 120
            ? `${Math.round(stats.windowMinutes / 60)}h`
            : `${stats.windowMinutes}m`;
        statsDiv.textContent = `Tasks: +${stats.added} ✓${stats.completed} ✗${stats.failed} (${timeDisplay})`;
    })
    .catch(error => {
        console.log('Error loading task stats:', error);
        const statsDiv = document.getElementById('task-stats');
        statsDiv.textContent = 'Stats unavailable';
    });
}

// Update stats every 30 seconds
setInterval(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        loadTaskStats(token);
    }
}, 30000);

// Run when script loads
loadHeader();