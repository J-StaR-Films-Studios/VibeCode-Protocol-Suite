import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { decodeKittyPrintable, isKeyRelease, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

/** Only the TUI can collect a secret without rendering its value in an input dialog. */
export async function maskedSecret(ctx: ExtensionContext, title: string): Promise<string | null> {
  if (ctx.mode !== "tui" || !ctx.hasUI) throw new Error("Secret entry requires an interactive Pi TUI. No unmasked input is available in RPC or non-interactive modes.");
  return ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
    let value = "";
    return {
      render(width) {
        // Do not render any portion of the value, including pasted newlines or terminal escapes.
        return [
          truncateToWidth(theme.fg("accent", title), width),
          truncateToWidth(theme.fg("muted", `Secret: ${"•".repeat(Math.min(value.length, 32))}${value.length > 32 ? "…" : ""}`), width),
          truncateToWidth(theme.fg("dim", "Enter to provide, Esc to cancel. Backspace to edit."), width),
        ];
      },
      invalidate() {},
      handleInput(data) {
        if (isKeyRelease(data)) return;
        if (keybindings.matches(data, "tui.select.cancel") || matchesKey(data, Key.escape)) {
          value = "";
          done(null);
        } else if (keybindings.matches(data, "tui.input.submit")) {
          const result = value;
          value = "";
          done(result || null);
        } else if (keybindings.matches(data, "tui.editor.deleteCharBackward")) {
          value = Array.from(value).slice(0, -1).join("");
        } else if (keybindings.matches(data, "tui.editor.deleteToLineStart")) {
          value = "";
        } else {
          const paste = data.match(/^\x1b\[200~([\s\S]*)\x1b\[201~$/);
          const typed = paste ? paste[1] : decodeKittyPrintable(data) ?? (/^[^\x00-\x1f\x7f\x1b]+$/u.test(data) ? data : "");
          if (typed && !/[\x00\x1b\x7f]/.test(typed) && value.length + typed.length <= 65536) value += typed;
        }
        tui.requestRender();
      },
    };
  });
}
