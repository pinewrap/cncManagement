"use client";

import { useEffect, useRef, useState } from "react";

type Customer = { id: string; name: string };

type Props = {
  customers: Customer[];
  value: string;           // selected customer id
  onChange: (id: string) => void;
  placeholder?: string;
};

export default function CustomerSearch({ customers, value, onChange, placeholder = "Search customer..." }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : customers;

  function select(c: Customer) {
    onChange(c.id);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center rounded border bg-white">
        <input
          type="text"
          className="w-full rounded px-3 py-2 text-sm outline-none"
          placeholder={selected ? selected.name : placeholder}
          value={selected ? "" : query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(""); // clear selection when typing again
          }}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="pr-3 text-gray-400 hover:text-gray-600"
            aria-label="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="mt-1 flex items-center gap-2 rounded bg-brand/20 px-3 py-1.5 text-sm font-medium text-brand-navy">
          {selected.name}
          <button type="button" onClick={clear} className="ml-auto text-xs text-gray-500 hover:text-gray-700">✕</button>
        </div>
      )}

      {/* Dropdown */}
      {open && !selected && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-white shadow-lg text-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">No customers found</li>
          ) : (
            filtered.map((c) => (
              <li
                key={c.id}
                className="cursor-pointer px-3 py-2 hover:bg-brand/10 hover:text-brand-navy"
                onMouseDown={() => select(c)}
              >
                {c.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
