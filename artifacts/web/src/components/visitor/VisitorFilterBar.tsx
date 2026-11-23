import { Search, LayoutGrid, MapPin, ChevronDown } from "lucide-react";

type Opt = { label: string; value: string };
export function VisitorFilterBar(p: {
  search: string; onSearch: (v: string) => void; placeholder: string;
  country: string; onCountry: (v: string) => void; countries: Opt[];
  category: string; onCategory: (v: string) => void; categories: Opt[]; categoryLabel: string;
  view: "grid" | "map"; onView: (v: "grid" | "map") => void;
}) {
  const sel = "w-full bg-transparent text-[16px] font-bold text-[#17100F] appearance-none pr-6 cursor-pointer focus:outline-none";
  const tog = (on: boolean) => `h-14 px-5 inline-flex items-center justify-center gap-2 border border-[#17100F] text-[14px] font-bold transition-colors ${on ? "bg-[#F3BF2C] text-[#17100F]" : "bg-[#FBF8F2] text-[#17100F] hover:bg-[#17100F] hover:text-[#F4EFE6]"}`;
  return (
    <div className="mt-8 md:mt-10 grid grid-cols-1 lg:grid-cols-[1.9fr_1fr_1fr_auto_auto] gap-2" data-testid="visitor-filter-bar">
      <label className="h-14 flex items-center gap-3 px-4 border border-[#17100F] bg-[#FBF8F2] focus-within:outline focus-within:outline-2 focus-within:outline-[#F3BF2C]">
        <Search className="w-4 h-4 shrink-0" /><span className="sr-only">Search</span>
        <input type="search" value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder={p.placeholder} className="min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-[#17100F]/55 focus:outline-none" data-testid="input-search" />
      </label>
      <label className="relative h-14 px-4 flex flex-col justify-center border border-[#17100F] bg-[#FBF8F2]">
        <span className="rp-label !text-[11px] text-[#17100F]/70">Country</span>
        <select value={p.country} onChange={(e) => p.onCountry(e.target.value)} className={sel} data-testid="select-country">
          {p.countries.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 bottom-3 pointer-events-none" />
      </label>
      <label className="relative h-14 px-4 flex flex-col justify-center border border-[#17100F] bg-[#FBF8F2]">
        <span className="rp-label !text-[11px] text-[#17100F]/70">{p.categoryLabel}</span>
        <select value={p.category} onChange={(e) => p.onCategory(e.target.value)} className={sel} data-testid="select-category">
          {p.categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 bottom-3 pointer-events-none" />
      </label>
      <div className="flex gap-2 lg:contents">
      <button type="button" onClick={() => p.onView("grid")} aria-pressed={p.view === "grid"} className={tog(p.view === "grid")} data-testid="button-view-grid"><LayoutGrid className="w-4 h-4" /> Grid</button>
      <button type="button" onClick={() => p.onView("map")} aria-pressed={p.view === "map"} className={tog(p.view === "map")} data-testid="button-view-map"><MapPin className="w-4 h-4" /> Map</button>
      </div>
    </div>
  );
}
