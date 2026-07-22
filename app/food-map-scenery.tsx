export function FoodMapScenery() {
  return <svg className="food-map-scenery" viewBox="0 0 360 2360" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="map-paper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf8" />
        <stop offset=".52" stopColor="#fbf6ec" />
        <stop offset="1" stopColor="#fffaf2" />
      </linearGradient>
      <linearGradient id="map-meadow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#dcebd9" />
        <stop offset="1" stopColor="#c9dfca" />
      </linearGradient>
      <linearGradient id="map-orchard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe9df" />
        <stop offset="1" stopColor="#f7d3ca" />
      </linearGradient>
      <linearGradient id="map-field" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff2c2" />
        <stop offset="1" stopColor="#f6dda0" />
      </linearGradient>
      <filter id="map-paper-grain" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="11" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="table" tableValues="0 .055" /></feComponentTransfer>
      </filter>
      <filter id="map-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#80684c" floodOpacity=".12" />
      </filter>
      <pattern id="map-field-lines" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
        <path d="M0 0V13" stroke="#cda94f" strokeOpacity=".15" strokeWidth="1" />
      </pattern>
      <g id="map-tree" filter="url(#map-soft-shadow)">
        <path d="M0 18v15" stroke="#94724d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="11" r="11" fill="#a8c9a4" />
        <circle cx="-8" cy="15" r="7" fill="#bfd7b9" />
        <circle cx="7" cy="16" r="8" fill="#8fb995" />
        <circle cx="-3" cy="7" r="7" fill="#d8e7d2" />
      </g>
      <g id="map-flower">
        <path d="M0 5v8" stroke="#88a885" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="0" cy="3" r="2.3" fill="#f2b39f" />
        <circle cx="-2.5" cy="4.5" r="2" fill="#ffd9cf" />
        <circle cx="2.5" cy="4.5" r="2" fill="#ffd9cf" />
        <circle cx="0" cy="3.7" r="1.1" fill="#d9a038" />
      </g>
      <g id="map-stone">
        <ellipse cx="0" cy="6" rx="11" ry="5" fill="#e6ddd0" />
        <path d="M-8 5c2-8 13-8 17 0" fill="#f4eee5" stroke="#d5c8b8" strokeWidth="1" />
      </g>
    </defs>

    <rect width="360" height="2360" fill="url(#map-paper)" />

    <g className="map-terrain">
      <path d="M-45 140C48 85 106 106 142 171c35 62 13 121-39 164C62 369 14 376-45 354Z" fill="url(#map-meadow)" />
      <path d="M405 370c-75-28-136-8-158 49-25 64 6 128 70 156 35 15 69 17 88 8Z" fill="url(#map-orchard)" />
      <path d="M-50 688c76-45 143-29 176 27 38 63 16 131-39 174-38 30-81 38-137 25Z" fill="url(#map-field)" />
      <path d="M-50 688c76-45 143-29 176 27 38 63 16 131-39 174-38 30-81 38-137 25Z" fill="url(#map-field-lines)" />
      <path d="M409 1004c-90-24-151 12-165 80-12 61 25 114 86 134 30 10 57 9 79 3Z" fill="url(#map-meadow)" />
      <path d="M-47 1277c91-34 151-4 169 62 19 69-24 127-91 146-25 7-51 7-78 2Z" fill="url(#map-orchard)" />
      <path d="M407 1577c-82-35-146-10-170 54-23 61 10 126 73 153 38 17 72 14 97 7Z" fill="url(#map-field)" />
      <path d="M-44 1845c91-26 153 11 162 81 9 69-39 118-107 130-20 4-38 3-55 0Z" fill="url(#map-meadow)" />
      <path d="M406 2110c-70-41-142-25-177 34-30 52-13 111 37 154 42 36 91 42 140 29Z" fill="url(#map-orchard)" />
    </g>

    <g className="map-contours" fill="none" stroke="#8eaa8d" strokeOpacity=".18" strokeWidth="1.1">
      <path d="M-20 173c67-47 127-36 157 18 29 52 4 105-50 136" />
      <path d="M-19 193c55-39 107-30 130 14 23 42 3 83-41 111" />
      <path d="M382 1045c-60-30-108-6-121 41-12 43 12 81 61 100" />
      <path d="M382 1065c-47-23-84-4-94 31-9 34 10 62 49 77" />
      <path d="M-18 1879c55-29 101-7 113 38 11 42-17 79-65 95" />
    </g>

    <path className="map-stream-edge" d="M-24 1130C87 1091 119 1147 92 1200c-24 48-9 93 82 119 100 29 112 83 50 131-69 52-35 102 89 135 56 15 75 44 68 76" fill="none" stroke="#fffdf8" strokeWidth="25" strokeLinecap="round" />
    <path className="map-stream" d="M-24 1130C87 1091 119 1147 92 1200c-24 48-9 93 82 119 100 29 112 83 50 131-69 52-35 102 89 135 56 15 75 44 68 76" fill="none" stroke="#d7e9e4" strokeWidth="18" strokeLinecap="round" />
    <path d="M-24 1130C87 1091 119 1147 92 1200c-24 48-9 93 82 119 100 29 112 83 50 131-69 52-35 102 89 135 56 15 75 44 68 76" fill="none" stroke="#bcd8d1" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="9 8" />

    <g className="map-landmarks">
      <use href="#map-tree" transform="translate(298 278) scale(.82)" />
      <use href="#map-tree" transform="translate(327 305) scale(.55)" />
      <use href="#map-tree" transform="translate(44 846) scale(.58)" />
      <use href="#map-tree" transform="translate(317 1110) scale(.7)" />
      <use href="#map-tree" transform="translate(48 1444) scale(.62)" />
      <use href="#map-tree" transform="translate(315 1755) scale(.62)" />
      <use href="#map-tree" transform="translate(47 2007) scale(.75)" />

      <use href="#map-stone" transform="translate(43 404) scale(.7)" />
      <use href="#map-stone" transform="translate(313 898) scale(.8)" />
      <use href="#map-stone" transform="translate(42 1626) scale(.65)" />
      <use href="#map-stone" transform="translate(303 2078) scale(.75)" />

      <use href="#map-flower" transform="translate(306 487)" />
      <use href="#map-flower" transform="translate(324 500) scale(.7)" />
      <use href="#map-flower" transform="translate(40 963) scale(.8)" />
      <use href="#map-flower" transform="translate(58 975) scale(.65)" />
      <use href="#map-flower" transform="translate(304 1500) scale(.85)" />
      <use href="#map-flower" transform="translate(44 2244) scale(.75)" />
    </g>

    <g className="map-clouds" fill="#fff" fillOpacity=".72">
      <path d="M275 103c4-12 20-14 27-4 11-6 25 2 24 14h-55c-3-4-1-8 4-10Z" />
      <path d="M24 573c3-9 15-11 21-3 8-5 19 1 19 10H20c-2-3 0-6 4-7Z" />
      <path d="M284 1906c4-11 18-13 24-4 10-6 23 1 23 12h-51c-2-4 0-7 4-8Z" />
    </g>

    <rect width="360" height="2360" filter="url(#map-paper-grain)" opacity=".55" />
  </svg>;
}
