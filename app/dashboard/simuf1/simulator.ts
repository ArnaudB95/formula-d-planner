import type { SimuF1CarRaceResult, SimuF1DiceLog, SimuF1Entry, SimuF1RaceResult } from "./types";
import { getCircuitConfigForWeekKey, getStatModifier, getStatMultiplier, profileLabel, type SimuF1StatKey } from "./circuit-config";

type RaceCar = {
  carId: string;
  ownerEmail: string;
  ownerPseudo: string;
  teamName: string;
  pilotName: string;
  bloc: number;
  grip: number;
  audace: number;
  defense: number;
  endurance: number;
  pneus: number;
  pitLaps: number[];
  dnf: boolean;
  dnfLap: number | null;
  lastPneusResetLap: number;
  pneusWearStacks: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const d100 = () => Math.floor(Math.random() * 100) + 1;

export const carBudgetUsed = (car: SimuF1Entry["cars"][number]) => {
  const stats = car.bloc + car.grip + car.audace + car.defense + car.endurance + car.pneus;
  return stats + car.pitStops;
};

export const validateCarSetup = (car: SimuF1Entry["cars"][number]) => {
  const stats = [car.bloc, car.grip, car.audace, car.defense, car.endurance, car.pneus];
  const statsInRange = stats.every((v) => v >= 1 && v <= 10);
  const pitStopsOk = car.pitStops >= 0 && car.pitStops <= 3;
  const pitLapsOk = car.pitLaps.length === car.pitStops && car.pitLaps.every((lap) => lap >= 1 && lap <= 9);
  const pitLapsStrictOrder = car.pitLaps.every((lap, i) => i === 0 || car.pitLaps[i - 1] < lap);
  return statsInRange && pitStopsOk && pitLapsOk && pitLapsStrictOrder && carBudgetUsed(car) === 31;
};

const gripEffect = (grip: number) => {
  const rules: Record<number, { chance: number; places: number; direction: "gain" | "lose" | "none" }> = {
    1: { chance: 80, places: 3, direction: "lose" },
    2: { chance: 60, places: 2, direction: "lose" },
    3: { chance: 40, places: 2, direction: "lose" },
    4: { chance: 20, places: 1, direction: "lose" },
    5: { chance: 0, places: 0, direction: "none" },
    6: { chance: 20, places: 1, direction: "gain" },
    7: { chance: 40, places: 1, direction: "gain" },
    8: { chance: 60, places: 2, direction: "gain" },
    9: { chance: 80, places: 2, direction: "gain" },
    10: { chance: 100, places: 3, direction: "gain" },
  };
  return rules[grip] || rules[5];
};

const audaceChance = (audace: number) => {
  if (audace >= 5) return 16 + (audace - 5) * 6.3;
  return Math.max(5, 16 - (5 - audace) * 2.5);
};

const defenseChance = (defense: number) => {
  if (defense >= 5) return 20 + (defense - 5) * 10;
  return Math.max(0, 20 - (5 - defense) * 5);
};

const enduranceBreakChance = (endurance: number) => {
  if (endurance >= 5) return Math.max(0.95, 2.1 - (endurance - 5) * 0.22);
  return 2.1 + (5 - endurance) * 0.4;
};

const pneusScore = (pneus: number) => 11 - pneus;

const ceilInt = (value: number) => Math.ceil(Math.max(0, value));

const blocDeltaWithCircuit = (value: number, modifier: "boosted" | "penalized" | "neutral") => {
  const base = value - 5;
  if (value === 5 || modifier === "neutral") return base;
  if (value > 5) {
    if (modifier === "boosted") return base * 1.5;
    return base / 2;
  }
  if (modifier === "boosted") return base / 2;
  return base * 1.5;
};

const gripFactorWithCircuit = (value: number, modifier: "boosted" | "penalized" | "neutral") => {
  if (value === 5 || modifier === "neutral") return 1;
  if (value > 5) {
    if (modifier === "boosted") return 1.5;
    return 0.5;
  }
  if (modifier === "boosted") return 1 / 0.5;
  return 1.5;
};

const enduranceFactorWithCircuit = (modifier: "boosted" | "penalized" | "neutral") => {
  if (modifier === "boosted") return 0.72;
  if (modifier === "penalized") return 1.3;
  return 1;
};

const applyGripGridMove = (
  grid: RaceCar[],
  index: number,
  circuit: ReturnType<typeof getCircuitConfigForWeekKey>
) => {
  const car = grid[index];
  const beforePos = index + 1;
  const effect = gripEffect(car.grip);
  const modifier = getStatModifier(circuit, "grip");
  const factor = gripFactorWithCircuit(car.grip, modifier);
  const chance = Math.max(0, Math.min(100, ceilInt(effect.chance * factor)));
  const places = Math.max(0, ceilInt(effect.places * factor));
  if (chance <= 0) {
    return {
      car,
      roll: null,
      chance,
      success: false,
      beforePos,
      afterPos: beforePos,
    };
  }

  const roll = d100();
  if (roll > chance) {
    return {
      car,
      roll,
      chance,
      success: false,
      beforePos,
      afterPos: beforePos,
    };
  }

  const step = places;
  const target = effect.direction === "gain" ? index - step : index + step;
  const nextIndex = clamp(target, 0, grid.length - 1);
  if (nextIndex === index) {
    return {
      car,
      roll,
      chance,
      success: true,
      beforePos,
      afterPos: beforePos,
    };
  }

  grid.splice(index, 1);
  grid.splice(nextIndex, 0, car);
  return {
    car,
    roll,
    chance,
    success: true,
    beforePos,
    afterPos: nextIndex + 1,
  };
};

const assignF1Points = (position: number) => {
  const table = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  return table[position - 1] || 0;
};

export const simulateRaceFromEntries = (
  raceId: string,
  seasonYear: number,
  entries: SimuF1Entry[],
  weekKey = ""
): SimuF1RaceResult => {
  const diceLogs: SimuF1DiceLog[] = [];
  const circuit = getCircuitConfigForWeekKey(weekKey);
  let seq = 0;
  const pushLog = (log: Omit<SimuF1DiceLog, "seq" | "createdAtISO">) => {
    seq += 1;
    diceLogs.push({
      seq,
      createdAtISO: new Date().toISOString(),
      ...log,
    });
  };

  const cars: RaceCar[] = [];

  entries.forEach((entry) => {
    if (!entry.participating) return;
    entry.cars.forEach((car, idx) => {
      if (!validateCarSetup(car)) return;
      cars.push({
        carId: `${entry.userEmail}__${idx + 1}`,
        ownerEmail: entry.userEmail,
        ownerPseudo: entry.userPseudo,
        teamName: entry.teamName,
        pilotName: car.pilotName,
        bloc: car.bloc,
        grip: car.grip,
        audace: car.audace,
        defense: car.defense,
        endurance: car.endurance,
        pneus: car.pneus,
        pitLaps: [...car.pitLaps].sort((a, b) => a - b),
        dnf: false,
        dnfLap: null,
        lastPneusResetLap: 1,
        pneusWearStacks: 0,
      });
    });
  });

  if (cars.length === 0) {
    return {
      raceId,
      seasonYear,
      generatedAtISO: new Date().toISOString(),
      cars: [],
      diceLogs: [],
    };
  }

  pushLog({
    phase: "qualif",
    lap: null,
    actorCarId: "system",
    actorPilotName: "System",
    stat: "bloc",
    roll: null,
    threshold: null,
    success: true,
    summary: `Circuit ${circuit.circuitName} (${profileLabel(circuit.profile)}): boosts ${circuit.boosted.join(", ")} | penalites ${circuit.penalized.join(", ")}`,
  });

  pushLog({
    phase: "qualif",
    lap: null,
    actorCarId: "system",
    actorPilotName: "System",
    stat: "pneus",
    roll: null,
    threshold: null,
    success: true,
    summary:
      "Regle pneus progressive (course de 10 tours): a chaque echec pneus, +1 stack usure. Chaque 2 stacks font perdre 1 place (arrondi inferieur) a la fin du tour. Pit stop autorise tours 1 a 9, et reset des stacks.",
  });

  const statModifierText = (stat: SimuF1StatKey) => {
    const mod = getStatModifier(circuit, stat);
    if (mod === "boosted") return "boost";
    if (mod === "penalized") return "penalite";
    return "normal x1";
  };

  let grid = [...cars].sort((a, b) => {
    const aTime = 100 + blocDeltaWithCircuit(a.bloc, getStatModifier(circuit, "bloc"));
    const bTime = 100 + blocDeltaWithCircuit(b.bloc, getStatModifier(circuit, "bloc"));
    if (aTime === bTime) return Math.random() > 0.5 ? 1 : -1;
    return aTime - bTime;
  });

  grid.forEach((car, idx) => {
    const delta = blocDeltaWithCircuit(car.bloc, getStatModifier(circuit, "bloc"));
    pushLog({
      phase: "qualif",
      lap: null,
      actorCarId: car.carId,
      actorPilotName: car.pilotName,
      stat: "bloc",
      roll: null,
      threshold: null,
      success: true,
      summary: `BLOC ${car.pilotName}: P${idx + 1} provisoire, delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}s (${statModifierText("bloc")})`,
    });
  });

  for (let i = 0; i < grid.length; i += 1) {
    const info = applyGripGridMove(grid, i, circuit);
    pushLog({
      phase: "qualif",
      lap: null,
      actorCarId: info.car.carId,
      actorPilotName: info.car.pilotName,
      stat: "grip",
      roll: info.roll,
      threshold: info.chance || null,
      success: info.success,
      summary: `GRIP ${info.car.pilotName}: P${info.beforePos} -> P${info.afterPos} (${statModifierText("grip")})`,
    });
  }

  const dnfs: RaceCar[] = [];

  for (let lap = 1; lap <= 10; lap += 1) {
    for (const car of grid) {
      if (car.dnf) continue;
      if (car.pitLaps.includes(lap)) {
        car.lastPneusResetLap = lap + 1;
        car.pneusWearStacks = 0;
        pushLog({
          phase: "course",
          lap,
          actorCarId: car.carId,
          actorPilotName: car.pilotName,
          stat: "pneus",
          roll: null,
          threshold: null,
          success: true,
          pneusWearStacks: car.pneusWearStacks,
          summary: `${car.pilotName} passe au stand: stacks pneus reset a 0`,
        });
      }
      const breakChance = Math.min(
        100,
        enduranceBreakChance(car.endurance) * enduranceFactorWithCircuit(getStatModifier(circuit, "endurance"))
      );
      const roll = d100();
      const broke = roll <= breakChance;
      pushLog({
        phase: "course",
        lap,
        actorCarId: car.carId,
        actorPilotName: car.pilotName,
        stat: "endurance",
        roll,
        threshold: breakChance,
        success: broke,
        summary: broke
            ? `${car.pilotName} abandonne (ENDURANCE, ${statModifierText("endurance")})`
            : `${car.pilotName} tient bon (ENDURANCE, ${statModifierText("endurance")})`,
      });
      if (broke) {
        car.dnf = true;
        car.dnfLap = lap;
      }
    }

    const active = grid.filter((c) => !c.dnf);
    const freshDnfs = grid.filter((c) => c.dnf && !dnfs.includes(c));
    dnfs.push(...freshDnfs);

    for (let i = active.length - 1; i >= 1; i -= 1) {
      const attacker = active[i];
      const defender = active[i - 1];
      const audaceThreshold = Math.min(100, ceilInt(audaceChance(attacker.audace) * getStatMultiplier(circuit, "audace")));
      const audaceRoll = d100();
      const audaceSuccess = audaceRoll <= audaceThreshold;
      pushLog({
        phase: "course",
        lap,
        actorCarId: attacker.carId,
        actorPilotName: attacker.pilotName,
        targetCarId: defender.carId,
        targetPilotName: defender.pilotName,
        stat: "audace",
        roll: audaceRoll,
        threshold: audaceThreshold,
        success: audaceSuccess,
        summary: `${attacker.pilotName} tente sur ${defender.pilotName}`,
      });
      if (audaceSuccess) {
        const defenseThreshold = Math.min(100, ceilInt(defenseChance(defender.defense) * getStatMultiplier(circuit, "defense")));
        const defenseRoll = d100();
        const defenseSuccess = defenseRoll <= defenseThreshold;
        pushLog({
          phase: "course",
          lap,
          actorCarId: defender.carId,
          actorPilotName: defender.pilotName,
          targetCarId: attacker.carId,
          targetPilotName: attacker.pilotName,
          stat: "defense",
          roll: defenseRoll,
          threshold: defenseThreshold,
          success: defenseSuccess,
          summary: defenseSuccess
            ? `${defender.pilotName} résiste à ${attacker.pilotName}`
            : `${defender.pilotName} cède face à ${attacker.pilotName}`,
        });
        if (!defenseSuccess) {
          active[i - 1] = attacker;
          active[i] = defender;
        }
      }
    }

    for (let i = 0; i < active.length; i += 1) {
      const car = active[i];
      const effectiveLap = Math.max(1, lap - car.lastPneusResetLap + 1);
      let effectivePneusScore = pneusScore(car.pneus);
      const pneusMod = getStatModifier(circuit, "pneus");
      if (pneusMod === "boosted") effectivePneusScore = Math.max(1, effectivePneusScore - 1);
      if (pneusMod === "penalized") effectivePneusScore += 1;
      const threshold = Math.min(100, effectivePneusScore * effectiveLap);
      const roll = d100();
      const success = roll <= threshold;
      if (success) car.pneusWearStacks += 1;
      pushLog({
        phase: "course",
        lap,
        actorCarId: car.carId,
        actorPilotName: car.pilotName,
        stat: "pneus",
        roll,
        threshold,
        success,
        pneusWearStacks: car.pneusWearStacks,
        summary: success
            ? `${car.pilotName} use ses pneus: stack ${car.pneusWearStacks} (PNEUS, ${statModifierText("pneus")})`
            : `${car.pilotName} gere ses pneus: stack ${car.pneusWearStacks} (PNEUS, ${statModifierText("pneus")})`,
      });
    }

    for (let i = active.length - 1; i >= 0; i -= 1) {
      const car = active[i];
      const drop = Math.floor(car.pneusWearStacks / 2);
      if (drop <= 0) continue;
      const nextIndex = clamp(i + drop, 0, active.length - 1);
      if (nextIndex === i) continue;
      active.splice(i, 1);
      active.splice(nextIndex, 0, car);
      pushLog({
        phase: "course",
        lap,
        actorCarId: car.carId,
        actorPilotName: car.pilotName,
        stat: "pneus",
        roll: null,
        threshold: null,
        success: true,
        pneusWearStacks: car.pneusWearStacks,
        pneusPlaceDrop: drop,
        summary: `${car.pilotName} perd ${drop} place(s) sur usure progressive (stack ${car.pneusWearStacks})`,
      });
    }

    grid = [...active, ...dnfs];
  }

  const finishers = grid.filter((c) => !c.dnf);
  const dnfSorted = grid
    .filter((c) => c.dnf)
    .sort((a, b) => (b.dnfLap || 0) - (a.dnfLap || 0));

  const finalOrder = [...finishers, ...dnfSorted];

  const results: SimuF1CarRaceResult[] = finalOrder.map((car, idx) => ({
    carId: car.carId,
    ownerEmail: car.ownerEmail,
    ownerPseudo: car.ownerPseudo,
    teamName: car.teamName,
    pilotName: car.pilotName,
    position: idx + 1,
    dnf: car.dnf,
    dnfLap: car.dnfLap,
    points: car.dnf ? 0 : assignF1Points(idx + 1),
  }));

  return {
    raceId,
    seasonYear,
    generatedAtISO: new Date().toISOString(),
    cars: results,
    diceLogs,
  };
};
