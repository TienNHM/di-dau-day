export function ProgressDots({
  total,
  current,
  accentFrom,
}: {
  total: number;
  current: number;
  accentFrom: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`Bước ${current + 1} trên ${total}`}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: index === current ? '1.75rem' : '0.375rem',
            backgroundColor: index <= current ? accentFrom : 'var(--color-line)',
          }}
        />
      ))}
    </div>
  );
}
