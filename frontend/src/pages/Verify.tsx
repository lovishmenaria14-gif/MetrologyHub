import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, XCircle, Search, Sparkles, Lock } from 'lucide-react';
import { Card } from '../components/ui/Card';

export const Verify = () => {
    const { id } = useParams();
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // Wait 1.5s for dramatic verification effect
                await new Promise(r => setTimeout(r, 1500));
               const res = await fetch(`${import.meta.env.VITE_API_URL}/api/public/verify/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                } else {
                    setStatus({ error: true });
                }
            } catch (e) {
                setStatus({ error: true });
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, [id]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)', padding: 20 }}>
            <Card style={{ maxWidth: 450, width: '100%', textAlign: 'center', padding: 40, borderRadius: 24, boxShadow: 'var(--shadow-lg)' }}>
                {loading ? (
                    <div>
                        <Search size={64} className="text-brand mb-4 mx-auto" style={{ animation: 'pulse 1.5s infinite', margin: '0 auto' }} />
                        <h2 style={{ marginBottom: 16 }}>Verifying Certificate...</h2>
                        <p className="text-muted">Connecting to Department of Legal Metrology registry securely.</p>
                    </div>
                ) : status?.error ? (
                    <div>
                        <XCircle size={64} className="text-danger mb-4 mx-auto" style={{ margin: '0 auto' }} />
                        <h2 className="text-danger" style={{ marginBottom: 16 }}>Invalid Certificate</h2>
                        <p className="text-muted">This QR Code could not be verified in the government registry. It may be forged or expired.</p>
                    </div>
                ) : (
                    <div>
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                            <ShieldCheck size={80} className="text-success" style={{ margin: '0 auto' }} />
                            <Sparkles size={24} className="text-warning" style={{ position: 'absolute', top: -10, right: -10, animation: 'pulse 2s infinite' }} />
                        </div>
                        <h2 className="text-success" style={{ marginBottom: 8, fontSize: '1.8rem' }}>100% Compliant</h2>
                        <p style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 24 }}>{status.product}</p>

                        <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 12, textAlign: 'left', border: '1px solid var(--border)' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Certificate ID</p>
                            <p style={{ margin: '0 0 16px 0', fontWeight: 600, fontFamily: 'monospace' }}>{status.id}</p>

                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Last Audited</p>
                            <p style={{ margin: '0 0 16px 0', fontWeight: 600 }}>{new Date(status.verifiedAt).toLocaleString()}</p>

                            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Certifying Authority</p>
                            <p style={{ margin: '0 0 16px 0', fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}>{status.certifyingAuthority}</p>

                            {status.cryptoSignature && (
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={12} /> Cryptographic Signature (SHA-256)</p>
                                    <p style={{ margin: '0', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 8, color: 'var(--brand)' }}>{status.cryptoSignature}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
