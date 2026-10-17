/** Decorative gradient shapes for the login showcase panel (original artwork, purely visual). */
export function ShapeArt() {
  return (
    <svg className="shape-art" viewBox="0 0 420 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sa1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6F5BFF" />
          <stop offset="1" stopColor="#D58BFF" />
        </linearGradient>
        <linearGradient id="sa2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#C9BDF5" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="sa3" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#4B3BE0" />
          <stop offset="1" stopColor="#9C7BFF" />
        </linearGradient>
      </defs>
      <g transform="rotate(-12 210 210)">
        <rect x="70" y="150" width="170" height="170" rx="46" fill="url(#sa1)" />
        <rect x="70" y="150" width="170" height="170" rx="46" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
      </g>
      <circle cx="285" cy="130" r="74" fill="url(#sa2)" />
      <circle cx="285" cy="130" r="40" fill="none" stroke="#B9A5FF" strokeWidth="14" strokeOpacity="0.7" />
      <path
        d="M300 250 l22 -46 l22 46 l50 7 l-36 35 l9 50 l-45 -24 l-45 24 l9 -50 l-36 -35 Z"
        fill="url(#sa3)"
        transform="translate(-10 10)"
      />
    </svg>
  );
}
