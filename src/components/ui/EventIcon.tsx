/**
 * EventIcon — Renders a Lucide icon for an event type.
 * 
 * Usage:
 *   <EventIcon eventType="work" size={16} />
 *   <EventIcon typeInfo={typeInfo} size={16} color="#00D4FF" />
 */

import React from 'react';
import { Calendar } from 'lucide-react';
import { EVENT_TYPES, type EventType, type EventTypeInfo } from '../../lib/schedule-events';

interface EventIconProps {
  /** Event type ID — looks up from EVENT_TYPES */
  eventType?: EventType | string;
  /** Or pass the full typeInfo directly */
  typeInfo?: EventTypeInfo;
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

export function EventIcon({
  eventType,
  typeInfo,
  size = 16,
  className,
  color,
  style,
}: EventIconProps) {
  const info = typeInfo || EVENT_TYPES.find(t => t.id === eventType);
  if (!info) {
    return <Calendar size={size} className={className} color={color} style={style} />;
  }
  const Icon = info.icon;
  return <Icon size={size} className={className} color={color || info.color} style={style} />;
}

/** Get the emoji string for an event type (for text-only contexts like Supabase writes) */
export function getEventEmoji(eventType: EventType | string): string {
  return EVENT_TYPES.find(t => t.id === eventType)?.emoji || '📅';
}

export default EventIcon;
