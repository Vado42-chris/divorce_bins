import React from 'react';

const MissionControlCockpit = ({
    verificationResult,
    fetchForm13Draft,
    isGenerating131,
    financialDraft,
    narrative,
    generateNarrative,
    vault,
    setSelectedItem
}) => {
    return (
        <section className="analytics-view">
            <div className="command-center-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr) minmax(300px, 1fr)', gap: '1.5rem', height: 'calc(100vh - 200px)', minHeight: '600px' }}>

                {/* COLUMN 1: EVIDENCE & INTELLIGENCE */}
                <div className="command-col scrollable" style={{ padding: '1rem', background: '#02061766', borderRadius: '8px', border: '1px solid #1e293b', overflowY: 'auto' }}>
                    <div className="col-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #3b82f633', paddingBottom: '0.5rem' }}>
                        <h4 style={{ color: '#3b82f6', margin: 0, fontSize: '0.9rem', letterSpacing: '0.1rem' }}>📁 EVIDENCE & INTELLIGENCE</h4>
                    </div>

                    <div className="narrative-card card-v2" style={{ background: '#0f172a', marginBottom: '1rem', borderLeft: '3px solid #f59e0b' }}>
                        <div className="card-header-flex">
                            <h3 style={{ fontSize: '0.85rem' }}>OIG Compliance Monitor</h3>
                            <div style={{ fontSize: '0.65rem', color: verificationResult?.includes('VERIFIED') ? '#10b981' : '#f59e0b' }}>
                                {verificationResult ? 'SIGNAL: ' + verificationResult.split(': ')[0] : 'STANDBY'}
                            </div>
                        </div>
                        <div className="compliance-status" style={{ fontSize: '0.75rem', marginTop: '10px' }}>
                            {verificationResult ? (
                                <div style={{ color: verificationResult.includes('VERIFIED') ? '#10b981' : '#ef4444' }}>
                                    {verificationResult}
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8' }}>
                                    Integrity seals active on discovery bundles.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="narrative-card card-v2" style={{ background: '#0f172a', marginBottom: '1rem', borderLeft: '3px solid #10b981' }}>
                        <div className="card-header-flex">
                            <h3 style={{ fontSize: '0.85rem' }}>Financial Forensic Intelligence</h3>
                            <button className="secondary-btn-xs" onClick={fetchForm13Draft} disabled={isGenerating131}>
                                {isGenerating131 ? 'Generating...' : 'Draft Form 13.1'}
                            </button>
                        </div>
                        <div className="financial-status" style={{ fontSize: '0.75rem', marginTop: '10px' }}>
                            {financialDraft ? (
                                <div style={{ color: '#10b981' }}>
                                    ✅ Form 13.1 Draft Ready ({financialDraft.draft.PART_1_ASSETS.length} Assets / {financialDraft.draft.PART_2_DEBTS.length} Debts)
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8' }}>
                                    ⚠️ No disclosure draft initialized. Initializing anchors...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="narrative-card card-v2" style={{ background: '#0f172a', marginBottom: '1rem' }}>
                        <div className="card-header-flex">
                            <h3 style={{ fontSize: '0.85rem' }}>Case Narrative Synthesis</h3>
                            <button className="primary-btn-xs" onClick={generateNarrative}>Synthesize</button>
                        </div>
                        <div className="narrative-content" style={{ fontSize: '0.75rem', maxHeight: '150px', overflow: 'hidden' }}>
                            {narrative ? <pre className="markdown-pre">{narrative.substring(0, 300)}...</pre> : <p style={{ color: '#94a3b8' }}>Ready for real-time synthesis.</p>}
                        </div>
                    </div>

                    <div className="evidence-summary-list">
                        <h5 style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.5rem' }}>RECENT NODES</h5>
                        {(vault || []).slice(0, 8).map(item => (
                            <div key={item.id} className="small-node-card" style={{ background: '#1e293b66', padding: '0.6rem', marginBottom: '0.5rem', borderRadius: '4px', borderLeft: '3px solid #3b82f6' }} onClick={() => setSelectedItem(item)}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{item.id} - {item.title}</div>
                                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem' }}>{item.date} | Confidence: {item.confidence || 0}%</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Additional columns would go here as they are modularized */}
                {/* For now, we are focusing on the most complex sections */}

            </div>
        </section>
    );
};

export default MissionControlCockpit;
