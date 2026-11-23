export const WIDGET_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export const WIDGET_ANIMATIONS = ["fade", "slide", "scale"] as const;

export type Plan = "free" | "pro";

type PlanLimits = {
  readonly projects: number;
  readonly messagesPerMonth: number;
  readonly knowledgeSources: number;
  readonly widget: {
    readonly customButtonColor: boolean;
    readonly positions: readonly (typeof WIDGET_POSITIONS)[number][];
    readonly customLabel: boolean;
    readonly animations: readonly (typeof WIDGET_ANIMATIONS)[number][];
    readonly customHeaderText: boolean;
    readonly canHideBadge: boolean;
  };
};

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  free: {
    projects: 1,
    messagesPerMonth: 100,
    knowledgeSources: 3,
    widget: {
      customButtonColor: false,
      positions: ["bottom-right"],
      customLabel: false,
      animations: ["fade"],
      customHeaderText: false,
      canHideBadge: false,
    },
  },
  pro: {
    projects: 5,
    messagesPerMonth: 2_000,
    knowledgeSources: 25,
    widget: {
      customButtonColor: true,
      positions: WIDGET_POSITIONS,
      customLabel: true,
      animations: WIDGET_ANIMATIONS,
      customHeaderText: true,
      canHideBadge: true,
    },
  },
};
