import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { ShieldCheck, AlertTriangle, FileScan, Sparkles, Map, Target, Trophy, Medal, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
    const navigate = useNavigate();
    const [lang, setLang] = useState(localStorage.getItem('appLang') || 'English');
    const [animatedNumbers, setAnimatedNumbers] = useState(false);
    const [insightIndex, setInsightIndex] = useState(0);

    useEffect(() => {
        const h = () => setLang(localStorage.getItem('appLang') || 'English');
        window.addEventListener('storage', h);
        setTimeout(() => setAnimatedNumbers(true), 100);

        const insightTimer = setInterval(() => {
            setInsightIndex(prev => (prev + 1) % 3);
        }, 5000);

        return () => {
            window.removeEventListener('storage', h);
            clearInterval(insightTimer);
        };
    }, []);
    const isHindi = lang === 'Hindi';

    const insights = isHindi ? [
        'को-पायलट इनसाइट: "MRP उल्लंघन आज 20% बढ़ गए हैं।"',
        'को-पायलट इनसाइट: "स्थानीय किराना स्टोर में अनुपालन दर में 5% का सुधार हुआ है।"',
        'को-पायलट इनसाइट: "चेतावनी - पैक किए गए स्नैक्स में फोंट आकार के मुद्दे अक्सर आ रहे हैं।"'
    ] : [
        'Copilot Insight: "MRP Violations are up 20% today."',
        'Copilot Insight: "Local grocery stores improved compliance by 5%."',
        'Copilot Insight: "Warning - Font size issues are frequent in packaged snacks."'
    ];

    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchScans = async () => {
            try {
                const token = localStorage.getItem('jwt_token');
                const res = await fetch('http://localhost:5001/api/scans', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.status === 401) {
                    localStorage.removeItem('auth');
                    window.location.href = '/login';
                }
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data.map((h: any) => ({
                        id: h.id,
                        status: h.fields && Object.values(h.fields).every(v => v) ? 'Compliant' : 'Violation',
                        product: h.filename || 'Unknown Product',
                        date: new Date(h.created_at).toLocaleDateString(),
                        rawFields: h.fields
                    })));
                }
            } catch (e) {
                const stored = localStorage.getItem('metrology_history');
                if (stored) setHistory(JSON.parse(stored));
            }
        };
        fetchScans();
    }, []);

    const computed = useMemo(() => {
        const total = history.length;
        const comps = history.filter((h: any) => h.status === 'Compliant').length;
        const viols = total - comps;
        const rate = total > 0 ? Math.round((comps / total) * 100) : 100;

        let noMrp = 0, noDate = 0, badAddress = 0, badFont = Math.floor(viols / 3);
        history.forEach((h: any) => {
            if (h.status === 'Violation' && h.rawFields) {
                if (!h.rawFields.mrp) noMrp++;
                if (!h.rawFields.month_year) noDate++;
                if (!h.rawFields.manufacturer) badAddress++;
            }
        });

        const bar = total > 0 ? [
            { name: 'Missing MRP', val: noMrp },
            { name: 'No Mfg Date', val: noDate },
            { name: 'Font Size', val: badFont },
            { name: 'No Address', val: badAddress }
        ] : [
            { name: 'Missing MRP', val: 0 }, { name: 'No Mfg Date', val: 0 }, { name: 'Font Size', val: 0 }, { name: 'No Address', val: 0 }
        ];

        const products: Record<string, number> = {};
        history.forEach((h: any) => {
            if (h.status === 'Violation') {
                products[h.product] = (products[h.product] || 0) + 1;
            }
        });
        let offenders = Object.entries(products).map(([name, v]) => ({
            name, violations: v, trend: '+1'
        })).sort((a, b) => b.violations - a.violations).slice(0, 3);
        if (offenders.length === 0) offenders = [{ name: 'No violations yet', violations: 0, trend: '-' }];

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const timeline = days.map(d => ({ name: d, scans: 0, violations: 0 }));
        history.forEach((h: any) => {
            const dt = new Date(h.date);
            if (!isNaN(dt.getTime())) {
                const dayIndex = dt.getDay();
                timeline[dayIndex].scans += 1;
                if (h.status === 'Violation') timeline[dayIndex].violations += 1;
            }
        });

        return { total, comps, viols, rate, bar, offenders, timeline };
    }, [history]);

    return (
        <div>
            <div className="d-flex justify-between align-center mb-6">
                <div>
                    <h1 className="page-title">{isHindi ? 'डैशबोर्ड अवलोकन' : 'Dashboard Overview'}</h1>
                    <p className="page-subtitle">{isHindi ? 'लीगल मेट्रोलॉजी अनुपालन की वास्तविक समय निगरानी।' : 'Real-time monitoring of Legal Metrology compliance.'}</p>
                </div>
                <div
                    style={{ padding: '12px 20px', background: 'var(--primary-light)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--primary)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Sparkles className="text-brand" size={20} style={{ animation: 'pulse 2s infinite' }} />
                    <div style={{ position: 'relative', overflow: 'hidden', height: '20px', width: 'min(300px, 100%)' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', position: 'absolute', top: 0, left: 0, animation: 'slideUpFade 0.5s ease-out forwards' }} key={insightIndex}>
                            {insights[insightIndex]}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="d-flex gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
                <Card style={{ flex: '1 1 200px', transform: animatedNumbers ? 'translateY(0)' : 'translateY(10px)', opacity: animatedNumbers ? 1 : 0, transition: 'all 0.5s ease-out 0s' }}>
                    <div className="d-flex justify-between align-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{isHindi ? 'कुल स्कैन' : 'Total Scans'}</h3>
                        <FileScan className="text-brand" />
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 800 }}>{computed.total}</p>
                    <p className="text-success" style={{ fontSize: '0.8rem', fontWeight: 600 }}>+12% from last week</p>
                </Card>

                <Card style={{ flex: '1 1 200px', transform: animatedNumbers ? 'translateY(0)' : 'translateY(10px)', opacity: animatedNumbers ? 1 : 0, transition: 'all 0.5s ease-out 0.1s' }}>
                    <div className="d-flex justify-between align-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{isHindi ? 'अनुपालन दर' : 'Compliance Rate'}</h3>
                        <ShieldCheck className="text-success" />
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>{computed.rate}%</p>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-app)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${computed.rate}%`, height: '100%', background: 'var(--success)', borderRadius: 3, transition: 'width 1s ease-out' }} />
                    </div>
                </Card>

                <Card style={{ flex: '1 1 200px', borderLeft: '4px solid var(--danger)', transform: animatedNumbers ? 'translateY(0)' : 'translateY(10px)', opacity: animatedNumbers ? 1 : 0, transition: 'all 0.5s ease-out 0.2s' }}>
                    <div className="d-flex justify-between align-center mb-2">
                        <h3 className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{isHindi ? 'उल्लंघन' : 'Violations Detected'}</h3>
                        <AlertTriangle className="text-danger" />
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 800 }}>{computed.viols}</p>
                    <p className="text-danger" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Requires review</p>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="d-flex gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Advanced Chart */}
                    <Card style={{ height: 420 }}>
                        <div className="d-flex justify-between align-center mb-4">
                            <h3 className="text-muted">{isHindi ? 'प्रवृत्ति पूर्वानुमान के साथ गतिविधि' : 'Activity & Trend Forecast'}</h3>
                            <div className="d-flex gap-2">
                                <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 12, fontWeight: 700 }}>AI Forecast Online</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                            <AreaChart data={computed.timeline}>
                                <defs>
                                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', background: 'var(--bg-card)', backdropFilter: 'blur(10px)', color: 'var(--text-primary)' }} />
                                <Area type="monotone" dataKey="scans" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorScans)" />
                                <Area type="monotone" dataKey="violations" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorViolations)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>

                    {/* Heatmap Mock */}
                    <div className="d-flex gap-4">
                        <Card style={{ flex: 1, minHeight: 250 }}>
                            <div className="d-flex justify-between align-center mb-4">
                                <h3 className="text-muted">{isHindi ? 'हॉटस्पॉट हीटमैप' : 'Hotspot Heatmap'}</h3>
                                <Map className="text-secondary" size={18} />
                            </div>
                            <div style={{ width: '100%', height: 160, borderRadius: 16, background: 'linear-gradient(45deg, var(--bg-app) 25%, transparent 25%, transparent 75%, var(--bg-app) 75%, var(--bg-app)), linear-gradient(45deg, var(--bg-app) 25%, transparent 25%, transparent 75%, var(--bg-app) 75%, var(--bg-app))', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px', backgroundColor: 'var(--primary-light)', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                {/* Mock Heatmap dots */}
                                <div style={{ position: 'absolute', top: '30%', left: '40%', width: 40, height: 40, background: 'var(--danger)', borderRadius: '50%', filter: 'blur(12px)', opacity: 0.8, animation: 'pulse 2s infinite' }} />
                                <div style={{ position: 'absolute', top: '60%', left: '70%', width: 60, height: 60, background: 'var(--primary)', borderRadius: '50%', filter: 'blur(15px)', opacity: 0.6 }} />
                                <div style={{ position: 'absolute', top: '20%', left: '80%', width: 30, height: 30, background: 'var(--danger)', borderRadius: '50%', filter: 'blur(8px)', opacity: 0.7 }} />
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)' }}>
                                    <span style={{ padding: '4px 12px', background: 'var(--bg-card)', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, backdropFilter: 'blur(4px)' }}>Zone 4 requires attention</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Repeat Offender Radar */}
                    <Card>
                        <div className="d-flex justify-between align-center mb-4">
                            <h3 className="text-muted">{isHindi ? 'रिपीट ऑफेंडर रडार' : 'Repeat Offender Radar'}</h3>
                            <Target className="text-danger" size={18} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {computed.offenders.map((o, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-app)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{o.name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{o.violations} Violations</p>
                                    </div>
                                    <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '4px 8px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600 }}>
                                        {o.trend}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" style={{ width: '100%', marginTop: 16 }} onClick={() => navigate('/repository')}>View Full List</Button>
                    </Card>

                    {/* Gamified Leaderboard */}
                    <Card style={{ marginTop: '24px' }}>
                        <div className="d-flex justify-between align-center mb-4">
                            <h3 className="text-muted">{isHindi ? 'शीर्ष निरीक्षक (लीडरबोर्ड)' : 'Top Inspectors (Leaderboard)'}</h3>
                            <Trophy className="text-warning" size={18} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { name: 'Arjun K.', audits: 142, points: 2840, icon: <Trophy size={16} color="gold" /> },
                                { name: 'Riya S.', audits: 118, points: 2360, icon: <Medal size={16} color="silver" /> },
                                { name: 'Mehta B.', audits: 89, points: 1780, icon: <Award size={16} color="#cd7f32" /> }
                            ].map((l, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-app)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div className="d-flex align-center gap-3">
                                        <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {l.icon}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{l.name}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.audits} Audits This Month</p>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '4px 8px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600 }}>
                                        {l.points} pts
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" style={{ width: '100%', marginTop: 16 }} onClick={() => navigate('/rankings')}>View Overall Rankings</Button>
                    </Card>

                    {/* Breakdown Chart */}
                    <Card style={{ flex: 1, minHeight: 320 }}>
                        <h3 className="mb-4 text-muted">{isHindi ? 'उल्लंघन के प्रकार' : 'Violation Types Breakdown'}</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={computed.bar} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={80} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 12, background: 'var(--bg-card)', backdropFilter: 'blur(10px)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                <Bar dataKey="val" radius={[0, 6, 6, 0]} barSize={16}>
                                    {computed.bar.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={`url(#colorScans)`} style={{ fill: index === 0 ? 'var(--danger)' : 'var(--primary)' }} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            </div>
            <style>{`
                @keyframes pulse { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 0.4; } 100% { transform: scale(1); opacity: 0.8; } }
            `}</style>
        </div>
    );
};
