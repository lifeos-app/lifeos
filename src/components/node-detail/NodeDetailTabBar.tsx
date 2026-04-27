import { FileText, CheckSquare, BarChart3, Wallet } from 'lucide-react';
import type { TabKey } from './useNodeDetailState';

const tabs: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: 'overview', icon: <FileText size={12} />, label: 'Overview' },
  { key: 'tasks', icon: <CheckSquare size={12} />, label: 'Tasks' },
  { key: 'progress', icon: <BarChart3 size={12} />, label: 'Progress' },
  { key: 'resources', icon: <Wallet size={12} />, label: 'Resources' },
];

export function NodeDetailTabBar({ activeTab, setActiveTab }: { activeTab: TabKey; setActiveTab: (v: TabKey) => void }) {
  return (
    <div className="nd-tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`nd-tab ${activeTab === tab.key ? 'nd-tab--active' : ''}`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}