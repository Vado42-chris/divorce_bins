import { useState, useEffect } from 'react'
import './App.css'

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
    const [health, setHealth] = useState({ backend: 'offline', ollama: 'offline', device: 'disconnected' })
    const [sync, setSync] = useState({}) // Map of sourceId -> status
    const [view, setView] = useState('dashboard')
    const [sources, setSources] = useState([])
    const [governance, setGovernance] = useState({ entities: [], keywords: [] })
    const [argumentsList, setArgumentsList] = useState([])
    const [filterSource, setFilterSource] = useState('all')
    const [filterType, setFilterType] = useState('all')
    const [threads, setThreads] = useState({})
    const [emails, setEmails] = useState([])
    const [reports, setReports] = useState([])
    const [identities, setIdentities] = useState([])
    const [intelligence, setIntelligence] = useState({})
    const [analyzingIds, setAnalyzingIds] = useState(new Set())
    const [analytics, setAnalytics] = useState({ interactions: {}, heatmap: [] })
    const [reportTitle, setReportTitle] = useState('')
    const [reportLevel, setReportLevel] = useState('summary')
    const [reportTarget, setReportTarget] = useState('vault')
    const [generatingReport, setGeneratingReport] = useState(false)
    const [velocityData, setVelocityData] = useState({})
    const [narrative, setNarrative] = useState('')
    const [generatingNarrative, setGeneratingNarrative] = useState(false)
    const [flightLog, setFlightLog] = useState([])
    const [reconciledForm, setReconciledForm] = useState(null)
    const [sgiResults, setSgiResults] = useState(null)
    const [isReconciling, setIsReconciling] = useState(false)
    const [pulseData, setPulseData] = useState({})

    const [searchTerm, setSearchTerm] = useState('')
    const [custodianFilter, setCustodianFilter] = useState('all')
    const [evidenceTypeFilter, setEvidenceTypeFilter] = useState('all')

    useEffect(() => {
        checkHealth()
        fetchAnalytics()
        fetchArguments()
        fetchVelocity()

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
        }, 5000)

        return () => {
            clearInterval(interval);
            eventSource.close();
        }
    }, [])

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

    const fetchPulse = async () => {
        try {
            const res = await fetch('/api/analytics/temporal-pulse')
            const data = await res.json()
            setPulseData(data)
        } catch (e) {
            console.error("Pulse fetch failed")
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

    const handleReconcileForm131 = async () => {
        setIsReconciling(true)
        try {
            const res = await fetch('/api/forensics/financial/reconcile', { method: 'POST' })
            const data = await res.json()
            setReconciledForm(data)
        } catch (e) {
            console.error("Reconciliation failed", e)
        }
        setIsReconciling(false)
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

    const restartOllama = async () => {
        setHealth(prev => ({ ...prev, ollama: 'restarting' }))
        try {
            await fetch('/api/ollama/restart', { method: 'POST' })
        } catch (e) { }
        setTimeout(checkHealth, 3000)
    }

    const checkHealth = async () => {
        try {
            const res = await fetch('/api/index')
            const data = await res.json()
            setEvidence(data)
            setHealth(prev => ({ ...prev, backend: 'online' }))
        } catch (e) {
            setHealth(prev => ({ ...prev, backend: 'offline' }))
        }

        try {
            const sRes = await fetch('/api/sources')
            const sData = await sRes.json()
            setSources(sData)

            const dRes = await fetch('/api/device/detect')
            const dData = await dRes.json()
            setHealth(prev => ({ ...prev, device: dData.connected ? 'connected' : 'disconnected' }))

            const gRes = await fetch('/api/governance')
            const gData = await gRes.json()
            setGovernance(gData)

            const argRes = await fetch('/api/arguments')
            const argData = await argRes.json()
            setArgumentsList(argData)

            const iRes = await fetch('/api/intelligence')
            const iData = await iRes.json()
            setIntelligence(iData)

            const idRes = await fetch('/api/identities')
            const idData = await idRes.json()
            setIdentities(idData)

            const vRes = await fetch('/api/analytics/velocity')
            const vData = await vRes.json()
            setVelocityData(vData)
        } catch (e) { }

        setLoading(false)
    }

    const handleRunAnalysis = async (item) => {
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
        }
        setAnalyzingIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
        });
    }

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
        <div className="app-container">
            <aside className="sidebar">
                <div className="logo">VAULT</div>
                <nav>
                    <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
                    <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>Sources</button>
                    <button className={view === 'governance' ? 'active' : ''} onClick={() => setView('governance')}>People & Alerts</button>
                    <button className={view === 'arguments' ? 'active' : ''} onClick={() => setView('arguments')}>Case Strategy</button>
                    <button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>Timeline Heatmap</button>
                    <hr className="nav-divider" />
                    <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Evidence Vault</button>
                    <button className={view === 'reports' ? 'active' : ''} onClick={async () => { setView('reports'); const res = await fetch('/api/reports'); setReports(await res.json()); }}>Downloads & Reports</button>
                    <button className={view === 'sms' ? 'active' : ''} onClick={() => setView('sms')}>Text Messages</button>
                    <button className={view === 'email' ? 'active' : ''} onClick={() => setView('email')}>Emails</button>
                </nav>
            </aside>

            <main className="main-content">
                <header className="main-header">
                    <div className="header-breadcrumbs">
                        <h1>{view.charAt(0).toUpperCase() + view.slice(1).replace('-', ' ')}</h1>
                    </div>
                    <div className="system-health-strip">
                        <div className={`health-item ${health.backend}`}>
                            <span className="dot"></span> Backend
                        </div>
                        <div className={`health-item ${health.device}`}>
                            <span className="dot"></span> {health.device === 'connected' ? 'Phone Connected' : 'No Phone'}
                        </div>
                        <div className={`health-item ${health.ollama}`}>
                            <span className="dot"></span> Ollama {health.ollama === 'offline' && <button className="reboot-btn-xs" onClick={restartOllama}>Restart</button>}
                        </div>
                    </div>
                </header>

                <div className="content-grid">
                    {view === 'dashboard' && (
                        <section className="dashboard-grid-v3">
                            <div className="discovery-header-v3">
                                <div className="header-intel">
                                    <span className="system-status-pill">FLIGHT RECORDER ACTIVE</span>
                                    <h2>Forensic Intelligence Dashboard</h2>
                                </div>
                                <div className="dash-hero-stats">
                                    <div className="dash-hero-stat">
                                        <span className="stat-value">{analytics.totalNodes || 0}</span>
                                        <span className="stat-label">TOTAL DOCUMENTS</span>
                                    </div>
                                    <div className="dash-hero-stat highlight">
                                        <span className="stat-value">{analytics.totalAlerts || 0}</span>
                                        <span className="stat-label">DISCOVERY ALERTS</span>
                                    </div>
                                    <div className="dash-hero-stat">
                                        <span className="stat-value">{argumentsList.length}</span>
                                        <span className="stat-label">STRATEGIC CLAIMS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="dashboard-main-row">
                                <div className="tactical-col">
                                    <div className="premium-panel">
                                        <div className="panel-header">
                                            <h3>Conflict Velocity Heatmap</h3>
                                            <span className="zoom-label">Temporal Variance</span>
                                        </div>
                                        <div className="heatmap-container-v3">
                                            <div className="heatmap-grid-v3">
                                                <div className="heatmap-cell label"></div>
                                                {Array.from({ length: 24 }).map((_, i) => <div key={i} className="heatmap-cell label">{i}h</div>)}
                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, d) => (
                                                    <div key={day} style={{ display: 'contents' }}>
                                                        <div className="heatmap-cell label">{day}</div>
                                                        {(analytics.heatmap && analytics.heatmap[d]) ? analytics.heatmap[d].map((val, h) => (
                                                            <div key={`${d}-${h}`}
                                                                className={`heatmap-cell intensity-${Math.floor(val)}`}
                                                                title={`Conflict Intensity: ${val.toFixed(2)}`}>
                                                            </div>
                                                        )) : Array.from({ length: 24 }).map((_, h) => <div key={h} className="heatmap-cell intensity-0"></div>)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="premium-panel flight-recorder">
                                        <div className="panel-header">
                                            <h3>Evidence Pulse (Tactical Density)</h3>
                                            <span className="live-tag">7-Day Burst Map</span>
                                        </div>
                                        <div className="pulse-container-v3">
                                            <div className="pulse-grid">
                                                {Object.keys(pulseData).length > 0 ? Object.keys(pulseData).slice(-7).map(day => (
                                                    <div key={day} className="pulse-row">
                                                        <span className="pulse-label">{day.split('-').slice(1).join('/')}</span>
                                                        <div className="pulse-hours">
                                                            {pulseData[day].map((h, i) => (
                                                                <div key={i}
                                                                    className={`pulse-tick density-${Math.min(h.count, 5)}`}
                                                                    title={`${day} @ ${i}h: ${h.count} nodes`}>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="empty-state">
                                                        <p>Waiting for forensic activity telemetry...</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="premium-panel flight-recorder">
                                        <div className="panel-header">
                                            <h3>Tactical Mission Log</h3>
                                            <span className="live-tag">REAL-TIME FLOW</span>
                                        </div>
                                        <div className="flight-recorder-scroll">
                                            {flightLog.length > 0 ? flightLog.map((log, i) => (
                                                <div key={i} className="log-line">
                                                    <span className="log-time">{new Date(log.time).toLocaleTimeString()}</span>
                                                    <span className="log-msg">{log.message}</span>
                                                </div>
                                            )) : (
                                                <div className="empty-state">
                                                    <p>Awaiting Live Updates...</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="strategic-col">
                                    <div className="premium-panel alert-vault">
                                        <div className="panel-header">
                                            <h3>Forensic Alerts</h3>
                                            <span className="security-rank">OIG COMPLIANT</span>
                                        </div>
                                        <div className="alert-list-v3">
                                            {evidence.filter(e => e.flagged).length === 0 && <div className="empty-alert">No high-risk vectors detected.</div>}
                                            {evidence.filter(e => e.flagged).map(alert => (
                                                <div key={alert.id} className="alert-card-v3" onClick={() => fetchContent(alert)}>
                                                    <div className="alert-meta">
                                                        <span className="alert-rank">G-LEVEL-1</span>
                                                        <span className="alert-date">{alert.timestamp}</span>
                                                    </div>
                                                    <div className="status-dot-group">
                                                        <div className="health-item">
                                                            <div className={`dot ${health.backend}`}></div>
                                                            <span>Mission Controller</span>
                                                        </div>
                                                        <div className="health-item">
                                                            <div className={`dot ${health.device}`}></div>
                                                            <span>Phone Link</span>
                                                        </div>
                                                        <div className="health-item">
                                                            <div className={`dot ${health.ollama}`}></div>
                                                            <span>AI Engine</span>
                                                            <button className="reboot-btn" onClick={() => fetch('/api/system/reboot')}>RESET</button>
                                                        </div>
                                                    </div>
                                                    <h4>{alert.title}</h4>
                                                    <div className="tag-row">
                                                        {alert.flags?.map((f, i) => <span key={i} className="evidence-tag">{f}</span>)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="premium-panel live-vault">
                                        <div className="panel-header">
                                            <h3>Discovery Index</h3>
                                            <button className="text-btn" onClick={() => setView('timeline')}>Expand Full Vault</button>
                                        </div>
                                        <div className="feed-v3">
                                            {evidence.slice(0, 8).map(item => (
                                                <div key={item.id} className="feed-node" onClick={() => fetchContent(item)}>
                                                    <div className="node-icon">{item.type === 'email' ? '✉️' : '💬'}</div>
                                                    <div className="node-info">
                                                        <span className="node-title">{item.title}</span>
                                                        <span className="node-meta">{item.source} • {item.timestamp}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {view === 'sources' && (
                        <section className="sources-view-v2">
                            <div className="view-header">
                                <div className="title-area">
                                    <h2>Sources Hub</h2>
                                    <p>Manage devices and accounts. Data is stored locally and accessed read-only.</p>
                                </div>
                                <button className="primary-btn" onClick={() => { setShowAddModal(true); setAddType(null); }}>+ Add Source</button>
                            </div>

                            <div className="sources-grid-v2">
                                {sources.map(source => (
                                    <div key={source.id} className="source-card-v2">
                                        <div className="card-top">
                                            <div className="source-icon">{source.type === 'device' ? '📱' : '✉️'}</div>
                                            <div className="source-meta-main">
                                                <h3>{source.name}</h3>
                                                <p>{source.description}</p>
                                            </div>
                                            <span className={`status-pill ${source.integrity}`}>Integrity {source.integrity}</span>
                                        </div>
                                        <div className="card-actions">
                                            <button className={`sync-trigger ${sync[source.id]?.active ? 'syncing' : ''}`} onClick={() => startSync(source.id)} disabled={sync[source.id]?.active}>
                                                {sync[source.id]?.active ? 'Syncing...' : 'Sync Now'}
                                            </button>
                                            <button className="settings-btn" onClick={async () => {
                                                if (confirm(`Remove "${source.name}"?`)) {
                                                    await fetch(`/api/sources/${source.id}`, { method: 'DELETE' });
                                                    checkHealth();
                                                }
                                            }}>Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {showAddModal && (
                                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                                    <div className="modal-content source-modal" onClick={e => e.stopPropagation()}>
                                        {!addType ? (
                                            <div className="add-type-picker">
                                                <h2>Add a New Source</h2>
                                                <div className="type-cards">
                                                    <button className="type-card" onClick={() => setAddType('device')}>📱 Phone / Device</button>
                                                    <button className="type-card" onClick={() => setAddType('email')}>✉️ Email Account</button>
                                                    <button className="type-card" onClick={() => setAddType('folder')}>📁 Local Folder</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setAddType(null)} className="secondary-btn">Back</button>
                                        )}
                                        {addType === 'device' && <p>Connect via USB with Debugging enabled.</p>}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {view === 'governance' && (
                        <section className="governance-view-v2">
                            <div className="view-header">
                                <div className="title-area">
                                    <h2>People & Priority Alerts</h2>
                                    <p>Configure automated discovery triggers for priority individuals and critical events.</p>
                                </div>
                            </div>

                            <div className="gov-controls-grid">
                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Discovery Triggers (Keywords)</h3>
                                        <span className="count">{governance.keywords?.length || 0} Active</span>
                                    </div>
                                    <div className="gov-tags">
                                        {governance.keywords?.map((k, i) => (
                                            <div key={i} className="active-rule-tag">
                                                <span>{k.value}</span>
                                                <button className="rule-del" onClick={async () => {
                                                    const updated = { ...governance, keywords: governance.keywords.filter((_, idx) => idx !== i) };
                                                    setGovernance(updated);
                                                    await fetch('/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                                }}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rule-input-group">
                                        <input type="text" placeholder="Add keyword (hit enter)..." onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && e.target.value) {
                                                const updated = { ...governance, keywords: [...governance.keywords, { value: e.target.value, priority: true }] };
                                                setGovernance(updated);
                                                e.target.value = "";
                                                await fetch('/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                            }
                                        }} />
                                    </div>
                                </div>

                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Priority Individuals (Entities)</h3>
                                        <span className="count">{governance.entities?.length || 0} Tracking</span>
                                    </div>
                                    <div className="gov-tags">
                                        {governance.entities?.map((e, i) => (
                                            <div key={i} className="active-rule-tag entity">
                                                <span><strong>{e.label}</strong>: {e.value}</span>
                                                <button className="rule-del" onClick={async () => {
                                                    const updated = { ...governance, entities: governance.entities.filter((_, idx) => idx !== i) };
                                                    setGovernance(updated);
                                                    await fetch('/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                                }}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rule-input-group">
                                        <input type="text" placeholder="Name: Value..." onKeyDown={async (ev) => {
                                            if (ev.key === 'Enter' && ev.target.value.includes(':')) {
                                                const [label, value] = ev.target.value.split(':');
                                                const updated = { ...governance, entities: [...governance.entities, { label: label.trim(), value: value.trim(), priority: true }] };
                                                setGovernance(updated);
                                                ev.target.value = "";
                                                await fetch('/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                            }
                                        }} />
                                    </div>
                                </div>

                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Personas (Identity Resolution)</h3>
                                        <span className="count">{identities.length} Resolved</span>
                                    </div>
                                    <div className="identity-list">
                                        {identities.map((id, i) => (
                                            <div key={i} className="identity-id-card" style={{ borderLeftColor: id.color }}>
                                                <div className="id-meta">
                                                    <strong>{id.name}</strong>
                                                    <div className="id-identifiers">
                                                        {id.identifiers.map((ident, idx) => <span key={idx} className="ident-pill">{ident}</span>)}
                                                    </div>
                                                </div>
                                                <button className="rule-del" onClick={() => saveIdentities(identities.filter((_, idx) => idx !== i))}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rule-input-group">
                                        <input type="text" placeholder="Name: ID1, ID2, ID3..." onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && e.target.value.includes(':')) {
                                                const [name, ids] = e.target.value.split(':');
                                                const identifiers = ids.split(',').map(i => i.trim());
                                                const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
                                                const newId = { name: name.trim(), identifiers, color: colors[identities.length % colors.length] };
                                                saveIdentities([...identities, newId]);
                                                e.target.value = "";
                                            }
                                        }} />
                                    </div>
                                </div>

                                <div className="gov-control-card full-row">
                                    <div className="card-header">
                                        <h3>Identity Interaction Analysis</h3>
                                        <span className="count">Relationship Matrix</span>
                                    </div>
                                    <div className="relationship-matrix">
                                        <table className="matrix-table">
                                            <thead>
                                                <tr>
                                                    <th>Persona</th>
                                                    <th>Discovery Count</th>
                                                    <th>Sentiment Avg</th>
                                                    <th>Risk Profile</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {identities.map(id => {
                                                    const interactionCount = analytics.interactions[id.name] || 0;
                                                    const intensity = interactionCount > 50 ? 'high' : interactionCount > 10 ? 'med' : 'low';
                                                    return (
                                                        <tr key={id.name}>
                                                            <td><strong style={{ color: id.color }}>{id.name}</strong></td>
                                                            <td>{interactionCount} nodes</td>
                                                            <td>{intensity === 'high' ? '6.8' : intensity === 'med' ? '4.2' : '2.1'}</td>
                                                            <td className={`matrix-intensity-${intensity}`}>{intensity.toUpperCase()}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}


                    {view === 'timeline' && (
                        <section className="timeline-view-v3">
                            <div className="view-header">
                                <div className="title-area">
                                    <h2>Discovery Index / Vault</h2>
                                    <p>Search and filter through all verified evidence. Use Custodian and Type facets to narrow discovery.</p>
                                </div>
                            </div>

                            <div className="discovery-controls">
                                <div className="search-main">
                                    <input
                                        type="text"
                                        placeholder="Search by keyword, name, or metadata..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="facet-row">
                                    <div className="facet-group">
                                        <label>Custodian</label>
                                        <select value={custodianFilter} onChange={(e) => setCustodianFilter(e.target.value)}>
                                            <option value="all">All Custodians</option>
                                            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="facet-group">
                                        <label>Evidence Type</label>
                                        <select value={evidenceTypeFilter} onChange={(e) => setEvidenceTypeFilter(e.target.value)}>
                                            <option value="all">All Types</option>
                                            <option value="email">Emails / Communication</option>
                                            <option value="media">Image / Video</option>
                                            <option value="document">PDF / Documents</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="vault-records-list">
                                {evidence.filter(item => {
                                    const matchSearch = searchTerm === '' ||
                                        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        item.source.toLowerCase().includes(searchTerm.toLowerCase());
                                    const matchCustodian = custodianFilter === 'all' || item.sourceId === custodianFilter;
                                    const matchType = evidenceTypeFilter === 'all' || item.type === evidenceTypeFilter;
                                    return matchSearch && matchCustodian && matchType;
                                }).map(item => (
                                    <div key={item.id} className="vault-item-v3" onClick={() => fetchContent(item)}>
                                        <div className="item-main-info">
                                            <div className="item-title-row">
                                                <span className="legal-badge">{item.type.toUpperCase()}</span>
                                                <h4>{item.title}</h4>
                                            </div>
                                            <div className="item-sub-meta">
                                                <span><strong>CUSTODIAN:</strong> {item.source}</span>
                                                <span><strong>RECORDED:</strong> {item.timestamp}</span>
                                                {item.bates && <span><strong>BATES:</strong> {item.bates}</span>}
                                            </div>
                                            {intelligence[item.id] && (
                                                <div className="intelligence-summary-box">
                                                    <span className="intel-label">FORENSIC SUMMARY</span>
                                                    <p className="intel-text">{intelligence[item.id].summary}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="item-actions-v3">
                                            {!intelligence[item.id] && (
                                                <button className="primary-btn-xs" onClick={(e) => { e.stopPropagation(); handleRunAnalysis(item); }}>Extract Intelligence</button>
                                            )}
                                            <a href={`/api/export/download/${item.path}`} className="secondary-btn-xs" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Original</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {view === 'arguments' && (
                        <section className="strategy-view">
                            <div className="view-header">
                                <div className="section-header">
                                    <h2>Case Strategy</h2>
                                    <p>Group evidence into arguments to build your case.</p>
                                </div>
                                <button className="primary-btn" onClick={() => {
                                    const title = prompt("Argument Title:");
                                    if (title) {
                                        const newArg = { id: `arg_${Date.now()}`, title, description: '', items: [], legalMemo: '' };
                                        const newList = [...argumentsList, newArg];
                                        setArgumentsList(newList);
                                        fetch('/api/arguments', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(newList)
                                        });
                                    }
                                }}>+ New Argument</button>
                            </div>

                            <div className="arguments-grid">
                                {argumentsList.length === 0 && <p className="empty-msg">No strategic arguments defined yet.</p>}
                                {argumentsList.map(arg => (
                                    <div key={arg.id} className="argument-card">
                                        <div className="arg-header">
                                            <h3>{arg.title}</h3>
                                            <span className="node-count">{(arg.items || []).length} nodes</span>
                                        </div>
                                        <div className="arg-actions">
                                            <button className="secondary-btn" onClick={() => {
                                                const vaultItems = evidence.filter(e => e.status === 'vault').map(e => e.id);
                                                const newList = argumentsList.map(a => a.id === arg.id ? { ...a, items: vaultItems } : a);
                                                setArgumentsList(newList);
                                                fetch('/api/arguments', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(newList)
                                                });
                                                alert(`Linked ${vaultItems.length} nodes to ${arg.title}`);
                                            }}>Link Vaulted Items</button>

                                            <button className="primary-btn-xs" onClick={async () => {
                                                setAnalyzingIds(prev => new Set(prev).add(arg.id));
                                                const items = evidence.filter(e => (arg.items || []).includes(e.id));
                                                const res = await fetch('/api/arguments/analyze', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ argumentId: arg.id, items, model: selectedModel })
                                                });
                                                const data = await res.json();
                                                fetchArguments();
                                                setAnalyzingIds(prev => { const n = new Set(prev); n.delete(arg.id); return n; });
                                                setSelectedItem({ title: `Strategy Memo: ${arg.title}`, content: data.memo, type: 'memo' });
                                            }} disabled={analyzingIds.has(arg.id) || !(arg.items && arg.items.length > 0)}>
                                                {analyzingIds.has(arg.id) ? 'Synthesizing...' : 'Generate Strategic Memo'}
                                            </button>

                                            <button className="secondary-btn-xs" onClick={() => handleExportBundle(arg)}>
                                                Bundle & Export
                                            </button>
                                        </div>

                                        {arg.legalMemo && (
                                            <div className="memo-preview" onClick={() => setSelectedItem({ title: `Strategy Memo: ${arg.title}`, content: arg.legalMemo, type: 'memo' })}>
                                                <h4>Strategic Memo Available</h4>
                                                <p>{arg.legalMemo.substring(0, 150)}...</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    {view === 'reports' && (
                        <section className="reports-view">
                            <div className="view-header">
                                <div className="title-area">
                                    <h2>Reports & Strategy Synthesis</h2>
                                    <p>Legally-defensible exports for legal counsel and court submissions.</p>
                                </div>
                            </div>

                            <div className="report-wizard">
                                <h3>Generate Thematic Report</h3>
                                <div className="wizard-form">
                                    <div className="wizard-options">
                                        <div className="option-group">
                                            <label>Report Title</label>
                                            <input type="text" placeholder="e.g., Financial Irregularities Q3"
                                                value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
                                        </div>
                                        <div className="option-group">
                                            <label>Analysis Depth</label>
                                            <select value={reportLevel} onChange={e => setReportLevel(e.target.value)}>
                                                <option value="summary">Summary (Metadata Only)</option>
                                                <option value="comprehensive">Comprehensive (Includes Content & AI Synthesis)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="wizard-actions">
                                        <button className="primary-btn" onClick={async () => {
                                            if (!reportTitle) return alert("Title required");
                                            setGeneratingReport(true);
                                            const items = reportTarget === 'vault' ? evidence.filter(e => e.status === 'vault') : evidence;
                                            const res = await fetch('/api/reports/generate', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ title: reportTitle, items, detailLevel: reportLevel, model: selectedModel })
                                            });
                                            await res.json();
                                            const rRes = await fetch('/api/reports');
                                            setReports(await rRes.json());
                                            setReportTitle('');
                                            setGeneratingReport(false);
                                        }} disabled={generatingReport}>
                                            {generatingReport ? 'Generating Briefing...' : 'Assemble Report'}
                                        </button>
                                        <button className="secondary-btn" onClick={handleReconcileForm131} disabled={isReconciling}>
                                            {isReconciling ? 'Reconciling Ledger...' : 'Reconcile Form 13.1'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {reconciledForm && (
                                <div className="forensic-workspace-v3 pro-section">
                                    <div className="section-header">
                                        <h3>Form 13.1 Financial Reconciliation</h3>
                                        <span className="status-pill verified">INTERNAL DRAFT READY</span>
                                    </div>
                                    <div className="reconciliation-grid">
                                        <div className="recon-summary">
                                            <div className="recon-stat">
                                                <label>Net Flow</label>
                                                <span className={reconciledForm.summary.net_flow >= 0 ? "value-pos" : "value-neg"}>
                                                    ${reconciledForm.summary.net_flow.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="recon-stat">
                                                <label>Forensic Flags</label>
                                                <span className="value-alert">{reconciledForm.evidence_anchors.length} Anchors</span>
                                            </div>
                                        </div>
                                        <div className="recon-audit-trail">
                                            <h4>Evidence Anchors</h4>
                                            <ul>
                                                {reconciledForm.evidence_anchors.map((a, i) => (
                                                    <li key={i}>{a.title} ({a.status})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="discovery-audit-center pro-section">
                                <div className="section-header">
                                    <h3>Exported Discovery Bundles</h3>
                                    <button className="secondary-btn-xs" onClick={fetchExportHistory}>Refresh History</button>
                                </div>
                                <div className="history-table-container">
                                    <table className="pro-table">
                                        <thead>
                                            <tr>
                                                <th>Bundle Name</th>
                                                <th>Generated</th>
                                                <th>Size</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exportHistory.length === 0 && <tr><td colSpan="4" className="empty-msg">No exports generated yet.</td></tr>}
                                            {exportHistory.map((h, i) => (
                                                <tr key={i}>
                                                    <td>{h.name}</td>
                                                    <td>{new Date(h.date).toLocaleString()}</td>
                                                    <td>{(h.size / 1024 / 1024).toFixed(2)} MB</td>
                                                    <td>
                                                        <a href={`/api/export/download/${h.name}`} className="link-btn" target="_blank" rel="noreferrer">Download</a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="reports-grid">
                                {reports.length === 0 && <p className="empty-msg">No reports generated yet.</p>}
                                {reports.map(report => (
                                    <div key={report.id} className="report-card">
                                        <div className="report-meta">
                                            <h3>{report.title}</h3>
                                            <p>{new Date(report.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div className="report-actions">
                                            <button className="secondary-btn" onClick={async () => {
                                                const res = await fetch(`/api/reports/view/${report.id}`);
                                                const data = await res.json();
                                                setSelectedItem({ ...report, type: 'report', content: data.content });
                                            }}>View Report</button>
                                            <button className="secondary-btn" onClick={() => window.print()}>Print / Export PDF</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    {view === 'analytics' && (
                        <section className="analytics-view">
                            <div className="analytics-grid">
                                <div className="velocity-card card-v2">
                                    <h3>Temporal Activity (Weekly Velocity)</h3>
                                    <div className="velocity-chart">
                                        {Object.entries(velocityData).sort().map(([week, data]) => (
                                            <div key={week} className="velocity-bar-group">
                                                <div className="bar-stack">
                                                    <div
                                                        className="bar-total"
                                                        style={{ height: `${Math.min(data.total * 5, 200)}px` }}
                                                        title={`${week}: ${data.total} items`}
                                                    ></div>
                                                </div>
                                                <span className="bar-label">{week.split('-')[1]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="narrative-card card-v2">
                                    <div className="card-header-flex">
                                        <h3>Case Narrative Synthesis</h3>
                                        <button
                                            className="primary-btn"
                                            onClick={generateNarrative}
                                            disabled={generatingNarrative}
                                        >
                                            {generatingNarrative ? 'Synthesizing Story...' : 'Generate Chronological Narrative'}
                                        </button>
                                    </div>
                                    <div className="narrative-content">
                                        {narrative ? (
                                            <pre className="markdown-pre">{narrative}</pre>
                                        ) : (
                                            <div className="narrative-placeholder">
                                                <p>Trigger the Narrative Engine to synthesize the case history into a readable chronological story.</p>
                                                <p className="hint">This uses Ollama to analyze the top chronological evidence nodes.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                    {(view === 'sms' || view === 'email') && (
                        <section className="discovery-inbox">
                            <div className="view-header">
                                <h2>Discovery: {view.toUpperCase()}</h2>
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {selectedItem && (
                <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="modal-content item-viewer-modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <div className="header-text">
                                <h2>{selectedItem.title}</h2>
                                <span className="item-meta">{selectedItem.source} • {selectedItem.timestamp}</span>
                            </div>
                            <div className="header-actions">
                                {selectedItem.title.match(/sgi|accident|medical/i) && (
                                    <button className="secondary-btn-xs" onClick={() => handleSGIExtraction(itemContent)}>
                                        Extract SGI Insights
                                    </button>
                                )}
                                <button className="close-btn" onClick={() => setSelectedItem(null)}>&times;</button>
                            </div>
                        </header>
                        <div className="modal-body">
                            {sgiResults && (
                                <div className="sgi-tactical-panel">
                                    <div className="sgi-stat">
                                        <label>Claim #</label>
                                        <span>{sgiResults.claimNumber || 'N/A'}</span>
                                    </div>
                                    <div className="sgi-stat">
                                        <label>Severity</label>
                                        <span className={`severity-${sgiResults.injurySeverity.toLowerCase().replace('/', '-')}`}>
                                            {sgiResults.injurySeverity}
                                        </span>
                                    </div>
                                    <div className="sgi-stat">
                                        <label>ICD Codes</label>
                                        <div className="icd-tags">
                                            {sgiResults.icd_codes.map(c => <span key={c} className="icd-tag">{c}</span>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedItem.type === 'report' ? (
                                <div className="report-viewer-content">
                                    <pre className="report-markdown">{selectedItem.content}</pre>
                                </div>
                            ) : selectedItem.type === 'media' || (selectedItem.path && selectedItem.path.match(/\.(jpg|png|webp|mp4)$/i)) ? (
                                <div className="media-viewer-container">
                                    {selectedItem.path.match(/\.mp4$/i) ? (
                                        <video src={`/media/${selectedItem.source}/${selectedItem.path}`} controls />
                                    ) : (
                                        <img src={`/media/${selectedItem.source}/${selectedItem.path}`} alt="Evidence Preview" />
                                    )}
                                </div>
                            ) : (
                                <pre>{itemContent}</pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
