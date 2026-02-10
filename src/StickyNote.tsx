const STICKY_COLORS = [
  { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-900" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-900" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900" },
  { bg: "bg-lime-100", border: "border-lime-300", text: "text-lime-900" },
  { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-900" },
];

const ROTATIONS = [
  "-rotate-2",
  "rotate-1",
  "-rotate-1",
  "rotate-2",
  "rotate-0",
  "-rotate-3",
  "rotate-3",
];

interface StickyNoteProps {
  label: string;
  value: string;
  colorIndex: number;
}

export function StickyNote({ label, value, colorIndex }: StickyNoteProps) {
  const color = STICKY_COLORS[colorIndex % STICKY_COLORS.length];
  const rotation = ROTATIONS[colorIndex % ROTATIONS.length];

  return (
    <div
      className={`${color.bg} ${color.border} border ${rotation} px-3 py-2 rounded shadow-md hover:scale-105 transition-transform cursor-default`}
      style={{
        boxShadow: "2px 3px 6px rgba(0,0,0,0.15)",
      }}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${color.text} opacity-60`}>
        {label}
      </p>
      <p className={`text-sm font-medium ${color.text} mt-0.5`}>{value}</p>
    </div>
  );
}
