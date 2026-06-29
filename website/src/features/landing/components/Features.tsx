import React from "react";

export default function Features() {
  const features = [
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "The Blueprint Rule",
      desc: "Never write complex code blindly. Every major feature starts with a markdown plan detailing client/server flows, schema updates, and verification steps.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      ),
      title: "The 200-Line Limit",
      desc: "Stop monoliths before they form. The protocol automatically monitors file sizes and prompts modular refactoring when files approach 200 lines.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Progressive Context Loading",
      desc: "Fight token bloat and save context window. Load light indices and manifests automatically, fetching full instruction sets only when tools need them.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: "Repo-Local Codex Plugin",
      desc: "Operate inside your environment. Manage workflows via direct scripts like takomi-detect.ps1, takomi-policy.ps1, and takomi-board.ps1.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Anti-Gravity Design Pass",
      desc: "Strict aesthetic rules. High-fidelity layouts, clear font hierarchy, dark terminal-noir palettes, and zero-compromise UX rules for absolute clarity.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      title: "Verification Gates",
      desc: "Strict typechecks on every file edit. The protocol mandates 'npx tsc --noEmit' checks and local test executions before code is ever merged.",
    },
  ];

  return (
    <section id="protocol" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <span className="font-mono text-xs text-accent uppercase tracking-widest">
            ENGINE DESIGN PHILOSOPHY
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mt-2">
            The VibeCode Core Protocols
          </h2>
        </div>
        <p className="max-w-md text-zinc-400 text-sm md:text-base leading-relaxed">
          Traditional AI agents write unstructured code and dump thousands of prompt lines into context. 
          Takomi imposes rules, progressive memory loading, and static gates.
        </p>
      </div>

      <div className="grid gap-px bg-zinc-900 overflow-hidden rounded border border-zinc-800 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feat, index) => (
          <div
            key={index}
            className="bg-zinc-950 p-8 flex flex-col gap-4 transition-colors hover:bg-zinc-900/40 group cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-900/50 group-hover:border-accent/30 group-hover:bg-accent-muted transition-colors">
                {feat.icon}
              </div>
              <h3 className="font-mono text-base font-bold text-foreground tracking-tight">
                {feat.title}
              </h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mt-2">
              {feat.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
