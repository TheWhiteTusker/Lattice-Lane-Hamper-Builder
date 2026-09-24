/** The lighthouse on its cliff. The beacon lens sits at (160, 148) of the 320×500 viewBox. */
export function LighthouseSvg() {
  return (
    <svg viewBox="0 0 320 500" className="w-full h-full drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rocky Cliff Base */}
      <path d="M0 450 C40 435 90 445 140 435 C190 425 240 450 320 440 L320 500 L0 500 Z" fill="#0d110f"/>
      <path d="M10 465 C60 450 110 460 160 455 C210 450 260 470 310 460 L320 500 L0 500 Z" fill="#141916"/>
      <path d="M30 480 Q100 470 170 482 T310 480 L320 500 L0 500 Z" fill="#19201c"/>

      {/* Ocean Water Reflections at Base */}
      <ellipse cx="160" cy="492" rx="110" ry="4" fill="rgba(245, 215, 130, 0.08)"/>
      <ellipse cx="140" cy="496" rx="70" ry="2.5" fill="rgba(245, 215, 130, 0.05)"/>

      {/* Lighthouse Foundation / Stone Plinth */}
      <polygon points="110,435 210,435 218,455 102,455" fill="#1c221e" stroke="#262f2a" strokeWidth="1.5"/>

      {/* Arched Entrance Doorway */}
      <path d="M148 435 L148 410 Q160 398 172 410 L172 435 Z" fill="#0a0d0b" stroke="#2b352f" strokeWidth="1.5"/>
      <circle cx="168" cy="420" r="1.5" fill="#c4aa63" />

      {/* Tower Body - Tapered Masonry */}
      {/* Tower Section 1 (Bottom Charcoal Granite) */}
      <polygon points="116,435 204,435 198,360 122,360" fill="#181e1b" stroke="#242c27" strokeWidth="1"/>

      {/* Tower Section 2 (Cream Stone Band - Lattice Lane heritage) */}
      <polygon points="122,360 198,360 193,290 127,290" fill="#c8c2b1" stroke="#ded8c8" strokeWidth="1"/>
      {/* Lower Window */}
      <path d="M154 335 L154 318 Q160 312 166 318 L166 335 Z" fill="#241d0c"/>
      <path d="M155 334 L155 319 Q160 314 165 319 L165 334 Z" fill="#fbbf24" opacity="0.85"/>

      {/* Tower Section 3 (Sage Green Band - Brand Color) */}
      <polygon points="127,290 193,290 188,220 132,220" fill="#54655b" stroke="#43524a" strokeWidth="1"/>
      {/* Upper Window */}
      <path d="M155 260 L155 245 Q160 240 165 245 L165 260 Z" fill="#241d0c"/>
      <path d="M156 259 L156 246 Q160 242 164 246 L164 259 Z" fill="#fef08a" opacity="0.9"/>

      {/* Tower Section 4 (Upper Stone Collar) */}
      <polygon points="132,220 188,220 185,185 135,185" fill="#dcd6c5" stroke="#ede7d7" strokeWidth="1"/>

      {/* Observation Gallery / Balcony Platform */}
      {/* Decorative stone corbels */}
      <path d="M130 185 L125 178 L195 178 L190 185 Z" fill="#242c27" stroke="#343f38"/>
      {/* Balcony deck */}
      <rect x="122" y="174" width="76" height="4" rx="1.5" fill="#181e1b" stroke="#3a473f"/>
      {/* Metal Railing */}
      <line x1="124" y1="165" x2="196" y2="165" stroke="#8a968e" strokeWidth="1.5"/>
      {[128, 140, 160, 180, 192].map((x) => (
        <line key={x} x1={x} y1="165" x2={x} y2="174" stroke="#8a968e" strokeWidth="1" />
      ))}

      {/* Lantern Glass Room */}
      <rect x="136" y="125" width="48" height="49" fill="rgba(254, 240, 138, 0.18)" stroke="#242c27" strokeWidth="2"/>
      {/* Glass Mullions / Diagonal Grid */}
      <line x1="136" y1="125" x2="184" y2="174" stroke="#242c27" strokeWidth="1.2"/>
      <line x1="184" y1="125" x2="136" y2="174" stroke="#242c27" strokeWidth="1.2"/>
      <line x1="160" y1="125" x2="160" y2="174" stroke="#242c27" strokeWidth="1.5"/>

      {/* The Fresnel Beacon Lens (Center at X: 160, Y: 148) */}
      <circle cx="160" cy="148" r="14" fill="url(#beacon-glow)" className="animate-pulse"/>
      <circle cx="160" cy="148" r="8" fill="#fffdfa" />
      <circle cx="160" cy="148" r="4" fill="#ffffff" />

      {/* Domed Roof / Cupola */}
      <path d="M132 125 C132 100 188 100 188 125 Z" fill="#2c3631" stroke="#1b221f" strokeWidth="1.5"/>
      {/* Pinnacle & Spire */}
      <rect x="158" y="90" width="4" height="12" fill="#d5cfc0" />
      <circle cx="160" cy="88" r="3.5" fill="#fef08a" />
      <line x1="160" y1="85" x2="160" y2="72" stroke="#c8c2b1" strokeWidth="1.5"/>

      {/* Definitions for gradients */}
      <defs>
        <radialGradient id="beacon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#fef08a" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
