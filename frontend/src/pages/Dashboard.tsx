import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import {
    ShieldCheck,
    AlertTriangle,
    FileScan,
    Sparkles,
    Map as MapIcon,
    Target,
    Activity,
    MapPin,
    ArrowRight,
    ClipboardCheck,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Search,
    TrendingUp,
    Users,
    Building2
} from 'lucide-react';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';

import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    Circle
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

type Inspection = {
    id: string;
    latitude: number;
    longitude: number;
    status: 'COMPLIANT' | 'NON_COMPLIANT';
    violations: string[];
    filename?: string;
    created_at?: string;
};

type AnalyticsData = {
    heatmap: [number, number, number][];
    inspections: Inspection[];
    repeatOffenders: {
        manufacturer: string;
        violations: number;
    }[];
};

type HistoryItem = {
    id: string;
    status: 'Compliant' | 'Violation';
    product: string;
    date?: string;
    rawFields: Record<string, any>;
    latitude?: number;
    longitude?: number;
};

export const Dashboard = () => {
    const navigate = useNavigate();

    const [lang, setLang] = useState(
        localStorage.getItem('appLang') || 'English'
    );

    const [animatedNumbers, setAnimatedNumbers] = useState(false);

    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [analytics, setAnalytics] = useState<AnalyticsData>({
        heatmap: [],
        inspections: [],
        repeatOffenders: []
    });

    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState('');

    const [refreshing, setRefreshing] = useState(false);

    // =========================================================
    // LANGUAGE
    // =========================================================

    useEffect(() => {
        const handleLanguageChange = () => {
            setLang(
                localStorage.getItem('appLang') || 'English'
            );
        };

        window.addEventListener(
            'storage',
            handleLanguageChange
        );

        setTimeout(() => {
            setAnimatedNumbers(true);
        }, 100);

        return () => {
            window.removeEventListener(
                'storage',
                handleLanguageChange
            );
        };
    }, []);

    const isHindi = lang === 'Hindi';

    // =========================================================
    // FETCH SCANS
    // =========================================================

    const fetchScans = async () => {
        try {
            const token =
                localStorage.getItem('jwt_token');

            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/scans`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            if (res.status === 401) {
                localStorage.removeItem('auth');
                window.location.href = '/login';
                return;
            }

            if (!res.ok) {
                throw new Error(
                    `Scans request failed: ${res.status}`
                );
            }

            const data = await res.json();

            const formatted = data.map((h: any) => {
                const fields = h.fields || {};

                /*
                 * Compliance is based on the same required
                 * fields used by your existing application.
                 *
                 * This intentionally does NOT use Object.values()
                 * because crypto_signature may exist inside fields.
                 */

                const requiredFields = [
                    'mrp',
                    'net_quantity',
                    'manufacturer',
                    'month_year'
                ];

                const isCompliant =
                    requiredFields.every(
                        field => !!fields[field]
                    );

                return {
                    id: h.id,
                    status: isCompliant
                        ? 'Compliant'
                        : 'Violation',
                    product:
                        h.filename ||
                        'Unknown Product',
                    date: h.created_at,
                    rawFields: fields,
                    latitude: h.latitude,
                    longitude: h.longitude
                };
            });

            setHistory(formatted);

        } catch (error) {
            console.error(
                'Failed to fetch scans:',
                error
            );

            const stored =
                localStorage.getItem(
                    'metrology_history'
                );

            if (stored) {
                try {
                    setHistory(
                        JSON.parse(stored)
                    );
                } catch {
                    console.error(
                        'Invalid stored history'
                    );
                }
            }
        }
    };

    // =========================================================
    // FETCH ANALYTICS
    // =========================================================

    const fetchAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            setAnalyticsError('');

            const token =
                localStorage.getItem('jwt_token');

            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/analytics`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            if (res.status === 401) {
                localStorage.removeItem('auth');
                window.location.href = '/login';
                return;
            }

            if (!res.ok) {
                throw new Error(
                    `Analytics request failed: ${res.status}`
                );
            }

            const data = await res.json();

            setAnalytics({
                heatmap:
                    Array.isArray(data.heatmap)
                        ? data.heatmap
                        : [],

                inspections:
                    Array.isArray(data.inspections)
                        ? data.inspections
                        : [],

                repeatOffenders:
                    Array.isArray(
                        data.repeatOffenders
                    )
                        ? data.repeatOffenders
                        : []
            });

        } catch (error) {
            console.error(
                'Analytics error:',
                error
            );

            setAnalyticsError(
                'Unable to load live inspection locations.'
            );

        } finally {
            setAnalyticsLoading(false);
        }
    };

    // =========================================================
    // INITIAL DATA LOAD
    // =========================================================

    useEffect(() => {
        fetchScans();
        fetchAnalytics();
    }, []);

    // =========================================================
    // REFRESH
    // =========================================================

    const refreshDashboard = async () => {
        setRefreshing(true);

        await Promise.all([
            fetchScans(),
            fetchAnalytics()
        ]);

        setTimeout(() => {
            setRefreshing(false);
        }, 400);
    };

    // =========================================================
    // COMPUTED DATA
    // =========================================================

    const computed = useMemo(() => {
        const total = history.length;

        const compliant = history.filter(
            h => h.status === 'Compliant'
        ).length;

        const violations =
            total - compliant;

        const complianceRate =
            total > 0
                ? Math.round(
                    (compliant / total) * 100
                )
                : 0;

        /*
         * Real issue categories based on the
         * actual fields returned by your scanner.
         */

        let missingMrp = 0;
        let missingQuantity = 0;
        let missingManufacturer = 0;
        let missingDate = 0;

        history.forEach(item => {
            if (item.status !== 'Violation') {
                return;
            }

            const fields =
                item.rawFields || {};

            if (!fields.mrp) {
                missingMrp++;
            }

            if (!fields.net_quantity) {
                missingQuantity++;
            }

            if (!fields.manufacturer) {
                missingManufacturer++;
            }

            if (!fields.month_year) {
                missingDate++;
            }
        });

        const violationBreakdown = [
            {
                name: 'Missing MRP',
                val: missingMrp
            },
            {
                name: 'Quantity',
                val: missingQuantity
            },
            {
                name: 'Manufacturer',
                val: missingManufacturer
            },
            {
                name: 'Mfg. Date',
                val: missingDate
            }
        ];

        /*
         * Weekly activity
         */

        const days = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ];

        const timeline = days.map(day => ({
            name: day,
            scans: 0,
            violations: 0
        }));

        history.forEach(item => {
            if (!item.date) return;

            const date =
                new Date(item.date);

            if (isNaN(date.getTime())) {
                return;
            }

            const day =
                date.getDay();

            timeline[day].scans++;

            if (
                item.status ===
                'Violation'
            ) {
                timeline[day].violations++;
            }
        });

        /*
         * Today's activity
         */

        const today = new Date();

        const todayScans =
            history.filter(item => {
                if (!item.date) return false;

                const date =
                    new Date(item.date);

                return (
                    date.getDate() ===
                    today.getDate() &&
                    date.getMonth() ===
                    today.getMonth() &&
                    date.getFullYear() ===
                    today.getFullYear()
                );
            });

        const todayViolations =
            todayScans.filter(
                item =>
                    item.status ===
                    'Violation'
            ).length;

        /*
         * Recent inspections
         */

        const recent =
            [...history]
                .sort(
                    (a, b) =>
                        new Date(
                            b.date || 0
                        ).getTime() -
                        new Date(
                            a.date || 0
                        ).getTime()
                )
                .slice(0, 6);

        /*
         * Review queue
         */

        const reviewQueue =
            history.filter(
                item =>
                    item.status ===
                    'Violation'
            ).length;

        return {
            total,
            compliant,
            violations,
            complianceRate,
            missingMrp,
            missingQuantity,
            missingManufacturer,
            missingDate,
            violationBreakdown,
            timeline,
            todayScans: todayScans.length,
            todayViolations,
            recent,
            reviewQueue
        };
    }, [history]);

    // =========================================================
    // MAP CENTER
    // =========================================================

    const mapCenter =
        useMemo<[number, number]>(() => {
            const locations =
                analytics.inspections.filter(
                    item =>
                        Number.isFinite(
                            item.latitude
                        ) &&
                        Number.isFinite(
                            item.longitude
                        )
                );

            if (locations.length > 0) {
                const lat =
                    locations.reduce(
                        (sum, item) =>
                            sum +
                            item.latitude,
                        0
                    ) /
                    locations.length;

                const lng =
                    locations.reduce(
                        (sum, item) =>
                            sum +
                            item.longitude,
                        0
                    ) /
                    locations.length;

                return [lat, lng];
            }

            return [
                22.5937,
                78.9629
            ];
        }, [
            analytics.inspections
        ]);

    // =========================================================
    // VIOLATION LOCATIONS
    // =========================================================

    const violationLocations =
        analytics.inspections.filter(
            item =>
                item.status ===
                'NON_COMPLIANT' &&
                Number.isFinite(
                    item.latitude
                ) &&
                Number.isFinite(
                    item.longitude
                )
        );

    // =========================================================
    // REPEAT OFFENDERS
    // =========================================================

    const offenders =
        analytics.repeatOffenders
            .slice(0, 5);

    // =========================================================
    // HELPERS
    // =========================================================

    const formatDate = (
        date?: string
    ) => {
        if (!date) {
            return 'Unknown date';
        }

        const parsed =
            new Date(date);

        if (
            isNaN(
                parsed.getTime()
            )
        ) {
            return date;
        }

        return parsed.toLocaleString(
            isHindi
                ? 'hi-IN'
                : 'en-IN',
            {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        );
    };

    const getProductName = (
        name: string
    ) => {
        if (!name) {
            return 'Unknown Product';
        }

        if (name.length > 28) {
            return (
                name.substring(0, 28) +
                '...'
            );
        }

        return name;
    };

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div>

            {/* =================================================
                HEADER
            ================================================= */}

            <div
                className="d-flex justify-between align-center mb-6"
                style={{
                    flexWrap: 'wrap',
                    gap: 16
                }}
            >

                <div>

                    <div
                        className="d-flex align-center gap-2"
                        style={{
                            marginBottom: 6
                        }}
                    >

                        <div
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                background:
                                    'var(--primary-light)',
                                color:
                                    'var(--primary)',
                                display: 'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center'
                            }}
                        >
                            <ShieldCheck
                                size={22}
                            />
                        </div>

                        <span
                            style={{
                                fontSize:
                                    '0.75rem',
                                fontWeight: 800,
                                color:
                                    'var(--primary)',
                                textTransform:
                                    'uppercase',
                                letterSpacing:
                                    '0.08em'
                            }}
                        >
                            Legal Metrology
                        </span>

                    </div>

                    <h1 className="page-title">
                        {isHindi
                            ? 'निरीक्षण कमांड सेंटर'
                            : 'Inspection Command Center'}
                    </h1>

                    <p className="page-subtitle">
                        {isHindi
                            ? 'कानूनी मेट्रोलॉजी अनुपालन की वास्तविक समय निगरानी।'
                            : 'Real-time monitoring of Legal Metrology compliance and field inspections.'}
                    </p>

                </div>

                <div
                    className="d-flex align-center gap-3"
                    style={{
                        flexWrap: 'wrap'
                    }}
                >

                    <Button
                        variant="outline"
                        onClick={
                            refreshDashboard
                        }
                        disabled={
                            refreshing
                        }
                    >
                        <RefreshCw
                            size={16}
                            style={{
                                marginRight: 7,
                                animation:
                                    refreshing
                                        ? 'spin 0.8s linear infinite'
                                        : 'none'
                            }}
                        />

                        {isHindi
                            ? 'रिफ्रेश'
                            : 'Refresh'}
                    </Button>

                    <Button
                        onClick={() =>
                            navigate(
                                '/scan'
                            )
                        }
                    >
                        <FileScan
                            size={17}
                            style={{
                                marginRight: 7
                            }}
                        />

                        {isHindi
                            ? 'नया निरीक्षण'
                            : 'New Inspection'}
                    </Button>

                </div>

            </div>

            {/* =================================================
                LIVE STATUS BAR
            ================================================= */}

            <div
                className="d-flex align-center gap-3 mb-5"
                style={{
                    padding:
                        '10px 14px',
                    borderRadius: 12,
                    border:
                        '1px solid var(--border)',
                    background:
                        'var(--bg-card)',
                    fontSize:
                        '0.8rem',
                    color:
                        'var(--text-secondary)'
                }}
            >

                <span
                    className="d-flex align-center gap-2"
                >

                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius:
                                '50%',
                            background:
                                'var(--success)',
                            boxShadow:
                                '0 0 0 4px var(--success-light)'
                        }}
                    />

                    <strong
                        style={{
                            color:
                                'var(--success)'
                        }}
                    >
                        {isHindi
                            ? 'सिस्टम लाइव'
                            : 'System Live'}
                    </strong>

                </span>

                <span>
                    •
                </span>

                <span>
                    {isHindi
                        ? 'डेटा अंतिम बार अभी अपडेट हुआ'
                        : 'Live inspection data connected'}
                </span>

                <span
                    style={{
                        marginLeft:
                            'auto'
                    }}
                >
                    {new Date().toLocaleDateString(
                        isHindi
                            ? 'hi-IN'
                            : 'en-IN',
                        {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        }
                    )}
                </span>

            </div>

            {/* =================================================
                KPI CARDS
            ================================================= */}

            <div
                className="d-flex gap-4 mb-6"
                style={{
                    flexWrap: 'wrap'
                }}
            >

                {/* TOTAL */}

                <Card
                    style={{
                        flex:
                            '1 1 210px',
                        position:
                            'relative',
                        overflow:
                            'hidden',
                        transform:
                            animatedNumbers
                                ? 'translateY(0)'
                                : 'translateY(10px)',
                        opacity:
                            animatedNumbers
                                ? 1
                                : 0,
                        transition:
                            'all 0.5s ease-out'
                    }}
                >

                    <div
                        style={{
                            position:
                                'absolute',
                            right: -20,
                            top: -20,
                            width: 90,
                            height: 90,
                            borderRadius:
                                '50%',
                            background:
                                'var(--primary-light)',
                            opacity: 0.5
                        }}
                    />

                    <div className="d-flex justify-between align-center">

                        <div>

                            <p
                                style={{
                                    fontSize:
                                        '0.78rem',
                                    color:
                                        'var(--text-secondary)',
                                    fontWeight: 700,
                                    textTransform:
                                        'uppercase',
                                    letterSpacing:
                                        '0.04em'
                                }}
                            >
                                {isHindi
                                    ? 'कुल निरीक्षण'
                                    : 'Total Inspections'}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '2.25rem',
                                    fontWeight: 850,
                                    marginTop: 8,
                                    lineHeight: 1
                                }}
                            >
                                {computed.total}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '0.75rem',
                                    color:
                                        'var(--text-secondary)',
                                    marginTop: 8
                                }}
                            >
                                {computed.todayScans}{' '}
                                {isHindi
                                    ? 'आज'
                                    : 'today'}
                            </p>

                        </div>

                        <div
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                background:
                                    'var(--primary-light)',
                                color:
                                    'var(--primary)',
                                display: 'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center'
                            }}
                        >
                            <ClipboardCheck
                                size={22}
                            />
                        </div>

                    </div>

                </Card>

                {/* COMPLIANCE */}

                <Card
                    style={{
                        flex:
                            '1 1 210px',
                        transform:
                            animatedNumbers
                                ? 'translateY(0)'
                                : 'translateY(10px)',
                        opacity:
                            animatedNumbers
                                ? 1
                                : 0,
                        transition:
                            'all 0.5s ease-out 0.1s'
                    }}
                >

                    <div className="d-flex justify-between align-center">

                        <div>

                            <p
                                style={{
                                    fontSize:
                                        '0.78rem',
                                    color:
                                        'var(--text-secondary)',
                                    fontWeight: 700,
                                    textTransform:
                                        'uppercase',
                                    letterSpacing:
                                        '0.04em'
                                }}
                            >
                                {isHindi
                                    ? 'अनुपालन दर'
                                    : 'Compliance Rate'}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '2.25rem',
                                    fontWeight: 850,
                                    color:
                                        'var(--success)',
                                    marginTop: 8,
                                    lineHeight: 1
                                }}
                            >
                                {computed.complianceRate}%
                            </p>

                        </div>

                        <div
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                background:
                                    'var(--success-light)',
                                color:
                                    'var(--success)',
                                display: 'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center'
                            }}
                        >
                            <ShieldCheck
                                size={23}
                            />
                        </div>

                    </div>

                    <div
                        style={{
                            marginTop: 18,
                            height: 7,
                            borderRadius: 10,
                            background:
                                'var(--bg-app)',
                            overflow:
                                'hidden'
                        }}
                    >

                        <div
                            style={{
                                width:
                                    `${computed.complianceRate}%`,
                                height: '100%',
                                background:
                                    'var(--success)',
                                borderRadius: 10,
                                transition:
                                    'width 1s ease'
                            }}
                        />

                    </div>

                </Card>

                {/* VIOLATIONS */}

                <Card
                    style={{
                        flex:
                            '1 1 210px',
                        borderLeft:
                            '4px solid var(--danger)',
                        transform:
                            animatedNumbers
                                ? 'translateY(0)'
                                : 'translateY(10px)',
                        opacity:
                            animatedNumbers
                                ? 1
                                : 0,
                        transition:
                            'all 0.5s ease-out 0.2s'
                    }}
                >

                    <div className="d-flex justify-between align-center">

                        <div>

                            <p
                                style={{
                                    fontSize:
                                        '0.78rem',
                                    color:
                                        'var(--text-secondary)',
                                    fontWeight: 700,
                                    textTransform:
                                        'uppercase',
                                    letterSpacing:
                                        '0.04em'
                                }}
                            >
                                {isHindi
                                    ? 'उल्लंघन'
                                    : 'Violations'}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '2.25rem',
                                    fontWeight: 850,
                                    color:
                                        'var(--danger)',
                                    marginTop: 8,
                                    lineHeight: 1
                                }}
                            >
                                {computed.violations}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '0.75rem',
                                    color:
                                        'var(--danger)',
                                    marginTop: 8,
                                    fontWeight: 600
                                }}
                            >
                                {computed.todayViolations}{' '}
                                {isHindi
                                    ? 'आज'
                                    : 'detected today'}
                            </p>

                        </div>

                        <div
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                background:
                                    'var(--danger-light)',
                                color:
                                    'var(--danger)',
                                display: 'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center'
                            }}
                        >
                            <AlertTriangle
                                size={23}
                            />
                        </div>

                    </div>

                </Card>

                {/* REVIEW */}

                <Card
                    style={{
                        flex:
                            '1 1 210px',
                        transform:
                            animatedNumbers
                                ? 'translateY(0)'
                                : 'translateY(10px)',
                        opacity:
                            animatedNumbers
                                ? 1
                                : 0,
                        transition:
                            'all 0.5s ease-out 0.3s'
                    }}
                >

                    <div className="d-flex justify-between align-center">

                        <div>

                            <p
                                style={{
                                    fontSize:
                                        '0.78rem',
                                    color:
                                        'var(--text-secondary)',
                                    fontWeight: 700,
                                    textTransform:
                                        'uppercase',
                                    letterSpacing:
                                        '0.04em'
                                }}
                            >
                                {isHindi
                                    ? 'समीक्षा कतार'
                                    : 'Review Queue'}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '2.25rem',
                                    fontWeight: 850,
                                    color:
                                        computed.reviewQueue >
                                            0
                                            ? 'var(--warning)'
                                            : 'var(--success)',
                                    marginTop: 8,
                                    lineHeight: 1
                                }}
                            >
                                {computed.reviewQueue}
                            </p>

                            <p
                                style={{
                                    fontSize:
                                        '0.75rem',
                                    color:
                                        'var(--text-secondary)',
                                    marginTop: 8
                                }}
                            >
                                {isHindi
                                    ? 'ध्यान आवश्यक'
                                    : 'Items requiring attention'}
                            </p>

                        </div>

                        <div
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 14,
                                background:
                                    'var(--warning-light)',
                                color:
                                    'var(--warning)',
                                display: 'flex',
                                alignItems:
                                    'center',
                                justifyContent:
                                    'center'
                            }}
                        >
                            <Clock
                                size={22}
                            />
                        </div>

                    </div>

                </Card>

            </div>

            {/* =================================================
                MAIN CONTENT
            ================================================= */}

            <div
                className="d-flex gap-4 mb-6"
                style={{
                    flexWrap: 'wrap'
                }}
            >

                {/* =================================================
                    LEFT
                ================================================= */}

                <div
                    style={{
                        flex:
                            '2 1 600px',
                        display:
                            'flex',
                        flexDirection:
                            'column',
                        gap: 24
                    }}
                >

                    {/* ACTIVITY */}

                    <Card
                        style={{
                            height: 390
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-4">

                            <div>

                                <div
                                    className="d-flex align-center gap-2"
                                >

                                    <Activity
                                        size={19}
                                        className="text-brand"
                                    />

                                    <h3>
                                        {isHindi
                                            ? 'निरीक्षण गतिविधि'
                                            : 'Inspection Activity'}
                                    </h3>

                                </div>

                                <p
                                    style={{
                                        fontSize:
                                            '0.78rem',
                                        color:
                                            'var(--text-secondary)',
                                        marginTop: 4
                                    }}
                                >
                                    {isHindi
                                        ? 'साप्ताहिक निरीक्षण और उल्लंघन'
                                        : 'Weekly inspections and detected violations'}
                                </p>

                            </div>

                            <span
                                style={{
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    gap: 6,
                                    padding:
                                        '6px 10px',
                                    borderRadius:
                                        20,
                                    background:
                                        'var(--success-light)',
                                    color:
                                        'var(--success)',
                                    fontSize:
                                        '0.72rem',
                                    fontWeight: 700
                                }}
                            >

                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius:
                                            '50%',
                                        background:
                                            'currentColor'
                                    }}
                                />

                                Live Data

                            </span>

                        </div>

                        <ResponsiveContainer
                            width="100%"
                            height="80%"
                        >

                            <AreaChart
                                data={
                                    computed.timeline
                                }
                            >

                                <defs>

                                    <linearGradient
                                        id="dashboardScans"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >

                                        <stop
                                            offset="5%"
                                            stopColor="var(--primary)"
                                            stopOpacity={0.35}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor="var(--primary)"
                                            stopOpacity={0}
                                        />

                                    </linearGradient>

                                    <linearGradient
                                        id="dashboardViolations"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >

                                        <stop
                                            offset="5%"
                                            stopColor="var(--danger)"
                                            stopOpacity={0.25}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor="var(--danger)"
                                            stopOpacity={0}
                                        />

                                    </linearGradient>

                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="var(--border)"
                                />

                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fontSize: 12,
                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fontSize: 12,
                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                />

                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 12,
                                        border:
                                            '1px solid var(--border)',
                                        background:
                                            'var(--bg-card)',
                                        boxShadow:
                                            'var(--shadow-md)',
                                        color:
                                            'var(--text-primary)'
                                    }}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="scans"
                                    stroke="var(--primary)"
                                    strokeWidth={3}
                                    fill="url(#dashboardScans)"
                                />

                                <Area
                                    type="monotone"
                                    dataKey="violations"
                                    stroke="var(--danger)"
                                    strokeWidth={2}
                                    fill="url(#dashboardViolations)"
                                />

                            </AreaChart>

                        </ResponsiveContainer>

                    </Card>

                    {/* =================================================
                        RECENT INSPECTIONS
                    ================================================= */}

                    <Card>

                        <div
                            className="d-flex justify-between align-center"
                            style={{
                                marginBottom: 18
                            }}
                        >

                            <div>

                                <h3>
                                    {isHindi
                                        ? 'हाल के निरीक्षण'
                                        : 'Recent Inspections'}
                                </h3>

                                <p
                                    style={{
                                        fontSize:
                                            '0.78rem',
                                        color:
                                            'var(--text-secondary)',
                                        marginTop: 4
                                    }}
                                >
                                    {isHindi
                                        ? 'आपकी नवीनतम स्कैन गतिविधि'
                                        : 'Latest inspection activity from the field'}
                                </p>

                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    navigate(
                                        '/history'
                                    )
                                }
                            >
                                View All
                                <ArrowRight
                                    size={14}
                                    style={{
                                        marginLeft: 6
                                    }}
                                />
                            </Button>

                        </div>

                        {computed.recent.length === 0 ? (

                            <div
                                style={{
                                    padding:
                                        '35px 20px',
                                    textAlign:
                                        'center',
                                    border:
                                        '1px dashed var(--border)',
                                    borderRadius:
                                        14,
                                    color:
                                        'var(--text-secondary)'
                                }}
                            >

                                <Search
                                    size={28}
                                    style={{
                                        marginBottom:
                                            10,
                                        opacity: 0.5
                                    }}
                                />

                                <p
                                    style={{
                                        fontWeight:
                                            600
                                    }}
                                >
                                    {isHindi
                                        ? 'अभी कोई निरीक्षण उपलब्ध नहीं है'
                                        : 'No inspections recorded yet'}
                                </p>

                                <p
                                    style={{
                                        fontSize:
                                            '0.78rem',
                                        marginTop: 4
                                    }}
                                >
                                    {isHindi
                                        ? 'नया निरीक्षण शुरू करके यहां परिणाम देखें।'
                                        : 'Start a new inspection to see results here.'}
                                </p>

                            </div>

                        ) : (

                            <div
                                style={{
                                    display:
                                        'flex',
                                    flexDirection:
                                        'column',
                                    gap: 8
                                }}
                            >

                                {computed.recent.map(
                                    item => {

                                        const compliant =
                                            item.status ===
                                            'Compliant';

                                        return (

                                            <div
                                                key={
                                                    item.id
                                                }
                                                style={{
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    gap: 12,
                                                    padding:
                                                        '12px 14px',
                                                    border:
                                                        '1px solid var(--border)',
                                                    borderRadius:
                                                        12,
                                                    background:
                                                        'var(--bg-app)'
                                                }}
                                            >

                                                <div
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        flexShrink: 0,
                                                        borderRadius: 10,
                                                        background:
                                                            compliant
                                                                ? 'var(--success-light)'
                                                                : 'var(--danger-light)',
                                                        color:
                                                            compliant
                                                                ? 'var(--success)'
                                                                : 'var(--danger)',
                                                        display:
                                                            'flex',
                                                        alignItems:
                                                            'center',
                                                        justifyContent:
                                                            'center'
                                                    }}
                                                >

                                                    {compliant ? (
                                                        <CheckCircle2
                                                            size={18}
                                                        />
                                                    ) : (
                                                        <XCircle
                                                            size={18}
                                                        />
                                                    )}

                                                </div>

                                                <div
                                                    style={{
                                                        flex: 1,
                                                        minWidth:
                                                            0
                                                    }}
                                                >

                                                    <p
                                                        style={{
                                                            fontWeight:
                                                                700,
                                                            fontSize:
                                                                '0.88rem'
                                                        }}
                                                    >
                                                        {getProductName(
                                                            item.product
                                                        )}
                                                    </p>

                                                    <p
                                                        style={{
                                                            fontSize:
                                                                '0.72rem',
                                                            color:
                                                                'var(--text-secondary)',
                                                            marginTop:
                                                                3
                                                        }}
                                                    >
                                                        #{item.id} •{' '}
                                                        {formatDate(
                                                            item.date
                                                        )}
                                                    </p>

                                                </div>

                                                <span
                                                    style={{
                                                        padding:
                                                            '5px 9px',
                                                        borderRadius:
                                                            8,
                                                        fontSize:
                                                            '0.7rem',
                                                        fontWeight:
                                                            800,
                                                        background:
                                                            compliant
                                                                ? 'var(--success-light)'
                                                                : 'var(--danger-light)',
                                                        color:
                                                            compliant
                                                                ? 'var(--success)'
                                                                : 'var(--danger)'
                                                    }}
                                                >
                                                    {compliant
                                                        ? 'COMPLIANT'
                                                        : 'VIOLATION'}
                                                </span>

                                            </div>

                                        );
                                    }
                                )}

                            </div>

                        )}

                    </Card>

                    {/* =================================================
                        MAP
                    ================================================= */}

                    <Card
                        style={{
                            minHeight: 520
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-4">

                            <div>

                                <div
                                    className="d-flex align-center gap-2"
                                >

                                    <MapIcon
                                        size={20}
                                        className="text-secondary"
                                    />

                                    <h3>
                                        {isHindi
                                            ? 'निरीक्षण हॉटस्पॉट'
                                            : 'Inspection Hotspots'}
                                    </h3>

                                </div>

                                <p
                                    style={{
                                        marginTop: 5,
                                        fontSize:
                                            '0.78rem',
                                        color:
                                            'var(--text-secondary)'
                                    }}
                                >
                                    {analyticsLoading
                                        ? 'Loading live GPS inspection data...'
                                        : `${analytics.inspections.length} located inspections • ${violationLocations.length} violation locations`}
                                </p>

                            </div>

                            <div
                                className="d-flex gap-3"
                                style={{
                                    fontSize:
                                        '0.72rem'
                                }}
                            >

                                <span
                                    className="d-flex align-center gap-1"
                                >
                                    <span
                                        style={{
                                            width: 9,
                                            height: 9,
                                            borderRadius:
                                                '50%',
                                            background:
                                                'var(--success)'
                                        }}
                                    />
                                    Compliant
                                </span>

                                <span
                                    className="d-flex align-center gap-1"
                                >
                                    <span
                                        style={{
                                            width: 9,
                                            height: 9,
                                            borderRadius:
                                                '50%',
                                            background:
                                                'var(--danger)'
                                        }}
                                    />
                                    Violation
                                </span>

                            </div>

                        </div>

                        {analyticsError ? (

                            <div
                                style={{
                                    height: 400,
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    justifyContent:
                                        'center',
                                    background:
                                        'var(--bg-app)',
                                    borderRadius:
                                        16,
                                    color:
                                        'var(--danger)'
                                }}
                            >

                                <div
                                    style={{
                                        textAlign:
                                            'center'
                                    }}
                                >

                                    <AlertTriangle
                                        size={34}
                                        style={{
                                            marginBottom:
                                                10
                                        }}
                                    />

                                    <p>
                                        {analyticsError}
                                    </p>

                                </div>

                            </div>

                        ) : (

                            <div
                                style={{
                                    height: 400,
                                    borderRadius:
                                        16,
                                    overflow:
                                        'hidden',
                                    border:
                                        '1px solid var(--border)'
                                }}
                            >

                                <MapContainer
                                    center={
                                        mapCenter
                                    }
                                    zoom={
                                        analytics.inspections.length >
                                            0
                                            ? 12
                                            : 5
                                    }
                                    scrollWheelZoom={
                                        true
                                    }
                                    style={{
                                        height:
                                            '100%',
                                        width:
                                            '100%'
                                    }}
                                >

                                    <TileLayer
                                        attribution="&copy; OpenStreetMap contributors"
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />

                                    {/* HOTSPOT AREAS */}

                                    {violationLocations.map(
                                        inspection => (

                                            <Circle
                                                key={
                                                    `heat-${inspection.id}`
                                                }
                                                center={[
                                                    inspection.latitude,
                                                    inspection.longitude
                                                ]}
                                                radius={
                                                    300
                                                }
                                                pathOptions={{
                                                    color:
                                                        'var(--danger)',
                                                    fillColor:
                                                        'var(--danger)',
                                                    fillOpacity:
                                                        0.14,
                                                    weight:
                                                        1
                                                }}
                                            />

                                        )
                                    )}

                                    {/* MARKERS */}

                                    {analytics.inspections.map(
                                        inspection => {

                                            const isViolation =
                                                inspection.status ===
                                                'NON_COMPLIANT';

                                            return (

                                                <CircleMarker
                                                    key={
                                                        inspection.id
                                                    }
                                                    center={[
                                                        inspection.latitude,
                                                        inspection.longitude
                                                    ]}
                                                    radius={
                                                        isViolation
                                                            ? 9
                                                            : 7
                                                    }
                                                    pathOptions={{
                                                        color:
                                                            isViolation
                                                                ? 'var(--danger)'
                                                                : 'var(--success)',
                                                        fillColor:
                                                            isViolation
                                                                ? 'var(--danger)'
                                                                : 'var(--success)',
                                                        fillOpacity:
                                                            0.9,
                                                        weight:
                                                            2
                                                    }}
                                                >

                                                    <Popup>

                                                        <div
                                                            style={{
                                                                minWidth:
                                                                    210
                                                            }}
                                                        >

                                                            <div
                                                                style={{
                                                                    display:
                                                                        'flex',
                                                                    alignItems:
                                                                        'center',
                                                                    gap: 7,
                                                                    marginBottom:
                                                                        10
                                                                }}
                                                            >

                                                                <MapPin
                                                                    size={
                                                                        16
                                                                    }
                                                                />

                                                                <strong>
                                                                    Inspection
                                                                </strong>

                                                            </div>

                                                            <p
                                                                style={{
                                                                    marginBottom:
                                                                        5
                                                                }}
                                                            >
                                                                <strong>
                                                                    ID:
                                                                </strong>{' '}
                                                                {
                                                                    inspection.id
                                                                }
                                                            </p>

                                                            <p
                                                                style={{
                                                                    marginBottom:
                                                                        5
                                                                }}
                                                            >
                                                                <strong>
                                                                    Status:
                                                                </strong>{' '}

                                                                <span
                                                                    style={{
                                                                        color:
                                                                            isViolation
                                                                                ? 'var(--danger)'
                                                                                : 'var(--success)',
                                                                        fontWeight:
                                                                            700
                                                                    }}
                                                                >
                                                                    {
                                                                        inspection.status
                                                                    }
                                                                </span>

                                                            </p>

                                                            <p
                                                                style={{
                                                                    marginBottom:
                                                                        5
                                                                }}
                                                            >
                                                                <strong>
                                                                    GPS:
                                                                </strong>{' '}
                                                                {inspection.latitude.toFixed(
                                                                    5
                                                                )}
                                                                ,{' '}
                                                                {inspection.longitude.toFixed(
                                                                    5
                                                                )}
                                                            </p>

                                                            {inspection.filename && (
                                                                <p
                                                                    style={{
                                                                        marginBottom:
                                                                            5
                                                                    }}
                                                                >
                                                                    <strong>
                                                                        Product:
                                                                    </strong>{' '}
                                                                    {
                                                                        inspection.filename
                                                                    }
                                                                </p>
                                                            )}

                                                            {isViolation &&
                                                                inspection.violations?.length >
                                                                    0 && (

                                                                    <div
                                                                        style={{
                                                                            marginTop:
                                                                                9
                                                                        }}
                                                                    >

                                                                        <strong>
                                                                            Detected issues:
                                                                        </strong>

                                                                        <ul
                                                                            style={{
                                                                                margin:
                                                                                    '5px 0 0 18px',
                                                                                padding:
                                                                                    0
                                                                            }}
                                                                        >

                                                                            {inspection.violations.map(
                                                                                violation => (
                                                                                    <li
                                                                                        key={
                                                                                            violation
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            violation
                                                                                        }
                                                                                    </li>
                                                                                )
                                                                            )}

                                                                        </ul>

                                                                    </div>

                                                                )}

                                                        </div>

                                                    </Popup>

                                                </CircleMarker>

                                            );
                                        }
                                    )}

                                </MapContainer>

                            </div>

                        )}

                        <div
                            className="d-flex gap-4 mt-3"
                            style={{
                                flexWrap:
                                    'wrap',
                                fontSize:
                                    '0.75rem',
                                color:
                                    'var(--text-secondary)'
                            }}
                        >

                            <span>
                                🔴 Violation hotspot
                            </span>

                            <span>
                                🟢 Compliant inspection
                            </span>

                            <span>
                                📍 Click marker for details
                            </span>

                        </div>

                    </Card>

                </div>

                {/* =================================================
                    RIGHT COLUMN
                ================================================= */}

                <div
                    style={{
                        flex:
                            '1 1 320px',
                        display:
                            'flex',
                        flexDirection:
                            'column',
                        gap: 24
                    }}
                >

                    {/* =================================================
                        COMPLIANCE HEALTH
                    ================================================= */}

                    <Card>

                        <div className="d-flex justify-between align-center">

                            <div>

                                <p
                                    style={{
                                        fontSize:
                                            '0.75rem',
                                        fontWeight:
                                            800,
                                        color:
                                            'var(--text-secondary)',
                                        textTransform:
                                            'uppercase'
                                    }}
                                >
                                    {isHindi
                                        ? 'अनुपालन स्वास्थ्य'
                                        : 'Compliance Health'}
                                </p>

                                <h2
                                    style={{
                                        fontSize:
                                            '2.7rem',
                                        fontWeight:
                                            850,
                                        marginTop:
                                            8,
                                        color:
                                            computed.complianceRate >=
                                                80
                                                ? 'var(--success)'
                                                : computed.complianceRate >=
                                                    60
                                                    ? 'var(--warning)'
                                                    : 'var(--danger)'
                                    }}
                                >
                                    {
                                        computed.complianceRate
                                    }%
                                </h2>

                            </div>

                            <div
                                style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius:
                                        '50%',
                                    background:
                                        'var(--bg-app)',
                                    border:
                                        `7px solid ${
                                            computed.complianceRate >=
                                            80
                                                ? 'var(--success)'
                                                : computed.complianceRate >=
                                                    60
                                                    ? 'var(--warning)'
                                                    : 'var(--danger)'
                                        }`,
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    justifyContent:
                                        'center'
                                }}
                            >

                                <ShieldCheck
                                    size={27}
                                />

                            </div>

                        </div>

                        <div
                            style={{
                                marginTop:
                                    18,
                                padding:
                                    '10px 12px',
                                borderRadius:
                                    10,
                                background:
                                    computed.complianceRate >=
                                        80
                                        ? 'var(--success-light)'
                                        : 'var(--danger-light)',
                                color:
                                    computed.complianceRate >=
                                        80
                                        ? 'var(--success)'
                                        : 'var(--danger)',
                                fontSize:
                                    '0.78rem',
                                fontWeight:
                                    700
                            }}
                        >

                            {computed.complianceRate >=
                            80
                                ? '✓ Overall compliance is healthy'
                                : '⚠ Compliance requires attention'}

                        </div>

                    </Card>

                    {/* =================================================
                        COPILOT SIGNAL
                    ================================================= */}

                    <Card
                        style={{
                            background:
                                'linear-gradient(135deg, var(--bg-card), var(--primary-light))',
                            border:
                                '1px solid var(--border)'
                        }}
                    >

                        <div
                            className="d-flex align-center gap-2 mb-3"
                        >

                            <div
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius:
                                        10,
                                    background:
                                        'var(--primary)',
                                    color:
                                        'white',
                                    display:
                                        'flex',
                                    alignItems:
                                        'center',
                                    justifyContent:
                                        'center'
                                }}
                            >
                                <Sparkles
                                    size={17}
                                />
                            </div>

                            <div>

                                <h3>
                                    {isHindi
                                        ? 'निरीक्षण सिग्नल'
                                        : 'Inspection Signal'}
                                </h3>

                                <p
                                    style={{
                                        fontSize:
                                            '0.68rem',
                                        color:
                                            'var(--text-secondary)',
                                        marginTop:
                                            2
                                    }}
                                >
                                    {isHindi
                                        ? 'वास्तविक डेटा से उत्पन्न'
                                        : 'Generated from current inspection data'}
                                </p>

                            </div>

                        </div>

                        <p
                            style={{
                                fontSize:
                                    '0.88rem',
                                lineHeight:
                                    1.55
                            }}
                        >

                            {computed.violations >
                            0
                                ? `There are ${computed.violations} recorded violation${computed.violations === 1 ? '' : 's'} requiring attention.`
                                : 'No violations have been recorded in the available inspection data.'}

                        </p>

                        {computed.missingMrp >
                            0 && (

                            <div
                                style={{
                                    marginTop:
                                        12,
                                    padding:
                                        '9px 11px',
                                    background:
                                        'var(--bg-card)',
                                    borderRadius:
                                        9,
                                    fontSize:
                                        '0.76rem'
                                }}
                            >

                                <strong>
                                    MRP:
                                </strong>{' '}
                                {computed.missingMrp}{' '}
                                inspection
                                {computed.missingMrp !==
                                1
                                    ? 's'
                                    : ''}{' '}
                                missing MRP data.

                            </div>

                        )}

                    </Card>

                    {/* =================================================
                        VIOLATION BREAKDOWN
                    ================================================= */}

                    <Card
                        style={{
                            minHeight:
                                330
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-3">

                            <div>

                                <h3>
                                    {isHindi
                                        ? 'उल्लंघन प्रकार'
                                        : 'Violation Categories'}
                                </h3>

                                <p
                                    style={{
                                        fontSize:
                                            '0.72rem',
                                        color:
                                            'var(--text-secondary)',
                                        marginTop:
                                            3
                                    }}
                                >
                                    {isHindi
                                        ? 'वास्तविक स्कैन डेटा'
                                        : 'Based on actual scan fields'}
                                </p>

                            </div>

                            <AlertTriangle
                                size={18}
                                className="text-danger"
                            />

                        </div>

                        <ResponsiveContainer
                            width="100%"
                            height={230}
                        >

                            <BarChart
                                data={
                                    computed.violationBreakdown
                                }
                                layout="vertical"
                                margin={{
                                    top: 0,
                                    right: 10,
                                    left: 15,
                                    bottom: 0
                                }}
                            >

                                <XAxis
                                    type="number"
                                    hide
                                />

                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={85}
                                    tick={{
                                        fontSize: 10,
                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                />

                                <Tooltip
                                    contentStyle={{
                                        borderRadius:
                                            10,
                                        background:
                                            'var(--bg-card)',
                                        border:
                                            '1px solid var(--border)',
                                        color:
                                            'var(--text-primary)'
                                    }}
                                />

                                <Bar
                                    dataKey="val"
                                    barSize={14}
                                    radius={[
                                        0,
                                        6,
                                        6,
                                        0
                                    ]}
                                >

                                    {computed.violationBreakdown.map(
                                        (_, index) => (

                                            <Cell
                                                key={
                                                    `violation-cell-${index}`
                                                }
                                                fill={
                                                    index ===
                                                    0
                                                        ? 'var(--danger)'
                                                        : 'var(--primary)'
                                                }
                                            />

                                        )
                                    )}

                                </Bar>

                            </BarChart>

                        </ResponsiveContainer>

                    </Card>

                    {/* =================================================
                        REPEAT OFFENDERS
                    ================================================= */}

                    <Card>

                        <div className="d-flex justify-between align-center mb-4">

                            <div>

                                <h3>
                                    {isHindi
                                        ? 'रिपीट ऑफेंडर'
                                        : 'Repeat Offenders'}
                                </h3>

                                <p
                                    style={{
                                        fontSize:
                                            '0.72rem',
                                        color:
                                            'var(--text-secondary)',
                                        marginTop:
                                            3
                                    }}
                                >
                                    {isHindi
                                        ? 'उच्च जोखिम वाले निर्माता'
                                        : 'Manufacturers with repeated violations'}
                                </p>

                            </div>

                            <Target
                                size={19}
                                className="text-danger"
                            />

                        </div>

                        {offenders.length ===
                        0 ? (

                            <div
                                style={{
                                    textAlign:
                                        'center',
                                    padding:
                                        '22px 10px',
                                    color:
                                        'var(--text-secondary)'
                                }}
                            >

                                <CheckCircle2
                                    size={26}
                                    style={{
                                        marginBottom:
                                            7,
                                        color:
                                            'var(--success)'
                                    }}
                                />

                                <p
                                    style={{
                                        fontSize:
                                            '0.8rem',
                                        fontWeight:
                                            600
                                    }}
                                >
                                    No repeat offenders found
                                </p>

                            </div>

                        ) : (

                            <div
                                style={{
                                    display:
                                        'flex',
                                    flexDirection:
                                        'column',
                                    gap: 9
                                }}
                            >

                                {offenders.map(
                                    (
                                        offender,
                                        index
                                    ) => (

                                        <div
                                            key={
                                                `${offender.manufacturer}-${index}`
                                            }
                                            style={{
                                                display:
                                                    'flex',
                                                justifyContent:
                                                    'space-between',
                                                alignItems:
                                                    'center',
                                                padding:
                                                    '11px 12px',
                                                background:
                                                    'var(--bg-app)',
                                                border:
                                                    '1px solid var(--border)',
                                                borderRadius:
                                                    11
                                            }}
                                        >

                                            <div
                                                className="d-flex align-center gap-2"
                                            >

                                                <div
                                                    style={{
                                                        width:
                                                            30,
                                                        height:
                                                            30,
                                                        borderRadius:
                                                            9,
                                                        background:
                                                            'var(--danger-light)',
                                                        color:
                                                            'var(--danger)',
                                                        display:
                                                            'flex',
                                                        alignItems:
                                                            'center',
                                                        justifyContent:
                                                            'center'
                                                    }}
                                                >
                                                    <Building2
                                                        size={
                                                            15
                                                        }
                                                    />
                                                </div>

                                                <div>

                                                    <p
                                                        style={{
                                                            fontWeight:
                                                                700,
                                                            fontSize:
                                                                '0.82rem'
                                                        }}
                                                    >
                                                        {
                                                            offender.manufacturer
                                                        }
                                                    </p>

                                                    <p
                                                        style={{
                                                            fontSize:
                                                                '0.68rem',
                                                            color:
                                                                'var(--text-secondary)',
                                                            marginTop:
                                                                2
                                                        }}
                                                    >
                                                        Repeated violations
                                                    </p>

                                                </div>

                                            </div>

                                            <span
                                                style={{
                                                    padding:
                                                        '5px 8px',
                                                    borderRadius:
                                                        7,
                                                    background:
                                                        'var(--danger-light)',
                                                    color:
                                                        'var(--danger)',
                                                    fontSize:
                                                        '0.7rem',
                                                    fontWeight:
                                                        800
                                                }}
                                            >
                                                {
                                                    offender.violations
                                                }
                                            </span>

                                        </div>

                                    )
                                )}

                            </div>

                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            style={{
                                width:
                                    '100%',
                                marginTop:
                                    14
                            }}
                            onClick={() =>
                                navigate(
                                    '/repository'
                                )
                            }
                        >
                            View Full List
                            <ArrowRight
                                size={14}
                                style={{
                                    marginLeft: 6
                                }}
                            />
                        </Button>

                    </Card>

                    {/* =================================================
                        QUICK ACTIONS
                    ================================================= */}

                    <Card>

                        <div
                            className="d-flex align-center gap-2 mb-4"
                        >

                            <Target
                                size={18}
                                className="text-brand"
                            />

                            <h3>
                                {isHindi
                                    ? 'त्वरित कार्य'
                                    : 'Quick Actions'}
                            </h3>

                        </div>

                        <div
                            style={{
                                display:
                                    'grid',
                                gridTemplateColumns:
                                    '1fr 1fr',
                                gap: 10
                            }}
                        >

                            <button
                                onClick={() =>
                                    navigate(
                                        '/scan'
                                    )
                                }
                                style={{
                                    border:
                                        '1px solid var(--border)',
                                    background:
                                        'var(--bg-app)',
                                    borderRadius:
                                        11,
                                    padding:
                                        '14px 10px',
                                    cursor:
                                        'pointer',
                                    color:
                                        'var(--text-primary)'
                                }}
                            >

                                <FileScan
                                    size={20}
                                    className="text-brand"
                                />

                                <p
                                    style={{
                                        fontSize:
                                            '0.75rem',
                                        fontWeight:
                                            700,
                                        marginTop:
                                            7
                                    }}
                                >
                                    New Scan
                                </p>

                            </button>

                            <button
                                onClick={() =>
                                    navigate(
                                        '/history'
                                    )
                                }
                                style={{
                                    border:
                                        '1px solid var(--border)',
                                    background:
                                        'var(--bg-app)',
                                    borderRadius:
                                        11,
                                    padding:
                                        '14px 10px',
                                    cursor:
                                        'pointer',
                                    color:
                                        'var(--text-primary)'
                                }}
                            >

                                <Clock
                                    size={20}
                                    className="text-brand"
                                />

                                <p
                                    style={{
                                        fontSize:
                                            '0.75rem',
                                        fontWeight:
                                            700,
                                        marginTop:
                                            7
                                    }}
                                >
                                    History
                                </p>

                            </button>

                            <button
                                onClick={() =>
                                    navigate(
                                        '/repository'
                                    )
                                }
                                style={{
                                    border:
                                        '1px solid var(--border)',
                                    background:
                                        'var(--bg-app)',
                                    borderRadius:
                                        11,
                                    padding:
                                        '14px 10px',
                                    cursor:
                                        'pointer',
                                    color:
                                        'var(--text-primary)'
                                }}
                            >

                                <Building2
                                    size={20}
                                    className="text-brand"
                                />

                                <p
                                    style={{
                                        fontSize:
                                            '0.75rem',
                                        fontWeight:
                                            700,
                                        marginTop:
                                            7
                                    }}
                                >
                                    Repository
                                </p>

                            </button>

                            <button
                                onClick={() =>
                                    navigate(
                                        '/rankings'
                                    )
                                }
                                style={{
                                    border:
                                        '1px solid var(--border)',
                                    background:
                                        'var(--bg-app)',
                                    borderRadius:
                                        11,
                                    padding:
                                        '14px 10px',
                                    cursor:
                                        'pointer',
                                    color:
                                        'var(--text-primary)'
                                }}
                            >

                                <Users
                                    size={20}
                                    className="text-brand"
                                />

                                <p
                                    style={{
                                        fontSize:
                                            '0.75rem',
                                        fontWeight:
                                            700,
                                        marginTop:
                                            7
                                    }}
                                >
                                    Rankings
                                </p>

                            </button>

                        </div>

                    </Card>

                </div>

            </div>

            {/* =================================================
                FOOTER INSIGHT
            ================================================= */}

            <div
                style={{
                    padding:
                        '16px 18px',
                    borderRadius:
                        14,
                    background:
                        'var(--bg-card)',
                    border:
                        '1px solid var(--border)',
                    display:
                        'flex',
                    alignItems:
                        'center',
                    gap: 12,
                    marginBottom:
                        10
                }}
            >

                <TrendingUp
                    size={18}
                    className="text-brand"
                />

                <div>

                    <p
                        style={{
                            fontWeight:
                                700,
                            fontSize:
                                '0.82rem'
                        }}
                    >
                        {isHindi
                            ? 'निरीक्षण इंटेलिजेंस'
                            : 'Inspection Intelligence'}
                    </p>

                    <p
                        style={{
                            fontSize:
                                '0.74rem',
                            color:
                                'var(--text-secondary)',
                            marginTop:
                                2
                        }}
                    >
                        {isHindi
                            ? 'डैशबोर्ड पर दिखाए गए आंकड़े आपके उपलब्ध निरीक्षण डेटा से गणना किए गए हैं।'
                            : 'Dashboard metrics and violation categories are calculated from your available inspection data.'}
                    </p>

                </div>

            </div>

            {/* =================================================
                LOCAL ANIMATIONS
            ================================================= */}

            <style>
                {`
                    @keyframes spin {
                        from {
                            transform: rotate(0deg);
                        }
                        to {
                            transform: rotate(360deg);
                        }
                    }

                    @media (max-width: 768px) {
                        .page-title {
                            font-size: 1.65rem !important;
                        }
                    }
                `}
            </style>

        </div>
    );
};

