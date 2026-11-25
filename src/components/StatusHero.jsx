export default function StatusHero(props) {
  return (
    <section
      class="hero card"
      id="hero"
      data-status={props.status || "unknown"}
      aria-live="polite"
      aria-labelledby="statusLabel"
    >
      <div class="hero-main">
        <p class="eyebrow">Status</p>
        <h2 id="statusLabel">{props.statusLabel}</h2>
        <p class="hero-hint" id="statusHint">
          {props.hint}
        </p>
        <div class="hero-chip-row" id="heroChips">
          <span class="mini-chip" id="motionChip">
            <span class="mini-label">Motion</span>
            <span id="motionValue">{props.motionLabel}</span>
          </span>
          <span class="mini-chip" id="lightChip">
            <span class="mini-label">Light</span>
            <span id="brightValue">{props.brightness || "—"}</span>
          </span>
          <span class="mini-chip" id="telemetryChip" hidden={!props.telemetryPaused}>
            <span class="mini-label">Telemetry</span>
            <span id="telemetryValue">Paused</span>
          </span>
        </div>
      </div>

      <dl class="hero-meta">
        <div>
          <dt>Last reading</dt>
          <dd
            id="lastUpdate"
            classList={{ stale: props.lastUpdateStale }}
            title={props.lastUpdateTitle}
          >
            {props.lastUpdate}
          </dd>
        </div>
        <div>
          <dt>Device ID</dt>
          <dd class="mono" id="deviceIdDisplay">
            {props.deviceId || "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
