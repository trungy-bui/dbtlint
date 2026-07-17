"use client";

import {
  motion,
  useAnimationFrame,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

type NodeTone = "pass" | "warn" | "fail" | "test" | "skipped";

type ModelNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  tone?: NodeTone;
  detail?: string;
  quietOnMobile?: boolean;
};

type Position = {
  x: number;
  y: number;
};

type Velocity = {
  x: number;
  y: number;
};

type ActiveConnection = {
  fromIndex: number;
  toIndex: number;
  startedAt: number;
};

type RenderedConnection = ActiveConnection & {
  progress: number;
};

type AnimationFrameState = {
  positions: Position[];
  connection: RenderedConnection | null;
};

type NodeMotion = {
  glowOpacity: number;
  sweepDelay: number;
};

type NodeVisuals = {
  accent: string;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  dot: string;
  dotOpacity: number;
  label: string;
  detail: string;
};

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 720;
const NODE_WIDTH = 136;
const NODE_HEIGHT = 38;
const MIN_SPEED = 8;
const MAX_SPEED = 15;
const CONNECTION_DURATION = 2_200;
const CONNECTION_INTERVAL = 5_200;
const NODE_SWEEP_DURATION = 0.22;
const NODE_SWEEP_INTERVAL = 12;

const nodeVisuals = {
  neutral: {
    accent: "#94a3b8",
    fill: "#0f172a",
    fillOpacity: 0.72,
    stroke: "#475569",
    strokeOpacity: 0.56,
    dot: "#64748b",
    dotOpacity: 0.7,
    label: "#94a3b8",
    detail: "#94a3b8",
  },
  pass: {
    accent: "#34d399",
    fill: "#052e2b",
    fillOpacity: 0.82,
    stroke: "#34d399",
    strokeOpacity: 0.62,
    dot: "#34d399",
    dotOpacity: 0.9,
    label: "#a7f3d0",
    detail: "#6ee7b7",
  },
  warn: {
    accent: "#fbbf24",
    fill: "#2d2305",
    fillOpacity: 0.72,
    stroke: "#fbbf24",
    strokeOpacity: 0.48,
    dot: "#fbbf24",
    dotOpacity: 0.7,
    label: "#fde68a",
    detail: "#fcd34d",
  },
  fail: {
    accent: "#fb7185",
    fill: "#2b1018",
    fillOpacity: 0.76,
    stroke: "#fb7185",
    strokeOpacity: 0.58,
    dot: "#fb7185",
    dotOpacity: 0.82,
    label: "#fecdd3",
    detail: "#fda4af",
  },
  test: {
    accent: "#38bdf8",
    fill: "#082f49",
    fillOpacity: 0.76,
    stroke: "#38bdf8",
    strokeOpacity: 0.56,
    dot: "#38bdf8",
    dotOpacity: 0.82,
    label: "#bae6fd",
    detail: "#7dd3fc",
  },
  skipped: {
    accent: "#94a3b8",
    fill: "#0f172a",
    fillOpacity: 0.62,
    stroke: "#64748b",
    strokeOpacity: 0.5,
    dot: "#64748b",
    dotOpacity: 0.56,
    label: "#94a3b8",
    detail: "#94a3b8",
  },
} satisfies Record<NodeTone | "neutral", NodeVisuals>;

const nodes: ModelNode[] = [
  {
    id: "seed-product-categories",
    label: "seed_product_cats.csv",
    x: 70,
    y: 50,
    tone: "pass",
    detail: "PASS",
    quietOnMobile: true,
  },
  { id: "raw-orders", label: "raw.orders", x: 18, y: 146 },
  {
    id: "raw-payments",
    label: "raw.payments",
    x: 18,
    y: 306,
    quietOnMobile: true,
  },
  {
    id: "raw-customers",
    label: "raw.customers",
    x: 18,
    y: 466,
    quietOnMobile: true,
  },
  {
    id: "seed-countries",
    label: "seed_countries.csv",
    x: 18,
    y: 606,
    tone: "pass",
    detail: "PASS",
    quietOnMobile: true,
  },
  { id: "stg-orders", label: "stg_orders.sql", x: 248, y: 124 },
  {
    id: "stg-products",
    label: "stg_products.sql",
    x: 270,
    y: 50,
    quietOnMobile: true,
  },
  {
    id: "stg-payments",
    label: "stg_payments.sql",
    x: 248,
    y: 284,
    quietOnMobile: true,
  },
  {
    id: "stg-customers",
    label: "stg_customers.sql",
    x: 248,
    y: 488,
    quietOnMobile: true,
  },
  {
    id: "stg-legacy-customers",
    label: "stg_legacy.sql",
    x: 248,
    y: 602,
    tone: "skipped",
    detail: "SKIP",
    quietOnMobile: true,
  },
  { id: "int-orders", label: "int_orders.sql", x: 478, y: 190 },
  {
    id: "int-order-items",
    label: "int_order_items.sql",
    x: 500,
    y: 80,
    quietOnMobile: true,
  },
  {
    id: "int-revenue",
    label: "int_revenue.sql",
    x: 478,
    y: 350,
    tone: "warn",
    detail: "L016",
  },
  {
    id: "int-shipping",
    label: "int_shipping.sql",
    x: 478,
    y: 430,
    tone: "fail",
    detail: "L003",
  },
  {
    id: "int-customers",
    label: "int_customers.sql",
    x: 478,
    y: 510,
    quietOnMobile: true,
  },
  {
    id: "snap-orders",
    label: "snap_orders.sql",
    x: 478,
    y: 606,
    tone: "pass",
    detail: "PASS",
    quietOnMobile: true,
  },
  {
    id: "snap-customers",
    label: "snap_customers.sql",
    x: 610,
    y: 642,
    tone: "pass",
    detail: "PASS",
    quietOnMobile: true,
  },
  { id: "fct-orders", label: "fct_orders.sql", x: 722, y: 172 },
  { id: "fct-revenue", label: "fct_revenue.sql", x: 722, y: 332 },
  {
    id: "dim-products",
    label: "dim_products.sql",
    x: 760,
    y: 60,
    quietOnMobile: true,
  },
  {
    id: "dim-customers",
    label: "dim_customers.sql",
    x: 722,
    y: 492,
    quietOnMobile: true,
  },
  {
    id: "fct-customer-ltv",
    label: "fct_customer_ltv.sql",
    x: 820,
    y: 620,
    quietOnMobile: true,
  },
  {
    id: "quality-gate",
    label: "quality_gate",
    x: 968,
    y: 252,
    tone: "pass",
    detail: "PASS",
  },
  {
    id: "test-unique-order-id",
    label: "test_unique_id",
    x: 968,
    y: 412,
    tone: "test",
    detail: "RUNNING",
  },
  {
    id: "test-not-null-order-id",
    label: "test_not_null_id",
    x: 1040,
    y: 570,
    tone: "test",
    detail: "RUNNING",
    quietOnMobile: true,
  },
];

// These pairs express likely lineage, but are only sampled for transient checks.
// They are deliberately not rendered as a permanent graph.
const flowPairs = [
  ["seed-product-categories", "stg-products"],
  ["raw-orders", "stg-orders"],
  ["raw-payments", "stg-payments"],
  ["raw-customers", "stg-customers"],
  ["raw-customers", "stg-legacy-customers"],
  ["seed-countries", "dim-customers"],
  ["stg-orders", "int-orders"],
  ["stg-orders", "int-order-items"],
  ["stg-products", "int-order-items"],
  ["stg-products", "dim-products"],
  ["stg-orders", "int-revenue"],
  ["stg-orders", "int-shipping"],
  ["stg-payments", "int-revenue"],
  ["stg-customers", "int-customers"],
  ["int-orders", "fct-orders"],
  ["int-order-items", "fct-orders"],
  ["int-orders", "fct-revenue"],
  ["int-revenue", "fct-revenue"],
  ["int-shipping", "fct-orders"],
  ["int-customers", "dim-customers"],
  ["raw-orders", "snap-orders"],
  ["raw-customers", "snap-customers"],
  ["snap-customers", "dim-customers"],
  ["int-customers", "fct-customer-ltv"],
  ["int-revenue", "fct-customer-ltv"],
  ["fct-orders", "quality-gate"],
  ["fct-orders", "test-unique-order-id"],
  ["fct-orders", "test-not-null-order-id"],
  ["fct-revenue", "quality-gate"],
  ["dim-products", "quality-gate"],
  ["fct-customer-ltv", "quality-gate"],
  ["dim-customers", "quality-gate"],
] as const;

const nodeIndexById = new Map(nodes.map((node, index) => [node.id, index]));

const connectionCandidates = flowPairs.flatMap(([fromId, toId]) => {
  const fromIndex = nodeIndexById.get(fromId);
  const toIndex = nodeIndexById.get(toId);

  return fromIndex === undefined || toIndex === undefined
    ? []
    : [{ fromIndex, toIndex }];
});

const initialPositions = () => nodes.map((node) => ({ x: node.x, y: node.y }));

function createVelocities(): Velocity[] {
  return nodes.map(() => {
    const angle = Math.random() * Math.PI * 2;
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);

    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
  });
}

function pickConnection(positions: Position[]) {
  const nearestPlausiblePairs = connectionCandidates
    .map((candidate) => {
      const from = positions[candidate.fromIndex];
      const to = positions[candidate.toIndex];
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      return { ...candidate, distanceSquared: dx * dx + dy * dy };
    })
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .slice(0, 4);

  return nearestPlausiblePairs[
    Math.floor(Math.random() * nearestPlausiblePairs.length)
  ];
}

function routeGlow(progress: number) {
  if (progress < 0.12) return (progress / 0.12) * 0.42;
  if (progress < 0.72) return 0.42 - ((progress - 0.12) / 0.6) * 0.16;
  return Math.max(0, ((1 - progress) / 0.28) * 0.26);
}

function lintPass(progress: number) {
  const travel = Math.min(1, Math.max(0, (progress - 0.08) / 0.78));
  const opacity =
    progress < 0.12
      ? progress / 0.12
      : progress > 0.88
        ? (1 - progress) / 0.12
        : 0.9;

  return { opacity: Math.max(0, opacity), travel };
}

const nodeSweep: Variants = {
  rest: { scale: 1 },
  active: ({ sweepDelay }: NodeMotion) => ({
    scale: [1, 1.028, 1],
    transition: {
      delay: sweepDelay,
      duration: NODE_SWEEP_DURATION,
      ease: [0.16, 1, 0.3, 1],
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: NODE_SWEEP_INTERVAL - NODE_SWEEP_DURATION,
      times: [0, 0.45, 1],
    },
  }),
};

const nodeGlow: Variants = {
  rest: { opacity: 0 },
  active: ({ glowOpacity, sweepDelay }: NodeMotion) => ({
    opacity: [0, glowOpacity, 0],
    transition: {
      delay: sweepDelay,
      duration: NODE_SWEEP_DURATION,
      ease: [0.16, 1, 0.3, 1],
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: NODE_SWEEP_INTERVAL - NODE_SWEEP_DURATION,
      times: [0, 0.45, 1],
    },
  }),
};

function getNodeMotion(node: ModelNode, index: number): NodeMotion {
  return {
    glowOpacity: node.tone ? 0.52 : 0.34,
    sweepDelay: 2 + (index % 5) * 0.38 + Math.floor(index / 5) * 0.06,
  };
}

export function DagBackground({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState<AnimationFrameState>(() => ({
    positions: initialPositions(),
    connection: null,
  }));
  const simulation = useRef<{
    positions: Position[];
    velocities: Velocity[];
    connection: ActiveConnection | null;
    nextConnectionAt: number | null;
  }>({
    positions: initialPositions(),
    velocities: [],
    connection: null,
    nextConnectionAt: null,
  });

  useEffect(() => {
    const positions = initialPositions();

    simulation.current = {
      positions,
      velocities: reduceMotion === false ? createVelocities() : [],
      connection: null,
      nextConnectionAt: null,
    };
    setFrame({ positions, connection: null });
  }, [reduceMotion]);

  useAnimationFrame((time, delta) => {
    if (reduceMotion !== false) return;

    const current = simulation.current;
    if (current.velocities.length !== nodes.length) return;

    const elapsedSeconds = Math.min(delta, 50) / 1_000;

    current.positions.forEach((position, index) => {
      const velocity = current.velocities[index];
      position.x += velocity.x * elapsedSeconds;
      position.y += velocity.y * elapsedSeconds;

      if (position.x <= 0 && velocity.x < 0) {
        position.x = 0;
        velocity.x *= -1;
      } else if (position.x >= VIEWBOX_WIDTH - NODE_WIDTH && velocity.x > 0) {
        position.x = VIEWBOX_WIDTH - NODE_WIDTH;
        velocity.x *= -1;
      }

      if (position.y <= 0 && velocity.y < 0) {
        position.y = 0;
        velocity.y *= -1;
      } else if (position.y >= VIEWBOX_HEIGHT - NODE_HEIGHT && velocity.y > 0) {
        position.y = VIEWBOX_HEIGHT - NODE_HEIGHT;
        velocity.y *= -1;
      }
    });

    if (current.nextConnectionAt === null) {
      current.nextConnectionAt = time + 1_600;
    } else if (!current.connection && time >= current.nextConnectionAt) {
      const pair = pickConnection(current.positions);

      if (pair) {
        current.connection = { ...pair, startedAt: time };
      }

      current.nextConnectionAt =
        time + CONNECTION_INTERVAL + Math.random() * 1_200;
    }

    let connection: RenderedConnection | null = null;

    if (current.connection) {
      const progress =
        (time - current.connection.startedAt) / CONNECTION_DURATION;

      if (progress >= 1) {
        current.connection = null;
      } else {
        connection = {
          ...current.connection,
          progress: Math.max(0, progress),
        };
      }
    }

    setFrame({
      positions: current.positions.map((position) => ({ ...position })),
      connection,
    });
  });

  const nodeMotionState = reduceMotion === false ? "active" : "rest";
  const activeConnection = frame.connection;
  const connectionFrom = activeConnection
    ? frame.positions[activeConnection.fromIndex]
    : null;
  const connectionTo = activeConnection
    ? frame.positions[activeConnection.toIndex]
    : null;
  const connectionIsQuiet = activeConnection
    ? nodes[activeConnection.fromIndex].quietOnMobile ||
      nodes[activeConnection.toIndex].quietOnMobile
    : false;
  const pulse = activeConnection ? lintPass(activeConnection.progress) : null;
  const startX = connectionFrom ? connectionFrom.x + NODE_WIDTH / 2 : 0;
  const startY = connectionFrom ? connectionFrom.y + NODE_HEIGHT / 2 : 0;
  const endX = connectionTo ? connectionTo.x + NODE_WIDTH / 2 : 0;
  const endY = connectionTo ? connectionTo.y + NODE_HEIGHT / 2 : 0;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-hidden ${className}`}
    >
      <svg
        className="absolute inset-0 size-full opacity-35 sm:opacity-50"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      >
        <title>Ambient dbt model dependency graph</title>
        <defs>
          <filter
            height="500%"
            id="dag-activity-glow"
            width="500%"
            x="-200%"
            y="-200%"
          >
            <feGaussianBlur result="blur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            height="180%"
            id="dag-node-glow"
            width="140%"
            x="-20%"
            y="-40%"
          >
            <feGaussianBlur result="blur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {activeConnection && connectionFrom && connectionTo && pulse && (
          <g
            className={connectionIsQuiet ? "hidden sm:block" : undefined}
            fill="none"
          >
            <line
              pathLength="1"
              stroke="#34d399"
              strokeDasharray="1"
              strokeDashoffset={
                1 - Math.min(1, activeConnection.progress / 0.22)
              }
              strokeLinecap="round"
              strokeOpacity={routeGlow(activeConnection.progress)}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              x1={startX}
              x2={endX}
              y1={startY}
              y2={endY}
            />
            <circle
              cx={startX + (endX - startX) * pulse.travel}
              cy={startY + (endY - startY) * pulse.travel}
              fill="#6ee7b7"
              fillOpacity={pulse.opacity}
              filter="url(#dag-activity-glow)"
              r="3"
            />
          </g>
        )}

        <g>
          {nodes.map((node, index) => {
            const visuals = nodeVisuals[node.tone ?? "neutral"];
            const isSkipped = node.tone === "skipped";
            const baseGlowOpacity =
              node.tone && node.tone !== "skipped" ? 0.15 : 0.07;
            const nodeMotion = getNodeMotion(node, index);
            const position = frame.positions[index];

            return (
              <g
                className={node.quietOnMobile ? "hidden sm:block" : undefined}
                key={node.id}
                transform={`translate(${position.x} ${position.y})`}
              >
                <motion.g
                  animate={nodeMotionState}
                  custom={nodeMotion}
                  initial={false}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                  variants={nodeSweep}
                >
                  <rect
                    fill="none"
                    filter="url(#dag-node-glow)"
                    height={NODE_HEIGHT}
                    opacity={baseGlowOpacity}
                    rx="8"
                    stroke={visuals.accent}
                    strokeDasharray={isSkipped ? "5 4" : undefined}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    width={NODE_WIDTH}
                  />
                  <motion.rect
                    animate={nodeMotionState}
                    custom={nodeMotion}
                    fill="none"
                    filter="url(#dag-node-glow)"
                    height={NODE_HEIGHT}
                    initial={false}
                    rx="8"
                    stroke={visuals.accent}
                    strokeDasharray={isSkipped ? "5 4" : undefined}
                    strokeWidth="1"
                    variants={nodeGlow}
                    vectorEffect="non-scaling-stroke"
                    width={NODE_WIDTH}
                  />
                  <rect
                    fill={visuals.fill}
                    fillOpacity={visuals.fillOpacity}
                    height={NODE_HEIGHT}
                    rx="7"
                    stroke={visuals.stroke}
                    strokeDasharray={isSkipped ? "5 4" : undefined}
                    strokeOpacity={visuals.strokeOpacity}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    width={NODE_WIDTH}
                  />
                  <circle
                    cx="13"
                    cy={NODE_HEIGHT / 2}
                    fill={visuals.dot}
                    fillOpacity={visuals.dotOpacity}
                    r="2.5"
                  />
                  <text
                    fill={visuals.label}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize="10"
                    letterSpacing="0.015em"
                    x="23"
                    y="22.5"
                  >
                    {node.label}
                  </text>
                  {node.detail && (
                    <text
                      fill={visuals.detail}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fontSize="8"
                      fontWeight="600"
                      letterSpacing="0.08em"
                      textAnchor="end"
                      x={NODE_WIDTH - 9}
                      y="11"
                    >
                      {node.detail}
                    </text>
                  )}
                </motion.g>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_62%_at_50%_48%,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.74)_48%,rgba(2,6,23,0.18)_100%)] sm:bg-[radial-gradient(ellipse_46%_68%_at_50%_48%,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.62)_52%,rgba(2,6,23,0.12)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/70" />
    </div>
  );
}
