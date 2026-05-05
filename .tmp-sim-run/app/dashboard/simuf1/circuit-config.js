"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileLabel = exports.getStatMultiplier = exports.getStatModifier = exports.getCircuitConfigForWeekKey = exports.weekNumberFromWeekKey = void 0;
const byWeek = {
    1: { week: 1, circuitName: "Monza", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["grip", "defense"] },
    2: { week: 2, circuitName: "Monaco", profile: "urbain", boosted: ["grip", "defense"], penalized: ["audace", "bloc"] },
    3: { week: 3, circuitName: "Silverstone", profile: "mixte", boosted: ["pneus", "endurance"], penalized: ["bloc"] },
    4: { week: 4, circuitName: "Spa-Francorchamps", profile: "imprevisible", boosted: ["endurance", "pneus"], penalized: ["bloc", "audace"] },
    5: { week: 5, circuitName: "Barcelone", profile: "technique", boosted: ["grip", "defense"], penalized: ["audace"] },
    6: { week: 6, circuitName: "Hockenheim", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["grip"] },
    7: { week: 7, circuitName: "Nurburgring", profile: "imprevisible", boosted: ["endurance", "defense"], penalized: ["pneus", "bloc"] },
    8: { week: 8, circuitName: "Hungaroring", profile: "technique", boosted: ["grip", "defense"], penalized: ["bloc", "audace"] },
    9: { week: 9, circuitName: "Zandvoort", profile: "technique", boosted: ["grip", "pneus"], penalized: ["audace"] },
    10: { week: 10, circuitName: "Imola", profile: "mixte", boosted: ["defense", "endurance"], penalized: ["bloc"] },
    11: { week: 11, circuitName: "Suzuka", profile: "technique", boosted: ["grip", "defense", "pneus"], penalized: ["bloc"] },
    12: { week: 12, circuitName: "Paul Ricard", profile: "mixte", boosted: ["pneus", "bloc"], penalized: ["audace"] },
    13: { week: 13, circuitName: "Osterreichring", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["defense", "pneus"] },
    14: { week: 14, circuitName: "Brands Hatch", profile: "technique", boosted: ["grip", "defense"], penalized: ["bloc"] },
    15: { week: 15, circuitName: "Valence", profile: "urbain", boosted: ["defense", "endurance"], penalized: ["audace", "bloc"] },
    16: { week: 16, circuitName: "Magny-Cours", profile: "mixte", boosted: ["pneus", "defense"], penalized: ["bloc"] },
    17: { week: 17, circuitName: "Austin (COTA)", profile: "mixte", boosted: ["pneus", "bloc"], penalized: ["defense"] },
    18: { week: 18, circuitName: "Interlagos", profile: "imprevisible", boosted: ["endurance", "pneus"], penalized: ["bloc", "grip"] },
    19: { week: 19, circuitName: "Mexico City", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["endurance"] },
    20: { week: 20, circuitName: "Montreal", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["pneus", "grip"] },
    21: { week: 21, circuitName: "Miami", profile: "urbain", boosted: ["defense", "grip"], penalized: ["bloc"] },
    22: { week: 22, circuitName: "Las Vegas", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["grip", "endurance"] },
    23: { week: 23, circuitName: "Sao Paulo (Outer)", profile: "imprevisible", boosted: ["endurance", "defense"], penalized: ["pneus"] },
    24: { week: 24, circuitName: "Buenos Aires", profile: "mixte", boosted: ["grip", "pneus"], penalized: ["audace"] },
    25: { week: 25, circuitName: "Watkins Glen", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["defense"] },
    26: { week: 26, circuitName: "Indianapolis", profile: "rapide", boosted: ["bloc", "audace", "pneus"], penalized: ["grip"] },
    27: { week: 27, circuitName: "Bahrein", profile: "technique", boosted: ["grip", "endurance"], penalized: ["pneus", "bloc"] },
    28: { week: 28, circuitName: "Abou Dhabi", profile: "mixte", boosted: ["bloc", "defense"], penalized: ["pneus"] },
    29: { week: 29, circuitName: "Jeddah", profile: "urbain", boosted: ["bloc", "audace"], penalized: ["defense", "grip"] },
    30: { week: 30, circuitName: "Losail", profile: "technique", boosted: ["grip", "pneus"], penalized: ["audace", "bloc"] },
    31: { week: 31, circuitName: "Kyalami", profile: "imprevisible", boosted: ["endurance", "bloc"], penalized: ["pneus"] },
    32: { week: 32, circuitName: "Casablanca", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["grip", "endurance"] },
    33: { week: 33, circuitName: "Melbourne", profile: "urbain", boosted: ["defense", "grip"], penalized: ["bloc", "audace"] },
    34: { week: 34, circuitName: "Singapour", profile: "urbain", boosted: ["defense", "endurance"], penalized: ["bloc", "audace"] },
    35: { week: 35, circuitName: "Shanghai", profile: "mixte", boosted: ["pneus", "grip"], penalized: ["audace"] },
    36: { week: 36, circuitName: "Sepang", profile: "imprevisible", boosted: ["endurance", "pneus"], penalized: ["bloc"] },
    37: { week: 37, circuitName: "Yeongam", profile: "mixte", boosted: ["bloc", "defense"], penalized: ["pneus"] },
    38: { week: 38, circuitName: "Buddh", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["grip"] },
    39: { week: 39, circuitName: "Suzuka Est", profile: "technique", boosted: ["grip", "defense"], penalized: ["bloc", "audace"] },
    40: { week: 40, circuitName: "Fuji Speedway", profile: "imprevisible", boosted: ["endurance", "pneus"], penalized: ["audace"] },
    41: { week: 41, circuitName: "Baku", profile: "urbain", boosted: ["bloc", "audace"], penalized: ["defense", "grip"] },
    42: { week: 42, circuitName: "Hanoi", profile: "urbain", boosted: ["defense", "grip"], penalized: ["bloc"] },
    43: { week: 43, circuitName: "Circuit de la Cote", profile: "imprevisible", boosted: ["endurance", "defense"], penalized: ["pneus", "bloc"] },
    44: { week: 44, circuitName: "Circuit des Neiges", profile: "imprevisible", boosted: ["pneus", "defense"], penalized: ["bloc", "audace"] },
    45: { week: 45, circuitName: "Circuit du Desert", profile: "rapide", boosted: ["bloc", "audace"], penalized: ["endurance", "pneus"] },
    46: { week: 46, circuitName: "Circuit Nocturne", profile: "technique", boosted: ["grip", "endurance"], penalized: ["audace"] },
    47: { week: 47, circuitName: "Circuit de l'Ile", profile: "mixte", boosted: ["pneus", "grip"], penalized: ["bloc"] },
    48: { week: 48, circuitName: "Circuit Alpestre", profile: "technique", boosted: ["endurance", "defense"], penalized: ["bloc", "audace"] },
    49: { week: 49, circuitName: "Circuit Volcanique", profile: "imprevisible", boosted: ["endurance", "pneus"], penalized: ["bloc", "grip"] },
    50: { week: 50, circuitName: "Circuit Urbain Nuit", profile: "urbain", boosted: ["defense", "grip"], penalized: ["bloc", "audace"] },
    51: { week: 51, circuitName: "Piste de l'Avenir", profile: "rapide", boosted: ["bloc", "audace", "endurance"], penalized: ["pneus"] },
    52: { week: 52, circuitName: "Grand Final", profile: "mixte", boosted: ["bloc", "grip", "audace"], penalized: ["endurance", "pneus"] },
};
const weekRegex = /W(\d{1,2})/i;
const weekNumberFromWeekKey = (weekKey) => {
    const match = String(weekKey || "").match(weekRegex);
    const week = Number(match?.[1] || "1");
    if (!Number.isFinite(week) || week < 1)
        return 1;
    return ((week - 1) % 52) + 1;
};
exports.weekNumberFromWeekKey = weekNumberFromWeekKey;
const getCircuitConfigForWeekKey = (weekKey) => {
    const week = (0, exports.weekNumberFromWeekKey)(weekKey);
    return byWeek[week] || byWeek[1];
};
exports.getCircuitConfigForWeekKey = getCircuitConfigForWeekKey;
const getStatModifier = (config, stat) => {
    if (config.boosted.includes(stat))
        return "boosted";
    if (config.penalized.includes(stat))
        return "penalized";
    return "neutral";
};
exports.getStatModifier = getStatModifier;
const getStatMultiplier = (config, stat) => {
    const modifier = (0, exports.getStatModifier)(config, stat);
    if (modifier === "boosted")
        return 1.5;
    if (modifier === "penalized")
        return 0.5;
    return 1;
};
exports.getStatMultiplier = getStatMultiplier;
const profileLabel = (profile) => {
    if (profile === "rapide")
        return "Rapide";
    if (profile === "technique")
        return "Technique";
    if (profile === "mixte")
        return "Mixte";
    if (profile === "imprevisible")
        return "Imprevisible";
    return "Urbain";
};
exports.profileLabel = profileLabel;
