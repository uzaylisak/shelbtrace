import { useMemo } from "react";

interface Bubble {
  size:     number;
  left:     number;
  top:      number;
  duration: number;
  delay:    number;
  opacity:  number;
}

function gen(count: number): Bubble[] {
  const out: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2654435761) >>> 0;
    const b = (i * 1234567891) >>> 0;
    out.push({
      size:     40  + (a % 160),          // 40–200 px
      left:     2   + (a % 96),           // 2–98 %
      top:      -5  + (b % 110),          // -5–105 % (some start above/below viewport)
      duration: 20  + (a % 20),           // 20–40 s
      delay:    0   + (i * 1.8),          // stagger start
      opacity:  0.06 + (a % 7) * 0.012,  // 0.06–0.14
    });
  }
  return out;
}

/** Global fixed bubble layer — shown on every page */
export function Bubbles() {
  const bubbles = useMemo(() => gen(20), []);

  return (
    <div
      aria-hidden="true"
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        0,
        pointerEvents: "none",
        overflow:      "hidden",
      }}
    >
      {bubbles.map((b, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            left:         `${b.left}%`,
            top:          `${b.top}%`,
            width:        b.size,
            height:       b.size,
            borderRadius: "50%",
            background:   `rgba(255,119,201,${b.opacity})`,
            animation:    `floatBubble ${b.duration}s ease-in-out ${b.delay}s infinite`,
            pointerEvents:"none",
          }}
        />
      ))}
    </div>
  );
}
