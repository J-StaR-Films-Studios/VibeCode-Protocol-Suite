import React from "react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-900 bg-zinc-950/60 py-12 font-mono">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="h-5 w-5 flex items-center justify-center rounded border border-accent/20 bg-accent-muted text-accent font-black text-xs">
              T
            </span>
            <span>TAKOMI</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 max-w-xs font-sans">
            A repo-local context firewall and agent lifecycle manager for VibeCoding environments.
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-xs text-zinc-400 font-sans">
            Designed and engineered from <span className="text-accent font-mono font-bold">Ado, Nigeria</span>
          </span>
          <span className="text-[9px] text-zinc-600">
            We are the makers of our codebase.
          </span>
        </div>

        <div className="flex flex-col items-center md:items-end gap-2 text-center md:text-right text-xs">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-zinc-500">
            <span className="text-[10px]">THE SUITE:</span>
            <a
              href="#"
              className="text-zinc-400 hover:text-accent transition-colors"
            >
              John-GPT
            </a>
            <span className="text-zinc-800">|</span>
            <a
              href="#"
              className="text-zinc-400 hover:text-accent transition-colors"
            >
              OpenMagic
            </a>
            <span className="text-zinc-800">|</span>
            <a
              href="#"
              className="text-zinc-400 hover:text-accent transition-colors"
            >
              VibeCode
            </a>
          </div>
          <span className="text-[10px] text-zinc-600 mt-1">
            &copy; {currentYear} VibeCode Protocol. Open source under ISC license.
          </span>
        </div>
      </div>
    </footer>
  );
}
