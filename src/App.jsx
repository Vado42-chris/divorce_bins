import { useState, useEffect, createContext, useContext, useRef } from 'react'
import './App.css'
import { StrategicShell, GlossCard, BreadcrumbNav, IntelligenceTile, TacticalTray, StrategicSection, StrategicInput, StrategicButton } from './components/Atomic'
import DecisionEventCard from './components/DecisionEventCard';
import StrategicSandboxHub from './components/StrategicSandboxHub';
import ProjectionMirror from './components/ProjectionMirror';

const LEGAL_LEXICON = {
    'Bates': 'A unique identification number assigned to every page of discovery to ensure traceability and a verifiable chain of custody.',
    'Interrogatory': 'A written question from one party to another that must be answered in writing and under oath.',
    'Affidavit': 'A written statement confirmed by oath or affirmation, used as evidence in court.',
    'Discovery': 'The pre-trial phase where parties exchange information and evidence relevant to the case.',
    'Subpoena': 'A legal order requireing someone to provide documents or testimony.',
    'Exhibit': 'A document or physical object produced in court as evidence.',
    'Deposition': 'An out-of-court testimony given under oath, recorded for use in discovery or at trial.',
    'Forensic': 'Scientific or technical methods used to investigate and establish facts for legal proceedings.',
    'Reconciliation': 'The process of matching financial records (like bank statements) against disclosed claims to find discrepancies.'
};

function App() {
    const [evidence, setEvidence] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedItem, setSelectedItem] = useState(null)
    const [itemContent, setItemContent] = useState('')
    const [showDiscovery, setShowDiscovery] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [foundDevices, setFoundDevices] = useState([])
    const [addType, setAddType] = useState(null) // 'device' or 'account'
    const [newSource, setNewSource] = useState({ name: '', type: '', host: '', user: '', pass: '' })
    const [chatHistory, setChatHistory] = useState([
        { role: 'ai', text: 'I am ready to help you analyze your 16 years of history. What are we looking for today?' }
    ])
    const [chatInput, setChatInput] = useState('')
    const [models, setModels] = useState([])
    const [selectedModel, setSelectedModel] = useState('llama3.1:8b')
    const [health, setHealth] = useState({ backend: 'offline', aiEngine: 'offline', device: 'disconnected' })
    const [sync, setSync] = useState({}) // Map of sourceId -> status
    const [view, setView] = useState('dashboard');
    const [dockets, setDockets] = useState([]);
    const [activeDocket, setActiveDocket] = useState(null);
    const [inbox, setInbox] = useState([]);
    const [lexicon, setLexicon] = useState({ tags: [] });
    const [decisionQueue, setDecisionQueue] = useState([]);
    const [streamStatus, setStreamStatus] = useState('connecting');
    const [sources, setSources] = useState([])
    const [governance, setGovernance] = useState({ entities: [], keywords: [] })
    const [argumentsList, setArgumentsList] = useState([])
    const [emails, setEmails] = useState([])
    const [reports, setReports] = useState([])
    const [identities, setIdentities] = useState([])
    const [intelligence, setIntelligence] = useState({})
    const [analyzingIds, setAnalyzingIds] = useState(new Set())
    const [analytics, setAnalytics] = useState({ interactions: {}, heatmap: [] })
    const [reportTitle, setReportTitle] = useState('')
    const [reportLevel, setReportLevel] = useState('summary')
    const [reportTarget, setReportTarget] = useState('vault')

    // Phase 71: Tactical Context State
    const [pinnedItems, setPinnedItems] = useState([]);
    const [trayOpen, setTrayOpen] = useState(false);

    const togglePin = (item) => {
        const isPinned = pinnedItems.some(p => p.id === item.id);
        if (isPinned) {
            setPinnedItems(prev => prev.filter(p => p.id !== item.id));
        } else {
            setPinnedItems(prev => [...prev, item]);
        }
    };

    const handleRefine = async (id, newContent) => {
        // Update local state
        setIntelligence(prev => ({
            ...prev,
            [id]: { ...prev[id], analysis: newContent }
        }));
        // Push to server
        try {
            await fetch('/api/corrections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'INTELLIGENCE', sourceId: id, overrideContent: newContent })
            });
        } catch (e) { console.error("Refinement save failed", e); }
    };
    const [generatingReport, setGeneratingReport] = useState(false)
    const [velocityData, setVelocityData] = useState({})
    const [narrative, setNarrative] = useState('')
    const [generatingNarrative, setGeneratingNarrative] = useState(false)
    const [flightLog, setFlightLog] = useState([])
    const [reconciledForm, setReconciledForm] = useState(null)
    const [sgiResults, setSgiResults] = useState(null)
    const [isReconciling, setIsReconciling] = useState(false)
    const [intelligenceTips, setIntelligenceTips] = useState([])
    const [isCorrelating, setIsCorrelating] = useState(false)
    const [reconciledDiscrepancies, setReconciledDiscrepancies] = useState([]);

    const [searchTerm, setSearchTerm] = useState('')
    const [custodianFilter, setCustodianFilter] = useState('all')
    const [evidenceTypeFilter, setEvidenceTypeFilter] = useState('all')
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [isBatchMode, setIsBatchMode] = useState(false)
    const [isProcessingBatch, setIsProcessingBatch] = useState(false)
    const [searchResults, setSearchResults] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [pulseData, setPulseData] = useState({ discoveryProgress: 0, strategicReadiness: 0, activeAlerts: 0 });
    const [activeJurisdiction, setActiveJurisdiction] = useState('Ontario');

    const [wargameActive, setWargameActive] = useState(false);
    const [wargameData, setWargameData] = useState(null);
    const [userResponse, setUserResponse] = useState('');
    const [wargameFeedback, setWargameFeedback] = useState(null);
    const [isWargaming, setIsWargaming] = useState(false);

    const [lastAuditFetch, setLastAuditFetch] = useState(0);

    const handleForensicSearch = async (query) => {
        if (!activeDocket) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&docket_id=${activeDocket.id}`);
            if (!res.ok) throw new Error("Search failed on backend");
            const data = await res.json();

            // Hardened validation: Ensure results match current active docket
            const validatedResults = data.filter(r => r.docket_id === activeDocket.id || r.global);
            setSearchResults(validatedResults);

            if (view !== 'search_results') setView('search_results');
        } catch (e) {
            console.error("Forensic search failed:", e);
        } finally {
            setIsProcessing(false);
        }
    };

    // Correct the "Search Result Persistence Hole"
    useEffect(() => {
        setSearchResults([]);
        setSearchTerm('');
    }, [activeDocket?.id]);

    const handleTrialLock = async () => {
        if (!activeDocket || !window.confirm("CRITICAL: Activating Trial Lock will set this docket to READ-ONLY. This process simulates a WORM (Write Once, Read Many) forensic seal. Proceed?")) return;

        setIsProcessing(true);
        try {
            const res = await fetch('/api/dockets/lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docket_id: activeDocket.id })
            });
            if (res.ok) {
                // Refresh docket state
                const updRes = await fetch('/api/dockets');
                const dockets = await updRes.json();
                const updated = dockets.find(d => d.id === activeDocket.id);
                setActiveDocket(updated);
                setView('projection');
                alert("DOCKET SEALED. TEMPORAL LOCK ACTIVE.");
            }
        } catch (e) {
            console.error("Lock failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    const evaluateResponse = async () => {
        setIsWargaming(true);
        try {
            const res = await fetch('/api/wargame/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: wargameData.attackLines,
                    response: userResponse
                })
            });
            const data = await res.json();
            setWargameFeedback(data);
        } catch (e) {
            console.error("Evaluation failed", e);
        } finally {
            setIsWargaming(false);
        }
    };

    const checkHealth = async () => {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealth(prev => ({
                ...prev,
                backend: data.status === 'healthy' ? 'online' : 'offline',
                aiEngine: data.aiEngine || 'offline'
            }));

            // Sync evidence with backend
            const iRes = await fetch('/api/index')
            const iData = await iRes.json()
            setEvidence(iData)

            // Sync sources and metrics
            const sRes = await fetch('/api/sources')
            setSources(await sRes.json())

            const dRes = await fetch('/api/device/detect')
            const dData = await dRes.json()
            setHealth(prev => ({ ...prev, device: dData.connected ? 'connected' : 'disconnected' }))
        } catch (e) {
            setHealth(prev => ({ ...prev, backend: 'offline', aiEngine: 'offline' }));
        }
    };

    const [isVerifyingMetadata, setIsVerifyingMetadata] = useState(false);
    const [metadataResults, setMetadataResults] = useState(null);

    const handleVerifyMetadata = async () => {
        if (!sgiBrief || isVerifyingMetadata) return;
        setIsVerifyingMetadata(true);
        try {
            // Find a critical SGI file to verify (e.g., the first one)
            const target = sgiBrief.nodes?.[0];
            if (!target) throw new Error("No evidence nodes found for verification.");

            const res = await fetch(`/api/forensics/sgi/metadata-verify?id=${target.id}`);
            const data = await res.json();
            setMetadataResults(data);
        } catch (e) {
            console.error("Metadata verification failed", e);
        } finally {
            setIsVerifyingMetadata(false);
        }
    };

    const [analysisStatus, setAnalysisStatus] = useState('idle');
    const handleRunAnalysis = async (item = null) => {
        if (item) {
            setAnalyzingIds(prev => new Set([...prev, item.id]));
            try {
                const res = await fetch('/api/intelligence/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ itemId: item.id, path: item.path, model: selectedModel })
                });
                const data = await res.json();
                setIntelligence(prev => ({ ...prev, [item.id]: data }));
            } catch (e) {
                console.error(e);
            } finally {
                setAnalyzingIds(prev => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            }
        } else {
            // Global/SGI Reindex
            setAnalysisStatus('running');
            try {
                await fetch('/api/forensics/sgi/reindex', { method: 'POST' });
            } catch (e) {
                console.error("Forensic trigger failed");
            } finally {
                setTimeout(() => setAnalysisStatus('idle'), 2000);
            }
        }
    };

    useEffect(() => {
        // Path Normalization for legacy routes
        const path = window.location.pathname;
        if (path === '/wargame' || path === '/arbitration') {
            setView('sandbox');
        }

        checkHealth()
        fetchAnalytics()
        fetchArguments()
        fetchVelocity()
        fetchPulse()
        fetchJurisdiction()

        // Real-time Forensic Stream
        const eventSource = new EventSource('/api/stream/events');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const type = data.type ? data.type.toLowerCase() : '';
                if (type === 'log' || type === 'event') {
                    setFlightLog(prev => [data, ...prev].slice(0, 100));
                }
                if (type === 'heartbeat') {
                    setHealth(prev => ({ ...prev, backend: 'online' }));
                }
            } catch (e) {
                console.error("Forensic Stream Parse Error", e);
            }
        };

        eventSource.onerror = () => {
            setHealth(prev => ({ ...prev, backend: 'offline' }));
            eventSource.close();
        };

        const interval = setInterval(() => {
            checkHealth()
            fetchAnalytics()
            fetchArguments()
            fetchVelocity()
            fetchPulse()
        }, 8000)

        return () => {
            clearInterval(interval);
            eventSource.close();
        }
    }, [])


    const fetchJurisdiction = async () => {
        try {
            const res = await fetch('/api/governance/jurisdiction');
            const data = await res.json();
            setActiveJurisdiction(data.active);
        } catch (e) {
            console.error("Jurisdiction fetch failed");
        }
    };

    const handleJurisdictionChange = async (name) => {
        try {
            await fetch('/api/governance/jurisdiction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jurisdiction: name })
            });
            setActiveJurisdiction(name);
        } catch (e) {
            console.error("Switch failed");
        }
    };

    const LegalTooltip = ({ term, children }) => {
        const [show, setShow] = useState(false);
        const definition = LEGAL_LEXICON[term];

        if (!definition) return children;

        return (
            <span
                className="legal-tooltip-trigger"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            >
                {children}
                {show && (
                    <div className="legal-tooltip-content premium-glass">
                        <strong>{term}</strong>
                        <p>{definition}</p>
                    </div>
                )}
            </span>
        );
    };

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/analytics')
            const data = await res.json()
            setAnalytics(data)
        } catch (e) {
            console.error("Analytics fetch failed")
        }
    }

    const fetchVelocity = async () => {
        try {
            const res = await fetch('/api/analytics/velocity')
            const data = await res.json()
            setVelocityData(data)
        } catch (e) {
            console.error("Velocity fetch failed")
        }
    }

    const runCorrelationEngine = async () => {
        setIsCorrelating(true)
        try {
            const res = await fetch('/api/intelligence/correlate', { method: 'POST' })
            if (res.ok) {
                await fetchPulse() // Refresh tips
                setFlightLog(prev => [{ timestamp: new Date().toISOString(), message: "Semantic Correlation Engine complete." }, ...prev].slice(0, 100))
            }
        } catch (e) {
            console.error("Correlation failed", e)
        } finally {
            setIsCorrelating(false)
        }
    }

    const fetchPulse = async () => {
        try {
            const res = await fetch('/api/dashboard/pulse');
            setPulseData(await res.json());
        } catch (e) {
            console.error("Pulse fetch failed");
        }
    }

    useEffect(() => {
        let poll
        const activeSyncs = Object.keys(sync).filter(id => sync[id].active)
        if (activeSyncs.length > 0) {
            poll = setInterval(async () => {
                const newSync = { ...sync }
                for (const id of activeSyncs) {
                    const res = await fetch(`/api/pipeline/status?id=${id}`)
                    const data = await res.json()
                    newSync[id] = data
                }
                setSync(newSync)

                if (Object.values(newSync).every(s => !s.active)) {
                    // Refresh data
                    const iRes = await fetch('/api/index')
                    const iData = await iRes.json()
                    setEvidence(iData)
                    clearInterval(poll)
                }
            }, 1000)
        }
        return () => clearInterval(poll)
    }, [sync])

    const startSync = async (sourceId) => {
        setSync(prev => ({ ...prev, [sourceId]: { active: true, step: 'Starting', progress: 5, message: 'Initiating...' } }))
        await fetch('/api/pipeline/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId })
        })
    }

    const fetchThreads = async () => {
        const res = await fetch('/api/sms/threads')
        const data = await res.json()
        setThreads(data)
    }

    const fetchEmails = async () => {
        const res = await fetch('/api/email/inbox')
        const data = await res.json()
        setEmails(data)
    }

    const handleBatchUpdate = async (updates) => {
        if (selectedIds.size === 0 || isProcessingBatch) return
        setIsProcessingBatch(true)
        try {
            const res = await fetch('/api/evidence/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds), updates })
            })
            if (res.ok) {
                await checkHealth()
                setSelectedIds(new Set())
            }
        } catch (e) {
            console.error("Batch update failed", e)
        } finally {
            setIsProcessingBatch(false)
        }
    }

    const handleCreateDocket = async (title, classification) => {
        try {
            const res = await fetch('/api/dockets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, classification })
            });
            const newDocket = await res.json();
            setDockets([...dockets, newDocket]);
            setActiveDocket(newDocket);
        } catch (e) { console.error("Docket creation failed"); }
    };

    const handleDecision = async (itemId, decision) => {
        try {
            await fetch('/api/decisions/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId,
                    decision,
                    docketId: activeDocket?.id
                })
            });
            // Remove from local queue
            setDecisionQueue(prev => prev.filter(e => e.item.id !== itemId));
            // Trigger a re-sync of intelligence
            fetch('/api/intelligence').then(res => res.json()).then(setEvidence);
        } catch (e) { console.error("Decision resolution failed"); }
    };

    const handleEgress = async (reportId, status) => {
        try {
            await fetch('/api/reports/egress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, status, docketId: activeDocket?.id })
            });
            alert("Egress Tag Applied Successfully");
        } catch (e) { alert("Egress failed"); }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0 || isProcessingBatch || !confirm(`Permanently delete ${selectedIds.size} items?`)) return
        setIsProcessingBatch(true)
        try {
            const res = await fetch('/api/evidence/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            })
            if (res.ok) {
                fetchEvidence()
                setSelectedIds(new Set())
                setIsBatchMode(false)
            }
        } catch (e) {
            console.error("Batch delete failed", e)
        } finally {
            setIsProcessingBatch(false)
        }
    }

    const handleAutoClassify = async (ids) => {
        if (!ids || ids.length === 0 || isProcessingBatch) return
        setIsProcessingBatch(true)
        try {
            const res = await fetch('/api/evidence/auto-classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
            if (res.ok) {
                await checkHealth() // Refresh vault
                broadcastLog({ timestamp: new Date().toISOString(), message: "AI classification success." })
            }
        } catch (e) {
            console.error("Auto-classify failed", e)
        } finally {
            setIsProcessingBatch(false)
        }
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleSGIExtraction = async (text) => {
        try {
            const res = await fetch('/api/forensics/sgi/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            })
            const data = await res.json()
            setSgiResults(data)
        } catch (e) {
            console.error("SGI Extraction failed", e)
        }
    }

    const fetchArguments = async () => {
        const res = await fetch('/api/arguments')
        const data = await res.json()
        setArgumentsList(data)
    }

    useEffect(() => {
        fetch('/api/intelligence').then(res => res.json()).then(setEvidence);
        fetch('/api/dockets').then(res => res.json()).then(data => {
            setDockets(data);
            if (data.length > 0 && !activeDocket) setActiveDocket(data[0]);
        });
        fetch('/api/inbox').then(res => res.json()).then(setInbox);
        fetch('/api/lexicon').then(res => res.json()).then(setLexicon);

        // --- SSE Event Stream Integration ---
        const eventSource = new EventSource('/api/stream/events');
        eventSource.onopen = () => setStreamStatus('active');
        eventSource.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data);
                if (event.type === 'NEW_INTELLIGENCE' || event.type === 'NEW_EMAIL') {
                    setDecisionQueue(prev => [event, ...prev.slice(0, 49)]); // Keep last 50
                }
            } catch (err) {
                console.error("SSE Message Parse Failure:", err);
            }
        };
        eventSource.onerror = () => setStreamStatus('error');
        return () => eventSource.close();
    }, []);

    useEffect(() => {
        if (view === 'sms') fetchThreads()
        if (view === 'email') fetchEmails()
        if (view === 'arguments') fetchArguments()
    }, [view])

    const handleSelectItem = (item) => {
        setSelectedItem(item);
        setSgiResults(null);
        fetchContent(item);
    }

    const fetchContent = (item) => {
        setSelectedItem(item)
        setItemContent('Loading...')
        fetch(`/api/content?path=${item.path}`)
            .then(res => res.text())
            .then(data => setItemContent(data))
    }
    const [exportHistory, setExportHistory] = useState([]);

    const fetchExportHistory = async () => {
        try {
            const res = await fetch('/api/reports/history');
            setExportHistory(await res.json());
        } catch (e) {
            console.error("Failed to load export history");
        }
    };

    const handleExportBundle = async (arg) => {
        try {
            const res = await fetch(`/api/export/bundle/${arg.id}`, { method: 'POST' });
            const data = await res.json();
            if (data.file) {
                window.open(`/api/export/download/${data.file}`);
                fetchExportHistory();
            }
        } catch (e) {
            alert("Export failed. Check backend logs.");
        }
    };

    const handleChat = async () => {
        if (!chatInput.trim()) return
        const msg = chatInput
        setChatInput('')
        setChatHistory(prev => [...prev, { role: 'user', text: msg }])

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: msg, model: selectedModel })
            })
            const data = await res.json()
            if (res.ok) {
                setChatHistory(prev => [...prev, { role: 'ai', text: data.response }])
            } else {
                setChatHistory(prev => [...prev, { role: 'ai', text: `Warning: ${data.error || "Fault"}` }])
            }
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'ai', text: "Error: Could not connect to the local vault backend." }])
        }
    }

    const handleFileUpload = async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        try {
            await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            const res = await fetch('/api/index')
            const data = await res.json()
            setEvidence(data)
        } catch (e) {
            alert("Upload failed")
        }
    }

    const restartAIEngine = async () => {
        setHealth(prev => ({ ...prev, aiEngine: 'restarting' }))
        try {
            await fetch('/api/ollama/restart', { method: 'POST' })
        } catch (e) { }
        setTimeout(checkHealth, 3000)
    }

    // checkHealth and handleRunAnalysis removed (consolidated at top)

    const saveIdentities = async (idList) => {
        setIdentities(idList);
        await fetch('/api/identities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idList)
        });
    }

    const promoteToVault = async (item) => {
        if (!item) return;
        const newStatus = item.status === 'vault' ? 'discovery' : 'vault';
        try {
            await fetch('/api/index/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, path: item.path, status: newStatus })
            });
            checkHealth();
        } catch (e) {
            alert("Promotion failed");
        }
    }

    const generateNarrative = async () => {
        setGeneratingNarrative(true);
        try {
            const res = await fetch('/api/analytics/narrative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: selectedModel })
            });
            const data = await res.json();
            setNarrative(data.narrative);
        } catch (e) {
            alert("Narrative synthesis failed");
        }
        setGeneratingNarrative(false);
    }

    return (
        <StrategicShell
            header={
                <StrategicHeader
                    search={
                        <StrategicInput
                            placeholder={activeDocket ? `SEARCH IN [${activeDocket.title.toUpperCase()}]...` : "SELECT A DOCKET TO SEARCH..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onEnter={() => handleForensicSearch(searchTerm)}
                            icon="🔍"
                            disabled={!activeDocket}
                        />
                    }
                    breadcrumbs={
                        <BreadcrumbNav
                            paths={[
                                { name: 'Dockets', view: 'dockets' },
                                activeDocket ? { name: activeDocket.title?.toUpperCase(), view: 'dockets', active: view === 'dockets' } : null,
                                (view !== 'dockets' && view !== 'dashboard') ? { name: view.toUpperCase(), active: true } : null
                            ].filter(Boolean)}
                        />
                    }
                    userCard={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {isProcessing && <div className="processing-indicator">ANALYZING...</div>}
                            <UserIdCard
                                user={{ name: "Chris Hallberg", initials: "CH" }}
                                activeDocket={activeDocket}
                                onClick={() => setView('profile')}
                            />
                        </div>
                    }
                />
            }
            sidebar={
                <aside className="sidebar">
                    <div className="logo">SOVEREIGN</div>
                    <nav>
                        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>DASHBOARD</button>
                        <button className={['dockets', 'inbox', 'sandbox', 'financials', 'vault'].includes(view) ? 'active' : ''} onClick={() => setView('dockets')}>DOCKETS</button>

                        {(['dockets', 'inbox', 'sandbox', 'financials', 'vault'].includes(view) || activeDocket) && (
                            <div className="sub-nav">
                                <button className={view === 'inbox' ? 'active' : ''} onClick={() => setView('inbox')}>↳ INBOX</button>
                                <button className={view === 'sandbox' ? 'active' : ''} onClick={() => setView('sandbox')}>↳ SANDBOX</button>
                                <button className={view === 'financials' ? 'active' : ''} onClick={() => setView('financials')}>↳ FINANCIALS</button>
                                <button className={view === 'vault' ? 'active' : ''} onClick={() => setView('vault')}>↳ EVIDENCE VAULT</button>
                            </div>
                        )}

                        <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>REPORTS</button>
                        <button className={view === 'arguments' ? 'active' : ''} onClick={() => setView('arguments')}>ARGUMENTS</button>
                        <hr className="nav-divider" />
                        {activeDocket && !activeDocket.temporal_lock && (
                            <button className="trial-lock-btn nav-alt" onClick={handleTrialLock}>🔒 TRIAL LOCK</button>
                        )}
                        {activeDocket?.temporal_lock && (
                            <button className="projection-mode-btn nav-alt" onClick={() => setView('projection')}>📺 PROJECTION MODE</button>
                        )}
                        <button className={view === 'help' ? 'active' : ''} onClick={() => setView('help')}>HELP & KB</button>
                    </nav>
                </aside>
            }
            main={
                <div className="main-content">
                    {(() => {
                        try {
                            switch (view) {
                                case 'dashboard': return <StrategicDashboard metrics={pulseData} />;
                                case 'dockets': return <DocketsHub dockets={dockets} active={activeDocket} onSelect={setActiveDocket} onAdd={() => setShowAddModal(true)} />;
                                case 'inbox': return <SovereignInbox emails={emails} activeDocket={activeDocket} lexicon={lexicon} />;
                                case 'sandbox':
                                    return <StrategicSandboxHub
                                        onReindex={() => handleRunAnalysis()}
                                        analysisStatus={analysisStatus}
                                        pinnedItems={pinnedItems}
                                        togglePin={togglePin}
                                        handleRefine={handleRefine}
                                        activeDocket={activeDocket}
                                    />;
                                case 'vault':
                                case 'sources':
                                    return <ActiveEvidenceHub
                                        evidence={evidence}
                                        categories={[]}
                                        selectedIds={selectedIds}
                                        toggleSelect={toggleSelect}
                                        pinnedItems={pinnedItems}
                                        togglePin={togglePin}
                                        handleRefine={handleRefine}
                                        activeDocket={activeDocket}
                                        lastFetch={lastAuditFetch}
                                        setLastFetch={setLastAuditFetch}
                                    />;
                                case 'financials': return <FinancialForensics reconciledDiscrepancies={reconciledDiscrepancies} activeDocket={activeDocket} />;
                                case 'reports': return <ReportCenter reports={reports} activeDocket={activeDocket} onEgress={handleEgress} />;
                                case 'projection': return <ProjectionMirror activeDocket={activeDocket} onExit={() => setView('evidence')} />;
                                case 'strategy':
                                case 'arguments': return <ArgumentCompass argumentsList={argumentsList} activeDocket={activeDocket} />;
                                case 'help': return <HelpHub />;
                                default: return <StrategicDashboard metrics={pulseData} />;
                            }
                        } catch (err) {
                            console.error("UI Render Failure:", err);
                            return <div className="render-error">RECOVERY MODE: UI RENDER FAILURE</div>;
                        }
                    })()}
                </div>
            }
            trayOpen={trayOpen}
        />
    );
}

const DocketsHub = ({ dockets, active, onSelect, onAdd }) => (
    <div className="sandbox-main-flow">
        <StrategicSection
            title="DOCKET MANAGEMENT"
            actions={<StrategicButton onClick={onAdd}>+ NEW CASE</StrategicButton>}
        >
            <div className="dockets-grid">
                {dockets.map(d => (
                    <GlossCard
                        key={d.id}
                        selected={active?.id === d.id}
                        onClick={() => onSelect(d)}
                        className="docket-card"
                    >
                        <h3>{d.title}</h3>
                        <div className="docket-meta">
                            <span>ID: {d.id}</span>
                            <span>STATUS: {d.status || 'ACTIVE'}</span>
                        </div>
                    </GlossCard>
                ))}
            </div>
        </StrategicSection>
    </div>
);

const HelpHub = () => (
    <div className="sandbox-main-flow">
        <StrategicSection title="HELP & KNOWLEDGE BASE">
            <div className="help-grid">
                <GlossCard className="help-article">
                    <h4>What is a Docket?</h4>
                    <p>A Docket is a forensic container for all documents, emails, and financial records related to a specific legal matter.</p>
                </GlossCard>
                <GlossCard className="help-article">
                    <h4>Bates Stamping Rules</h4>
                    <p>Every item in the Evidence Vault is assigned a unique Bates number to ensure a verifiable chain of custody for discovery.</p>
                </GlossCard>
                <GlossCard className="help-article">
                    <h4>Forensic Reconciliation</h4>
                    <p>Use the Financials tab to match disclosed assets against bank records and identify discrepancies for Form 13.1.</p>
                </GlossCard>
            </div>
        </StrategicSection>
    </div>
);

const StrategicSandboxHub = ({ onReindex, analysisStatus, pinnedItems, togglePin, handleRefine, activeDocket }) => {
    const [wargame, setWargame] = useState({});
    const [settlement, setSettlement] = useState({});
    const [exporting, setExporting] = useState(false);

    const [probeInput, setProbeInput] = useState("");
    const [probeResult, setProbeResult] = useState(null);
    const [isProbing, setIsProbing] = useState(false);
    const [modifiers, setModifiers] = useState({ lifestyle: false, pain: false, psychological: false, mobility: false });
    const [selectedWargames, setSelectedWargames] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const wRes = await fetch('/api/wargame');
                setWargame(await wRes.json());
                const sRes = await fetch('/api/settlement');
                setSettlement(await sRes.json());
            } catch (e) { console.error("Strategic data fetch failed"); }
        };
        fetchData();
    }, []);

    const handleProbe = async () => {
        if (!probeInput) return;
        setIsProbing(true);
        try {
            const res = await fetch('/api/wargame/probe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario: probeInput })
            });
            setProbeResult(await res.json());
        } catch (e) { console.error("Probe failed"); }
        finally { setIsProbing(false); }
    };

    const toggleModifier = async (key) => {
        const newMods = { ...modifiers, [key]: !modifiers[key] };
        setModifiers(newMods);
        try {
            const res = await fetch('/api/settlement/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modifiers: newMods })
            });
            setSettlement(await res.json());
        } catch (e) { console.error("Simulation failed"); }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await fetch('/api/export/tactical-brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedWargames, simulationData: settlement })
            });
            const data = await res.json();
            if (data.success) alert(`Tactical Brief Exported: ${data.path}`);
        } catch (e) { alert("Export failed"); }
        finally { setExporting(false); }
    };

    return (
        <StrategicShell
            header={
                <div className="hub-breadcrumb-header">
                    <BreadcrumbNav paths={['Vault', 'Strategy Sandbox']} />
                    <div className="header-actions">
                        <StrategicButton onClick={handleExport} loading={exporting} variant="primary">
                            GENERATE BRIEF
                        </StrategicButton>
                    </div>
                </div>
            }
            main={
                <div className="sandbox-main-flow">
                    <StrategicSection title="WAR ROOM PROBE">
                        <div className="probe-grid">
                            <StrategicInput
                                placeholder="Input Scenario / Counter-Argument to probe..."
                                value={probeInput}
                                onChange={(e) => setProbeInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleProbe()}
                                icon="🛡️"
                            />
                            <StrategicButton onClick={handleProbe} loading={isProbing}>
                                PROBE DEFENSE
                            </StrategicButton>
                        </div>

                        {probeResult && (
                            <div className="probe-result-animate">
                                <IntelligenceTile
                                    title="LIVE SCENARIO ANALYSIS"
                                    content={probeResult.adversarial_points.join("; ")}
                                    meta={`Secondary Defense: ${probeResult.counter_narratives[0]}`}
                                    onPin={() => togglePin({ id: 'probe_' + Date.now(), title: "Probe Result", content: probeResult.adversarial_points[0] })}
                                    isPinned={false}
                                    onRefine={(c) => console.log("Can't refine live analysis yet")}
                                />
                            </div>
                        )}
                    </StrategicSection>

                    <StrategicSection title="ACTIVE WARGAMES">
                        <div className="wargame-feed">
                            {wargame && typeof wargame === 'object' && Object.values(wargame).length > 0 ? (
                                Object.values(wargame).map((w, i) => (
                                    <IntelligenceTile
                                        key={i}
                                        title={w?.title || "Untitled Wargame"}
                                        content={Array.isArray(w?.adversarial_points) ? w.adversarial_points.join("\n") : "No points available."}
                                        meta={Array.isArray(w?.counter_narratives) ? `Defense: ${w.counter_narratives[0]}` : "No defense defined."}
                                        onPin={() => togglePin({ id: w?.title, title: w?.title, content: w?.adversarial_points?.[0] })}
                                        isPinned={pinnedItems.some(p => p.id === w?.title)}
                                        onRefine={(c) => handleRefine(w?.title, c)}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">NO ACTIVE WARGAMES DETECTED.</div>
                            )}
                        </div>
                    </StrategicSection>
                </div>
            }
            sidebar={
                <div className="sandbox-sidebar-container">
                    <StrategicSection
                        title="LIVE DECISION QUEUE"
                        meta={<span className={`stream-status ${streamStatus || 'offline'}`}>{(streamStatus || 'offline').toUpperCase()}</span>}
                    >
                        <div className="decision-queue-stream">
                            {decisionQueue.length > 0 ? (
                                decisionQueue.map((event, idx) => (
                                    <DecisionEventCard
                                        key={idx}
                                        event={event}
                                        onResolve={handleDecision}
                                        onChat={(item) => setSelectedItem(item)}
                                    />
                                ))
                            ) : (
                                <div className="stream-empty premium-glass">
                                    <p>Awaiting new legal signals...</p>
                                </div>
                            )}
                        </div>
                    </StrategicSection>

                    <StrategicSection title="VALUATION TUNING">
                        <div className="modifier-grid">
                            {Object.keys(modifiers).map(m => (
                                <button
                                    key={m}
                                    className={`modifier-btn ${modifiers[m] ? 'active' : ''}`}
                                    onClick={() => toggleModifier(m)}
                                >
                                    {m.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </StrategicSection>

                    {settlement.projections && (
                        <StrategicSection title="SETTLEMENT PROJECTION">
                            <div className="projection-projection premium-glass inner highlighting-box">
                                <span className="label">ESTIMATED RANGE</span>
                                <span className="value highlighting">
                                    ${settlement.projections.non_pecuniary_min.toLocaleString()} - ${settlement.projections.non_pecuniary_max.toLocaleString()}
                                </span>
                                <p className="projection-note">{settlement.projections.note}</p>
                            </div>
                        </StrategicSection>
                    )}
                </div>
            }
        />
    );
};

const StrategicDashboard = () => (
    <div className="sandbox-main-flow">
        <StrategicSection title="SYSTEM OVERVIEW">
            <div className="dashboard-grid">
                <div className="metric-card premium-glass">
                    <h3>DISCOVERY VELOCITY</h3>
                    <div className="velocity-stat">12.4 Nodes/Day</div>
                </div>
                <div className="metric-card premium-glass">
                    <h3>STRATEGIC READINESS</h3>
                    <div className="readiness-gauge">
                        <div className="gauge-fill" style={{ width: '84%' }}></div>
                        <span className="gauge-label">84.2%</span>
                    </div>
                </div>
                <div className="metric-card premium-glass alert">
                    <h3>ACTIVE JURISDICTION</h3>
                    <div className="jurisdiction-text">Saskatchewan (SK)</div>
                </div>
            </div>
        </StrategicSection>
    </div>
);

const TimelineView = () => <div className="placeholder-hub">Timeline View Content</div>;
const SovereignInbox = ({ emails, activeDocket, lexicon }) => {
    // Group emails by account (H2) and then by folder/tag (H3)
    const grouped = (emails || []).reduce((acc, email) => {
        if (!email) return acc;
        const account = email.account || 'Historical Archives';
        if (!acc[account]) acc[account] = {};
        const folder = email.folder || 'Inbox';
        if (!acc[account][folder]) acc[account][folder] = [];
        acc[account][folder].push(email);
        return acc;
    }, {});

    const [syncing, setSyncing] = useState(false);

    const handleSyncEmails = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/emails/ingress', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                console.log(`Synced ${data.count} signals.`);
            }
        } catch (e) {
            console.error("Sync failed", e);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <StrategicShell
            header={
                <div className="hub-breadcrumb-header">
                    <BreadcrumbNav paths={['Communication', 'Legal Inbox']} />
                    <div className="header-actions">
                        <StrategicButton onClick={handleSyncEmails} loading={syncing} variant="secondary">
                            SYNC ACCOUNTS
                        </StrategicButton>
                    </div>
                </div>
            }
            main={
                <div className="sandbox-main-flow">
                    <StrategicSection title={`SOVEREIGN INBOX: ${activeDocket?.title || "GLOBAL"}`}>
                        <div className="inbox-account-list">
                            {Object.keys(grouped).map(account => (
                                <div key={account} className="inbox-account-group">
                                    <h2 className="premium-heading-h2">{account.toUpperCase()}</h2>
                                    {Object.keys(grouped[account]).map(folder => (
                                        <div key={folder} className="inbox-folder-group">
                                            <h3 className="premium-heading-h3">{folder}</h3>
                                            <div className="inbox-message-grid">
                                                {grouped[account][folder].map((email, idx) => (
                                                    <IntelligenceTile
                                                        key={idx}
                                                        title={email.subject || "No Subject"}
                                                        content={email.analysis || "Categorized as legal intelligence."}
                                                        meta={`From: ${email.from} | Date: ${email.date}`}
                                                        onPin={() => { }}
                                                        isPinned={false}
                                                        onRefine={() => { }}
                                                        actions={[
                                                            { label: 'FLAG FOR ARBITRATION', variant: 'primary' },
                                                            { label: 'LINK TO DOCKET', variant: 'secondary' }
                                                        ]}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </StrategicSection>
                </div>
            }
        />
    );
};

const ActiveEvidenceHub = ({ evidence, categories, selectedIds, toggleSelect, onSelectItem, pinnedItems, togglePin, handleRefine, activeDocket, lastFetch, setLastFetch }) => {
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    useEffect(() => {
        const now = Date.now();
        // Correct the "Frequency Trap" - 30s throttle
        if (now - lastFetch < 30000) return;

        const fetchAudit = async () => {
            setLoadingAudit(true);
            try {
                const res = await fetch('/api/audit');
                if (res.ok) {
                    const data = await res.json();
                    setAuditLogs(data);
                    setLastFetch(now);
                }
            } catch (e) {
                console.error("Failed to fetch audit logs", e);
            } finally {
                setLoadingAudit(false);
            }
        };
        fetchAudit();
    }, [activeDocket?.id]);

    const stats = {
        total: evidence.length,
        types: [...new Set(evidence.map(e => e.type))].length,
        sources: [...new Set(evidence.map(e => e.source))].length
    };

    const filteredEvidence = activeDocket
        ? evidence.filter(e => e.docket_id === activeDocket.id || e.global === true)
        : evidence;

    return (
        <StrategicShell
            header={
                <div className="hub-breadcrumb-header">
                    <BreadcrumbNav paths={['Vault', 'Evidence Explorer']} />
                    <div className="header-actions">
                        <span className="selection-count">{selectedIds.size} ITEMS SELECTED</span>
                        <StrategicButton variant="secondary">ADD SOURCE</StrategicButton>
                    </div>
                </div>
            }
            main={
                <div className="sandbox-main-flow">
                    <div className="vault-top-grid">
                        <StrategicSection title={`INTELLIGENCE VAULT: ${activeDocket?.title || "UNSORTED"}`}>
                            <div className="evidence-grid">
                                {filteredEvidence.length > 0 ? (
                                    filteredEvidence.map((item, i) => (
                                        <IntelligenceTile
                                            key={item.id || i}
                                            title={item.title || "Untitled Fragment"}
                                            content={item.analysis || "No intelligence analysis available."}
                                            meta={`Source: ${item.source} | Date: ${item.timestamp}`}
                                            onPin={() => togglePin({ id: item.id, title: item.title, content: item.analysis })}
                                            isPinned={pinnedItems.some(p => p.id === item.id)}
                                            onRefine={(c) => handleRefine(item.id, c)}
                                        />
                                    ))
                                ) : (
                                    <div className="empty-state">NO EVIDENCE FOR THIS DOCKET. INGEST DATA TO BEGIN.</div>
                                )}
                            </div>
                        </StrategicSection>

                        <StrategicSection title="FORENSIC AUDIT TRAIL">
                            <div className="audit-trail-list">
                                {loadingAudit ? (
                                    <div className="loading-pulse">FETCHING CHAIN OF CUSTODY...</div>
                                ) : auditLogs.length > 0 ? (
                                    auditLogs.map((log, i) => (
                                        <div key={i} className="audit-log-item">
                                            <span className="audit-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            <span className={`audit-action ${log.level.toLowerCase()}`}>{log.message}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">NO AUDIT ENTRIES RECORDED.</div>
                                )}
                            </div>
                        </StrategicSection>
                    </div>
                </div>
            }
            sidebar={
                <div className="evidence-stats-sidebar">
                    <StrategicSection title="VAULT TELEMETRY">
                        <div className="stat-row">
                            <span className="stat-label">TOTAL ARTIFACTS</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">ACTIVE SOURCES</span>
                            <span className="stat-value">{stats.sources}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">DIVERSITY INDEX</span>
                            <span className="stat-value">{stats.types}</span>
                        </div>
                    </StrategicSection>
                </div>
            }
        />
    );
};
const GovernanceHub = ({ governance }) => (
    <StrategicShell
        header={
            <div className="hub-breadcrumb-header">
                <BreadcrumbNav paths={['System', 'Governance & Controls']} />
                <div className="header-actions">
                    <StrategicButton variant="secondary">EXPORT COMPLIANCE LOG</StrategicButton>
                </div>
            </div>
        }
        main={
            <div className="sandbox-main-flow">
                <StrategicSection title="ADMINISTRATIVE CONTROLS">
                    <div className="governance-grid">
                        <GlossCard className="governance-card">
                            <h4>ENTITY IDENTITIES</h4>
                            <div className="entity-list">
                                {governance?.entities?.map((e, i) => (
                                    <div key={i} className="entity-item">{e}</div>
                                )) || "No entities defined."}
                            </div>
                        </GlossCard>
                        <GlossCard className="governance-card">
                            <h4>KEYWORD SENSITIVITY</h4>
                            <div className="keyword-tags">
                                {governance?.keywords?.map((k, i) => (
                                    <span key={i} className="keyword-tag">{k}</span>
                                )) || "No keywords flagged."}
                            </div>
                        </GlossCard>
                    </div>
                </StrategicSection>
            </div>
        }
    />
);

const ArgumentCompass = ({ argumentsList }) => (
    <StrategicShell
        header={
            <div className="hub-breadcrumb-header">
                <BreadcrumbNav paths={['Strategy', 'Argument Compass']} />
            </div>
        }
        main={
            <div className="sandbox-main-flow">
                <StrategicSection title="STRATEGIC ARGUMENTS">
                    <div className="arguments-feed">
                        {argumentsList?.length > 0 ? (
                            argumentsList.map((arg, i) => (
                                <IntelligenceTile
                                    key={i}
                                    title={arg.title}
                                    content={arg.summary}
                                    meta={`Strength: ${arg.strength}% | Stability: ${arg.stability}%`}
                                    onPin={() => { }}
                                    onRefine={() => { }}
                                />
                            ))
                        ) : (
                            <div className="empty-state">NO ARGUMENTS CONSTRUCTED.</div>
                        )}
                    </div>
                </StrategicSection>
            </div>
        }
    />
);

const FinancialForensics = ({ reconciledDiscrepancies }) => (
    <StrategicShell
        header={
            <div className="hub-breadcrumb-header">
                <BreadcrumbNav paths={['Finance', 'Forensic Reconciliation']} />
            </div>
        }
        main={
            <div className="sandbox-main-flow">
                <StrategicSection title="DISCREPANCY OVERVIEW">
                    <div className="discrepancy-list">
                        {reconciledDiscrepancies?.length > 0 ? (
                            reconciledDiscrepancies.map((d, i) => (
                                <GlossCard key={i} className="discrepancy-card">
                                    <div className="discrepancy-header">
                                        <span className="severity-pin">!</span>
                                        <h4>{d.item}</h4>
                                    </div>
                                    <div className="discrepancy-body">
                                        <div className="val">REPORTED: {d.reported}</div>
                                        <div className="val">ACTUAL: {d.actual}</div>
                                        <div className="delta">DELTA: {d.delta}</div>
                                    </div>
                                </GlossCard>
                            ))
                        ) : (
                            <div className="empty-state">NO DISCREPANCIES DETECTED IN LAST RUN.</div>
                        )}
                    </div>
                </StrategicSection>
            </div>
        }
    />
);

const ReportCenter = ({ reports }) => (
    <StrategicShell
        header={
            <div className="hub-breadcrumb-header">
                <BreadcrumbNav paths={['System', 'Reports Archive']} />
            </div>
        }
        main={
            <div className="sandbox-main-flow">
                <StrategicSection title="TACTICAL REPORTS">
                    <div className="reports-grid">
                        {reports?.length > 0 ? (
                            reports.map((r, i) => (
                                <GlossCard key={i} className="report-card">
                                    <div className="report-icon">📄</div>
                                    <div className="report-info">
                                        <h4>{r.name}</h4>
                                        <p>{r.timestamp}</p>
                                    </div>
                                    <StrategicButton variant="secondary">VIEW</StrategicButton>
                                </GlossCard>
                            ))
                        ) : (
                            <div className="empty-state">NO REPORTS GENERATED YET.</div>
                        )}
                    </div>
                </StrategicSection>
            </div>
        }
    />
);

export default App;
