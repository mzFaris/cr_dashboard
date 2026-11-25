const LINK_LABELS = {
  idle: "Disconnected",
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  error: "Error",
};

const AVAILABILITY_LABELS = {
  online: "Online",
  offline: "Offline",
  unknown: "Unknown",
};

export default function TopBar(props) {
  const linkLabel = () => LINK_LABELS[props.linkState] || "Disconnected";
  const availability = () => (props.connected ? props.availability : "unknown");

  return (
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M5 16V8a4 4 0 0 1 8 0v8" />
            <path d="M15 16V6h4" />
          </svg>
        </span>
        <h1>ComfortRoom</h1>
      </div>

      <div class="topbar-actions">
        <span class="pill" data-state={props.linkState}>
          {linkLabel()}
        </span>
        <span class="pill" data-state={availability()}>
          {AVAILABILITY_LABELS[availability()]}
        </span>
        <button
          type="button"
          class="btn ghost"
          id="settingsToggle"
          aria-expanded={props.settingsOpen}
          aria-controls="connectionPanel"
          onClick={props.onToggleSettings}
        >
          Settings
        </button>
      </div>
    </header>
  );
}
