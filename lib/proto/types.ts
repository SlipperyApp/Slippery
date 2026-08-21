export type ProtoCur = {
  view: string;
  theme: string;
  oddsFmt: string;
  showIn: string;
  per: string;
  weekStart: number;
  calDates: boolean;
  signedIn: boolean;
  [key: string]: unknown;
};

export type ProtoApi = {
  go: (view: string) => void;
  sheet: (key: string) => void;
  toast: (message: string, undo?: boolean) => void;
  closeSheet: () => void;
  repaint: () => void;
  cur: ProtoCur;
  views: Record<string, unknown>;
  sheets: Record<string, unknown>;
  groups: [string, [string, string][]][];
  setTheme: (theme: string) => void;
  startTutorial: () => void;
  tutorialSteps: number;
  hydrateLedger: () => Promise<boolean>;
  setHeroAnim: (name: string) => void;
  hydrate: (patch: Partial<ProtoCur>) => void;
};
