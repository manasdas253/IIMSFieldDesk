import { brandPalette } from "@shared/brandPalette";
import { VISIT_PURPOSES, type VisitPurpose } from "@shared/fieldOps";

export interface DailyMapVisit {
  id: number;
  employeeName: string;
  customerName: string;
  location: string;
  purpose: VisitPurpose;
  outcome: string;
  createdAt: Date | string;
  visitDate?: string;
  notes?: string | null;
  visitStatus?: "Visited" | "Planned" | "Rescheduled";
}

type CityCoordinates = { name: string; coordinates: [number, number] };
export interface CityVisitGroup {
  key: string;
  name: string;
  coordinates: [number, number] | null;
  visits: DailyMapVisit[];
  purposeCounts: Record<VisitPurpose, number>;
  dominantPurpose: VisitPurpose;
  count: number;
}

export const PURPOSE_COLORS: Record<VisitPurpose, string> = {
  "New Lead": brandPalette.purpose["New Lead"],
  "Follow-up": "#d0a13d",
  Service: "#4e819e",
  Collection: "#3c8765",
  Other: "#8973a6",
};

const cityCatalog: Record<string, CityCoordinates> = {
  agra: { name: "Agra", coordinates: [78.0081, 27.1767] },
  ahmedabad: { name: "Ahmedabad", coordinates: [72.5714, 23.0225] },
  amritsar: { name: "Amritsar", coordinates: [74.8723, 31.634] },
  aurangabad: { name: "Chhatrapati Sambhajinagar", coordinates: [75.3433, 19.8762] },
  bengaluru: { name: "Bengaluru", coordinates: [77.5946, 12.9716] },
  bhopal: { name: "Bhopal", coordinates: [77.4126, 23.2599] },
  bhubaneswar: { name: "Bhubaneswar", coordinates: [85.8245, 20.2961] },
  bilaspur: { name: "Bilaspur", coordinates: [82.1409, 22.0797] },
  chandigarh: { name: "Chandigarh", coordinates: [76.7794, 30.7333] },
  chennai: { name: "Chennai", coordinates: [80.2707, 13.0827] },
  coimbatore: { name: "Coimbatore", coordinates: [76.9558, 11.0168] },
  cuttack: { name: "Cuttack", coordinates: [85.8793, 20.4625] },
  dehradun: { name: "Dehradun", coordinates: [78.0322, 30.3165] },
  delhi: { name: "Delhi", coordinates: [77.209, 28.6139] },
  dhanbad: { name: "Dhanbad", coordinates: [86.4304, 23.7957] },
  faridabad: { name: "Faridabad", coordinates: [77.3178, 28.4089] },
  goa: { name: "Goa", coordinates: [73.8278, 15.4909] },
  gorakhpur: { name: "Gorakhpur", coordinates: [83.3732, 26.7606] },
  guwahati: { name: "Guwahati", coordinates: [91.7362, 26.1445] },
  gurugram: { name: "Gurugram", coordinates: [77.0266, 28.4595] },
  hubli: { name: "Hubballi", coordinates: [75.124, 15.3647] },
  hyderabad: { name: "Hyderabad", coordinates: [78.4867, 17.385] },
  indore: { name: "Indore", coordinates: [75.8577, 22.7196] },
  jabalpur: { name: "Jabalpur", coordinates: [79.9864, 23.1815] },
  jaipur: { name: "Jaipur", coordinates: [75.7873, 26.9124] },
  jammu: { name: "Jammu", coordinates: [74.857, 32.7266] },
  jamshedpur: { name: "Jamshedpur", coordinates: [86.2029, 22.8046] },
  jodhpur: { name: "Jodhpur", coordinates: [73.0243, 26.2389] },
  kanpur: { name: "Kanpur", coordinates: [80.3319, 26.4499] },
  kochi: { name: "Kochi", coordinates: [76.2673, 9.9312] },
  kolkata: { name: "Kolkata", coordinates: [88.3639, 22.5726] },
  kozhikode: { name: "Kozhikode", coordinates: [75.7804, 11.2588] },
  lucknow: { name: "Lucknow", coordinates: [80.9462, 26.8467] },
  ludhiana: { name: "Ludhiana", coordinates: [75.8573, 30.901] },
  madurai: { name: "Madurai", coordinates: [78.1198, 9.9252] },
  mangaluru: { name: "Mangaluru", coordinates: [74.856, 12.9141] },
  meerut: { name: "Meerut", coordinates: [77.7064, 28.9845] },
  mumbai: { name: "Mumbai", coordinates: [72.8777, 19.076] },
  mysuru: { name: "Mysuru", coordinates: [76.6394, 12.2958] },
  nagpur: { name: "Nagpur", coordinates: [79.0882, 21.1458] },
  nashik: { name: "Nashik", coordinates: [73.7898, 19.9975] },
  noida: { name: "Noida", coordinates: [77.391, 28.5355] },
  panaji: { name: "Panaji", coordinates: [73.8278, 15.4909] },
  patna: { name: "Patna", coordinates: [85.1376, 25.5941] },
  prayagraj: { name: "Prayagraj", coordinates: [81.8463, 25.4358] },
  pune: { name: "Pune", coordinates: [73.8567, 18.5204] },
  raipur: { name: "Raipur", coordinates: [81.6296, 21.2514] },
  rajkot: { name: "Rajkot", coordinates: [70.8022, 22.3039] },
  ranchi: { name: "Ranchi", coordinates: [85.3096, 23.3441] },
  sambalpur: { name: "Sambalpur", coordinates: [83.9752, 21.4669] },
  shimla: { name: "Shimla", coordinates: [77.1734, 31.1048] },
  surat: { name: "Surat", coordinates: [72.8311, 21.1702] },
  thiruvananthapuram: { name: "Thiruvananthapuram", coordinates: [76.9366, 8.5241] },
  tiruchirappalli: { name: "Tiruchirappalli", coordinates: [78.7047, 10.7905] },
  udaipur: { name: "Udaipur", coordinates: [73.7125, 24.5854] },
  vadodara: { name: "Vadodara", coordinates: [73.1812, 22.3072] },
  varanasi: { name: "Varanasi", coordinates: [82.9739, 25.3176] },
  vijayawada: { name: "Vijayawada", coordinates: [80.648, 16.5062] },
  visakhapatnam: { name: "Visakhapatnam", coordinates: [83.2185, 17.6868] },
};

const aliases: Record<string, string> = {
  aurangabad: "aurangabad",
  bangalore: "bengaluru",
  bangaluru: "bengaluru",
  bombay: "mumbai",
  calcutta: "kolkata",
  cochin: "kochi",
  gurgaon: "gurugram",
  hubballi: "hubli",
  madras: "chennai",
  "new delhi": "delhi",
  panjim: "panaji",
  mysore: "mysuru",
  calicut: "kozhikode",
  prayagraj: "prayagraj",
  trichy: "tiruchirappalli",
  trivandrum: "thiruvananthapuram",
  vizag: "visakhapatnam",
};

export function normalizeVisitCity(location: string) {
  const firstPart = location.split(/[;,|]/, 1)[0] ?? location;
  const normalized = firstPart.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-IN").replace(/\b(city|district|urban|municipal corporation)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const key = aliases[normalized] ?? normalized;
  return key;
}

function blankPurposeCounts(): Record<VisitPurpose, number> {
  return Object.fromEntries(VISIT_PURPOSES.map(purpose => [purpose, 0])) as Record<VisitPurpose, number>;
}

function timestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function groupVisitsByCity(visits: DailyMapVisit[]) {
  const groups = new Map<string, CityVisitGroup>();
  const unmappedLocations = new Set<string>();

  for (const visit of visits) {
    const key = normalizeVisitCity(visit.location);
    const catalog = cityCatalog[key];
    if (!catalog) unmappedLocations.add(visit.location.trim());
    let group = groups.get(key);
    if (!group) {
      group = { key, name: catalog?.name ?? (visit.location.split(/[;,|]/, 1)[0]?.trim() || visit.location), coordinates: catalog?.coordinates ?? null, visits: [], purposeCounts: blankPurposeCounts(), dominantPurpose: visit.purpose, count: 0 };
      groups.set(key, group);
    }
    group.visits.push(visit);
    group.purposeCounts[visit.purpose] += 1;
    group.count += 1;
  }

  const cities = [...groups.values()].map(group => {
    group.visits.sort((a, b) => timestamp(b.visitDate ?? b.createdAt) - timestamp(a.visitDate ?? a.createdAt));
    group.dominantPurpose = VISIT_PURPOSES.reduce((best, purpose) => group.purposeCounts[purpose] > group.purposeCounts[best] ? purpose : best, VISIT_PURPOSES[0]);
    return group;
  }).sort((a, b) => a.name.localeCompare(b.name, "en-IN"));

  return { cities, unmappedLocations: [...unmappedLocations].sort((a, b) => a.localeCompare(b, "en-IN")) };
}

export function purposeColor(purpose: VisitPurpose) {
  return PURPOSE_COLORS[purpose];
}
