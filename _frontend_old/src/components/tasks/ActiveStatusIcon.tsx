/**
 * ActiveStatusIcon - Rotating arcs inside a circle
 *
 * Shows three partial circles rotating at different speeds.
 * Used for Active task status.
 */

interface ActiveStatusIconProps {
  className?: string;
  color?: string;
}

export function ActiveStatusIcon({ className = '', color = 'currentColor' }: ActiveStatusIconProps) {
  // Circumference for each ring (2 * PI * radius)
  const ring1Circumference = 2 * Math.PI * 6;  // outer rotating ring
  const ring2Circumference = 2 * Math.PI * 3;  // inner rotating ring

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Outer static circle (like Pending) */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />

      {/* Outer rotating arc */}
      <circle
        cx="12"
        cy="12"
        r="6.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${ring1Circumference * 0.4} ${ring1Circumference * 0.6}`}
        className="animate-spin-outer"
        style={{ transform: 'rotate(45deg)', transformOrigin: 'center' }}
      />

      {/* Inner rotating arc */}
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
        strokeDasharray={`${ring2Circumference * 0.25} ${ring2Circumference * 0.75}`}
        className="animate-spin-inner"
      />

      <style>{`
        @keyframes spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        .animate-spin-outer {
          animation: spin-cw 4s linear infinite;
          transform-origin: center;
        }
        .animate-spin-inner {
          animation: spin-ccw 2.5s linear infinite;
          transform-origin: center;
        }
      `}</style>
    </svg>
  );
}
