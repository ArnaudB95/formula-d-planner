export type SimuF1RaceStatus = "draft" | "open" | "locked" | "simulated" | "published";

export type SimuF1CarSetup = {
  pilotName: string;
  bloc: number;
  grip: number;
  audace: number;
  defense: number;
  endurance: number;
  pneus: number;
  pitStops: number;
  pitLaps: number[];
};

export type SimuF1Entry = {
  raceId: string;
  seasonYear: number;
  userEmail: string;
  userPseudo: string;
  teamName: string;
  participating: boolean;
  cars: [SimuF1CarSetup, SimuF1CarSetup];
  updatedAt?: any;
};

export type SimuF1Race = {
  id: string;
  seasonYear: number;
  weekKey: string;
  sundayDateISO: string;
  circuitName?: string;
  circuitProfile?: string;
  boostedStats?: Array<"bloc" | "grip" | "audace" | "defense" | "endurance" | "pneus">;
  penalizedStats?: Array<"bloc" | "grip" | "audace" | "defense" | "endurance" | "pneus">;
  status: SimuF1RaceStatus;
  createdAt?: any;
  updatedAt?: any;
};

export type SimuF1CarRaceResult = {
  carId: string;
  ownerEmail: string;
  ownerPseudo: string;
  teamName: string;
  pilotName: string;
  position: number;
  dnf: boolean;
  dnfLap: number | null;
  points: number;
};

export type SimuF1DiceLog = {
  seq: number;
  phase: "qualif" | "course";
  lap: number | null;
  actorCarId: string;
  actorPilotName: string;
  targetCarId?: string;
  targetPilotName?: string;
  stat: "bloc" | "grip" | "audace" | "defense" | "endurance" | "pneus";
  roll: number | null;
  threshold: number | null;
  success: boolean;
  pneusWearStacks?: number;
  pneusPlaceDrop?: number;
  summary: string;
  createdAtISO: string;
};

export type SimuF1RaceResult = {
  raceId: string;
  seasonYear: number;
  generatedAtISO: string;
  generatedAt?: any;
  cars: SimuF1CarRaceResult[];
  diceLogs: SimuF1DiceLog[];
};

export type SimuF1SeasonStandings = {
  seasonYear: number;
  updatedAt?: any;
  teams: Record<string, number>;
  drivers: Record<string, number>;
};

export type SimuF1PilotProfile = {
  userEmail: string;
  pilot1Name: string;
  pilot2Name: string;
  updatedAt?: any;
};

export type SimuF1RaceHistoryItem = {
  id: string;
  seasonYear: number;
  weekKey: string;
  sundayDateISO: string;
  circuitName?: string;
  status: SimuF1RaceStatus;
};
