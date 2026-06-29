"use client";

import React, { useEffect, useState } from "react";

const stages = [
  {
    name: "Prompt",
    tool: "composer.capture",
    message: "User asks: build me something useful for tracking projects.",
    panelTitle: "Intent captured",
    panelBody:
      "Takomi classifies the request as a Genesis task instead of jumping straight into file edits.",
    artifacts: ["Goal: project tracker", "Mode: Genesis", "Writes: none"],
  },
  {
    name: "Detect",
    tool: "takomi-detect.ps1",
    message: "Read project .pi surfaces, plugin availability, CLI state, and skills.",
    panelTitle: "Runtime map",
    panelBody:
      "The harness checks what is actually installed before choosing an orchestration path.",
    artifacts: [".pi present", "Codex plugin present", "Raw skills available"],
  },
  {
    name: "Route",
    tool: "strata.route",
    message: "Strata agents choose PI through CLI, Codex plugin, or raw skill flow.",
    panelTitle: "Route selected",
    panelBody:
      "Because PI exists, Takomi uses the CLI/PI path for tool orchestration and context management.",
    artifacts: ["Surface: PI through CLI", "Sub-agents: allowed", "Policy loaded"],
  },
  {
    name: "Plan",
    tool: "takomi-board.ps1",
    message: "Create a readable roadbook and task packets before editing code.",
    panelTitle: "Roadbook created",
    panelBody:
      "The plan becomes markdown that humans and future agents can inspect or resume.",
    artifacts: ["master_plan.md", "T001_genesis.task.md", "T002_design.task.md"],
  },
  {
    name: "Design",
    tool: "takomi_subagent",
    message: "Send a bounded design packet, then return synthesis to the parent agent.",
    panelTitle: "Design packet returned",
    panelBody:
      "The sub-agent explores UI shape without taking ownership of the whole workspace.",
    artifacts: ["Schema sketch", "UI states", "Build constraints"],
  },
  {
    name: "Build",
    tool: "verification.gate",
    message: "Only now does the builder edit files and run checks.",
    panelTitle: "Ready to build",
    panelBody:
      "The output is traceable: why a tool was called, what it changed, and what gate proves it.",
    artifacts: ["lint passed", "types passed", "handoff updated"],
  },
] as const;

export default function PiDemo() {
  const [active, setActive] = useState(0);
  const current = stages[active];

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((value) => (value + 1) % stages.length);
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="demo"
      className="border-t border-zinc-900 bg-zinc-950/20 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-accent">
              PI DEMO
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              A harness that routes before it acts
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
            The point is not a prettier terminal. It is a visible sequence:
            prompt, runtime detection, strata routing, roadbook, sub-agent packet,
            then build. Each tool call has a reason.
          </p>
        </div>

        <div className="overflow-hidden rounded border border-zinc-800 bg-[#070909] shadow-2xl">
          <div className="grid border-b border-zinc-900 lg:grid-cols-[280px_1fr]">
            <aside className="border-b border-zinc-900 bg-zinc-950/80 p-4 lg:border-b-0 lg:border-r">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Composer
              </div>
              <div className="mt-4 rounded border border-zinc-800 bg-background p-4">
                <p className="font-mono text-sm text-zinc-200">
                  build me something
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  A tiny project tracker with tasks, statuses, and a clean
                  dashboard.
                </p>
              </div>
              <button
                type="button"
                className="mt-4 h-10 w-full rounded border border-accent bg-accent text-sm font-bold text-background"
              >
                Run with Takomi
              </button>
            </aside>

            <div className="p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <div className="rounded border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        Ordered tool rail
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-foreground">
                        {current.name}: {current.tool}
                      </h3>
                    </div>
                    <span className="rounded border border-sage/30 bg-sage/10 px-2 py-1 font-mono text-[10px] text-sage">
                      {active + 1}/{stages.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {stages.map((stage, index) => (
                      <button
                        key={stage.name}
                        type="button"
                        onClick={() => setActive(index)}
                        className={`grid w-full gap-3 rounded border p-3 text-left transition-colors sm:grid-cols-[92px_1fr] ${
                          index === active
                            ? "border-accent/50 bg-accent-muted"
                            : index < active
                              ? "border-sage/20 bg-sage/5"
                              : "border-zinc-900 bg-background/60"
                        }`}
                      >
                        <span className="font-mono text-xs font-bold text-accent">
                          {stage.name}
                        </span>
                        <span>
                          <span className="block font-mono text-xs text-zinc-300">
                            {stage.tool}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                            {stage.message}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    Live workspace
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-foreground">
                    {current.panelTitle}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    {current.panelBody}
                  </p>

                  <div className="mt-6 space-y-2">
                    {current.artifacts.map((artifact) => (
                      <div
                        key={artifact}
                        className="flex items-center justify-between rounded border border-zinc-900 bg-background px-3 py-2"
                      >
                        <span className="text-sm text-zinc-300">{artifact}</span>
                        <span className="font-mono text-[10px] text-accent">
                          LIVE
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded border border-zinc-900 bg-background p-3 font-mono text-xs leading-relaxed text-zinc-400">
                    <span className="text-accent">&gt;</span> next action is
                    selected from state, not from guesswork
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
