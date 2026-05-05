import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCircuitConfigForWeekKey } from "./app/dashboard/simuf1/circuit-config";
import { simulateRaceFromEntries } from "./app/dashboard/simuf1/simulator";
import type { SimuF1Entry, SimuF1CarSetup, SimuF1RaceResult } from "./app/dashboard/simuf1/types";

type RacePack = {
  raceId: string;
  weekKey: string;
  circuitName: string;
  participants: SimuF1Entry[];
  result: SimuF1RaceResult;
};

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[rnd(0, arr.length - 1)];

const pseudonyms = ["Aster", "Nova", "Rivet", "Orion", "Flint", "Lyra", "Kairo", "Mistral", "Vega", "Soren"];
const teams = ["Falcon Works", "Polar Apex", "Titan Lane", "Crimson Torque", "Helios GP", "Arc Nova"];
const pilotNames = ["L. Martin", "I. Rossi", "N. Duval", "S. Kova", "E. Hayashi", "P. Novak", "R. Silva", "J. Hart"];

const randomPitLaps = (pitStops: number) => {
  const laps = new Set<number>();
  while (laps.size < pitStops) {
    laps.add(rnd(1, 10));
  }
  return Array.from(laps).sort((a, b) => a - b);
};

const randomCarSetup = (pilotName: string): SimuF1CarSetup => {
  const statKeys: Array<keyof Omit<SimuF1CarSetup, "pilotName" | "pitStops" | "pitLaps">> = [
    "bloc",
    "grip",
    "audace",
    "defense",
    "endurance",
    "pneus",
  ];

  const stats: Record<string, number> = {
    bloc: 1,
    grip: 1,
    audace: 1,
    defense: 1,
    endurance: 1,
    pneus: 1,
  };

  const pitStops = rnd(0, 3);
  const targetStatsTotal = 31 - pitStops;
  let pointsLeft = targetStatsTotal - 6;
  while (pointsLeft > 0) {
    const k = pick(statKeys);
    if (stats[k] < 10) {
      stats[k] += 1;
      pointsLeft -= 1;
    }
  }

  const pitLaps = randomPitLaps(pitStops);

  return {
    pilotName,
    bloc: stats.bloc,
    grip: stats.grip,
    audace: stats.audace,
    defense: stats.defense,
    endurance: stats.endurance,
    pneus: stats.pneus,
    pitStops,
    pitLaps,
  };
};

const generateParticipants = (raceId: string, seasonYear: number, count: number): SimuF1Entry[] => {
  const usedPseudos = new Set<string>();
  const entries: SimuF1Entry[] = [];

  for (let i = 0; i < count; i += 1) {
    let pseudo = pick(pseudonyms);
    while (usedPseudos.has(pseudo)) {
      pseudo = pick(pseudonyms);
    }
    usedPseudos.add(pseudo);

    const teamName = `${pick(teams)} ${i + 1}`;
    const pilot1 = randomCarSetup(`${pick(pilotNames)} #${i + 1}A`);
    const pilot2 = randomCarSetup(`${pick(pilotNames)} #${i + 1}B`);

    entries.push({
      raceId,
      seasonYear,
      userEmail: `${pseudo.toLowerCase()}@simu.local`,
      userPseudo: pseudo,
      teamName,
      participating: true,
      cars: [pilot1, pilot2],
    });
  }

  return entries;
};

const weekKeys = ["S1-W02", "S1-W11", "S1-W18"];
const seasonYear = 2026;

const races: RacePack[] = weekKeys.map((weekKey, idx) => {
  const raceId = `SIMU-${idx + 1}`;
  const participantsCount = rnd(3, 6);
  const participants = generateParticipants(raceId, seasonYear, participantsCount);
  const result = simulateRaceFromEntries(raceId, seasonYear, participants, weekKey);
  const circuit = getCircuitConfigForWeekKey(weekKey);

  return {
    raceId,
    weekKey,
    circuitName: circuit.circuitName,
    participants,
    result,
  };
});

const summarizeRace = (pack: RacePack) => {
  const totalCars = pack.result.cars.length;
  const dnfs = pack.result.cars.filter((c) => c.dnf).length;
  const finishers = totalCars - dnfs;
  const avgPointsTop3 =
    pack.result.cars.slice(0, 3).reduce((acc, c) => acc + c.points, 0) / Math.max(1, Math.min(3, totalCars));

  const audaceAttempts = pack.result.diceLogs.filter((d) => d.stat === "audace").length;
  const audaceSuccess = pack.result.diceLogs.filter((d) => d.stat === "audace" && d.success).length;
  const defenseSuccess = pack.result.diceLogs.filter((d) => d.stat === "defense" && d.success).length;
  const pneusFailures = pack.result.diceLogs.filter((d) => d.stat === "pneus" && d.success).length;

  const participantStats = pack.participants.flatMap((p) => p.cars).reduce(
    (acc, car) => {
      acc.bloc += car.bloc;
      acc.grip += car.grip;
      acc.audace += car.audace;
      acc.defense += car.defense;
      acc.endurance += car.endurance;
      acc.pneus += car.pneus;
      return acc;
    },
    { bloc: 0, grip: 0, audace: 0, defense: 0, endurance: 0, pneus: 0 }
  );

  const divisor = Math.max(1, pack.participants.length * 2);

  return {
    totalCars,
    dnfs,
    finishers,
    dnfRate: (dnfs / Math.max(1, totalCars)) * 100,
    avgPointsTop3,
    audaceAttempts,
    audaceSuccess,
    defenseSuccess,
    pneusFailures,
    avgStats: {
      bloc: participantStats.bloc / divisor,
      grip: participantStats.grip / divisor,
      audace: participantStats.audace / divisor,
      defense: participantStats.defense / divisor,
      endurance: participantStats.endurance / divisor,
      pneus: participantStats.pneus / divisor,
    },
  };
};

const raceSummaries = races.map((r) => ({
  ...r,
  summary: summarizeRace(r),
}));

const globalCars = raceSummaries.reduce((acc, r) => acc + r.summary.totalCars, 0);
const globalDnfs = raceSummaries.reduce((acc, r) => acc + r.summary.dnfs, 0);
const globalAudaceAttempts = raceSummaries.reduce((acc, r) => acc + r.summary.audaceAttempts, 0);
const globalAudaceSuccess = raceSummaries.reduce((acc, r) => acc + r.summary.audaceSuccess, 0);

const lines: string[] = [];
lines.push("RAPPORT DE SIMULATION SIMUF1");
lines.push("Date: 2026-04-30");
lines.push("Scenario: 3 courses, participants fictifs (3 a 6), 2 voitures chacun, 3 circuits differents");
lines.push("");

for (const race of raceSummaries) {
  lines.push(`=== ${race.raceId} | ${race.circuitName} (${race.weekKey}) ===`);
  lines.push(`Participants: ${race.participants.length} (voitures: ${race.summary.totalCars})`);
  lines.push("Stats moyennes des voitures engagees:");
  lines.push(
    `  BLOC ${race.summary.avgStats.bloc.toFixed(2)} | GRIP ${race.summary.avgStats.grip.toFixed(2)} | AUDACE ${race.summary.avgStats.audace.toFixed(2)} | DEFENSE ${race.summary.avgStats.defense.toFixed(2)} | ENDURANCE ${race.summary.avgStats.endurance.toFixed(2)} | PNEUS ${race.summary.avgStats.pneus.toFixed(2)}`
  );
  lines.push("Classement final:");

  race.result.cars.forEach((car) => {
    const status = car.dnf ? `DNF (tour ${car.dnfLap})` : "Arrivee";
    lines.push(
      `  P${car.position} - ${car.pilotName} [${car.teamName}] | ${status} | points=${car.points}`
    );
  });

  lines.push("Indicateurs course:");
  lines.push(
    `  DNF: ${race.summary.dnfs}/${race.summary.totalCars} (${race.summary.dnfRate.toFixed(1)}%) | tentatives audace=${race.summary.audaceAttempts} | audace reussie=${race.summary.audaceSuccess} | defenses reussies=${race.summary.defenseSuccess} | pertes adherence pneus=${race.summary.pneusFailures}`
  );
  lines.push("");
}

lines.push("=== ANALYSE SYNTHETIQUE ===");
lines.push(
  `Au global, ${globalCars} voitures ont pris le depart et ${globalDnfs} ont abandonne (${((globalDnfs / Math.max(1, globalCars)) * 100).toFixed(1)}%).`
);
lines.push(
  `Le ratio de succes des attaques AUDACE est de ${globalAudaceSuccess}/${Math.max(1, globalAudaceAttempts)} (${((globalAudaceSuccess / Math.max(1, globalAudaceAttempts)) * 100).toFixed(1)}%).`
);
lines.push("Constats:");
lines.push("1) Le poids de l'ENDURANCE est structurellement tres fort: chaque tour force un test de casse pour toutes les voitures actives.");
lines.push("2) Les pneus provoquent de nombreuses permutations, ce qui augmente la variabilite meme sans duel AUDACE/DEFENSE.");
lines.push("3) Les bonus/malus circuit orientent clairement les profils performants, mais l'effet aleatoire des jets reste dominant a court echantillon (3 courses).");
lines.push("");
lines.push("=== CRITIQUE EXPERTE DE LA QUALITE DE SIMULATION ===");
lines.push("Points solides:");
lines.push("- Le systeme est transparent (logs de des complets par phase/stat) et donc audit-able.");
lines.push("- Les regles sont coherentes avec un jeu de gestion: qualification statique, course dynamique, interactions attacker/defender.");
lines.push("- L'influence du circuit est multidimensionnelle (boost/penalite) et lisible pour les joueurs.");
lines.push("Limites methodologiques observees:");
lines.push("- Echantillon faible: 3 courses ne permettent pas d'estimer une meta stable ni d'evaluer l'equilibrage fin.");
lines.push("- Variables non modelisees: meteo, incidents multi-voitures, safety car, usure differenciee selon style de pilotage.");
lines.push("- Distribution des stats aleatoires non representee des comportements joueurs reels (optimisation, archetypes de build)." );
lines.push("- Le classement inclut toujours les DNF en fin d'ordre, mais leur score est fixe a 0 point.");
lines.push("Niveau de confiance sur cette simulation ponctuelle: moyen-faible pour equilibrage global, moyen pour verifier la coherence mecanique." );

const reportPath = resolve(process.cwd(), "simuf1_rapport_simulation_2026-04-30.txt");
writeFileSync(reportPath, lines.join("\n"), "utf8");

console.log(`Report generated: ${reportPath}`);
