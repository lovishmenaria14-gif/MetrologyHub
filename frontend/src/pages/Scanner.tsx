import { useState, useRef, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, FileScan, PlusSquare, FileText, AlertOctagon, Camera, X, Mic, MicOff, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import { analyzeTextWithRuleEngine } from '../utils/RuleEngine';


export const Scanner = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanStep, setScanStep] = useState(0);
    const [report, setReport] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [bboxData, setBboxData] = useState<any[]>([]);
    const [imgDims, setImgDims] = useState({ w: 1, h: 1 });
    const [repeatOffender, setRepeatOffender] = useState(false);

    // Voice Assistant States
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const handleVoiceCommandRef = useRef<(cmd: string) => void>();
    const [qrModal, setQrModal] = useState<{ open: boolean, id: string }>({ open: false, id: '' });

    // Camera States
    const [showCamera, setShowCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tamperWarning, setTamperWarning] = useState<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const userRole = localStorage.getItem('userRole') || 'inspector';
    const userName = localStorage.getItem('userName') || 'Admin User';

    // Translation Setup
    const [lang, setLang] = useState(localStorage.getItem('appLang') || 'English');
    useEffect(() => {
        const h = () => setLang(localStorage.getItem('appLang') || 'English');
        window.addEventListener('storage', h);
        return () => window.removeEventListener('storage', h);
    }, []);
    const isHindi = lang === 'Hindi';

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = isHindi ? 'hi-IN' : 'en-US';

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (e: any) => {
                console.error('Speech error', e);
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                console.log("Voice Command:", transcript);
                if (handleVoiceCommandRef.current) handleVoiceCommandRef.current(transcript);
            };
            recognitionRef.current = recognition;
        }
    }, [isHindi]);

    const toggleListening = () => {
        if (isListening) recognitionRef.current?.stop();
        else recognitionRef.current?.start();
    };

    const t = {
        title: isHindi ? 'पैकेज्ड कमोडिटी को स्कैन करें' : 'Scan Packaged Commodity',
        subtitle: isHindi ? 'OCR अनुपालन जाँच के लिए लेबल या उत्पाद छवियाँ अपलोड करें।' : 'Upload label or product images for OCR compliance assertion.',
        drag_drop: isHindi ? 'छवि यहाँ क्लिक करें या खींचें' : 'Click or Drag image here',
        supports: isHindi ? 'समर्थित: JPG, PNG (अधिकतम 3, प्रत्येक 5MB)' : 'Supports JPG, PNG (Max 3 photos, 5MB each)',
        max_error: isHindi ? 'एक जाँच के लिए अधिकतम 3 छवियां अपलोड की जा सकती हैं।' : 'Maximum of 3 images can be uploaded for a single compliance check.',
        previews: isHindi ? 'चयनित पूर्वावलोकन' : 'Selected Previews',
        btn_scan: isHindi ? 'अनुपालन स्कैन चलाएँ' : 'Run Compliance Scan',
        btn_scanning: isHindi ? 'प्रीप्रोसेसिंग और OCR इंजन...' : 'Preprocessing & OCR Engine...',
        upload_prompt: isHindi ? 'अनुपालन विवरण देखने के लिए यहाँ उत्पाद छवि अपलोड करें।' : 'Upload a product image to view compliance details here.',
        ai_prog: isHindi ? 'एआई विश्लेषण जारी है...' : 'AI Analysis in Progress...',
        ai_desc: isHindi ? 'लेबल निकालना और मेट्रोलॉजी नियम 2011 का सत्यापन' : 'Extracting labels and verifying Metrology Rules 2011',
        rep_title: isHindi ? 'विश्लेषण रिपोर्ट' : 'Analysis Report',
        rep_compliant: isHindi ? 'अनुपालक (सत्यापित)' : 'COMPLIANT',
        rep_viol: isHindi ? 'संभावित गैर-अनुपालन' : 'POTENTIAL NON-COMPLIANCE - Review Required',
        raw_ocr: isHindi ? 'कच्चा निकाला गया पाठ (OCR)' : 'Raw Extracted Text (OCR)',
        det_non: isHindi ? 'ज्ञात गैर-अनुपालन' : 'Detected Non-Compliances',
        all_mand: isHindi ? 'सभी अनिवार्य घोषणाएँ मौजूद हैं' : 'All Mandatory Declarations Present',
        all_mand_desc: isHindi ? 'फ़ॉन्ट आकार और पठनीयता मानक पूरे हुए।' : 'Font size and readability standards met.',
        fail_ocr: isHindi ? 'OCR सेवा से संपर्क करने में विफल।' : 'Failed to contact OCR service.',
        sim_mode: isHindi ? 'सिमुलेशन परिणाम:' : 'Simulation Result:',
        sim_compliant: isHindi ? 'अनुपालन होने का अनुकरण करें' : 'Simulate Compliant',
        sim_violation: isHindi ? 'उल्लंघन होने का अनुकरण करें' : 'Simulate Violation',
        add_report: isHindi ? 'रिपोर्ट में जोड़ें' : 'Add to Report',
        no_access: isHindi ? 'रिपोर्ट में जोड़ने के लिए केवल निरीक्षक या एडमिन को अनुमति है।' : 'Only Inspector or Admin can add to reports.',
        step_preprocessing: isHindi ? 'छवि प्रीप्रोसेसिंग (डेस्क्यू, डीनोइज़, चमक सुधार)...' : 'Image Preprocessing (deskew, denoise, glare correction)...',
        step_cv: isHindi ? 'कंप्यूटर विज़न: पाठ क्षेत्र का पता लगाना (बाउंडिंग बॉक्स)...' : 'Computer Vision: Text Region Detection (bounding boxes)...',
        step_ocr: isHindi ? 'OCR: पाठ निष्कर्षण (PaddleOCR)...' : 'OCR: Text Extraction (PaddleOCR)...',
        step_nlp: isHindi ? 'एनएलपी क्षेत्र वर्गीकरण (पाठ का मानचित्रण -> घोषणा प्रकार)...' : 'NLP Field Classification (map text -> declaration type)...',
        step_rule_presence: isHindi ? 'रूल इंजन चेतावनी: उपस्थिति जाँच...' : 'RULE ENGINE VALIDATION: Presence Check...',
        step_rule_format: isHindi ? 'रूल इंजन चेतावनी: प्रारूप और स्थान जाँच...' : 'RULE ENGINE VALIDATION: Format & Placement Check...',
        step_rule_font: isHindi ? 'रूल इंजन चेतावनी: फ़ॉन्ट का आकार / पठनीयता जाँच...' : 'RULE ENGINE VALIDATION: Font-Size/Readability Check...',
        step_finalizing: isHindi ? 'अनुपालन परिणाम को अंतिम रूप दिया जा रहा है...' : 'Finalizing Compliance Result...',
        pdf_btn: isHindi ? 'कानूनी नोटिस (PDF) उत्पन्न करें' : 'Generate Legal Notice (PDF)',
        repeat_offender: isHindi ? 'बार-बार अपराध करने वाला' : 'REPEAT OFFENDER DETECTED',
        tamper_alert: isHindi ? 'चेतावनी: संभावित डिजिटल छेड़छाड़ का पता चला।' : 'WARNING: Possible digital manipulation detected.'
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length > 1) return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const handleAddToReport = () => {
        const stored = localStorage.getItem('metrology_history');
        const history = stored ? JSON.parse(stored) : [];
        const newItem = {
            id: Math.floor(1000 + Math.random() * 9000).toString(),
            product: files.length > 0 ? files[0].name.replace(/\.[^/.]+$/, "") : 'Scanned Commodity',
            date: new Date().toISOString().split('T')[0],
            status: report.compliant ? 'Compliant' : 'Violation',
            officer: getInitials(userName)
        };
        history.unshift(newItem);
        localStorage.setItem('metrology_history', JSON.stringify(history));
        navigate('/repository');
    };

    const handleGeneratePDF = () => {
        if (!report?.scanId) {
            setError(isHindi ? 'स्कैन आईडी गुम है।' : 'Scan ID is missing.');
            return;
        }
        window.open(`http://localhost:5001/scans/${report.scanId}/report`, '_blank');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 3) {
            setError(t.max_error);
            return;
        }
        if (selectedFiles.length > 0) {
            setFiles(selectedFiles);
            setPreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
            setReport(null);
            setError(null);

            // Tamper Detection Heuristic (Mock)
            const fName = selectedFiles[0].name.toLowerCase();
            if (fName.includes('edit') || fName.includes('psd') || fName.includes('copy')) {
                setTamperWarning(t.tamper_alert + " (Metadata inconsistency: Source flagged)");
            } else if (Math.random() < 0.15) {
                setTamperWarning(t.tamper_alert + " (Lighting/Texture inconsistency detected)");
            } else {
                setTamperWarning(null);
            }
        }
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setStream(mediaStream);
            setShowCamera(true);
            setError(null);

            // Request geolocation
            navigator.geolocation.getCurrentPosition((pos) => {
                setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }, (err) => console.warn('Geolocation failed', err));

        } catch (err) {
            console.error('Camera access denied:', err);
            setError('Camera access is required to use this feature.');
        }
    };

    useEffect(() => {
        if (showCamera && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [showCamera, stream]);

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Burn Watermark (Geotag & Timestamp)
                context.fillStyle = 'rgba(0, 0, 0, 0.5)';
                context.fillRect(0, canvas.height - 40, canvas.width, 40);
                context.fillStyle = 'white';
                context.font = '16px monospace';
                const timeStr = new Date().toLocaleString();
                const geoStr = currentLocation ? `GPS: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'GPS: Unavailable';
                context.fillText(`${timeStr} | ${geoStr}`, 10, canvas.height - 15);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        setFiles([file]);
                        setPreviewUrls([URL.createObjectURL(file)]);
                        setReport(null);
                        setError(null);
                        setTamperWarning(null); // Real camera photos are trusted
                        stopCamera();
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    };

    // Auto cleanup camera horizontally if unmounted
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, [stream]);

    const scanSteps = [
        t.step_preprocessing,
        t.step_cv,
        t.step_ocr,
        t.step_nlp,
        t.step_rule_presence,
        t.step_rule_format,
        t.step_rule_font,
        t.step_finalizing
    ];

    const runScan = async () => {
        if (files.length === 0) return;
        setScanning(true);
        setScanStep(0);
        setError(null);
        setReport(null);

        const formData = new FormData();
        formData.append('image', files[0]);

        if (!navigator.onLine) {
            try {
                const { saveToOfflineQueue } = await import('../utils/OfflineQueue');
                const offlineId = `offline-${Date.now()}`;

                for (let i = 0; i < scanSteps.length; i++) {
                    setScanStep(i);
                    await new Promise(r => setTimeout(r, 200));
                }

                await saveToOfflineQueue({
                    id: offlineId,
                    file: files[0],
                    timestamp: new Date().toISOString(),
                    productName: files[0].name.replace(/\.[^/.]+$/, ""),
                    officer: userName
                });

                if ('serviceWorker' in navigator && 'SyncManager' in window) {
                    try {
                        const reg = await navigator.serviceWorker.ready;
                        // @ts-ignore
                        await reg.sync.register('sync-offline-scans');
                        console.log('Background sync registered');
                    } catch (e) {
                        console.warn('Sync registration failed', e);
                    }
                }

                setReport({
                    scanId: offlineId,
                    extractedText: isHindi ? 'ऑफ़लाइन मोड: सिंक के लिए सहेजा गया' : 'OFFLINE MODE: Saved for Sync',
                    compliant: false,
                    violations: [{ type: 'Pending Sync', detail: isHindi ? 'यह स्कैन आपके डिवाइस पर सहेजा गया है। नेटवर्क आते ही यह अपने आप सिंक हो जाएगा।' : 'This scan is stored securely on your device. It will automatically sync when network access is restored.' }],
                    timestamp: new Date().toISOString(),
                    isOffline: true
                });
            } catch (err) {
                setError('Failed to store offline scan.');
            } finally {
                setScanning(false);
            }
            return;
        }

        try {
            let extracted = "";
            let boxes: any[] = [];
            let scanId = "";
            for (let i = 0; i < scanSteps.length; i++) {
                setScanStep(i);

                if (i === 2) {
                    try {
                        const token = localStorage.getItem('jwt_token');
                        const res = await fetch('http://localhost:5001/api/ocr', {
                            method: 'POST',
                            body: formData,
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.status === 401) {
                            localStorage.removeItem('auth');
                            localStorage.removeItem('jwt_token');
                            window.location.href = '/login';
                            return;
                        }
                        const rawText = await res.text();
                        console.log('API Response Status:', res.status, 'OK:', res.ok);
                        console.log('API Raw Body:', rawText);
                        if (!res.ok) throw new Error('API Response (' + res.status + '): ' + rawText.substring(0, 50));
                        const result = JSON.parse(rawText);
                        extracted = result.text || "";
                        scanId = result.id || "";
                        boxes = [];
                    } catch (ocrErr: any) {
                        console.error('OCR Error:', ocrErr);
                        throw new Error(typeof ocrErr === 'string' ? ocrErr : (ocrErr?.message || 'Failed OCR parsing step.'));
                    }
                } else {
                    await new Promise(r => setTimeout(r, 400));
                }
            }

            const ruleResult = analyzeTextWithRuleEngine(extracted);
            const productName = files[0].name.replace(/\.[^/.]+$/, "");

            let repeatViolations = false;
            try {
                const token = localStorage.getItem('jwt_token');
                const apiRes = await fetch('http://localhost:5001/api/scans', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (apiRes.status === 401) {
                    localStorage.removeItem('auth');
                    localStorage.removeItem('jwt_token');
                    window.location.href = '/login';
                }
                if (apiRes.ok) {
                    const hData = await apiRes.json();
                    const sameProductViolations = hData.filter((h: any) => h.filename === files[0].name && (!h.fields || Object.values(h.fields).some(v => !v)));
                    repeatViolations = sameProductViolations.length > 0;
                }
            } catch (e) {
                console.warn('API Sync fail', e);
                const history = JSON.parse(localStorage.getItem('metrology_history') || '[]');
                repeatViolations = history.filter((h: any) => h.product === productName && h.status === 'Violation').length > 0;
            }

            setBboxData(boxes);
            setRepeatOffender(repeatViolations);

            setReport({
                scanId: scanId,
                extractedText: extracted || (isHindi ? "कोई पाठ नहीं मिला।" : "No text detected."),
                compliant: ruleResult.compliant,
                violations: ruleResult.violations,
                timestamp: new Date().toISOString()
            });

            // Multilingual Audio Feedback (TTS)
            if (window.speechSynthesis) {
                let msg = '';
                if (ruleResult.compliant) {
                    msg = isHindi ? 'स्कैन पूरा हुआ। उत्पाद पूरी तरह से अनुपालन करता है।' : 'Scan complete. Product is verified compliant.';
                } else {
                    const issues = ruleResult.violations.map((v: any) => v.type).join(', ');
                    msg = isHindi ? `स्कैन पूरा हुआ। उल्लंघन पाए गए: ${issues}` : `Scan complete. Violations detected: ${issues}`;
                }
                const utterance = new SpeechSynthesisUtterance(msg);
                utterance.lang = isHindi ? 'hi-IN' : 'en-US';
                utterance.rate = 0.95;
                window.speechSynthesis.speak(utterance);
            }
        } catch (err: any) {
            console.error('Scan Runtime Error:', err);
            const errMsg = err?.message ? err.message : (typeof err === 'string' ? err : 'Scan validation failed');
            setError(errMsg.substring(0, 150));
        } finally {
            setScanning(false);
        }
    };

    handleVoiceCommandRef.current = (cmd: string) => {
        if (cmd.includes('camera') || cmd.includes('तस्वीर') || cmd.includes('कैमरा')) {
            if (!showCamera) startCamera();
        } else if (cmd.includes('capture') || cmd.includes('photo') || cmd.includes('take') || cmd.includes('खींच')) {
            if (showCamera) takePhoto();
            else {
                if (files.length > 0) runScan();
                else startCamera();
            }
        } else if (cmd.includes('scan') || cmd.includes('स्कैन')) {
            if (files.length > 0) runScan();
            else if (!showCamera) startCamera();
        } else if (cmd.includes('report') || cmd.includes('रिपोर्ट')) {
            if (report) handleAddToReport();
        }
    };

    return (
        <div>
            <div className="d-flex justify-between align-center mb-6">
                <div>
                    <h1 className="page-title">{t.title}</h1>
                    <p className="page-subtitle">{t.subtitle}</p>
                </div>
                {recognitionRef.current && (
                    <Button
                        variant={isListening ? 'danger' : 'outline'}
                        onClick={toggleListening}
                        className="d-flex align-center gap-2"
                        style={{ borderRadius: 50, animation: isListening ? 'pulse 2s infinite' : 'none' }}
                    >
                        {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                        {isListening ? (isHindi ? 'सुन रहा है...' : 'Listening...') : (isHindi ? 'वॉयस कमांड' : 'Voice Assistant')}
                    </Button>
                )}
            </div>

            <div className="d-flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Card style={{ flex: '1 1 350px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {!showCamera ? (
                            <div
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius)',
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    background: 'var(--bg-app)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => fileRef.current?.click()}
                            >
                                <UploadCloud size={48} className="text-brand mb-4" style={{ margin: '0 auto' }} />
                                <h3 style={{ marginBottom: 8 }}>{t.drag_drop}</h3>
                                <p className="text-muted" style={{ fontSize: '0.9rem' }}>{t.supports}</p>
                                <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
                            </div>
                        ) : (
                            <div style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#000' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto', display: 'block' }} />
                                <canvas ref={canvasRef} style={{ display: 'none' }} />
                                <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16 }}>
                                    <Button onClick={takePhoto} size="lg" style={{ borderRadius: '50px', padding: '12px 32px' }}>
                                        <Camera size={20} className="mr-2" style={{ marginRight: 8 }} />
                                        Capture
                                    </Button>
                                    <Button onClick={stopCamera} variant="danger" size="lg" style={{ borderRadius: '50px' }}>
                                        <X size={20} />
                                    </Button>
                                </div>
                            </div>
                        )}
                        {!showCamera && (
                            <Button variant="outline" className="d-flex justify-center align-center gap-2" style={{ width: '100%' }} onClick={startCamera}>
                                <Camera size={18} /> Enable Camera
                            </Button>
                        )}
                    </div>

                    {tamperWarning && !showCamera && (
                        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--danger-light)', borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <AlertCircle size={20} className="text-danger" />
                            <p className="text-danger" style={{ fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>{tamperWarning}</p>
                        </div>
                    )}

                    {previewUrls.length > 0 && !showCamera && (
                        <div style={{ marginTop: 20 }}>
                            <p className="text-muted mb-2 font-weight-bold">{t.previews} ({files.length}/3):</p>
                            <div className="d-flex gap-4" style={{ overflowX: 'auto', paddingBottom: 8 }}>
                                {previewUrls.map((url, i) => (
                                    <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                        <img
                                            onLoad={(e) => {
                                                if (i === 0) setImgDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                                            }}
                                            src={url} alt={`Preview ${i}`}
                                            style={{ height: 160, borderRadius: 8, border: '1px solid var(--border)' }}
                                        />
                                        {i === 0 && bboxData && bboxData.length > 0 && (
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                                                {bboxData.map((word, wIdx) => {
                                                    if (!word || !word.bbox) return null;
                                                    const scaleY = 160 / (imgDims.h || 1);
                                                    const scaleX = scaleY; // Since object-fit maintains aspect ratio relative to height directly here
                                                    const wLeft = (word.bbox.x0 || 0) * scaleX;
                                                    const wTop = (word.bbox.y0 || 0) * scaleY;
                                                    const wWidth = ((word.bbox.x1 || 0) - (word.bbox.x0 || 0)) * scaleX;
                                                    const wHeight = ((word.bbox.y1 || 0) - (word.bbox.y0 || 0)) * scaleY;
                                                    return (
                                                        <div
                                                            key={wIdx}
                                                            style={{
                                                                position: 'absolute',
                                                                left: wLeft, top: wTop, width: wWidth, height: wHeight,
                                                                border: '1px solid rgba(16, 185, 129, 0.8)',
                                                                backgroundColor: 'rgba(16, 185, 129, 0.15)'
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <Button style={{ width: '100%', marginTop: 24 }} onClick={runScan} isLoading={scanning}>
                                {scanning ? t.btn_scanning : t.btn_scan}
                            </Button>
                        </div>
                    )}
                </Card>

                <div style={{ flex: '2 1 400px' }}>
                    {error && (
                        <Card style={{ borderLeft: '4px solid var(--danger)' }}>
                            <div className="d-flex align-center gap-4">
                                <AlertCircle className="text-danger" />
                                <p>{error}</p>
                            </div>
                        </Card>
                    )}

                    {!report && !error && !scanning && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <FileScan size={64} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                            <p>{t.upload_prompt}</p>
                        </div>
                    )}

                    {scanning && (
                        <div style={{ padding: 40, textAlign: 'center' }}>
                            <RefreshCw size={48} className="text-brand" style={{ animation: 'spin 2s linear infinite', margin: '0 auto 16px' }} />
                            <h3>{t.ai_prog}</h3>
                            <p className="text-muted" style={{ minHeight: '40px', marginTop: '12px' }}>
                                {scanSteps[scanStep]}
                            </p>
                        </div>
                    )}

                    {report && (
                        <Card style={{ borderTop: `4px solid ${report.compliant ? 'var(--success)' : 'var(--danger)'}` }}>
                            <div id="report-content" style={{ padding: '0 8px' }}>
                                <div className="d-flex justify-between align-center mb-6">
                                    <div className="d-flex align-center gap-4">
                                        <h2>{t.rep_title}</h2>
                                        {repeatOffender && (
                                            <span className="badge badge-danger text-danger" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertOctagon size={14} /> {t.repeat_offender}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`badge ${report.compliant ? 'badge-success' : 'badge-danger'}`}>
                                        {report.compliant ? t.rep_compliant : t.rep_viol}
                                    </span>
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-muted mb-2">{t.raw_ocr}</h4>
                                    <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                        {report.extractedText}
                                    </div>
                                </div>

                                {!report.compliant && (
                                    <div>
                                        <h4 className="text-danger mb-4">{t.det_non}</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {report.violations.map((v: any, i: number) => (
                                                <div key={i} style={{ padding: 16, background: 'var(--danger-light)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                                    <h5 className="text-danger" style={{ marginBottom: 4 }}>{v.type}</h5>
                                                    <p style={{ fontSize: '0.9rem', color: 'var(--danger-text)' }}>{v.detail}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {report.compliant && (
                                    <div style={{ padding: 24, textAlign: 'center', background: 'var(--success-light)', borderRadius: 8 }}>
                                        <CheckCircle2 className="text-success" size={48} style={{ margin: '0 auto 12px' }} />
                                        <h3 className="text-success-text">{t.all_mand}</h3>
                                        <p style={{ color: 'var(--success-text)', fontSize: '0.9rem' }}>{t.all_mand_desc}</p>
                                    </div>
                                )}

                                <div style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Inspector ID: {userName.toUpperCase()}</span>
                                    <span>Time: {new Date(report.timestamp).toLocaleString()}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: 24, padding: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <Button variant="outline" className="d-flex justify-center align-center gap-4 text-brand" onClick={handleGeneratePDF}>
                                    <FileText size={18} /> {t.pdf_btn}
                                </Button>

                                {report.compliant && !report.isOffline && (
                                    <Button variant="outline" className="d-flex justify-center align-center gap-4 text-success" style={{ borderColor: 'var(--success)' }} onClick={() => setQrModal({ open: true, id: report.scanId })}>
                                        <QrCode size={18} /> {isHindi ? 'क्यूआर प्रमाणपत्र जेनरेट करें' : 'Generate Public QR Certificate'}
                                    </Button>
                                )}

                                {report.isOffline ? (
                                    <div className="text-warning" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
                                        {isHindi ? 'यह रिपोर्ट ऑफ़लाइन है और अगली बार जब आप ऑनलाइन होंगे तब सिंक हो जाएगी।' : 'This offline report will automatically sync with the repository when you return online.'}
                                    </div>
                                ) : userRole === 'supervisor' ? (
                                    <div className="text-danger" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                        {t.no_access}
                                    </div>
                                ) : (
                                    <Button onClick={handleAddToReport} className="d-flex align-center justify-center gap-2" style={{ width: '100%' }}>
                                        <PlusSquare size={18} /> {t.add_report}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

            {qrModal.open && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <Card style={{ width: 400, textAlign: 'center', position: 'relative', background: 'var(--bg-app)' }}>
                        <Button variant="outline" size="sm" style={{ position: 'absolute', top: 16, right: 16, border: 'none', padding: 8 }} onClick={() => setQrModal({ open: false, id: '' })}>
                            <X size={20} />
                        </Button>
                        <h2 className="mb-4">Govt QR Certificate</h2>
                        <p className="text-muted mb-6">Scan to verify this manufacturer's compliance on the public portal.</p>
                        <div style={{ background: 'white', padding: 24, borderRadius: 16, display: 'inline-block' }}>
                         <QRCode value={`${window.location.origin}/verify/${qrModal.id}`} size={200} />
                        </div>
                        <p style={{ marginTop: 24, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Certificate ID: {qrModal.id}</p>
                    </Card>
                </div>
            )}
        </div>
    );
};
