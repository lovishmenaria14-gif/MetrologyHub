import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Search, Filter, Download, QrCode, X } from 'lucide-react';
import QRCode from 'react-qr-code';

const initialMockHistory = [
    { id: '1042', product: 'Parle-G Biscuit 100g', date: '2026-08-30', status: 'Compliant', officer: 'AD' },
    { id: '1041', product: 'Aashirvaad Atta 5kg', date: '2026-08-29', status: 'Violation', officer: 'AD' },
    { id: '1040', product: 'Maggi Noodles 70g', date: '2026-08-28', status: 'Compliant', officer: 'MK' },
    { id: '1039', product: 'Lays Chips 50g', date: '2026-08-28', status: 'Violation', officer: 'MK' },
    { id: '1038', product: 'Amul Butter 100g', date: '2026-08-27', status: 'Compliant', officer: 'AD' },
];

export const Repository = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [qrModal, setQrModal] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

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
                        officer: 'Automated Hub'
                    })));
                }
            } catch (e) {
                const stored = localStorage.getItem('metrology_history');
                if (stored) {
                    setHistory(JSON.parse(stored));
                } else {
                    localStorage.setItem('metrology_history', JSON.stringify(initialMockHistory));
                    setHistory(initialMockHistory);
                }
            }
        };
        fetchScans();
    }, []);

    // Translation Setup
    const [lang, setLang] = useState(localStorage.getItem('appLang') || 'English');
    useEffect(() => {
        const h = () => setLang(localStorage.getItem('appLang') || 'English');
        window.addEventListener('storage', h);
        return () => window.removeEventListener('storage', h);
    }, []);
    const isHindi = lang === 'Hindi';
    const t = {
        title: isHindi ? 'अनुपालन इतिहास' : 'Compliance History',
        subtitle: isHindi ? 'पहले स्कैन की गई उत्पाद रिपोर्ट खोजें और पुनर्प्राप्त करें।' : 'Search and retrieve previously scanned product reports.',
        exportBtn: isHindi ? 'पूरा रजिस्टर निर्यात करें' : 'Export Full Registry',
        searchPlaceholder: isHindi ? 'उत्पाद का नाम या स्कैन आईडी खोजें...' : 'Search by Product Name or Scan ID...',
        filterBtn: isHindi ? (filterActive ? 'फ़िल्टर साफ़ करें' : 'उल्लंघन फ़िल्टर करें') : (filterActive ? 'Clear Filter' : 'Filter Violations'),
        h_id: isHindi ? 'स्कैन आईडी' : 'Scan ID',
        h_prod: isHindi ? 'उत्पाद का नाम' : 'Product Name',
        h_date: isHindi ? 'निरीक्षण की तिथि' : 'Inspection Date',
        h_status: isHindi ? 'स्थिति' : 'Status',
        h_officer: isHindi ? 'अधिकारी' : 'Officer',
        h_action: isHindi ? 'कार्रवाई' : 'Action',
        v_pdf: isHindi ? 'पीडीएफ देखें' : 'View PDF',
        qr_btn: isHindi ? 'क्यूआर प्रमाणपत्र' : 'Govt QR Certificate',
        no_records: isHindi ? `"${searchTerm}" से मेल खाने वाला कोई रिकॉर्ड नहीं मिला` : `No records found matching "${searchTerm}"`,
        compliant: isHindi ? 'अनुपालन' : 'Compliant',
        violation: isHindi ? 'उल्लंघन' : 'Violation'
    };

    const filtered = history.filter(item =>
        (item.product.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.includes(searchTerm)) &&
        (!filterActive || item.status === 'Violation')
    );

    const handleViewPdf = (scanId: string) => {
        if (scanId.startsWith('10')) {
            alert('This is a mock scan. Upload a real image to generate a PDF.');
            return;
        }
        window.open(`http://localhost:5001/scans/${scanId}/report`, '_blank');
    };

    const handleExportCSV = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Scan ID,Product Name,Date,Status,Officer\n"
            + history.map(e => `${e.id},"${e.product}",${e.date},${e.status},${e.officer}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "compliance_repository_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="d-flex justify-between align-center mb-6">
                <div>
                    <h1 className="page-title">{t.title}</h1>
                    <p className="page-subtitle mb-0">{t.subtitle}</p>
                </div>
                <Button variant="outline" className="d-flex align-center gap-4 text-brand" onClick={handleExportCSV}>
                    <Download size={18} /> {t.exportBtn}
                </Button>
            </div>

            <Card>
                <div className="d-flex gap-4 mb-6">
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 16, top: 12, color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 10px 10px 42px',
                                borderRadius: 8, border: '1px solid var(--border)',
                                background: 'var(--bg-app)', color: 'var(--text-primary)',
                                fontFamily: 'inherit', fontSize: '0.95rem'
                            }}
                        />
                    </div>
                    <Button variant={filterActive ? 'primary' : 'secondary'} onClick={() => setFilterActive(!filterActive)}>
                        <Filter size={18} /> {t.filterBtn}
                    </Button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_id}</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_prod}</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_date}</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_status}</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_officer}</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.h_action}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '16px' }}>#{row.id}</td>
                                    <td style={{ padding: '16px', fontWeight: 500 }}>{row.product}</td>
                                    <td style={{ padding: '16px' }}>{row.date}</td>
                                    <td style={{ padding: '16px' }}>
                                        <span className={`badge ${row.status === 'Compliant' ? 'badge-success' : 'badge-danger'}`}>
                                            {row.status === 'Compliant' ? t.compliant : t.violation}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>{row.officer}</td>
                                    <td style={{ padding: '16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <Button size="sm" variant="secondary" onClick={() => handleViewPdf(row.id)}>{t.v_pdf}</Button>
                                        <Button
                                            size="sm"
                                            variant={row.status === 'Compliant' ? 'outline' : 'secondary'}
                                            className="d-flex align-center gap-2"
                                            style={row.status === 'Compliant' ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'rgba(59, 130, 246, 0.1)' } : { opacity: 0.5, cursor: 'not-allowed' }}
                                            onClick={() => {
                                                if (row.status === 'Compliant') setQrModal({ open: true, id: row.id });
                                                else alert(isHindi ? 'गैर-अनुपालन संस्था के लिए QR जेनरेट नहीं किया जा सकता।' : 'Cannot generate QR for non-compliant entity. They must pass the audit.');
                                            }}>
                                            <QrCode size={16} /> {t.qr_btn || "Generate QR"}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {t.no_records}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {qrModal.open && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <Card style={{ width: 400, textAlign: 'center', position: 'relative', background: 'var(--bg-app)' }}>
                        <Button variant="outline" size="sm" style={{ position: 'absolute', top: 16, right: 16, border: 'none', padding: 8 }} onClick={() => setQrModal({ open: false, id: '' })}>
                            <X size={20} />
                        </Button>
                        <h2 className="mb-4">Govt QR Certificate</h2>
                        <p className="text-muted mb-6">Scan to verify this manufacturer's compliance on the public portal.</p>
                        <div style={{ background: 'white', padding: 24, borderRadius: 16, display: 'inline-block' }}>
                          <QRCode
    value={`${window.location.origin}/verify/${qrModal.id}`}
    size={200}
/>
                        </div>
                        <p style={{ marginTop: 24, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Certificate ID: {qrModal.id}</p>
                    </Card>
                </div>
            )}
        </div>
    );
};
