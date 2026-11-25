export default function ConnectionPanel(props) {
  return (
    <section
      class="card connection-panel"
      id="connectionPanel"
      aria-label="Connection settings"
      hidden={!props.open}
    >
      <form class="connection-form" onSubmit={props.onSubmit}>
        <div class="field">
          <label for="brokerUrl">Broker</label>
          <input
            id="brokerUrl"
            name="brokerUrl"
            type="url"
            spellcheck="false"
            autocomplete="off"
            value={props.brokerUrl}
            onInput={(event) => props.onBrokerUrl(event.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label for="deviceId">Device ID</label>
          <input
            id="deviceId"
            name="deviceId"
            type="text"
            spellcheck="false"
            autocomplete="off"
            value={props.deviceId}
            onInput={(event) => props.onDeviceId(event.currentTarget.value)}
          />
        </div>
        <div class="connection-actions">
          <button
            type="submit"
            class={props.hasClient ? "btn ghost" : "btn primary"}
            id="connectButton"
            disabled={props.connecting}
          >
            {props.hasClient ? "Disconnect" : "Connect"}
          </button>
          <span class="connection-note">
            {props.settingsDirty ? "Reconnect to apply." : ""}
          </span>
        </div>
        <p class="form-error" id="connectionError" role="alert" hidden={!props.error}>
          {props.error}
        </p>
      </form>
    </section>
  );
}
