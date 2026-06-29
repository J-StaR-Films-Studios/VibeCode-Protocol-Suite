"use client";

import React, { useState } from "react";

const installCommand = "npm install -g takomi && takomi setup pi";

export default function InstallCTA() {
  const [copied, setCopied] = useState(false);

  const copyCmd = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="install" className="mx-auto max-w-6xl px-6 py-20 md:py-28 border-t border-zinc-900 scroll-mt-16">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Left Column: Context & Codex Details */}
        <div className="flex flex-col gap-6">
          <span className="font-mono text-xs text-accent uppercase tracking-widest">
            INITIALIZE ENGINE
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Plug Takomi directly into your environment
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Takomi installs as a global CLI toolkit and can also run as a repo-local
            Codex plugin. Once enabled, the engine inspects project boundaries,
            policy files, runtime surfaces, roadbooks, and verification scripts.
          </p>

          <div id="plugin" className="border-t border-zinc-900 pt-6 mt-2">
            <h3 className="font-mono text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Codex Repo-Local Marketplace Integration
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed font-mono">
              Enable the repo-local plugin via <code className="text-zinc-300">.agents/plugins/marketplace.json</code> targeting <code className="text-zinc-300">./plugins/takomi-codex</code>. 
              The plugin automatically routes execution context based on target files.
            </p>
          </div>
        </div>

        {/* Right Column: Code install & requirements */}
        <div className="border border-zinc-800 bg-zinc-950/40 rounded p-6 sm:p-8 font-mono">
          <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">
            INSTALLATION COMMAND
          </div>

          <div className="relative flex items-center justify-between bg-zinc-950 border border-zinc-900 rounded p-4 mb-6">
            <code className="text-xs sm:text-sm text-zinc-300 break-all select-all pr-8">
              {installCommand}
            </code>
            <button
              onClick={copyCmd}
              className="absolute right-3 p-2 text-zinc-500 hover:text-accent transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? (
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-900 pb-2">
              Prerequisites
            </div>
            
            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-accent mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="text-xs font-bold text-zinc-300">Node.js 18.0+</span>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Required for prompt-kernel skills installation CLI.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-accent mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="text-xs font-bold text-zinc-300">PowerShell 7 / pwsh</span>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Required to run local diagnostic checks (takomi-doctor.ps1).</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <svg className="h-4 w-4 text-accent mt-0.5 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="text-xs font-bold text-zinc-300">Git Version Control</span>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Essential for tracking snapshot diff state changes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
