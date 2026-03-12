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
  "New Art": "New Art Series",
  "Evidenza": "Evidenza Collection",
  "Teak": "Teak Executive Series",
  "Pari": "Pari Executive Series",
  "New Berlin": "New Berlin Series",
  "Top Grid": "Top Grid Series",
  "Guangsheng": "Guangsheng Collection",
  "Nais": "Nais Series",
  "Shanhe": "Shanhe Series",
  "Bit": "Bit Workstation Series",
  "Fessenz": "Fessenz Signature",
  "Mike": "Mike Conference Series",
  "Karen": "Karen Manager Series",
  "Bonnie": "Bonnie Manager Series",
  // Gaozhuo / Milan workspace
  "Milan": "Milan Collection",
  "Better": "Better Workspace Series",
  "Baggio": "Baggio Executive Series",
  "Owen": "Owen Workstation Series",
  "Miller": "Miller Pod Series",
  "Cape": "Cape Executive Series",
  "Mige": "Mige Workstation Series",
  // Yashang steel products (GOJO division)
  "Yashang Steel": "Steel Filing",
  "Yafeng Steel Tank": "Steel Tank Filing",
  // LRU series (GOJO)
  "LRU": "Executive Series",
  "JN": "Heritage Director",
  "YOM": "Presidia",
  "HXM": "Presidia Executive",
  "JCN": "Grand Director Series",
  "YIN": "Executive Suite",
  "YUP": "Executive Plus",
  "YUZ": "Executive Premier",
  "VEP": "Executive Platform",
  "VEIYE": "Executive Prestige",
  "WINA": "Executive Wing",
  "GUANHE": "Executive Grand",
  "WPN": "Premium Workstation",
  "BSA": "Executive Bench",
  "MZE": "Executive Storage",
  // Seating
  "G01": "Foundation Seating I",
  "G02": "Foundation Seating II",
  "G03": "Core Seating",
  "G04": "Core Seating II",
  "G05": "Core Seating III",
  "G06": "Essentials Seating",
  "G07": "Essentials Seating II",
  "842": "Classic Series",
  "848/850": "Classic Series II",
  "833-1C": "Heritage Classic",
  // Lounge & occasional
  "K01": "Lounge Series I",
  "K02": "Lounge Series II",
  "K03": "Premium Lounge",
  "LZ9002": "Executive Storage II",
  "LZ9003": "Executive Storage III",
  "ZC 牛角椅": "Occasional Chair Collection",
  "FU8061 Sofa Collection": "Lounge Sofa Collection",
  "BJ Side Table Collection": "Side Table Collection",
  "CJ Coffee Table Collection": "Coffee Table Collection",
  "Accent Chair Collection": "Accent Chair Collection",
};

export function getSeriesDisplayName(series: string): string {
  return SERIES_DISPLAY_NAMES[series] || series;
}
