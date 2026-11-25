import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import mqtt from "mqtt";

import ActivityLog from "./components/ActivityLog";
import ConnectionPanel from "./components/ConnectionPanel";
import Controls from "./components/Controls";
import MetricCard from "./components/MetricCard";
import StatusHero from "./components/StatusHero";
import TopBar from "./components/TopBar";
import {
  ACK_TIMEOUT_MS,
  COMMAND_TEXT,
  DEFAULT_DEVICE_ID,
  DEFAULT_FIELDS,
  defaultBrokerUrl,
  ERROR_TEXT,
  HISTORY_LIMIT,
  MOTION_TEXT,
  STALE_AFTER_S,
  STORAGE_KEY,
  statusInfo,
} from "./constants";

function isValidDeviceId(value) {
  return value.length > 0 && value.length <= 128 && !/[\s/+#]/.test(value);
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function trimNumber(value) {
  return String(Number(Number(value).toFixed(3)));
}

function loadSettings() {
  const settings = { brokerUrl: defaultBrokerUrl(), deviceId: DEFAULT_DEVICE_ID };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return settings;
    const saved = JSON.parse(raw);
    if (saved && typeof saved.brokerUrl === "string" && /^wss?:\/\//i.test(saved.brokerUrl)) {
      settings.brokerUrl = saved.brokerUrl;
    }
    if (saved && typeof saved.deviceId === "string" && isValidDeviceId(saved.deviceId.trim())) {
      settings.deviceId = saved.deviceId.trim();
    }
  } catch {

  }
  return settings;
}

function saveSettings(brokerUrl, deviceId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ brokerUrl, deviceId }));
  } catch {

  }
}

const initialAcks = Object.fromEntries(
  Object.keys(COMMAND_TEXT).map((command) => [
    command,
    { message: "", kind: "idle" },
  ]),
);

export default function App() {
  const saved = loadSettings();
  const [state, setState] = createStore({
    brokerUrl: saved.brokerUrl,
    deviceId: saved.deviceId,
    activeBrokerUrl: null,
    activeDeviceId: null,
    hasClient: false,
    connected: false,
    connecting: false,
    linkState: "idle",
    lastLinkError: "",
    connectionError: "",
    settingsOpen: false,
    availability: "unknown",
    status: null,
    motion: null,
    temperature: null,
    humidity: null,
    light: null,
    lastTelemetryAt: 0,
    history: { temperature: [], humidity: [], light: [] },
    thresholds: { temp: 30, light: 2000 },
    publishIntervalSec: 3,
    buzzerMuted: null,
    telemetryPaused: null,
    intent: {},
    fields: { ...DEFAULT_FIELDS },
    acks: initialAcks,
    logs: [],
  });

  let client = null;
  let connectAttempt = 0;
  let telemetryNoted = false;
  let logId = 0;
  const ackTimers = new Map();
  const [nowMs, setNowMs] = createSignal(Date.now());

  function log(message, kind = "info") {
    setState("logs", (logs) =>
      [
        {
          id: ++logId,
          time: new Date().toLocaleTimeString([], { hour12: false }),
          message,
          kind,
        },
        ...logs,
      ].slice(0, 120),
    );
  }

  function setAck(command, message, kind) {
    setState("acks", command, { message, kind });
  }

  function clearAckTimer(command) {
    if (ackTimers.has(command)) {
      clearTimeout(ackTimers.get(command));
      ackTimers.delete(command);
    }
  }

  function clearAckTimers() {
    for (const command of ackTimers.keys()) clearAckTimer(command);
  }

  function startAckTimer(command) {
    clearAckTimer(command);
    const timer = setTimeout(() => {
      ackTimers.delete(command);
      setAck(command, "No acknowledgement. Is the device online?", "error");
      log(`${COMMAND_TEXT[command] || command}: no acknowledgement within 6 s.`, "error");
    }, ACK_TIMEOUT_MS);
    ackTimers.set(command, timer);
  }

  function resetDeviceView() {
    setState({
      availability: "unknown",
      status: null,
      motion: null,
      temperature: null,
      humidity: null,
      light: null,
      lastTelemetryAt: 0,
      history: { temperature: [], humidity: [], light: [] },
      thresholds: { temp: 30, light: 2000 },
      publishIntervalSec: 3,
      buzzerMuted: null,
      telemetryPaused: null,
      intent: {},
      fields: { ...DEFAULT_FIELDS },
    });
    clearAckTimers();
    for (const command of Object.keys(COMMAND_TEXT)) {
      setAck(command, "", "idle");
    }
    telemetryNoted = false;
  }

  function stopClient() {
    const active = client;
    client = null;
    connectAttempt += 1;
    if (active) {
      try {
        active.end(true);
      } catch {

      }
    }
    setState({
      hasClient: false,
      connected: false,
      connecting: false,
      availability: "unknown",
    });
    clearAckTimers();
  }

  function disconnect(options = {}) {
    const hadClient = Boolean(client);
    stopClient();
    setState("linkState", "idle");
    if (hadClient && !options.silent) log("Disconnected from the broker.", "info");
  }

  function showConnectionError(message) {
    setState({ connectionError: message, settingsOpen: true });
    log(message, "error");
  }

  function hideConnectionError() {
    setState("connectionError", "");
  }

  function connect() {
    hideConnectionError();

    const deviceId = state.deviceId.trim();
    const brokerUrl = state.brokerUrl.trim();

    if (!isValidDeviceId(deviceId)) {
      showConnectionError(
        "Device ID must be 1–128 characters and may not contain spaces, '/', '+' or '#'.",
      );
      return;
    }
    if (!/^wss?:\/\/\S+$/i.test(brokerUrl)) {
      showConnectionError("Broker URL must start with ws:// or wss://.");
      return;
    }

    if (state.activeDeviceId && deviceId !== state.activeDeviceId) resetDeviceView();

    stopClient();
    saveSettings(brokerUrl, deviceId);
    setState({
      deviceId,
      brokerUrl,
      activeDeviceId: deviceId,
      activeBrokerUrl: brokerUrl,
      linkState: "connecting",
      connecting: true,
    });

    const attempt = connectAttempt;
    let nextClient;
    try {
      nextClient = mqtt.connect(brokerUrl, {
        clientId: `comfortroom-dashboard-${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        keepalive: 30,
        reconnectPeriod: 4000,
        connectTimeout: 10000,
        protocolVersion: 4,
      });
    } catch (error) {
      setState({ linkState: "error", connected: false, connecting: false });
      showConnectionError(`Could not connect: ${error.message}`);
      return;
    }

    client = nextClient;
    setState("hasClient", true);

    nextClient.on("connect", () => {
      if (client !== nextClient || attempt !== connectAttempt) return;
      setState({
        connected: true,
        connecting: false,
        linkState: "live",
        lastLinkError: "",
      });
      hideConnectionError();

      const filter = `${state.activeDeviceId}/room/#`;
      nextClient.subscribe(filter, { qos: 0 }, (error) => {
        if (client !== nextClient) return;
        if (error) {
          log(`Could not subscribe to ${filter}: ${error.message}`, "error");
        } else {
          log(`Subscribed to ${filter}`, "info");
        }
      });
      log(`Connected to ${brokerUrl}`, "info");
    });

    nextClient.on("message", (topic, payload) => {
      if (client === nextClient) handleMessage(topic, payload);
    });

    nextClient.on("reconnect", () => {
      if (client !== nextClient) return;
      setState("linkState", "reconnecting");
    });

    nextClient.on("offline", () => {
      if (client !== nextClient) return;
      setState({ connected: false, linkState: "reconnecting" });
    });

    nextClient.on("close", () => {
      if (client !== nextClient) return;
      setState({
        connected: false,
        linkState: state.linkState === "error" ? "error" : "reconnecting",
      });
    });

    nextClient.on("error", (error) => {
      if (client !== nextClient) return;
      const message = error && error.message ? error.message : String(error);
      setState({ linkState: "error", connecting: false });
      if (message !== state.lastLinkError) {
        setState("lastLinkError", message);
        log(`MQTT error: ${message}`, "error");
      }
    });
  }

  function handleMessage(topic, payload) {
    const prefix = `${state.activeDeviceId}/room/`;
    if (!topic.startsWith(prefix)) return;
    const name = topic.slice(prefix.length);
    const text = payload.toString("utf8").trim();
    if (!text) return;

    switch (name) {
      case "temperature":
        setReading("temperature", text);
        break;
      case "humidity":
        setReading("humidity", text);
        break;
      case "light":
        setReading("light", text);
        break;
      case "motion":
        if (text === "ON" || text === "OFF") {
          setState({ motion: text, lastTelemetryAt: Date.now() });
        } else {
          log(`Ignored motion payload "${text}"; expected ON or OFF.`, "error");
        }
        break;
      case "status":
        handleStatus(text);
        break;
      case "availability":
        handleAvailability(text);
        break;
      case "ack":
        handleAck(text);
        break;
      default:
        break;
    }
  }

  function setReading(series, text) {
    const value = Number(text);
    if (!Number.isFinite(value)) {
      log(`Ignored non-numeric ${series} payload "${text}".`, "error");
      return;
    }
    setState(series, value);
    setState("lastTelemetryAt", Date.now());
    setState("history", series, (values) => [...values, value].slice(-HISTORY_LIMIT));
    if (!telemetryNoted) {
      telemetryNoted = true;
      log("Telemetry is streaming.", "info");
    }
  }

  function handleStatus(code) {
    if (code === state.status) return;
    setState("status", code);
    log(`Status: ${statusInfo(code).label} (${code})`, "info");
  }

  function handleAvailability(value) {
    if (value !== "online" && value !== "offline") {
      log(`Ignored availability payload "${value}".`, "error");
      return;
    }
    if (state.availability !== value) {
      setState("availability", value);
      log(
        value === "online" ? "Device is online." : "Device is offline.",
        value === "online" ? "info" : "error",
      );
    }
  }

  function handleAck(text) {
    const [command, result, detail] = text.split("|");
    if (!command || !result) {
      log(`Malformed acknowledgement: "${text}".`, "error");
      return;
    }

    clearAckTimer(command);
    const label = COMMAND_TEXT[command] || command;

    if (result === "OK") {
      const suffix = detail ? ` (${detail})` : "";
      setAck(command, `Applied${suffix}`, "ok");
      log(`${label} confirmed${suffix}`, "ok");
      applyConfirmedState(command, detail);
    } else {
      const message = ERROR_TEXT[detail] || `Failed with code ${detail}.`;
      setAck(command, message, "error");
      log(`${label} failed: ${message}`, "error");
    }
  }

  function applyConfirmedState(command, detail) {
    switch (command) {
      case "buzzer":
        setState("buzzerMuted", state.intent.buzzer === "OFF");
        break;
      case "silence":
        setAck(
          command,
          state.intent.silence === "OFF" ? "Silence cleared" : "Current alarm silenced",
          "ok",
        );
        break;
      case "publish":
        setState("telemetryPaused", state.intent.publish === "OFF");
        break;
      case "temp_threshold": {
        const value = Number(detail);
        if (Number.isFinite(value) && value > 0) {
          setState("thresholds", "temp", value);
          setState("fields", "temp_threshold", trimNumber(value));
        }
        break;
      }
      case "light_threshold": {
        const value = Number(detail);
        if (Number.isFinite(value)) {
          setState("thresholds", "light", value);
          setState("fields", "light_threshold", trimNumber(value));
        }
        break;
      }
      case "interval": {
        const value = Number(detail);
        if (Number.isFinite(value) && value > 0) {
          setState("publishIntervalSec", value);
          setState("fields", "interval", trimNumber(value));
        }
        break;
      }
      case "motion_hold": {
        const value = Number(detail);
        if (Number.isFinite(value) && value > 0) {
          setState("fields", "motion_hold", trimNumber(value));
        }
        break;
      }
      default:
        break;
    }
  }

  function sendCommand(command, payload, label) {
    const active = client;
    if (!state.connected || !active) {
      log("Not connected: the command was not sent.", "error");
      return;
    }

    const topic = `${state.activeDeviceId}/room/control/${command}`;
    const text = String(payload);

    setState("intent", command, text);
    setAck(command, "Sending…", "pending");
    startAckTimer(command);

    active.publish(topic, text, { qos: 0, retain: false }, (error) => {
      if (!error || client !== active) return;
      clearAckTimer(command);
      setAck(command, `Could not send: ${error.message}`, "error");
      log(`Could not send ${label}: ${error.message}`, "error");
    });

    log(`Sent ${label} = ${text}`, "out");
  }

  function toggleSettings() {
    const open = !state.settingsOpen;
    setState("settingsOpen", open);
    if (open) {
      setTimeout(() => document.getElementById("brokerUrl")?.focus({ preventScroll: true }), 0);
    } else {
      document.getElementById("settingsToggle")?.focus();
    }
  }

  const status = createMemo(() => statusInfo(state.status));
  const statusHint = createMemo(() => {
    if (!state.connected) return "Not connected.";
    if (state.availability === "offline") return "Device offline.";
    return status().hint;
  });

  const brightness = createMemo(() =>
    state.light === null ? null : state.light < state.thresholds.light ? "Bright" : "Dim",
  );

  const settingsDirty = createMemo(
    () =>
      Boolean(state.activeDeviceId) &&
      (state.deviceId.trim() !== state.activeDeviceId ||
        state.brokerUrl.trim() !== state.activeBrokerUrl),
  );

  const lastUpdateText = createMemo(() => {
    nowMs();
    if (!state.lastTelemetryAt) return "—";
    const seconds = Math.max(0, Math.round((Date.now() - state.lastTelemetryAt) / 1000));
    return seconds <= 1 ? "Just now" : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
  });

  const lastUpdateStale = createMemo(() => {
    nowMs();
    if (!state.lastTelemetryAt || !state.connected) return false;
    const seconds = Math.max(0, Math.round((Date.now() - state.lastTelemetryAt) / 1000));
    return seconds > Math.max(STALE_AFTER_S, state.publishIntervalSec * 2 + 5);
  });

  const lastUpdateTitle = createMemo(() =>
    state.lastTelemetryAt ? new Date(state.lastTelemetryAt).toLocaleString() : "",
  );

  onMount(() => {
    const clock = setInterval(() => setNowMs(Date.now()), 1000);

    const onKeyDown = (event) => {
      if (event.key === "Escape" && state.settingsOpen) {
        setState("settingsOpen", false);
        document.getElementById("settingsToggle")?.focus();
      }
    };

    const onPageHide = () => {
      if (!client) return;
      try {
        client.end(true);
      } catch {

      }
    };

    const onUnhandledRejection = (event) => {
      const message =
        event.reason && event.reason.message ? event.reason.message : String(event.reason);
      log(`Unexpected error: ${message}`, "error");
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    log("Dashboard ready.", "info");
    connect();

    onCleanup(() => {
      clearInterval(clock);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      clearAckTimers();
      if (client) {
        try {
          client.end(true);
        } catch {

        }
      }
    });
  });

  const temperatureMeta = () =>
    state.temperature === null
      ? ""
      : `Limit ${formatNumber(state.thresholds.temp, 1)} °C`;

  const lightMeta = () => (state.light === null ? "" : brightness());

  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>

      <TopBar
        linkState={state.linkState}
        connected={state.connected}
        availability={state.availability}
        settingsOpen={state.settingsOpen}
        onToggleSettings={toggleSettings}
      />

      <ConnectionPanel
        open={state.settingsOpen}
        brokerUrl={state.brokerUrl}
        deviceId={state.deviceId}
        hasClient={state.hasClient}
        connecting={state.connecting}
        settingsDirty={settingsDirty()}
        error={state.connectionError}
        onBrokerUrl={(value) => setState("brokerUrl", value)}
        onDeviceId={(value) => setState("deviceId", value)}
        onSubmit={(event) => {
          event.preventDefault();
          if (client) disconnect();
          else connect();
        }}
      />

      <main id="main">
        <StatusHero
          status={state.status}
          statusLabel={status().label}
          hint={statusHint()}
          motionLabel={state.motion ? MOTION_TEXT[state.motion] || "—" : "—"}
          brightness={brightness()}
          telemetryPaused={state.telemetryPaused === true}
          lastUpdate={lastUpdateText()}
          lastUpdateStale={lastUpdateStale()}
          lastUpdateTitle={lastUpdateTitle()}
          deviceId={state.activeDeviceId}
        />

        <section class="metrics" aria-label="Sensor readings">
          <MetricCard
            series="temperature"
            title="Temperature"
            unit="°C"
            value={state.temperature === null ? "—" : formatNumber(state.temperature, 1)}
            meta={temperatureMeta()}
            warn={state.temperature !== null && state.temperature > state.thresholds.temp}
            values={state.history.temperature}
          />
          <MetricCard
            series="humidity"
            title="Humidity"
            unit="%"
            value={state.humidity === null ? "—" : formatNumber(state.humidity, 1)}
            meta={state.humidity === null ? "" : "DHT11"}
            warn={false}
            values={state.history.humidity}
          />
          <MetricCard
            series="light"
            title="Light level"
            unit="ADC"
            value={state.light === null ? "—" : String(Math.round(state.light))}
            meta={lightMeta()}
            warn={false}
            values={state.history.light}
          />
        </section>

        <div class="lower-grid">
          <Controls
            connected={state.connected}
            fields={state.fields}
            acks={state.acks}
            buzzerMuted={state.buzzerMuted}
            telemetryPaused={state.telemetryPaused}
            onCommand={(command, payload) =>
              sendCommand(command, payload, COMMAND_TEXT[command] || command)
            }
            onFieldInput={(command, value) => setState("fields", command, value)}
            onApply={(command, value) =>
              sendCommand(command, value, COMMAND_TEXT[command] || command)
            }
          />
          <ActivityLog logs={state.logs} onClear={() => setState("logs", [])} />
        </div>
      </main>

      <footer class="footer">
        <code>{state.activeDeviceId || "no device"}/room/#</code>
      </footer>
    </>
  );
}
