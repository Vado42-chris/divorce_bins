import React, { useState, useEffect } from 'react';
import { StrategicShell, GlossCard, StrategicSection, BreadcrumbNav, StrategicButton } from './Atomic';

/**
 * PROJECTION MIRROR (v8.8.0)
 * A specialized, read-only view for judicial presentation.
 * Enforces PII masking and provides structured narrative overlays.
 */
const ProjectionMirror = ({ activeDocket, onExit }) => {
    const [projectionData, setProjectionData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvidence, setSelectedEvidence] = useState(null);

    useEffect(() => {
        const fetchAnonymizedData = async () => {
            if (!activeDocket) return;
            try {
                const res = await fetch(`/api/projection/anonymize?docket_id=${activeDocket.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setProjectionData(data);
                }
            } catch (e) {
                console.error("Projection data load failure", e);
            } finally {
                setLoading(false);
            }
        };
        fetchAnonymizedData();
    }, [activeDocket?.id]);

    if (!activeDocket) return <div className="projection-error">NO ACTIVE DOCKET FOR PROJECTION</div>;

    return (
        <StrategicShell
            header={
                <div className="projection-header premium-glass">
                    <div className="header-left">
                        <BreadcrumbNav paths={['Trial Presentation', activeDocket.title, 'Projection Mirror']} />
                        <span className="status-badge live">LIVE PROJECTION ACTIVE</span>
                    </div>
                    <div className="header-right">
                        <StrategicButton variant="secondary" onClick={onExit}>EXIT PROJECTION</StrategicButton>
                    </div>
                </div>
            }
            main={
                <div className="projection-main-flow">
                    <StrategicSection title="JUDICIAL TIMELINE (MASKED)">
                        {loading ? (
                            <div className="projection-loading">ANALYZING FORENSIC DATA FOR PROJECTION...</div>
                        ) : (
                            <div className="projection-grid">
                                {projectionData.map((item, idx) => (
                                    <GlossCard
                                        key={idx}
                                        className={`projection-tile ${selectedEvidence?.id === item.id ? 'active' : ''}`}
                                        onClick={() => setSelectedEvidence(item)}
                                    >
                                        <div className="tile-bates">BATES: {item.bates || 'PENDING'}</div>
                                        <h4 className="tile-title">{item.title}</h4>
                                        <div className="tile-meta">
                                            <span>CUSTODIAN: {item.custodian}</span>
                                            <span>SOURCE: {item.source}</span>
                                        </div>
                                    </GlossCard>
                                ))}
                            </div>
                        )}
                    </StrategicSection>
                </div>
            }
            sidebar={
                <div className="projection-narrative-panel premium-glass">
                    <header className="narrative-head">
                        <h4>TACTICAL NARRATIVE</h4>
                    </header>
                    <div className="narrative-content">
                        {selectedEvidence ? (
                            <div className="evidence-detail">
                                <div className="detail-header">
                                    <h3>{selectedEvidence.title}</h3>
                                    <p className="summary">{selectedEvidence.ai?.summary || "No automated summary available."}</p>
                                </div>
                                <div className="detail-tags">
                                    {selectedEvidence.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                                </div>
                                <div className="judicial-note">
                                    <h5>JUDICIAL CONTEXT</h5>
                                    <p>This evidence was captured with strict forensic custody and is presented here in a read-only, anonymized format for the court's review.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="narrative-empty">Select evidence from the timeline to view formal narrative context.</div>
                        )}
                    </div>
                </div>
            }
        />
    );
};

export default ProjectionMirror;
