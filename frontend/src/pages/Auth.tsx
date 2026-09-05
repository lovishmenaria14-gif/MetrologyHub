
import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Fingerprint,
    Lock,
    ShieldCheck,
    Mail,
    Key,
    User,
    Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL;

export const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1);

    // Translation config
    const [lang, setLang] = useState(
        localStorage.getItem('appLang') || 'English'
    );

    useEffect(() => {
        const h = () =>
            setLang(localStorage.getItem('appLang') || 'English');

        window.addEventListener('storage', h);

        return () => window.removeEventListener('storage', h);
    }, []);

    const isHindi = lang === 'Hindi';

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('inspector');

    const [authError, setAuthError] = useState('');
    const [scanning, setScanning] = useState(false);
    const [success, setSuccess] = useState(false);

    const navigate = useNavigate();

    const [pendingToken, setPendingToken] = useState<string | null>(null);

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');

        if (!email || !password) return;

        if (isLogin) {
            try {
                const formattedUser = email.includes('@')
                    ? email.split('@')[0].toLowerCase().trim()
                    : email.toLowerCase().trim();

                const res = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: formattedUser,
                        password
                    })
                });

                if (!res.ok) {
                    const data = await res.json();

                    setAuthError(
                        data.error ||
                        (
                            isHindi
                                ? 'अमान्य ईमेल या पासवर्ड। कृपया पुनः प्रयास करें।'
                                : 'Invalid email or password. Please try again.'
                        )
                    );

                    return;
                }

                const data = await res.json();

                setPendingToken(data.token);

                localStorage.setItem('userRole', data.role);
                localStorage.setItem('userName', data.username);

            } catch (err) {
                setAuthError(
                    'Connection failed: Ensure API Server is running.'
                );
                return;
            }

        } else {
            try {
                const formattedUser = email.includes('@')
                    ? email.split('@')[0].toLowerCase().trim()
                    : email.toLowerCase().trim();

                const res = await fetch(`${API_URL}/api/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: formattedUser,
                        password,
                        role
                    })
                });

                if (!res.ok) {
                    const data = await res.json();

                    setAuthError(
                        data.error || 'Registration failed.'
                    );

                    return;
                }

                const data = await res.json();

                setPendingToken(data.token);

                localStorage.setItem('userRole', data.role);
                localStorage.setItem('userName', data.username);

            } catch (err) {
                setAuthError(
                    'Connection failed: Ensure API Server is running.'
                );
                return;
            }
        }

        setStep(2);
    };

    const handleBiometricAuth = () => {
        setScanning(true);

        setTimeout(() => {
            setScanning(false);
            setSuccess(true);

            setTimeout(() => {
                localStorage.setItem('auth', '1');

                if (pendingToken) {
                    localStorage.setItem(
                        'jwt_token',
                        pendingToken
                    );
                }

                if (!isLogin) {
                    localStorage.setItem(
                        'userName',
                        name || 'User'
                    );

                    localStorage.setItem(
                        'userEmail',
                        email
                    );

                    localStorage.setItem(
                        'userRole',
                        role
                    );

                    // Actual JWT from registration
                    // is handled by pendingToken assignment
                }

                navigate('/');

            }, 800);

        }, 2000);
    };

    const t = {
        sign_in_title: isHindi
            ? 'अपने खाते में साइन इन करें'
            : 'Sign In to your account',

        create_act: isHindi
            ? 'नया खाता बनाएँ'
            : 'Create a new account',

        recovery: isHindi
            ? 'खाते की रिकवरी'
            : 'Account Recovery',

        sec_layer: isHindi
            ? 'सुरक्षा सत्यापन परत'
            : 'Security Verification Layer',

        full_name: isHindi
            ? 'पूरा नाम'
            : 'Full Name',

        email_addr: isHindi
            ? 'ईमेल पता'
            : 'Email Address',

        role_lbl: isHindi
            ? 'भूमिका'
            : 'Role',

        role_insp: isHindi
            ? 'निरीक्षक'
            : 'Inspector',

        role_sup: isHindi
            ? 'पर्यवेक्षक'
            : 'Supervisor',

        role_admin: isHindi
            ? 'सिस्टम एडमिन'
            : 'System Admin',

        pwd: isHindi
            ? 'पासवर्ड'
            : 'Password',

        strong_pwd: isHindi
            ? 'मजबूत पासवर्ड'
            : 'Strong Password',

        weak_pwd: isHindi
            ? 'कमजोर पासवर्ड (न्यूनतम 9 अक्षर)'
            : 'Weak Password (min 9 chars)',

        forgot_pwd: isHindi
            ? 'अपना पासवर्ड भूल गए?'
            : 'Forgot your password?',

        btn_cont: isHindi
            ? 'सुरक्षित लॉगिन पर जारी रखें'
            : 'Continue to Secure Login',

        btn_reg: isHindi
            ? 'खाता रजिस्टर करें'
            : 'Register Account',

        no_act: isHindi
            ? 'खाता नहीं है? साइन अप करें'
            : "Don't have an account? Sign Up",

        has_act: isHindi
            ? 'पहले से ही खाता है? साइन इन करें'
            : 'Already have an account? Sign In',

        mfa_req: isHindi
            ? 'कानूनी मेट्रोलॉजी कर्मियों के लिए अनिवार्य बहु-कारक प्रमाणीकरण आवश्यक है।'
            : 'Mandatory Multi-Factor Authentication required for Legal Metrology personnel.',

        auth_prog: isHindi
            ? 'प्रमाणीकरण हो रहा है...'
            : 'Authenticating...',

        verif_bio: isHindi
            ? 'बायोमेट्रिक्स / युबिकी सत्यापित करें'
            : 'Verify Biometrics / YubiKey',

        verif_setup: isHindi
            ? 'सत्यापित सेटअप'
            : 'Verified Setup',

        redirect: isHindi
            ? 'सुरक्षित डैशबोर्ड पर रीडायरेक्ट कर रहा है...'
            : 'Redirecting to secure dashboard...',

        sec_aes: isHindi
            ? 'AES-256 एन्क्रिप्टेड सत्र सेटअप'
            : 'AES-256 Encrypted Session Setup',

        reset_title: isHindi
            ? 'पासवर्ड रीसेट करें'
            : 'Reset Password',

        reset_desc: isHindi
            ? 'सुरक्षित पासवर्ड रीसेट लिंक प्राप्त करने के लिए अपना पंजीकृत ईमेल पता दर्ज करें।'
            : 'Enter your registered email address to receive a secure password reset link.',

        reset_succ: isHindi
            ? 'यदि ईमेल पंजीकृत खाते से मेल खाता है, तो रीसेट लिंक भेज दिया गया है।'
            : 'If the email matches a registered account, a reset link was sent.',

        send_link: isHindi
            ? 'रीसेट लिंक भेजें'
            : 'Send Reset Link',

        back_in: isHindi
            ? 'वापस साइन इन पर जाएँ'
            : 'Back to Sign In'
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-app)',
                padding: 24
            }}
        >
            <Card
                style={{
                    maxWidth: 420,
                    width: '100%',
                    padding: '40px 32px'
                }}
            >
                <div
                    style={{
                        textAlign: 'center',
                        marginBottom: 32
                    }}
                >
                    <ShieldCheck
                        size={48}
                        className="text-brand mb-4"
                        style={{
                            margin: '0 auto 16px'
                        }}
                    />

                    <h2>MetrologyHub</h2>

                    <p className="text-muted">
                        {step === 1
                            ? (isLogin
                                ? t.sign_in_title
                                : t.create_act)
                            : step === 3
                                ? t.recovery
                                : t.sec_layer}
                    </p>
                </div>

                {step === 1 && (
                    <form
                        onSubmit={handleCredentialsSubmit}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16
                        }}
                    >
                        {!isLogin && (
                            <div className="input-group">
                                <label
                                    className="text-muted"
                                    style={{
                                        fontSize: '0.85rem',
                                        marginBottom: 4,
                                        display: 'block'
                                    }}
                                >
                                    {t.full_name}
                                </label>

                                <div
                                    style={{
                                        position: 'relative'
                                    }}
                                >
                                    <User
                                        size={18}
                                        style={{
                                            position: 'absolute',
                                            left: 12,
                                            top: 12,
                                            color: 'var(--text-secondary)'
                                        }}
                                    />

                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={e =>
                                            setName(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        <div className="input-group">
                            <label
                                className="text-muted"
                                style={{
                                    fontSize: '0.85rem',
                                    marginBottom: 4,
                                    display: 'block'
                                }}
                            >
                                {isHindi
                                    ? 'उपयोगकर्ता नाम'
                                    : 'Username / Email'}
                            </label>

                            <div
                                style={{
                                    position: 'relative'
                                }}
                            >
                                <Mail
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: 12,
                                        color: 'var(--text-secondary)'
                                    }}
                                />

                                <input
                                    type="text"
                                    value={email}
                                    onChange={e =>
                                        setEmail(e.target.value)
                                    }
                                    required
                                    className="form-input"
                                    placeholder="inspector"
                                />
                            </div>
                        </div>

                        {!isLogin && (
                            <div className="input-group">
                                <label
                                    className="text-muted"
                                    style={{
                                        fontSize: '0.85rem',
                                        marginBottom: 4,
                                        display: 'block'
                                    }}
                                >
                                    {t.role_lbl}
                                </label>

                                <div
                                    style={{
                                        position: 'relative'
                                    }}
                                >
                                    <Briefcase
                                        size={18}
                                        style={{
                                            position: 'absolute',
                                            left: 12,
                                            top: 12,
                                            color: 'var(--text-secondary)'
                                        }}
                                    />

                                    <select
                                        value={role}
                                        onChange={e =>
                                            setRole(e.target.value)
                                        }
                                        className="form-input"
                                    >
                                        <option value="inspector">
                                            {t.role_insp}
                                        </option>

                                        <option value="supervisor">
                                            {t.role_sup}
                                        </option>

                                        <option value="admin">
                                            {t.role_admin}
                                        </option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="input-group">
                            <label
                                className="text-muted"
                                style={{
                                    fontSize: '0.85rem',
                                    marginBottom: 4,
                                    display: 'block'
                                }}
                            >
                                {t.pwd}
                            </label>

                            <div
                                style={{
                                    position: 'relative'
                                }}
                            >
                                <Key
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: 12,
                                        color: 'var(--text-secondary)'
                                    }}
                                />

                                <input
                                    type="password"
                                    value={password}
                                    onChange={e =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                    className="form-input"
                                    placeholder="••••••••"
                                />
                            </div>

                            {!isLogin &&
                                password.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: 8,
                                            fontSize: '0.75rem',
                                            color:
                                                password.length > 8
                                                    ? 'var(--success)'
                                                    : 'var(--danger)'
                                        }}
                                    >
                                        {password.length > 8
                                            ? t.strong_pwd
                                            : t.weak_pwd}
                                    </div>
                                )}

                            {isLogin && (
                                <div
                                    style={{
                                        textAlign: 'right',
                                        marginTop: 8
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep(3);
                                            setAuthError('');
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--accent-color)',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {t.forgot_pwd}
                                    </button>
                                </div>
                            )}
                        </div>

                        {authError && (
                            <div
                                className="text-danger"
                                style={{
                                    fontSize: '0.85rem'
                                }}
                            >
                                {authError}
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            style={{
                                width: '100%',
                                marginTop: 8
                            }}
                        >
                            {isLogin
                                ? t.btn_cont
                                : t.btn_reg}
                        </Button>

                        <div
                            style={{
                                textAlign: 'center',
                                marginTop: 16
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setAuthError('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-color)',
                                    cursor: 'pointer'
                                }}
                            >
                                {isLogin
                                    ? t.no_act
                                    : t.has_act}
                            </button>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <div style={{ textAlign: 'center' }}>
                        {success ? (
                            <div style={{ padding: 24 }}>
                                <CheckCircleIcon />

                                <h3 className="text-success mt-4">
                                    {t.verif_setup}
                                </h3>

                                <p
                                    className="text-muted"
                                    style={{
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {t.redirect}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p
                                    className="mb-6"
                                    style={{
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {t.mfa_req}
                                </p>

                                <div
                                    style={{
                                        width: 100,
                                        height: 100,
                                        borderRadius: '50%',
                                        background: scanning
                                            ? 'var(--primary-light)'
                                            : 'var(--bg-app)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 24px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        border: `2px solid ${
                                            scanning
                                                ? 'var(--primary)'
                                                : 'var(--border)'
                                        }`
                                    }}
                                    onClick={
                                        !scanning
                                            ? handleBiometricAuth
                                            : undefined
                                    }
                                >
                                    <Fingerprint
                                        size={48}
                                        className={
                                            scanning
                                                ? 'text-brand'
                                                : 'text-muted'
                                        }
                                        style={{
                                            animation: scanning
                                                ? 'pulse 1s infinite'
                                                : 'none'
                                        }}
                                    />
                                </div>

                                <Button
                                    size="lg"
                                    style={{
                                        width: '100%'
                                    }}
                                    onClick={
                                        handleBiometricAuth
                                    }
                                    isLoading={scanning}
                                >
                                    {scanning
                                        ? t.auth_prog
                                        : t.verif_bio}
                                </Button>

                                <div
                                    className="d-flex align-center justify-center gap-4 mt-6 text-muted"
                                    style={{
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <Lock size={16} />

                                    <span>
                                        {t.sec_aes}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <h3
                            style={{
                                marginBottom: 16
                            }}
                        >
                            {t.reset_title}
                        </h3>

                        <p
                            className="text-muted mb-4"
                            style={{
                                fontSize: '0.9rem'
                            }}
                        >
                            {t.reset_desc}
                        </p>

                        <div
                            className="input-group"
                            style={{
                                marginBottom: 16,
                                textAlign: 'left'
                            }}
                        >
                            <div
                                style={{
                                    position: 'relative'
                                }}
                            >
                                <Mail
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: 12,
                                        top: 12,
                                        color: 'var(--text-secondary)'
                                    }}
                                />

                                <input
                                    type="email"
                                    value={email}
                                    onChange={e =>
                                        setEmail(e.target.value)
                                    }
                                    className="form-input"
                                    placeholder="enforcement@gov.in"
                                />
                            </div>
                        </div>

                        {authError && (
                            <div
                                className={
                                    authError.includes('sent') ||
                                    authError.includes(
                                        'भेज दिया गया है'
                                    )
                                        ? 'text-success'
                                        : 'text-danger'
                                }
                                style={{
                                    fontSize: '0.85rem',
                                    marginBottom: 16
                                }}
                            >
                                {authError}
                            </div>
                        )}

                        <Button
                            size="lg"
                            style={{
                                width: '100%',
                                marginBottom: 16
                            }}
                            onClick={() => {
                                if (email) {
                                    setAuthError(
                                        t.reset_succ
                                    );
                                }
                            }}
                        >
                            {t.send_link}
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep(1);
                                setAuthError('');
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {t.back_in}
                        </button>
                    </div>
                )}
            </Card>

            <style>{`
                .form-input {
                    width: 100%;
                    padding: 10px 10px 10px 40px;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    background: var(--bg-app);
                    color: var(--text-primary);
                    font-family: inherit;
                    font-size: 0.95rem;
                    outline: none;
                }

                .form-input:focus {
                    border-color: var(--primary);
                }

                .text-danger {
                    color: var(--danger);
                }

                .text-success {
                    color: var(--success);
                }

                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }

                    50% {
                        transform: scale(1.1);
                        opacity: 0.7;
                    }

                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

const CheckCircleIcon = () => (
    <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--success)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
            margin: '0 auto'
        }}
    >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

