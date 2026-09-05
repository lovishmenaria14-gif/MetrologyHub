import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ScanLine, History, Settings, Sun, Moon, LogOut, CloudOff, Menu, X } from 'lucide-react';

export const DashboardLayout = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [lang, setLang] = useState(localStorage.getItem('appLang') || 'English');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem('sidebarCollapsed') === 'true');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const h = () => setLang(localStorage.getItem('appLang') || 'English');
        window.addEventListener('storage', h);
        return () => window.removeEventListener('storage', h);
    }, [theme]);

    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    const checkOfflineQueue = async () => {
        try {
            const { getOfflineQueue, clearOfflineQueue } = await import('../utils/OfflineQueue');
            const queue = await getOfflineQueue();
            setPendingSyncCount(queue.length);

            if (navigator.onLine && queue.length > 0) {
                // Background Sync Process
                setTimeout(async () => {
                    const history = JSON.parse(localStorage.getItem('metrology_history') || '[]');
                    let syncedCount = 0;
                    queue.forEach(item => {
                        history.unshift({
                            id: item.id.replace('offline-', 'sync-'),
                            product: item.productName,
                            date: item.timestamp.split('T')[0],
                            status: 'Compliant',
                            officer: item.officer
                        });
                        syncedCount++;
                    });
                    localStorage.setItem('metrology_history', JSON.stringify(history));
                    await clearOfflineQueue();
                    setPendingSyncCount(0);
                    alert(`Store-and-Forward: ${syncedCount} offline scans automatically synced to backend!`);
                }, 2000);
            }
        } catch (e) { console.warn('Offline queue check failed'); }
    };

    useEffect(() => {
        checkOfflineQueue();
        window.addEventListener('online', checkOfflineQueue);
        window.addEventListener('offline', checkOfflineQueue);
        const iv = setInterval(checkOfflineQueue, 8000);
        return () => {
            window.removeEventListener('online', checkOfflineQueue);
            window.removeEventListener('offline', checkOfflineQueue);
            clearInterval(iv);
        };
    }, []);

    const isHindi = lang === 'Hindi';
    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            localStorage.setItem('sidebarCollapsed', String(!prev));
            return !prev;
        });
    };
    const isMobileViewport = () => window.matchMedia('(max-width: 900px)').matches;
    const toggleNavigation = () => {
        if (isMobileViewport()) {
            setMobileNavOpen(prev => !prev);
        } else {
            toggleSidebar();
        }
    };
    const closeNavigation = () => {
        setMobileNavOpen(false);
        if (!isMobileViewport()) setSidebarCollapsed(true);
    };

    const t = {
        overview: isHindi ? 'डैशबोर्ड' : 'Overview',
        scan: isHindi ? 'स्कैन लेबल' : 'Scan Labels',
        repo: isHindi ? 'अनुपालन इतिहास' : 'Compliance History',
        settings: isHindi ? 'सेटिंग्स' : 'Settings',
        signOut: isHindi ? 'लॉग आउट' : 'Sign Out'
    };

    const navItems = [
        { path: '/', label: t.overview, icon: LayoutDashboard },
        { path: '/scan', label: t.scan, icon: ScanLine },
        { path: '/repository', label: t.repo, icon: History },
        { path: '/settings', label: t.settings, icon: Settings },
    ];

    const userName = localStorage.getItem('userName') || 'Admin User';
    const roleDisplay = localStorage.getItem('userRole') === 'admin' ? (isHindi ? 'सिस्टम एडमिन' : 'System Admin')
        : localStorage.getItem('userRole') === 'supervisor' ? (isHindi ? 'पर्यवेक्षक' : 'Supervisor')
            : (isHindi ? 'निरीक्षक' : 'Inspector');

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length > 1) return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const handleSignOut = () => {
        localStorage.clear();
        window.location.href = '/auth';
    };

    return (
        <div className={`layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
            <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <ScanLine className="brand-icon" size={28} />
                    <h2>MetrologyHub</h2>
                    <button className="icon-btn sidebar-close" onClick={closeNavigation} aria-label="Hide dashboard navigation">
                        <X size={20} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={() => setMobileNavOpen(false)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button
                        className="nav-link auth-btn"
                        onClick={handleSignOut}
                    >
                        <LogOut size={20} />
                        <span>{t.signOut}</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div className="topbar-start">
                        <button className="icon-btn mobile-menu-btn" onClick={toggleNavigation} aria-label={sidebarCollapsed || mobileNavOpen ? 'Show dashboard navigation' : 'Hide dashboard navigation'}>
                            <Menu size={21} />
                        </button>
                    </div>
                    <div className="topbar-search">
                        {/* Search or breadcrumbs */}
                    </div>
                    <div className="topbar-actions">
                        {pendingSyncCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--warning)', color: '#000', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, animation: 'pulse 2s infinite' }}>
                                <CloudOff size={16} />
                                {pendingSyncCount} Pending Sync{pendingSyncCount > 1 ? 's' : ''}
                            </div>
                        )}
                        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle Theme">
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="user-profile">
                            <div className="avatar" style={{ overflow: 'hidden' }}>
                                {localStorage.getItem('userAvatar')
                                    ? <img src={localStorage.getItem('userAvatar')!} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : getInitials(userName)
                                }
                            </div>
                            <div className="user-info">
                                <span className="user-name">{userName}</span>
                                <span className="user-role">{roleDisplay}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="page-container">
                    <Outlet />
                </div>
            </main>
        </div >
    );
};
