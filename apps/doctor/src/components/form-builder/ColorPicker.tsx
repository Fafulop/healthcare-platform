'use client';

const COLORS = [
  { name: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { name: 'green', bg: 'bg-green-500', ring: 'ring-green-500' },
  { name: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { name: 'red', bg: 'bg-red-500', ring: 'ring-red-500' },
  { name: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-500' },
  { name: 'teal', bg: 'bg-teal-500', ring: 'ring-teal-500' },
  { name: 'pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
  { name: 'indigo', bg: 'bg-indigo-500', ring: 'ring-indigo-500' },
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      {COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          onClick={() => onChange(color.name)}
          className={`w-6 h-6 rounded-full ${color.bg} transition-transform ${
            value === color.name
              ? `ring-2 ${color.ring} ring-offset-2 scale-110`
              : 'hover:scale-110'
          }`}
          title={color.name}
        />
      ))}
    </div>
  );
}
