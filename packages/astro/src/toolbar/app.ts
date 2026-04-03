const OVERRIDE_COOKIE = "flagify-overrides";

function getCookieOverrides(): Record<string, unknown> {
  const match = document.cookie.match(
    new RegExp(`${OVERRIDE_COOKIE}=([^;]+)`),
  );
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return {};
  }
}

function setCookieOverrides(overrides: Record<string, unknown>): void {
  document.cookie = `${OVERRIDE_COOKIE}=${encodeURIComponent(JSON.stringify(overrides))}; path=/; max-age=86400`;
}

export default {
  id: "flagify-flags",
  name: "Feature Flags",
  init(canvas: any) {
    const overrides = getCookieOverrides();

    const container = document.createElement("astro-dev-toolbar-window" as any);
    container.innerHTML = `
      <div style="padding: 12px; font-family: system-ui, sans-serif;">
        <h2 style="margin: 0 0 8px; font-size: 15px; font-weight: 600;">Flagify Overrides</h2>
        <p style="font-size: 13px; opacity: 0.7; margin: 0 0 12px;">
          Add flag overrides for local development.
        </p>
        <textarea
          id="flagify-overrides-editor"
          style="width: 100%; min-height: 140px; font-family: monospace; font-size: 13px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: inherit; resize: vertical;"
        >${JSON.stringify(overrides, null, 2)}</textarea>
        <div style="margin-top: 8px; display: flex; gap: 8px;">
          <button id="flagify-save" style="padding: 6px 14px; border-radius: 6px; border: none; background: #6366f1; color: white; cursor: pointer; font-size: 13px;">
            Save &amp; Reload
          </button>
          <button id="flagify-clear" style="padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: inherit; cursor: pointer; font-size: 13px;">
            Clear All
          </button>
        </div>
      </div>
    `;

    canvas.appendChild(container);

    container
      .querySelector("#flagify-save")
      ?.addEventListener("click", () => {
        const textarea = container.querySelector(
          "#flagify-overrides-editor",
        ) as HTMLTextAreaElement;
        try {
          const parsed = JSON.parse(textarea.value);
          setCookieOverrides(parsed);
          window.location.reload();
        } catch {
          alert("Invalid JSON");
        }
      });

    container
      .querySelector("#flagify-clear")
      ?.addEventListener("click", () => {
        document.cookie = `${OVERRIDE_COOKIE}=; path=/; max-age=0`;
        window.location.reload();
      });
  },
};
