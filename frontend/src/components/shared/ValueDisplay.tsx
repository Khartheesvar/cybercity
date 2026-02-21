interface ValueDisplayProps {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  danger?: boolean;
  warning?: boolean;
}

export function ValueDisplay({
  label,
  value,
  unit,
  decimals = 1,
  danger = false,
  warning = false,
}: ValueDisplayProps) {
  let textColor = "text-green-400";
  if (danger) textColor = "text-red-500 animate-pulse";
  else if (warning) textColor = "text-yellow-400";

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="text-xs text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold ${textColor}`}>
        {value.toFixed(decimals)}
        <span className="text-sm text-gray-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}
