import React from 'react';
import { StrategicButton, IntelligenceTile } from './Atomic';

const DecisionEventCard = ({ event, onResolve, onChat }) => {
    const { type, item, timestamp } = event;
    const isPriority = item.status === 'pending_decision';

    return (
        <div className={`decision-event-card premium-glass ${isPriority ? 'highlighting-box' : ''}`}>
            <div className="event-header">
                <span className="event-type">{type.replace('_', ' ')}</span>
                <span className="event-time">{new Date(timestamp).toLocaleTimeString()}</span>
            </div>

            <div className="event-body">
                <h4>{item.subject || item.title || "New Legal Signal"}</h4>
                <p className="event-excerpt">{item.Analysis || item.analysis || "Awaiting deep lexicon scan..."}</p>
                <div className="event-meta">
                    <span>Source: {item.source}</span>
                    {item.pristine_reference && (
                        <span className="pristine-link">🔗 Reference: {item.pristine_reference}</span>
                    )}
                </div>
            </div>

            <div className="event-actions">
                <StrategicButton
                    variant="primary"
                    onClick={() => onResolve(item.id, 'PROMOTE')}
                    size="small"
                >
                    PROMOTE TO DOCKET
                </StrategicButton>
                <StrategicButton
                    variant="secondary"
                    onClick={() => onResolve(item.id, 'REJECT')}
                    size="small"
                >
                    DISMISS
                </StrategicButton>
                <button className="chat-trigger-btn" onClick={() => onChat(item)}>
                    💬
                </button>
            </div>
        </div>
    );
};

export default DecisionEventCard;
