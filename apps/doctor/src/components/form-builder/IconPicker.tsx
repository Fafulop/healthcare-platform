'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Stethoscope,
  HeartPulse,
  Activity,
  Thermometer,
  Baby,
  Brain,
  Bone,
  Eye,
  Ear,
  Pill,
  Syringe,
  Scissors,
  Clock,
  Calendar,
  ClipboardList,
  UserCheck,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  activity: Activity,
  thermometer: Thermometer,
  baby: Baby,
  brain: Brain,
  bone: Bone,
  eye: Eye,
  ear: Ear,
  pill: Pill,
  syringe: Syringe,
  scissors: Scissors,
  clock: Clock,
  calendar: Calendar,
  'clipboard-list': ClipboardList,
  'user-check': UserCheck,
};

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SelectedIcon = value ? ICONS[value] : Stethoscope;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
      >
        <SelectedIcon className="w-4 h-4" />
        <span className="text-gray-700">{value || 'stethoscope'}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1 w-48">
          {Object.entries(ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={`p-2 rounded hover:bg-blue-50 flex items-center justify-center ${
                value === name ? 'bg-blue-100 ring-2 ring-blue-500' : ''
              }`}
              title={name}
            >
              <Icon className="w-5 h-5 text-gray-700" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
