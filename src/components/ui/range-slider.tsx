import { cn } from "@/lib/utils";

/** Range input nativo estilizado — mais simples que compor `@radix-ui/react-slider` (Root/Track/
 *  Range/Thumb) pro caso de uso do painel de propriedades, que so precisa de um unico valor. */
export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  className,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary", className)}
    />
  );
}
