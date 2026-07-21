import React, { useState } from 'react';
import MasterPage from './MasterPage';

export default function AgencyClientMasters({ masters }) {
  // Extract all masters that belong to 'Agency/Client Masters'
  const acMasters = masters.filter(m => m.group === 'Agency/Client Masters');
  
  // Default to the first tab ('agency_type')
  const [activeTab, setActiveTab] = useState(acMasters[0]?.key || 'agency_type');

  if (acMasters.length === 0) {
    return <div className="panel">Loading master configuration…</div>;
  }

  const activeMeta = acMasters.find(m => m.key === activeTab);

  return (
    <div>
      <h2>Agency / Client Masters</h2>
      <div className="muted" style={{ marginBottom: 16 }}>Manage agencies, clients, and related configurations.</div>
      
      {/* Scrollable Tabs */}
      <div className="scroll-tabs-container panel" style={{ padding: '8px 16px', marginBottom: 0 }}>
        <div className="scroll-tabs">
          {acMasters.map((m) => (
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
