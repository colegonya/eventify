"use client";

import { useState } from "react";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A swatch picker and a hex box editing the same value. The text input is the
 * one that submits, so leaving it empty still means "use the default palette" —
 * something a bare <input type="color"> can't express, since it always has a
 * value.
 */
export function ColorField({ name, label, defaultValue, fallback }) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <label className="flex flex-col gap-1 text-xs text-brand-ink/75">
      {label}
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={HEX.test(value) ? value : fallback}
          onChange={(e) => setValue(e.target.value)}
          className="size-8 cursor-pointer rounded-sm border border-brand-ink/20 bg-background p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        />
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`${label} hex value`}
          placeholder="default"
          spellCheck={false}
          className="w-24 rounded-sm border border-brand-ink/20 px-2 py-1.5 font-mono text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
        />
      </span>
    </label>
  );
}
