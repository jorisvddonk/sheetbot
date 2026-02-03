function loadHeader() {
    fetch('header.html')
    .then(response => response.text())
    .then(html => {
        document.getElementById('header-placeholder').innerHTML = html;
        initializeTheme();
        showWelcomeMessage();
        setupThemeToggle();
        setupMobileMenu();
        setupLogout();
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
    document.getElementById('welcome-message').textContent = "Sheetbot";
    if (token) {
        console.log('JWT token found');
        const payload = decodeJWT(token);
        if (payload && payload.userId) {
            document.getElementById('user-name').textContent = payload.userId;
        } else {
            console.log('No payload or userId:', payload);
        }
        loadTaskStats(token);
        loadAgentStats(token);
        loadTransitionStats(token);
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

function loadAgentStats(token) {
    fetch('/agenttracker', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Failed to fetch agent stats');
        }
    })
    .then(stats => {
        const statsDiv = document.getElementById('agent-stats');
        const timeDisplay = stats.windowMinutes >= 120
            ? `${Math.round(stats.windowMinutes / 60)}h`
            : `${stats.windowMinutes}m`;
        statsDiv.textContent = `Agents: ${stats.activeAgents}/${stats.totalUniqueAgents} (${timeDisplay})`;
    })
    .catch(error => {
        console.log('Error loading agent stats:', error);
        const statsDiv = document.getElementById('agent-stats');
        statsDiv.textContent = 'Agent stats unavailable';
    });
}

function loadTransitionStats(token) {
    fetch('/transitiontracker', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Failed to fetch transition stats');
        }
    })
    .then(stats => {
        const statsDiv = document.getElementById('transition-stats');
        const timeDisplay = stats.windowMinutes >= 120
            ? `${Math.round(stats.windowMinutes / 60)}h`
            : `${stats.windowMinutes}m`;
        statsDiv.textContent = `Transitions: ${stats.totalEvaluations} eval (${stats.totalEvaluationTimeMs.toFixed(1)}ms), ${stats.successfulTransitions} ✓ (${timeDisplay})`;
    })
    .catch(error => {
        console.log('Error loading transition stats:', error);
        const statsDiv = document.getElementById('transition-stats');
        statsDiv.textContent = 'Transition stats unavailable';
    });
}

function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            toggleDarkMode();
        });
    }
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.querySelector('.header-nav');

    if (menuBtn && nav) {
        const toggleMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            nav.classList.toggle('mobile-visible');
        };

        menuBtn.addEventListener('click', toggleMenu);
        menuBtn.addEventListener('touchstart', toggleMenu, { passive: false });

        // Close menu when clicking/touching outside or on a link
        const closeMenu = (e) => {
            if (!menuBtn.contains(e.target) && !nav.contains(e.target)) {
                nav.classList.remove('mobile-visible');
            }
        };

        document.addEventListener('click', closeMenu);
        document.addEventListener('touchstart', closeMenu, { passive: true });

        nav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                nav.classList.remove('mobile-visible');
            }
        });
    }

    // Show/hide mobile menu button based on screen size
    function checkScreenSize() {
        if (globalThis.innerWidth <= 480) {
            if (menuBtn) menuBtn.style.display = 'block';
        } else {
            if (menuBtn) menuBtn.style.display = 'none';
            if (nav) nav.classList.remove('mobile-visible');
        }
    }

    globalThis.addEventListener('resize', checkScreenSize);
    checkScreenSize(); // Initial check
}

function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark-mode');
    if (isDark) {
        html.classList.remove('dark-mode');
        html.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-toggle-btn').textContent = '🌙';
    } else {
        html.classList.add('dark-mode');
        html.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-toggle-btn').textContent = '☀️';
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle-btn');

    if (savedTheme === 'dark') {
        html.classList.add('dark-mode');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else if (savedTheme === 'light') {
        html.classList.add('light-mode');
        if (themeBtn) themeBtn.textContent = '🌙';
    } else {
        // No saved preference, check system preference
        if (globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
            html.classList.add('dark-mode');
            if (themeBtn) themeBtn.textContent = '☀️';
        } else {
            if (themeBtn) themeBtn.textContent = '🌙';
        }
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('jwt_token');
            globalThis.location.href = 'index.html';
        });
    }
}

// Update stats every 30 seconds
setInterval(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        loadTaskStats(token);
        loadAgentStats(token);
        loadTransitionStats(token);
    }
}, 30000);

// Run when script loads
loadHeader();