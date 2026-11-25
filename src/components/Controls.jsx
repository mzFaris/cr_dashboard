function Ack(props) {
  return <p class="ack" data-state={props.ack.kind}>{props.ack.message}</p>;
}

function Segment(props) {
  return (
    <button
      type="button"
      class="segment"
      classList={{ "is-active": props.active }}
      aria-pressed={props.active}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function CommandField(props) {
  const submit = (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    if (!input || !input.checkValidity() || input.value.trim() === "") {
      input?.reportValidity();
      return;
    }
    props.onApply(props.command, input.value.trim());
  };

  return (
    <form class="field command-field" data-field={props.command} novalidate onSubmit={submit}>
      <label for={props.id}>{props.label}</label>
      <div class="field-input">
        <input
          id={props.id}
          type="number"
          inputmode={props.inputmode}
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onInput={(event) => props.onInput(props.command, event.currentTarget.value)}
          required
        />
        <span class="unit">{props.unit}</span>
        <button type="submit" class="btn">
          Set
        </button>
      </div>
      <Ack ack={props.ack} />
    </form>
  );
}

export default function Controls(props) {
  const ack = (command) =>
    props.acks[command] || { message: "", kind: "idle" };

  const buzzerActive = (payload) =>
    props.buzzerMuted !== null && (payload === "OFF") === props.buzzerMuted;
  const telemetryActive = (payload) =>
    props.telemetryPaused !== null && (payload === "OFF") === props.telemetryPaused;

  return (
    <section class="card controls" aria-labelledby="controlsHeading">
      <div class="card-head">
        <h2 id="controlsHeading">Controls</h2>
      </div>

      <fieldset class="control-set" id="controlFieldset" disabled={!props.connected}>
        <legend class="sr-only">Device commands</legend>

        <div class="control-row">
          <h3>Buzzer</h3>
          <div class="control-actions">
            <button
              type="button"
              class="btn"
              data-command="silence"
              data-payload="ON"
              onClick={() => props.onCommand("silence", "ON")}
            >
              Silence
            </button>
            <div class="segmented" role="group" aria-label="Buzzer mute">
              <Segment
                label="Unmute"
                active={buzzerActive("ON")}
                onClick={() => props.onCommand("buzzer", "ON")}
              />
              <Segment
                label="Mute"
                active={buzzerActive("OFF")}
                onClick={() => props.onCommand("buzzer", "OFF")}
              />
            </div>
          </div>
          <Ack ack={ack("buzzer")} />
          <Ack ack={ack("silence")} />
        </div>

        <div class="control-row">
          <h3>Telemetry</h3>
          <div class="segmented" role="group" aria-label="Telemetry publishing">
            <Segment
              label="Resume"
              active={telemetryActive("ON")}
              onClick={() => props.onCommand("publish", "ON")}
            />
            <Segment
              label="Pause"
              active={telemetryActive("OFF")}
              onClick={() => props.onCommand("publish", "OFF")}
            />
          </div>
          <Ack ack={ack("publish")} />
        </div>

        <div class="threshold-grid">
          <CommandField
            command="temp_threshold"
            id="tempThreshold"
            label="Hot threshold"
            inputmode="decimal"
            min="0.1"
            max="100"
            step="any"
            unit="°C"
            value={props.fields.temp_threshold}
            onInput={props.onFieldInput}
            onApply={props.onApply}
            ack={ack("temp_threshold")}
          />
          <CommandField
            command="interval"
            id="publishInterval"
            label="Interval"
            inputmode="numeric"
            min="1"
            max="3600"
            step="1"
            unit="s"
            value={props.fields.interval}
            onInput={props.onFieldInput}
            onApply={props.onApply}
            ack={ack("interval")}
          />
          <CommandField
            command="motion_hold"
            id="motionHold"
            label="Motion hold"
            inputmode="numeric"
            min="1"
            max="3600"
            step="1"
            unit="s"
            value={props.fields.motion_hold}
            onInput={props.onFieldInput}
            onApply={props.onApply}
            ack={ack("motion_hold")}
          />
          <CommandField
            command="light_threshold"
            id="lightThreshold"
            label="Light threshold"
            inputmode="numeric"
            min="0"
            max="4095"
            step="1"
            unit="ADC"
            value={props.fields.light_threshold}
            onInput={props.onFieldInput}
            onApply={props.onApply}
            ack={ack("light_threshold")}
          />
        </div>
      </fieldset>
    </section>
  );
}
