"use client";
import { useState } from "react";
import { getCrestUrl, getClubColor } from "@/lib/clubs";

function initials(name: string): string {
  const parts = name.split(/[\s\-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface ClubCrestProps {
  name:      string
  size?:     number   // px — default 48
  className?: string
}

export default function ClubCrest({ name, size = 48, className = "" }: ClubCrestProps) {
  const [failed, setFailed] = useState(false);
  const crestUrl = getCrestUrl(name);
  const color    = getClubColor(name);

  if (crestUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={crestUrl}
        alt={`Escudo ${name}`}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain", width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: círculo com iniciais
  const fontSize = size < 32 ? size * 0.36 : size * 0.32;
  return (
    <div
      className={`flex items-center justify-center font-black rounded-full shrink-0 ${className}`}
      style={{
        width:      size,
        height:     size,
        background: `${color}22`,
        border:     `2px solid ${color}55`,
        color,
        fontSize,
      }}
    >
      {initials(name)}
    </div>
  );
}
