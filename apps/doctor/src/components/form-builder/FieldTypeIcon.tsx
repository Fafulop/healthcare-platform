import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  ChevronDown,
  Circle,
  CheckSquare,
  Upload,
} from 'lucide-react';
import type { FieldType } from '@/types/custom-encounter';

const FIELD_TYPE_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  time: Clock,
  dropdown: ChevronDown,
  radio: Circle,
  checkbox: CheckSquare,
  file: Upload,
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  textarea: 'Texto largo',
  number: 'Numero',
  date: 'Fecha',
  time: 'Hora',
  dropdown: 'Desplegable',
  radio: 'Seleccion',
  checkbox: 'Casilla',
  file: 'Archivo',
};

interface FieldTypeIconProps {
  type: FieldType;
  className?: string;
}

export function FieldTypeIcon({ type, className = 'w-4 h-4' }: FieldTypeIconProps) {
  const Icon = FIELD_TYPE_ICONS[type] ?? Type;
  return <Icon className={className} />;
}

export function getFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

export { FIELD_TYPE_ICONS, FIELD_TYPE_LABELS };
