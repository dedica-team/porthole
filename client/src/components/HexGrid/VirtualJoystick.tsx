import { useRef, useState } from 'react';

interface Props {
  onChange: (x: number, y: number) => void;
}

export default function VirtualJoystick({ onChange }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const limit = rect.width * 0.36;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > limit ? limit / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    setKnob({ x, y });
    onChange(x / limit, -y / limit);
  };

  const release = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      aria-label="Aim joystick"
      className="pointer-events-auto relative h-28 w-28 touch-none select-none rounded-full border border-red-400/50 bg-black/55 shadow-lg backdrop-blur-sm"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        event.preventDefault();
        update(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        event.preventDefault();
        event.currentTarget.releasePointerCapture(event.pointerId);
        release();
      }}
      onPointerCancel={release}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-red-300/70 bg-red-500/50 shadow"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-widest text-red-200/60">
        Aim
      </span>
    </div>
  );
}
