import { ChevronUp, ChevronDown } from 'lucide-react';

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  accent?: string;
  children: React.ReactNode;
}

export function Section({ title, icon, isOpen, onToggle, accent, children }: SectionProps) {
  return (
    <div className="nd-section">
      <div onClick={onToggle} className="nd-section-header" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
        <h3 style={accent ? { color: accent } : undefined}>
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h3>
        {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
      </div>
      {isOpen && <div className="nd-section-content">{children}</div>}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="text-[11px] text-white/50 mb-1">{label}</div>
      {children}
    </div>
  );
}