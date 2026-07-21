import React, { useState, useEffect } from 'react';
import MasterPage from './MasterPage';

export default function TabbedMastersContainer({ masters, groupName, title, description }) {
  const groupMasters = masters.filter(m => m.group === groupName);
  const [activeTab, setActiveTab] = useState(groupMasters[0]?.key);

  // If groupName changes (navigating between consolidated groups), reset the active tab
  useEffect(() => {
    setActiveTab(groupMasters[0]?.key);
  }, [groupName, masters]);

  const currentTab = groupMasters.find(m => m.key === activeTab) ? activeTab : groupMasters[0]?.key;

  if (groupMasters.length === 0) {
    return <div className="panel">Loading master configuration for {groupName}…</div>;
  }

  return (
    <div>
      <h2>{title}</h2>
      {description && <div className="muted" style={{ marginBottom: 16 }}>{description}</div>}
      
      <div className="scroll-tabs-container panel" style={{ padding: '8px 16px', marginBottom: 0 }}>
        <div className="scroll-tabs">
          {groupMasters.map((m) => (
            <button
              key={m.key}
              className={`scroll-tab ${currentTab === m.key ? 'active' : ''}`}
              onClick={() => setActiveTab(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {/* Render the generic master page for the selected tab */}
        <MasterPage masters={masters} masterKey={currentTab} hideHeader />
      </div>
    </div>
  );
}
