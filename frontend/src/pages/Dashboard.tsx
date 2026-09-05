import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import {
    ShieldCheck,
    AlertTriangle,
    FileScan,
    Sparkles,
    Map as MapIcon,
    Target,
    Trophy,
    Medal,
    Award,
    Activity,
    MapPin
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

export const Dashboard = () => {
    const navigate = useNavigate();

    const [lang, setLang] = useState(
        localStorage.getItem('appLang') || 'English'
    );

    const [animatedNumbers, setAnimatedNumbers] =
        useState(false);

    const [insightIndex, setInsightIndex] =
        useState(0);

    const [history, setHistory] =
        useState<any[]>([]);

    const [analytics, setAnalytics] =
        useState<AnalyticsData>({
            heatmap: [],
            inspections: [],
            repeatOffenders: []
        });

    const [analyticsLoading, setAnalyticsLoading] =
        useState(true);

    const [analyticsError, setAnalyticsError] =
        useState('');

    // ========================================================
    // LANGUAGE + INSIGHTS
    // ========================================================

    useEffect(() => {
        const h = () =>
            setLang(
                localStorage.getItem('appLang') ||
                'English'
            );

        window.addEventListener('storage', h);

        setTimeout(
            () => setAnimatedNumbers(true),
            100
        );

        const insightTimer =
            setInterval(() => {
                setInsightIndex(
                    prev => (prev + 1) % 3
                );
            }, 5000);

        return () => {
            window.removeEventListener(
                'storage',
                h
            );

            clearInterval(insightTimer);
        };
    }, []);

    const isHindi =
        lang === 'Hindi';

    // ========================================================
    // INSIGHTS
    // ========================================================

    const insights = isHindi
        ? [
            'को-पायलट इनसाइट: "MRP उल्लंघन आज 20% बढ़ गए हैं।"',
            'को-पायलट इनसाइट: "स्थानीय किराना स्टोर में अनुपालन दर में 5% का सुधार हुआ है।"',
            'को-पायलट इनसाइट: "चेतावनी - पैक किए गए स्नैक्स में फोंट आकार के मुद्दे अक्सर आ रहे हैं।"'
        ]
        : [
            'Copilot Insight: "MRP Violations are up 20% today."',
            'Copilot Insight: "Local grocery stores improved compliance by 5%."',
            'Copilot Insight: "Warning - Font size issues are frequent in packaged snacks."'
        ];

    // ========================================================
    // FETCH SCANS
    // ========================================================

    useEffect(() => {
        const fetchScans = async () => {
            try {
                const token =
                    localStorage.getItem(
                        'jwt_token'
                    );

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
                    localStorage.removeItem(
                        'auth'
                    );

                    window.location.href =
                        '/login';

                    return;
                }

                if (res.ok) {
                    const data =
                        await res.json();

                    setHistory(
                        data.map(
                            (h: any) => {

                                const fields =
                                    h.fields || {};

                                // IMPORTANT:
                                // Do NOT use Object.values()
                                // because crypto_signature
                                // is also stored in fields.

                                const requiredFields = [
                                    'mrp',
                                    'net_quantity',
                                    'manufacturer',
                                    'month_year'
                                ];

                                const isCompliant =
                                    requiredFields.every(
                                        field =>
                                            !!fields[field]
                                    );

                                return {
                                    id: h.id,

                                    status:
                                        isCompliant
                                            ? 'Compliant'
                                            : 'Violation',

                                    product:
                                        h.filename ||
                                        'Unknown Product',

                                    date:
                                        h.created_at,

                                    rawFields:
                                        fields,

                                    latitude:
                                        h.latitude,

                                    longitude:
                                        h.longitude
                                };
                            }
                        )
                    );
                }

            } catch (e) {

                console.error(
                    'Failed to fetch scans:',
                    e
                );

                const stored =
                    localStorage.getItem(
                        'metrology_history'
                    );

                if (stored) {
                    setHistory(
                        JSON.parse(stored)
                    );
                }
            }
        };

        fetchScans();
    }, []);

    // ========================================================
    // FETCH REAL ANALYTICS
    // ========================================================

    useEffect(() => {

        const fetchAnalytics =
            async () => {

                try {

                    setAnalyticsLoading(
                        true
                    );

                    setAnalyticsError('');

                    const token =
                        localStorage.getItem(
                            'jwt_token'
                        );

                    const res =
                        await fetch(
                            `${import.meta.env.VITE_API_URL}/api/analytics`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );

                    if (res.status === 401) {

                        localStorage.removeItem(
                            'auth'
                        );

                        window.location.href =
                            '/login';

                        return;
                    }

                    if (!res.ok) {
                        throw new Error(
                            `Analytics request failed: ${res.status}`
                        );
                    }

                    const data =
                        await res.json();

                    setAnalytics({
                        heatmap:
                            Array.isArray(
                                data.heatmap
                            )
                                ? data.heatmap
                                : [],

                        inspections:
                            Array.isArray(
                                data.inspections
                            )
                                ? data.inspections
                                : [],

                        repeatOffenders:
                            Array.isArray(
                                data.repeatOffenders
                            )
                                ? data.repeatOffenders
                                : []
                    });

                } catch (err) {

                    console.error(
                        'Analytics error:',
                        err
                    );

                    setAnalyticsError(
                        'Unable to load live inspection locations.'
                    );

                } finally {

                    setAnalyticsLoading(
                        false
                    );
                }
            };

        fetchAnalytics();

    }, []);

    // ========================================================
    // COMPUTED DASHBOARD DATA
    // ========================================================

    const computed =
        useMemo(() => {

            const total =
                history.length;

            const comps =
                history.filter(
                    (h: any) =>
                        h.status ===
                        'Compliant'
                ).length;

            const viols =
                total - comps;

            const rate =
                total > 0
                    ? Math.round(
                        (comps / total) *
                        100
                    )
                    : 100;

            let noMrp = 0;
            let noDate = 0;
            let badAddress = 0;

            const badFont =
                Math.floor(
                    viols / 3
                );

            history.forEach(
                (h: any) => {

                    if (
                        h.status ===
                            'Violation' &&
                        h.rawFields
                    ) {

                        if (
                            !h.rawFields.mrp
                        ) {
                            noMrp++;
                        }

                        if (
                            !h.rawFields.month_year
                        ) {
                            noDate++;
                        }

                        if (
                            !h.rawFields.manufacturer
                        ) {
                            badAddress++;
                        }
                    }
                }
            );

            const bar =
                total > 0
                    ? [
                        {
                            name:
                                'Missing MRP',
                            val:
                                noMrp
                        },
                        {
                            name:
                                'No Mfg Date',
                            val:
                                noDate
                        },
                        {
                            name:
                                'Font Size',
                            val:
                                badFont
                        },
                        {
                            name:
                                'No Address',
                            val:
                                badAddress
                        }
                    ]
                    : [
                        {
                            name:
                                'Missing MRP',
                            val: 0
                        },
                        {
                            name:
                                'No Mfg Date',
                            val: 0
                        },
                        {
                            name:
                                'Font Size',
                            val: 0
                        },
                        {
                            name:
                                'No Address',
                            val: 0
                        }
                    ];

            // ------------------------------------------------
            // Use backend repeat offender data
            // ------------------------------------------------

            let offenders =
                analytics.repeatOffenders
                    .map(
                        (o) => ({
                            name:
                                o.manufacturer,

                            violations:
                                o.violations,

                            trend:
                                '+1'
                        })
                    )
                    .slice(0, 3);

            if (
                offenders.length === 0
            ) {
                offenders = [
                    {
                        name:
                            'No violations yet',

                        violations: 0,

                        trend: '-'
                    }
                ];
            }

            // ------------------------------------------------
            // Weekly timeline
            // ------------------------------------------------

            const days = [
                'Sun',
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat'
            ];

            const timeline =
                days.map(
                    d => ({
                        name: d,
                        scans: 0,
                        violations: 0
                    })
                );

            history.forEach(
                (h: any) => {

                    const dt =
                        new Date(
                            h.date
                        );

                    if (
                        !isNaN(
                            dt.getTime()
                        )
                    ) {

                        const dayIndex =
                            dt.getDay();

                        timeline[
                            dayIndex
                        ].scans += 1;

                        if (
                            h.status ===
                            'Violation'
                        ) {
                            timeline[
                                dayIndex
                            ].violations += 1;
                        }
                    }
                }
            );

            return {
                total,
                comps,
                viols,
                rate,
                bar,
                offenders,
                timeline
            };

        }, [
            history,
            analytics.repeatOffenders
        ]);

    // ========================================================
    // MAP CENTER
    // ========================================================

    const mapCenter =
        useMemo<
            [number, number]
        >(() => {

            const locations =
                analytics.inspections
                    .filter(
                        item =>
                            Number.isFinite(
                                item.latitude
                            ) &&
                            Number.isFinite(
                                item.longitude
                            )
                    );

            if (
                locations.length > 0
            ) {

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

                return [
                    lat,
                    lng
                ];
            }

            // India center fallback
            return [
                22.5937,
                78.9629
            ];

        }, [
            analytics.inspections
        ]);

    // ========================================================
    // HOTSPOT CIRCLES
    // ========================================================

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

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div>

            {/* ==================================================
                HEADER
            ================================================== */}

            <div className="d-flex justify-between align-center mb-6">

                <div>

                    <h1 className="page-title">
                        {
                            isHindi
                                ? 'डैशबोर्ड अवलोकन'
                                : 'Dashboard Overview'
                        }
                    </h1>

                    <p className="page-subtitle">
                        {
                            isHindi
                                ? 'लीगल मेट्रोलॉजी अनुपालन की वास्तविक समय निगरानी।'
                                : 'Real-time monitoring of Legal Metrology compliance.'
                        }
                    </p>

                </div>

                <div
                    className="dashboard-insight"
                    role="status"
                    aria-live="polite"
                >

                    <div className="dashboard-insight-icon">
                        <Sparkles size={18} />
                    </div>

                    <div className="dashboard-insight-copy">

                        <span className="dashboard-insight-label">
                            <Activity size={13} />
                            Compliance signal
                        </span>

                        <p key={insightIndex}>
                            {
                                insights[
                                    insightIndex
                                ]
                                    .replace(
                                        'Copilot Insight: ',
                                        ''
                                    )
                                    .replace(
                                        /^को-पायलट इनसाइट: /,
                                        ''
                                    )
                            }
                        </p>

                    </div>

                </div>

            </div>

            {/* ==================================================
                QUICK METRICS
            ================================================== */}

            <div
                className="d-flex gap-4 mb-6"
                style={{
                    flexWrap:
                        'wrap'
                }}
            >

                <Card
                    style={{
                        flex:
                            '1 1 200px',

                        transform:
                            animatedNumbers
                                ? 'translateY(0)'
                                : 'translateY(10px)',

                        opacity:
                            animatedNumbers
                                ? 1
                                : 0,

                        transition:
                            'all 0.5s ease-out 0s'
                    }}
                >

                    <div className="d-flex justify-between align-center mb-2">

                        <h3
                            className="text-muted"
                            style={{
                                fontSize:
                                    '0.9rem',

                                fontWeight:
                                    600
                            }}
                        >
                            {
                                isHindi
                                    ? 'कुल स्कैन'
                                    : 'Total Scans'
                            }
                        </h3>

                        <FileScan className="text-brand" />

                    </div>

                    <p
                        style={{
                            fontSize:
                                '2rem',

                            fontWeight:
                                800
                        }}
                    >
                        {computed.total}
                    </p>

                    <p
                        className="text-success"
                        style={{
                            fontSize:
                                '0.8rem',

                            fontWeight:
                                600
                        }}
                    >
                        +12% from last week
                    </p>

                </Card>

                <Card
                    style={{
                        flex:
                            '1 1 200px',

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

                    <div className="d-flex justify-between align-center mb-2">

                        <h3
                            className="text-muted"
                            style={{
                                fontSize:
                                    '0.9rem',

                                fontWeight:
                                    600
                            }}
                        >
                            {
                                isHindi
                                    ? 'अनुपालन दर'
                                    : 'Compliance Rate'
                            }
                        </h3>

                        <ShieldCheck className="text-success" />

                    </div>

                    <p
                        style={{
                            fontSize:
                                '2rem',

                            fontWeight:
                                800,

                            color:
                                'var(--success)'
                        }}
                    >
                        {computed.rate}%
                    </p>

                    <div
                        style={{
                            width:
                                '100%',

                            height:
                                6,

                            background:
                                'var(--bg-app)',

                            borderRadius:
                                3,

                            marginTop:
                                8,

                            overflow:
                                'hidden'
                        }}
                    >

                        <div
                            style={{
                                width:
                                    `${computed.rate}%`,

                                height:
                                    '100%',

                                background:
                                    'var(--success)',

                                borderRadius:
                                    3,

                                transition:
                                    'width 1s ease-out'
                            }}
                        />

                    </div>

                </Card>

                <Card
                    style={{
                        flex:
                            '1 1 200px',

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

                    <div className="d-flex justify-between align-center mb-2">

                        <h3
                            className="text-muted"
                            style={{
                                fontSize:
                                    '0.9rem',

                                fontWeight:
                                    600
                            }}
                        >
                            {
                                isHindi
                                    ? 'उल्लंघन'
                                    : 'Violations Detected'
                            }
                        </h3>

                        <AlertTriangle className="text-danger" />

                    </div>

                    <p
                        style={{
                            fontSize:
                                '2rem',

                            fontWeight:
                                800
                        }}
                    >
                        {computed.viols}
                    </p>

                    <p
                        className="text-danger"
                        style={{
                            fontSize:
                                '0.8rem',

                            fontWeight:
                                600
                        }}
                    >
                        Requires review
                    </p>

                </Card>

            </div>

            {/* ==================================================
                MAIN GRID
            ================================================== */}

            <div
                className="d-flex gap-4 mb-6"
                style={{
                    flexWrap:
                        'wrap'
                }}
            >

                <div
                    style={{
                        flex:
                            '2 1 500px',

                        display:
                            'flex',

                        flexDirection:
                            'column',

                        gap:
                            '24px'
                    }}
                >

                    {/* ==================================================
                        ACTIVITY CHART
                    ================================================== */}

                    <Card
                        style={{
                            height:
                                420
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-4">

                            <h3 className="text-muted">
                                {
                                    isHindi
                                        ? 'प्रवृत्ति पूर्वानुमान के साथ गतिविधि'
                                        : 'Activity & Trend Forecast'
                                }
                            </h3>

                            <div className="d-flex gap-2">

                                <span
                                    style={{
                                        fontSize:
                                            '0.75rem',

                                        padding:
                                            '4px 8px',

                                        background:
                                            'var(--primary-light)',

                                        color:
                                            'var(--primary)',

                                        borderRadius:
                                            12,

                                        fontWeight:
                                            700
                                    }}
                                >
                                    AI Forecast Online
                                </span>

                            </div>

                        </div>

                        <ResponsiveContainer
                            width="100%"
                            height="85%"
                        >

                            <AreaChart
                                data={
                                    computed.timeline
                                }
                            >

                                <defs>

                                    <linearGradient
                                        id="colorScans"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >

                                        <stop
                                            offset="5%"
                                            stopColor="var(--primary)"
                                            stopOpacity={0.4}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor="var(--primary)"
                                            stopOpacity={0}
                                        />

                                    </linearGradient>

                                    <linearGradient
                                        id="colorViolations"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >

                                        <stop
                                            offset="5%"
                                            stopColor="var(--danger)"
                                            stopOpacity={0.3}
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
                                    tick={{
                                        fontSize:
                                            12,

                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <YAxis
                                    tick={{
                                        fontSize:
                                            12,

                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <Tooltip
                                    contentStyle={{
                                        borderRadius:
                                            12,

                                        border:
                                            '1px solid var(--border)',

                                        boxShadow:
                                            'var(--shadow-md)',

                                        background:
                                            'var(--bg-card)',

                                        backdropFilter:
                                            'blur(10px)',

                                        color:
                                            'var(--text-primary)'
                                    }}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="scans"
                                    stroke="var(--primary)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorScans)"
                                />

                                <Area
                                    type="monotone"
                                    dataKey="violations"
                                    stroke="var(--danger)"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorViolations)"
                                />

                            </AreaChart>

                        </ResponsiveContainer>

                    </Card>

                    {/* ==================================================
                        REAL GPS HEATMAP
                    ================================================== */}

                    <Card
                        style={{
                            minHeight:
                                480
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-4">

                            <div>

                                <div className="d-flex align-center gap-2">

                                    <MapIcon
                                        className="text-secondary"
                                        size={20}
                                    />

                                    <h3 className="text-muted">
                                        {
                                            isHindi
                                                ? 'निरीक्षण हॉटस्पॉट मैप'
                                                : 'Inspection Hotspot Map'
                                        }
                                    </h3>

                                </div>

                                <p
                                    style={{
                                        marginTop:
                                            4,

                                        fontSize:
                                            '0.8rem',

                                        color:
                                            'var(--text-secondary)'
                                    }}
                                >
                                    {
                                        analyticsLoading
                                            ? 'Loading live GPS inspection data...'
                                            : `${analytics.inspections.length} located inspections • ${violationLocations.length} violations`
                                    }
                                </p>

                            </div>

                            <div
                                className="d-flex gap-3"
                                style={{
                                    fontSize:
                                        '0.75rem'
                                }}
                            >

                                <span className="d-flex align-center gap-1">
                                    <span
                                        style={{
                                            width:
                                                10,

                                            height:
                                                10,

                                            borderRadius:
                                                '50%',

                                            background:
                                                'var(--success)',

                                            display:
                                                'inline-block'
                                        }}
                                    />
                                    Compliant
                                </span>

                                <span className="d-flex align-center gap-1">
                                    <span
                                        style={{
                                            width:
                                                10,

                                            height:
                                                10,

                                            borderRadius:
                                                '50%',

                                            background:
                                                'var(--danger)',

                                            display:
                                                'inline-block'
                                        }}
                                    />
                                    Violation
                                </span>

                            </div>

                        </div>

                        {analyticsError ? (

                            <div
                                style={{
                                    height:
                                        380,

                                    display:
                                        'flex',

                                    alignItems:
                                        'center',

                                    justifyContent:
                                        'center',

                                    color:
                                        'var(--danger)',

                                    background:
                                        'var(--bg-app)',

                                    borderRadius:
                                        16
                                }}
                            >
                                <div
                                    style={{
                                        textAlign:
                                            'center'
                                    }}
                                >

                                    <AlertTriangle
                                        size={32}
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
                                    height:
                                        380,

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
                                        analytics.inspections.length > 0
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
                                        attribution='&copy; OpenStreetMap contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />

                                    {/* ======================================
                                        VIOLATION HOTSPOT CIRCLES
                                    ====================================== */}

                                    {violationLocations.map(
                                        (
                                            inspection
                                        ) => (

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
                                                        0.15,

                                                    weight:
                                                        1
                                                }}
                                            />

                                        )
                                    )}

                                    {/* ======================================
                                        INSPECTION MARKERS
                                    ====================================== */}

                                    {analytics.inspections.map(
                                        (
                                            inspection
                                        ) => {

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
                                                            0.85,

                                                        weight:
                                                            2
                                                    }}
                                                >

                                                    <Popup>

                                                        <div
                                                            style={{
                                                                minWidth:
                                                                    190
                                                            }}
                                                        >

                                                            <div
                                                                style={{
                                                                    display:
                                                                        'flex',

                                                                    alignItems:
                                                                        'center',

                                                                    gap:
                                                                        6,

                                                                    marginBottom:
                                                                        8
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
                                                                    Scan:
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
                                                                inspection.violations.length >
                                                                    0 && (

                                                                    <div
                                                                        style={{
                                                                            marginTop:
                                                                                8
                                                                        }}
                                                                    >

                                                                        <strong>
                                                                            Missing:
                                                                        </strong>

                                                                        <ul
                                                                            style={{
                                                                                margin:
                                                                                    '4px 0 0 18px',

                                                                                padding:
                                                                                    0
                                                                            }}
                                                                        >

                                                                            {inspection.violations.map(
                                                                                (
                                                                                    violation
                                                                                ) => (

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
                            className="d-flex gap-3 mt-3"
                            style={{
                                fontSize:
                                    '0.78rem',

                                color:
                                    'var(--text-secondary)'
                            }}
                        >

                            <span>
                                🔴 Red =
                                violation hotspot
                            </span>

                            <span>
                                🟢 Green =
                                compliant inspection
                            </span>

                            <span>
                                📍 Click marker =
                                inspection details
                            </span>

                        </div>

                    </Card>

                </div>

                {/* ==================================================
                    RIGHT COLUMN
                ================================================== */}

                <div
                    style={{
                        flex:
                            '1 1 320px',

                        display:
                            'flex',

                        flexDirection:
                            'column',

                        gap:
                            '24px'
                    }}
                >

                    {/* ==================================================
                        REPEAT OFFENDER RADAR
                    ================================================== */}

                    <Card>

                        <div className="d-flex justify-between align-center mb-4">

                            <h3 className="text-muted">
                                {
                                    isHindi
                                        ? 'रिपीट ऑफेंडर रडार'
                                        : 'Repeat Offender Radar'
                                }
                            </h3>

                            <Target
                                className="text-danger"
                                size={18}
                            />

                        </div>

                        <div
                            style={{
                                display:
                                    'flex',

                                flexDirection:
                                    'column',

                                gap:
                                    12
                            }}
                        >

                            {computed.offenders.map(
                                (
                                    o,
                                    i
                                ) => (

                                    <div
                                        key={i}
                                        style={{
                                            display:
                                                'flex',

                                            justifyContent:
                                                'space-between',

                                            alignItems:
                                                'center',

                                            padding:
                                                '12px',

                                            background:
                                                'var(--bg-app)',

                                            borderRadius:
                                                12,

                                            border:
                                                '1px solid var(--border)'
                                        }}
                                    >

                                        <div>

                                            <p
                                                style={{
                                                    fontWeight:
                                                        700,

                                                    fontSize:
                                                        '0.9rem'
                                                }}
                                            >
                                                {
                                                    o.name
                                                }
                                            </p>

                                            <p
                                                style={{
                                                    fontSize:
                                                        '0.8rem',

                                                    color:
                                                        'var(--danger)'
                                                }}
                                            >
                                                {
                                                    o.violations
                                                }{' '}
                                                Violations
                                            </p>

                                        </div>

                                        <div
                                            style={{
                                                background:
                                                    'var(--danger-light)',

                                                color:
                                                    'var(--danger)',

                                                padding:
                                                    '4px 8px',

                                                borderRadius:
                                                    8,

                                                fontSize:
                                                    '0.8rem',

                                                fontWeight:
                                                    600
                                            }}
                                        >
                                            {
                                                o.trend
                                            }
                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            style={{
                                width:
                                    '100%',

                                marginTop:
                                    16
                            }}
                            onClick={() =>
                                navigate(
                                    '/repository'
                                )
                            }
                        >
                            View Full List
                        </Button>

                    </Card>

                    {/* ==================================================
                        LEADERBOARD
                    ================================================== */}

                    <Card
                        style={{
                            marginTop:
                                '0'
                        }}
                    >

                        <div className="d-flex justify-between align-center mb-4">

                            <h3 className="text-muted">
                                {
                                    isHindi
                                        ? 'शीर्ष निरीक्षक (लीडरबोर्ड)'
                                        : 'Top Inspectors (Leaderboard)'
                                }
                            </h3>

                            <Trophy
                                className="text-warning"
                                size={18}
                            />

                        </div>

                        <div
                            style={{
                                display:
                                    'flex',

                                flexDirection:
                                    'column',

                                gap:
                                    12
                            }}
                        >

                            {[
                                {
                                    name:
                                        'Arjun K.',
                                    audits:
                                        142,
                                    points:
                                        2840,
                                    icon:
                                        <Trophy
                                            size={16}
                                            color="gold"
                                        />
                                },

                                {
                                    name:
                                        'Riya S.',
                                    audits:
                                        118,
                                    points:
                                        2360,
                                    icon:
                                        <Medal
                                            size={16}
                                            color="silver"
                                        />
                                },

                                {
                                    name:
                                        'Mehta B.',
                                    audits:
                                        89,
                                    points:
                                        1780,
                                    icon:
                                        <Award
                                            size={16}
                                            color="#cd7f32"
                                        />
                                }

                            ].map(
                                (
                                    l,
                                    i
                                ) => (

                                    <div
                                        key={i}
                                        style={{
                                            display:
                                                'flex',

                                            justifyContent:
                                                'space-between',

                                            alignItems:
                                                'center',

                                            padding:
                                                '12px',

                                            background:
                                                'var(--bg-app)',

                                            borderRadius:
                                                12,

                                            border:
                                                '1px solid var(--border)'
                                        }}
                                    >

                                        <div className="d-flex align-center gap-3">

                                            <div
                                                style={{
                                                    width:
                                                        32,

                                                    height:
                                                        32,

                                                    borderRadius:
                                                        16,

                                                    background:
                                                        'var(--primary-light)',

                                                    display:
                                                        'flex',

                                                    alignItems:
                                                        'center',

                                                    justifyContent:
                                                        'center'
                                                }}
                                            >
                                                {
                                                    l.icon
                                                }
                                            </div>

                                            <div>

                                                <p
                                                    style={{
                                                        fontWeight:
                                                            700,

                                                        fontSize:
                                                            '0.9rem'
                                                    }}
                                                >
                                                    {
                                                        l.name
                                                    }
                                                </p>

                                                <p
                                                    style={{
                                                        fontSize:
                                                            '0.75rem',

                                                        color:
                                                            'var(--text-secondary)'
                                                    }}
                                                >
                                                    {
                                                        l.audits
                                                    }{' '}
                                                    Audits This Month
                                                </p>

                                            </div>

                                        </div>

                                        <div
                                            style={{
                                                background:
                                                    'var(--success-light)',

                                                color:
                                                    'var(--success)',

                                                padding:
                                                    '4px 8px',

                                                borderRadius:
                                                    8,

                                                fontSize:
                                                    '0.8rem',

                                                fontWeight:
                                                    600
                                            }}
                                        >
                                            {
                                                l.points
                                            }{' '}
                                            pts
                                        </div>

                                    </div>

                                )
                            )}

                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            style={{
                                width:
                                    '100%',

                                marginTop:
                                    16
                            }}
                            onClick={() =>
                                navigate(
                                    '/rankings'
                                )
                            }
                        >
                            View Overall Rankings
                        </Button>

                    </Card>

                    {/* ==================================================
                        VIOLATION BREAKDOWN
                    ================================================== */}

                    <Card
                        style={{
                            flex:
                                1,

                            minHeight:
                                320
                        }}
                    >

                        <h3 className="mb-4 text-muted">
                            {
                                isHindi
                                    ? 'उल्लंघन के प्रकार'
                                    : 'Violation Types Breakdown'
                            }
                        </h3>

                        <ResponsiveContainer
                            width="100%"
                            height="85%"
                        >

                            <BarChart
                                data={
                                    computed.bar
                                }
                                layout="vertical"
                                margin={{
                                    top:
                                        0,

                                    right:
                                        0,

                                    left:
                                        20,

                                    bottom:
                                        0
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
                                    tick={{
                                        fontSize:
                                            11,

                                        fill:
                                            'var(--text-secondary)'
                                    }}
                                    width={80}
                                />

                                <Tooltip
                                    cursor={{
                                        fill:
                                            'rgba(0,0,0,0.05)'
                                    }}
                                    contentStyle={{
                                        borderRadius:
                                            12,

                                        background:
                                            'var(--bg-card)',

                                        backdropFilter:
                                            'blur(10px)',

                                        border:
                                            '1px solid var(--border)',

                                        color:
                                            'var(--text-primary)'
                                    }}
                                />

                                <Bar
                                    dataKey="val"
                                    radius={[
                                        0,
                                        6,
                                        6,
                                        0
                                    ]}
                                    barSize={16}
                                >

                                    {computed.bar.map(
                                        (
                                            _,
                                            index
                                        ) => (

                                            <Cell
                                                key={
                                                    `cell-${index}`
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

                </div>

            </div>

            <style>
                {`
                    @keyframes pulse {
                        0% {
                            transform: scale(1);
                            opacity: 0.8;
                        }

                        50% {
                            transform: scale(1.5);
                            opacity: 0.4;
                        }

                        100% {
                            transform: scale(1);
                            opacity: 0.8;
                        }
                    }
                `}
            </style>

        </div>
    );
};

