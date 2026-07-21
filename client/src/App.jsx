import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { api, isLoggedIn, getUser, setSession } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MasterPage from './pages/MasterPage';
import TabbedMastersContainer from './pages/TabbedMastersContainer';
import BookingPage from './pages/BookingPage';
import QBC from './pages/QBC';
import { ConfirmAds, BookingAudit, PublishAudit, RateAudit } from './pages/WorkflowPages';
import { ProofReading, DealAudit, DealProvision, RateExpiry, FollowUp, MisUpdation, PendingDummy, CdUpload, PaymentGateway } from './pages/OtherTransactions';
import AdSearch from './pages/AdSearch';
import { Billing, RevisedBilling } from './pages/BillingPages';
import { ReportsMenu, ReportRunner } from './pages/ReportPages';
import { UsersPage, ChangePassword, Permissions, LogPage, Preferences, FormNames, GenerateRefFile, CopyRate } from './pages/SettingsPages';

const TXN_LINKS = [
  ['display-booking', 'Display Booking'], ['classified-booking', 'Classified Booking'],
  ['qbc', 'QBC (Quick Booking)'], ['payment-gateway', 'Payment Gateway'],
  ['confirm-ads', 'Confirm/Unconfirm Ads'], ['booking-audit', 'Booking Audit'],
  ['publish-audit', 'Publish Audit'], ['rate-audit', 'Rate Audit'],
  ['proof-reading', 'Proof Reading'], ['deal-audit', 'Deal Audit'],
  ['deal-provision', 'Deal Provision'], ['rate-expiry', 'Rate Expiry'],
  ['follow-up', 'Follow Up'], ['mis-updation', 'Mis Updation'],
  ['pending-dummy', 'Pending For Dummy'], ['cd-upload', 'CD Upload'],
];
const SETTINGS_LINKS = [
  ['users', 'Create User'], ['log', 'Log'], ['change-password', 'Change Password'],
  ['permissions', 'Master/User/Role Permission'], ['form-names', 'Form Name'],
  ['generate-ref-file', 'Generate Ref File'], ['preferences', 'Preferences'], ['copy-rate', 'Copy Rate'],
];

const CONSOLIDATED_GROUPS = {
  'Agency/Client Masters': { path: '/masters/agency-client', label: 'Agency / Client Masters' },
  'Executive/Retainer Masters': { path: '/masters/executive-retainer', label: 'Executive / Retainer Masters' },
  'Environment Masters': { path: '/masters/environment', label: 'Environment Masters' },
  'Ad Category': { path: '/masters/ad-category', label: 'Ad Category Masters' },
  'Publication Masters': { path: '/masters/publication', label: 'Publication Masters' },
  'Rate Masters': { path: '/masters/rate', label: 'Rate Masters' }
};

function Sidebar({ masters, reports }) {
  const [q, setQ] = useState('');
  const [openSec, setOpenSec] = useState({ Masters: true, Transactions: true, Reports: false, 'Ad Search': true, Billing: true, 'Application Settings': false });
  const groups = useMemo(() => {
    const g = {};
    for (const m of masters) (g[m.group] = g[m.group] || []).push(m);
    return g;
  }, [masters]);
  const reportGroups = useMemo(() => {
    const g = {};
    for (const r of reports) (g[r.group] = g[r.group] || []).push(r);
    return g;
  }, [reports]);
  const match = (label) => !q || label.toLowerCase().includes(q.toLowerCase());
  const toggle = (s) => setOpenSec((o) => ({ ...o, [s]: !o[s] }));
  const Sec = ({ name, children }) => (
    <div className="nav-sec">
      <div className="sec-title" onClick={() => toggle(name)}>{name}<span>{openSec[name] || q ? '▾' : '▸'}</span></div>
      {(openSec[name] || q) && children}
    </div>
  );
  return (
    <div className="sidebar">
      <div className="brand">Booking<span>Hub</span></div>
      <div className="search"><input placeholder="Search menu..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="nav-scroll nav">
        <NavLink to="/">🏠 Dashboard</NavLink>
        <Sec name="Masters">
          {Object.entries(groups).map(([grp, items]) => {
            const consolidated = CONSOLIDATED_GROUPS[grp];
            if (!consolidated) return null;
            const vis = items.filter((m) => match(m.label));
            if (!match(consolidated.label) && !vis.length) return null;
            return (
              <div key={grp}>
                <div className="nav-grp">{grp}</div>
                <NavLink to={consolidated.path}>{consolidated.label}</NavLink>
              </div>
            );
          })}
        </Sec>
        <Sec name="Transactions">
          {TXN_LINKS.filter(([, l]) => match(l)).map(([k, l]) => <NavLink key={k} to={`/transactions/${k}`}>{l}</NavLink>)}
        </Sec>
        <Sec name="Reports">
          <NavLink to="/reports">Report Menu</NavLink>
          {Object.entries(reportGroups).map(([grp, items]) => {
            const vis = items.filter((r) => match(r.title));
            if (!vis.length) return null;
            return (
              <div key={grp}>
                <div className="nav-grp">{grp}</div>
                {vis.map((r) => <NavLink key={r.id} to={`/reports/${r.id}`}>{r.title}</NavLink>)}
              </div>
            );
          })}
        </Sec>
        <Sec name="Ad Search">
          {match('Ad Search') && <NavLink to="/ad-search">Ad Search</NavLink>}
        </Sec>
        <Sec name="Billing">
          {match('Billing') && <NavLink to="/billing">Billing</NavLink>}
          {match('Revised Billing') && <NavLink to="/billing/revised">Revised Billing</NavLink>}
        </Sec>
        <Sec name="Application Settings">
          {SETTINGS_LINKS.filter(([, l]) => match(l)).map(([k, l]) => <NavLink key={k} to={`/settings/${k}`}>{l}</NavLink>)}
        </Sec>
      </div>
    </div>
  );
}

function Shell() {
  const [masters, setMasters] = useState([]);
  const [reports, setReports] = useState([]);
  const loc = useLocation();
  useEffect(() => {
    api.get('/api/masters/_meta').then(setMasters).catch(() => {});
    api.get('/api/reports/_meta').then(setReports).catch(() => {});
  }, []);
  const user = getUser();
  const logout = async () => { try { await api.post('/api/auth/logout'); } catch {} setSession(null, null); window.location.href = '/'; };
  const crumb = loc.pathname === '/' ? 'Dashboard' : loc.pathname.split('/').filter(Boolean).map((s) => s.replace(/-/g, ' ')).join(' › ');
  return (
    <div className="shell">
      <Sidebar masters={masters} reports={reports} />
      <div className="main">
        <div className="topbar">
          <div className="crumb" style={{ textTransform: 'capitalize' }}>{crumb}</div>
          <div className="spacer" />
          <div className="who">👤 {user?.name} <span className="badge info">{user?.role}</span></div>
          <button className="btn sec sm" onClick={logout}>Logout</button>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {Object.entries(CONSOLIDATED_GROUPS).map(([grp, conf]) => (
              <Route key={grp} path={conf.path} element={<TabbedMastersContainer masters={masters} groupName={grp} title={conf.label} />} />
            ))}
            <Route path="/masters/:key" element={<MasterPage masters={masters} />} />
            <Route path="/transactions/display-booking" element={<BookingPage adType="DISPLAY" key="d" />} />
            <Route path="/transactions/classified-booking" element={<BookingPage adType="CLASSIFIED" key="c" />} />
            <Route path="/transactions/qbc" element={<QBC />} />
            <Route path="/transactions/payment-gateway" element={<PaymentGateway />} />
            <Route path="/transactions/confirm-ads" element={<ConfirmAds />} />
            <Route path="/transactions/booking-audit" element={<BookingAudit />} />
            <Route path="/transactions/publish-audit" element={<PublishAudit />} />
            <Route path="/transactions/rate-audit" element={<RateAudit />} />
            <Route path="/transactions/proof-reading" element={<ProofReading />} />
            <Route path="/transactions/deal-audit" element={<DealAudit />} />
            <Route path="/transactions/deal-provision" element={<DealProvision />} />
            <Route path="/transactions/rate-expiry" element={<RateExpiry />} />
            <Route path="/transactions/follow-up" element={<FollowUp />} />
            <Route path="/transactions/mis-updation" element={<MisUpdation />} />
            <Route path="/transactions/pending-dummy" element={<PendingDummy />} />
            <Route path="/transactions/cd-upload" element={<CdUpload />} />
            <Route path="/ad-search" element={<AdSearch />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/revised" element={<RevisedBilling />} />
            <Route path="/reports" element={<ReportsMenu reports={reports} />} />
            <Route path="/reports/:id" element={<ReportRunner reports={reports} />} />
            <Route path="/settings/users" element={<UsersPage />} />
            <Route path="/settings/log" element={<LogPage />} />
            <Route path="/settings/change-password" element={<ChangePassword />} />
            <Route path="/settings/permissions" element={<Permissions />} />
            <Route path="/settings/form-names" element={<FormNames />} />
            <Route path="/settings/generate-ref-file" element={<GenerateRefFile />} />
            <Route path="/settings/preferences" element={<Preferences />} />
            <Route path="/settings/copy-rate" element={<CopyRate />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [logged, setLogged] = useState(isLoggedIn());
  if (!logged) return <Login onLogin={() => setLogged(true)} />;
  return <Shell />;
}
