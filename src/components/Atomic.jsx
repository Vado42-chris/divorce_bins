import React, { useState } from 'react';

/**
 * STRATEGIC SHELL
 * A slot-based layout component for consistent hub structure.
 * Slots: header, main, sidebar.
 */
export const StrategicShell = ({ header, main, sidebar, trayOpen }) => (
    <div className={`strategic-shell ${trayOpen ? 'tray-active' : ''}`}>
        <header className="shell-header-area">{header}</header>
        <div className="shell-body-area">
            <main className="shell-main-content">{main}</main>
            {sidebar && <aside className="shell-sidebar-panel">{sidebar}</aside>}
        </div>
    </div>
);

/**
 * GLOSS CARD
 * Foundational glassmorphism container.
 */
export const GlossCard = ({ children, className = "", onClick, selected }) => (
    <div
        className={`premium-glass gloss-card ${selected ? 'selected' : ''} ${className}`}
        onClick={onClick}
    >
        {children}
    </div>
);

/**
 * STRATEGIC HEADER
 * Top-level persistent navigation and search bar.
 */
export const StrategicHeader = ({ search, breadcrumbs, userCard }) => (
    <div className="strategic-header premium-glass">
        <div className="header-left">
            {search}
        </div>
        <div className="header-center">
            {breadcrumbs}
        </div>
        <div className="header-right">
            {userCard}
        </div>
    </div>
);

/**
 * BREADCRUMB NAV
 * Provides cognitive anchoring.
 */
export const BreadcrumbNav = ({ paths = [] }) => (
    <nav className="breadcrumb-nav">
        {paths.map((p, i) => (
            <React.Fragment key={i}>
                <span className={`breadcrumb-item ${p.active ? 'active' : ''}`}>
                    {typeof p === 'string' ? p.toUpperCase() : p.name?.toUpperCase()}
                </span>
                {i < paths.length - 1 && <span className="breadcrumb-separator">/</span>}
            </React.Fragment>
        ))}
    </nav>
);

/**
 * USER ID CARD
 * Displays identities and active case context.
 */
export const UserIdCard = ({ user, activeDocket, onClick }) => (
    <div className="user-id-card premium-glass inner" onClick={onClick}>
        <div className="user-avatar">
            {user.initials || 'CH'}
        </div>
        <div className="user-details">
            <div className="user-name">{user.name || "Sovereign User"}</div>
            <div className="active-case-badge">
                <span className="case-pulse"></span>
                {activeDocket?.title || "NO ACTIVE CASE"}
            </div>
        </div>
        <div className="card-actions">
            ⚙️
        </div>
    </div>
);

/**
 * INTELLIGENCE TILE
 * Normalized fact node with Pin and Refine actions.
 */
export const IntelligenceTile = ({ title, content, meta, onPin, onRefine, isPinned }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(content);

    const handleSave = () => {
        onRefine(draft);
        setEditing(false);
    };

    return (
        <GlossCard className="intelligence-tile">
            <div className="tile-header">
                <h4 className="tile-title">{title}</h4>
                <div className="tile-actions">
                    <button
                        className={`action-btn pin ${isPinned ? 'active' : ''}`}
                        onClick={onPin}
                        title={isPinned ? "Unpin Item" : "Pin to Tactical Tray"}
                    >
                        📌
                    </button>
                    {!editing && (
                        <button className="action-btn refine" onClick={() => setEditing(true)}>
                            ✏️
                        </button>
                    )}
                </div>
            </div>
            <div className="tile-content">
                {editing ? (
                    <div className="edit-mode">
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={4}
                        />
                        <div className="edit-actions">
                            <button className="save-btn" onClick={handleSave}>SAVE</button>
                            <button className="cancel-btn" onClick={() => setEditing(false)}>CANCEL</button>
                        </div>
                    </div>
                ) : (
                    <p>{content}</p>
                )}
            </div>
            {meta && <div className="tile-footer">{meta}</div>}
        </GlossCard>
    );
};

/**
 * TACTICAL TRAY
 * Persistent sidebar for pinned tactical anchors.
 */
export const TacticalTray = ({ pinnedItems, onUnpin, isOpen, onToggle }) => (
    <div className={`tactical-tray ${isOpen ? 'open' : 'closed'}`}>
        <button className="tray-toggle" onClick={onToggle}>
            {isOpen ? '➡️' : '📌'}
            {pinnedItems.length > 0 && <span className="tray-badge">{pinnedItems.length}</span>}
        </button>
        <div className="tray-content">
            <header className="tray-header">
                <h4>TACTICAL WORKSPACE</h4>
            </header>
            <div className="tray-list">
                {pinnedItems.length > 0 ? (
                    pinnedItems.map((item, i) => (
                        <div key={i} className="tray-item premium-glass inner">
                            <div className="tray-item-head">
                                <h5>{item.title}</h5>
                                <button className="unpin-small" onClick={() => onUnpin(item)}>✕</button>
                            </div>
                            <p className="tray-item-body">{item.content.substring(0, 80)}...</p>
                        </div>
                    ))
                ) : (
                    <div className="tray-empty">No tactical items pinned.</div>
                )}
            </div>
        </div>
    </div>
);/**
 * STRATEGIC SECTION
 * A standardized container for grouped intelligence tools.
 */
export const StrategicSection = ({ title, actions, children, className = "" }) => (
    <section className={`strategic-section ${className}`}>
        <header className="section-head">
            <h3 className="section-title">{title}</h3>
            {actions && <div className="section-actions">{actions}</div>}
        </header>
        <div className="section-content">
            {children}
        </div>
    </section>
);

/**
 * STRATEGIC INPUT
 * Premium text entry with forensic indicators.
 */
export const StrategicInput = ({ value, onChange, placeholder, onKeyPress, icon, disabled }) => (
    <div className={`strategic-input-wrapper ${disabled ? 'disabled' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
            type="text"
            className="premium-input"
            value={value}
            onChange={onChange}
            onKeyPress={onKeyPress}
            placeholder={placeholder}
            disabled={disabled}
        />
        <div className="input-glow-bar"></div>
    </div>
);

/**
 * STRATEGIC BUTTON
 * High-engagement action trigger with hover physics.
 */
export const StrategicButton = ({ onClick, children, variant = "primary", disabled, loading }) => (
    <button
        className={`strategic-btn ${variant} ${loading ? 'loading' : ''}`}
        onClick={onClick}
        disabled={disabled || loading}
    >
        {loading ? (
            <span className="btn-spinner"></span>
        ) : children}
    </button>
);
