/**
 * Maps internal series codes to customer-facing display names.
 * Internal codes are kept in the database and catalog for SKU resolution.
 * Display names are shown on all public-facing pages.
 */
export const SERIES_DISPLAY_NAMES: Record<string, string> = {
  // Fessenz Design Collection series (Feisenzhuo products — supplier names removed)
  "Weiyi": "Prestige Series",
  "Ruige": "Director Series",
  "Blister": "Icon Series",
  "Vic": "Signature Series",
  "Zhuoya": "Landmark Series",
  "Dynamic": "Dynamic Series",
  "Dell": "Premier Series",
  "Aimu": "Aimu Collection",
  "Red Cliff": "Heritage Series",
  "Milan": "Milan Collection",
  // Yashang steel products (GOJO division)
  "Yashang Steel": "Steel Filing",
  // LRU series (GOJO)
  "LRU": "Executive Series",
  "JN": "Heritage Director",
  "YOM": "Presidia",
  "HXM": "Presidia Executive",
  "G01": "Foundation Seating I",
  "G02": "Foundation Seating II",
  "G03": "Core Seating",
  "G04": "Core Seating II",
  "G05": "Core Seating III",
  "G06": "Essentials Seating",
  "G07": "Essentials Seating II",
  "K01": "Lounge Series I",
  "K02": "Lounge Series II",
  "K03": "Premium Lounge",
  "BSA": "Executive Bench",
  "MZE": "Executive Storage",
  "VEIYE": "Executive Series",
  "YIN": "Executive Suite",
  "YUP": "Executive Plus",
  "YUZ": "Executive Premier",
  "WPN": "Premium Workstation",
  "VEP": "Executive Platform",
  "WINA": "Executive Wing",
  "GUANHE": "Executive Grand",
  "LZ9002": "Executive Storage II",
  "LZ9003": "Executive Storage III",
  "842": "Classic Series",
  "848/850": "Classic Series II",
  "833-1C": "Heritage Classic",
  "JCN": "JCN Collection",
  "ZC 牛角椅": "ZC Occasional Chair",
  "FU8061 Sofa Collection": "Lounge Sofa Collection",
  "BJ Side Table Collection": "Side Table Collection",
  "CJ Coffee Table Collection": "Coffee Table Collection",
  "Accent Chair Collection": "Accent Chair Collection",
};

export function getSeriesDisplayName(series: string): string {
  return SERIES_DISPLAY_NAMES[series] || series;
}
