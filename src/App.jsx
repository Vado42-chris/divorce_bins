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

    useEffect(() => {
        checkHealth()
        fetchAnalytics()
        fetchArguments()
        fetchVelocity()
        const interval = setInterval(() => {
            checkHealth()
            fetchAnalytics()
            fetchArguments()
            fetchVelocity()
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/analytics')
            const data = await res.json()
            setAnalytics(data)
        } catch (e) {
            console.error("Analytics fetch failed")
        }
    }

    const fetchVelocity = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/analytics/velocity')
            const data = await res.json()
            setVelocityData(data)
        } catch (e) {
            console.error("Velocity fetch failed")
        }
    }

    useEffect(() => {
        let poll
        const activeSyncs = Object.keys(sync).filter(id => sync[id].active)
        if (activeSyncs.length > 0) {
            poll = setInterval(async () => {
                const newSync = { ...sync }
                for (const id of activeSyncs) {
                    const res = await fetch(`http://localhost:3001/api/pipeline/status?id=${id}`)
                    const data = await res.json()
                    newSync[id] = data
                }
                setSync(newSync)

                if (Object.values(newSync).every(s => !s.active)) {
                    // Refresh data
                    const iRes = await fetch('http://localhost:3001/api/index')
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
        await fetch('http://localhost:3001/api/pipeline/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId })
        })
    }

    const fetchThreads = async () => {
        const res = await fetch('http://localhost:3001/api/sms/threads')
        const data = await res.json()
        setThreads(data)
    }

    const fetchEmails = async () => {
        const res = await fetch('http://localhost:3001/api/email/inbox')
        const data = await res.json()
        setEmails(data)
    }

    const fetchArguments = async () => {
        const res = await fetch('http://localhost:3001/api/arguments')
        const data = await res.json()
        setArgumentsList(data)
    }

    useEffect(() => {
        if (view === 'sms') fetchThreads()
        if (view === 'email') fetchEmails()
        if (view === 'arguments') fetchArguments()
    }, [view])

    const fetchContent = (item) => {
        setSelectedItem(item)
        setItemContent('Loading...')
        fetch(`http://localhost:3001/api/content?path=${item.path}`)
            .then(res => res.text())
            .then(data => setItemContent(data))
    }
    const [exportHistory, setExportHistory] = useState([]);

    const fetchExportHistory = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/reports/history');
            setExportHistory(await res.json());
        } catch (e) {
            console.error("Failed to load export history");
        }
    };

    const handleExportBundle = async (arg) => {
        try {
            const res = await fetch(`http://localhost:3001/api/export/bundle/${arg.id}`, { method: 'POST' });
            const data = await res.json();
            if (data.file) {
                window.open(`http://localhost:3001/api/export/download/${data.file}`);
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
            const res = await fetch('http://localhost:3001/api/chat', {
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
            await fetch('http://localhost:3001/api/upload', {
                method: 'POST',
                body: formData
            })
            const res = await fetch('http://localhost:3001/api/index')
            const data = await res.json()
            setEvidence(data)
        } catch (e) {
            alert("Upload failed")
        }
    }

    const restartOllama = async () => {
        setHealth(prev => ({ ...prev, ollama: 'restarting' }))
        try {
            await fetch('http://localhost:3001/api/ollama/restart', { method: 'POST' })
        } catch (e) { }
        setTimeout(checkHealth, 3000)
    }

    const checkHealth = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/index')
            const data = await res.json()
            setEvidence(data)
            setHealth(prev => ({ ...prev, backend: 'online' }))
        } catch (e) {
            setHealth(prev => ({ ...prev, backend: 'offline' }))
        }

        try {
            const sRes = await fetch('http://localhost:3001/api/sources')
            const sData = await sRes.json()
            setSources(sData)

            const dRes = await fetch('http://localhost:3001/api/device/detect')
            const dData = await dRes.json()
            setHealth(prev => ({ ...prev, device: dData.connected ? 'connected' : 'disconnected' }))

            const gRes = await fetch('http://localhost:3001/api/governance')
            const gData = await gRes.json()
            setGovernance(gData)

            const argRes = await fetch('http://localhost:3001/api/arguments')
            const argData = await argRes.json()
            setArgumentsList(argData)

            const iRes = await fetch('http://localhost:3001/api/intelligence')
            const iData = await iRes.json()
            setIntelligence(iData)

            const idRes = await fetch('http://localhost:3001/api/identities')
            const idData = await idRes.json()
            setIdentities(idData)

            const vRes = await fetch('http://localhost:3001/api/analytics/velocity')
            const vData = await vRes.json()
            setVelocityData(vData)
        } catch (e) { }

        setLoading(false)
    }

    const handleRunAnalysis = async (item) => {
        setAnalyzingIds(prev => new Set([...prev, item.id]));
        try {
            const res = await fetch('http://localhost:3001/api/intelligence/analyze', {
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
        await fetch('http://localhost:3001/api/identities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idList)
        });
    }

    const promoteToVault = async (item) => {
        if (!item) return;
        const newStatus = item.status === 'vault' ? 'discovery' : 'vault';
        try {
            await fetch('http://localhost:3001/api/index/promote', {
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
            const res = await fetch('http://localhost:3001/api/analytics/narrative', {
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
                    <button className={view === 'governance' ? 'active' : ''} onClick={() => setView('governance')}>Governance Center</button>
                    <button className={view === 'arguments' ? 'active' : ''} onClick={() => setView('arguments')}>Argument Builder</button>
                    <button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>Temporal Analytics</button>
                    <hr className="nav-divider" />
                    <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Secure Vault</button>
                    <button className={view === 'reports' ? 'active' : ''} onClick={async () => { setView('reports'); const res = await fetch('http://localhost:3001/api/reports'); setReports(await res.json()); }}>Reports Center</button>
                    <button className={view === 'sms' ? 'active' : ''} onClick={() => setView('sms')}>SMS Discovery</button>
                    <button className={view === 'email' ? 'active' : ''} onClick={() => setView('email')}>Email Discovery</button>
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
                        <section className="dashboard-view-v2">
                            <div className="hero-stats-row">
                                <div className="stat-pill">
                                    <span className="stat-value">{evidence.length}</span>
                                    <span className="stat-name">Discovery Nodes</span>
                                </div>
                                <div className={`stat-pill ${evidence.filter(e => e.flagged).length > 0 ? 'alert' : ''}`}>
                                    <span className="stat-value">{evidence.filter(e => e.flagged).length}</span>
                                    <span className="stat-name">Active Alerts</span>
                                </div>
                                <div className="stat-pill">
                                    <span className="stat-value">{argumentsList.length}</span>
                                    <span className="stat-name">Strategic Vectors</span>
                                </div>
                            </div>

                            <div className="dash-core-grid">
                                <div className="alert-feed">
                                    <div className="section-header">
                                        <h3>Critical Evidence Alerts</h3>
                                        {evidence.filter(e => e.flagged).length > 0 && <span className="u-badge">G-LEVEL-1</span>}
                                    </div>
                                    <div className="alert-scroll">
                                        {evidence.filter(e => e.flagged).length === 0 && <p className="empty-msg">No governance matches in the current archive.</p>}
                                        {evidence.filter(e => e.flagged).map(alert => (
                                            <div key={alert.id} className="alert-node" onClick={() => fetchContent(alert)}>
                                                <div className="alert-meta">
                                                    <span className="severity">HIGH</span>
                                                    <span className="timestamp">{alert.timestamp}</span>
                                                </div>
                                                <h4>{alert.title}</h4>
                                                <div className="match-tags">
                                                    {alert.flags?.map((f, i) => <span key={i} className="m-tag">{f}</span>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="activity-center">
                                    <h3>Conflict Velocity Heatmap</h3>
                                    <div className="heatmap-container">
                                        <div className="heatmap-grid">
                                            <div className="heatmap-cell label"></div>
                                            {Array.from({ length: 24 }).map((_, i) => <div key={i} className="heatmap-cell label">{i}</div>)}
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, d) => (
                                                <div key={day} style={{ display: 'contents' }}>
                                                    <div className="heatmap-cell label">{day}</div>
                                                    {analytics.heatmap[d]?.map((val, h) => (
                                                        <div key={`${d}-${h}`}
                                                            className={`heatmap-cell intensity-${Math.floor(val)}`}
                                                            title={`Conflict: ${val.toFixed(1)}`}>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <h3>Vault Stream</h3>
                                    <div className="stream-list">
                                        {evidence.slice(0, 6).map(item => (
                                            <div key={item.id} className="stream-item" onClick={() => fetchContent(item)}>
                                                <div className="s-icon">{item.type === 'email' ? '✉️' : '💬'}</div>
                                                <div className="s-body">
                                                    <p><strong>{item.title}</strong> processed from {item.source}</p>
                                                    <span className="s-date">{item.timestamp}</span>
                                                </div>
                                            </div>
                                        ))}
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
                                                    await fetch(`http://localhost:3001/api/sources/${source.id}`, { method: 'DELETE' });
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
                                    <h2>Governance & Risk Center</h2>
                                    <p>Configure automated discovery triggers for priority entities and keywords.</p>
                                </div>
                            </div>

                            <div className="gov-controls-grid">
                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Keyword Monitoring</h3>
                                        <span className="count">{governance.keywords?.length || 0} Active</span>
                                    </div>
                                    <div className="gov-tags">
                                        {governance.keywords?.map((k, i) => (
                                            <div key={i} className="active-rule-tag">
                                                <span>{k.value}</span>
                                                <button className="rule-del" onClick={async () => {
                                                    const updated = { ...governance, keywords: governance.keywords.filter((_, idx) => idx !== i) };
                                                    setGovernance(updated);
                                                    await fetch('http://localhost:3001/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
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
                                                await fetch('http://localhost:3001/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                            }
                                        }} />
                                    </div>
                                </div>

                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Entity Priority List</h3>
                                        <span className="count">{governance.entities?.length || 0} Tracking</span>
                                    </div>
                                    <div className="gov-tags">
                                        {governance.entities?.map((e, i) => (
                                            <div key={i} className="active-rule-tag entity">
                                                <span><strong>{e.label}</strong>: {e.value}</span>
                                                <button className="rule-del" onClick={async () => {
                                                    const updated = { ...governance, entities: governance.entities.filter((_, idx) => idx !== i) };
                                                    setGovernance(updated);
                                                    await fetch('http://localhost:3001/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
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
                                                await fetch('http://localhost:3001/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                                            }
                                        }} />
                                    </div>
                                </div>

                                <div className="gov-control-card">
                                    <div className="card-header">
                                        <h3>Identity Resolution</h3>
                                        <span className="count">{identities.length} Personas</span>
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
                        <section className="timeline">
                            <div className="view-header">
                                <h2>Secure Vault</h2>
                            </div>
                            <div className="timeline-items">
                                {evidence.filter(item => item.status === 'vault').map((item, index) => (
                                    <div key={index} className="timeline-item" onClick={() => fetchContent(item)}>
                                        <div className="time">{item.timestamp}</div>
                                        <div className="item-card">
                                            <div className="item-details">
                                                <strong>{item.title}</strong>
                                                <span className={`type-tag ${item.type}`}>{item.type}</span>
                                                {item.identity && <span className="identity-badge" style={{ color: item.identityColor, border: `1px solid ${item.identityColor}` }}>{item.identity}</span>}
                                                {intelligence[item.id] && (
                                                    <div className="intelligence-summary-box">
                                                        <span className="intel-label">AI Summary</span>
                                                        <p className="intel-text">{intelligence[item.id].summary}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="item-actions-v2" onClick={e => e.stopPropagation()}>
                                                {analyzingIds.has(item.id) ? (
                                                    <span className="analyzing-spinner">Analyzing...</span>
                                                ) : !intelligence[item.id] && (
                                                    <button className="analyze-btn-xs" onClick={() => handleRunAnalysis(item)}>Analyze</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {view === 'arguments' && (
                        <section className="strategy-view">
                            <div className="view-header">
                                <div className="title-area">
                                    <h2>Case Strategy Board</h2>
                                    <p>Group evidence into tactical arguments and generate strategic memos.</p>
                                </div>
                                <button className="primary-btn" onClick={() => {
                                    const title = prompt("Argument Title:");
                                    if (title) {
                                        const newArg = { id: `arg_${Date.now()}`, title, description: '', items: [], legalMemo: '' };
                                        const newList = [...argumentsList, newArg];
                                        setArgumentsList(newList);
                                        fetch('http://localhost:3001/api/arguments', {
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
                                                fetch('http://localhost:3001/api/arguments', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(newList)
                                                });
                                                alert(`Linked ${vaultItems.length} nodes to ${arg.title}`);
                                            }}>Link Vaulted Items</button>

                                            <button className="primary-btn-xs" onClick={async () => {
                                                setAnalyzingIds(prev => new Set(prev).add(arg.id));
                                                const items = evidence.filter(e => (arg.items || []).includes(e.id));
                                                const res = await fetch('http://localhost:3001/api/arguments/analyze', {
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
                                            <label>Target Dataset</label>
                                            <select value={reportTarget} onChange={e => setReportTarget(e.target.value)}>
                                                <option value="vault">Secure Vault (Promoted Items Only)</option>
                                                <option value="all">Full Discovery (All Nodes)</option>
                                            </select>
                                        </div>
                                        <div className="option-group">
                                            <label>Analysis Depth</label>
                                            <select value={reportLevel} onChange={e => setReportLevel(e.target.value)}>
                                                <option value="summary">Summary (Metadata Only)</option>
                                                <option value="comprehensive">Comprehensive (Includes Content & AI Synthesis)</option>
                                            </select>
                                        </div>
                                        <div className="option-group">
                                            <label>Selected Model</label>
                                            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                                                {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="wizard-actions">
                                        <span className="item-count">
                                            {reportTarget === 'vault' ? evidence.filter(e => e.status === 'vault').length : evidence.length} nodes included
                                        </span>
                                        <button className="primary-btn" onClick={async () => {
                                            if (!reportTitle) return alert("Title required");
                                            setGeneratingReport(true);
                                            const items = reportTarget === 'vault' ? evidence.filter(e => e.status === 'vault') : evidence;
                                            const res = await fetch('http://localhost:3001/api/reports/generate', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ title: reportTitle, items, detailLevel: reportLevel, model: selectedModel })
                                            });
                                            await res.json();
                                            const rRes = await fetch('http://localhost:3001/api/reports');
                                            setReports(await rRes.json());
                                            setReportTitle('');
                                            setGeneratingReport(false);
                                        }} disabled={generatingReport}>
                                            {generatingReport ? 'Generating Briefing...' : 'Assemble Report'}
                                        </button>
                                    </div>
                                </div>
                            </div>

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
                                                        <a href={`http://localhost:3001/api/export/download/${h.name}`} className="link-btn" target="_blank" rel="noreferrer">Download</a>
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
                                                const res = await fetch(`http://localhost:3001/api/reports/view/${report.id}`);
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
                            <button className="close-btn" onClick={() => setSelectedItem(null)}>&times;</button>
                        </header>
                        <div className="modal-body">
                            {selectedItem.type === 'report' ? (
                                <div className="report-viewer-content">
                                    <pre className="report-markdown">{selectedItem.content}</pre>
                                </div>
                            ) : selectedItem.type === 'media' || (selectedItem.path && selectedItem.path.match(/\.(jpg|png|webp|mp4)$/i)) ? (
                                <div className="media-viewer-container">
                                    {selectedItem.path.match(/\.mp4$/i) ? (
                                        <video src={`http://localhost:3001/media/${selectedItem.source}/${selectedItem.path}`} controls />
                                    ) : (
                                        <img src={`http://localhost:3001/media/${selectedItem.source}/${selectedItem.path}`} alt="Evidence Preview" />
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
