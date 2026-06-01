"use client";

import { useRouter } from "next/navigation";

export interface FilterOption {
  value: string; // "2025-05"
  label: string; // "Maio 2025"
}

interface Props {
  options: FilterOption[];
  currentValue: string; // "" = sem filtro
}

export function ReportFilter({ options, currentValue }: Props) {
  const router = useRouter();

  if (options.length === 0) return null;

  function handleChange(value: string) {
    const url = new URL(window.location.href);
    if (value) {
      const [year, month] = value.split("-");
      url.searchParams.set("year", year);
      url.searchParams.set("month", month);
    } else {
      url.searchParams.delete("year");
      url.searchParams.delete("month");
    }
    url.searchParams.delete("page");
    router.replace(url.pathname + url.search);
  }

  return (
    <select
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      className="text-[10px] font-light text-[#455cab]/70 bg-[#f1f1f1] border border-[#dfdedf] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#455cab]/40 transition-colors cursor-pointer"
    >
      <option value="">Todos os meses</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
