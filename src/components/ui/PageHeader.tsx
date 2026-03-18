import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  centered?: boolean;
  /** Show pulsing glow behind icon (like Finances/Health) */
  pulse?: boolean;
  /** CSS color for pulse glow */
  pulseColor?: string;
}

export function PageHeader({
  icon, title, subtitle, actions, children, className, centered, pulse, pulseColor,
}: PageHeaderProps) {
  return (
    <header className={`page-header animate-fadeUp ${centered ? 'page-header--centered' : ''} ${className || ''}`}>
      <div className="page-header-left">
        {icon && (
          <div className="page-header-icon">
            {icon}
            {pulse && (
              <div
                className="page-header-pulse"
                style={pulseColor ? { borderColor: pulseColor } : undefined}
              />
            )}
          </div>
        )}
        <div>
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <div className="page-header-subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
      {children}
    </header>
  );
}
