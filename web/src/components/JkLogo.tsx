export function JkLogo({
  size = 24,
  color = '#ea580c',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      {/* J */}
      <line x1="10" y1="8" x2="10" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M10 21 Q10 26 7 26" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* K */}
      <line x1="17" y1="8" x2="17" y2="24" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M17 16 L23 8" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M17 16 L23 24" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Oblique strike */}
      <line x1="5" y1="27" x2="27" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
