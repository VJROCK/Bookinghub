import React, { useState } from 'react';
import MasterPage from './MasterPage';

export default function ExecutiveRetainerMasters({ masters }) {
  // Extract all masters that belong to 'Executive/Retainer Masters'
  const groupMasters = masters.filter(m => m.group === 'Executive/Retainer Masters');
  
  // Default to the first tab
  const [activeTab, setActiveTab] = useState(groupMasters[0]?.key || 'designation');

  if (groupMasters.length === 0) {
    return <div className="panel">Loading master configuration…</div>;
  }

  return (
    <div>
      <h2>Executive / Retainer Masters</h2>
      <div className="muted" style={{ marginBottom: 16 }}>Manage executives, retainers, designations, and reporting hierarchies.</div>
      
      {/* Scrollable Tabs */}
      <div className="scroll-tabs-container panel" style={{ padding: '8px 16px', marginBottom: 0 }}>
        <div className="scroll-tabs">
          {groupMasters.map((m) => (
            <button
              key={m.key}
              className={`scroll-tab ${activeTab === m.key ? 'active' : ''}`}
              onClick={() => setActiveTab(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {/* Render the generic master page for the selected tab */}
        <MasterPage masters={masters} masterKey={activeTab} hideHeader />
      </div>
    </div>
  );
}
