export const STORAGE_KEY = "comfortroom.dashboard.v2";
export const HISTORY_LIMIT = 90;
export const ACK_TIMEOUT_MS = 6000;
export const STALE_AFTER_S = 20;

export const DEFAULT_DEVICE_ID = "comfortroom";

export function defaultBrokerUrl() {
  const host = typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${host}:9001/mqtt`;
}

export const DEFAULT_FIELDS = {
  temp_threshold: "30",
  interval: "3",
  motion_hold: "10",
  light_threshold: "2000",
};

export const STATUS_TEXT = {
  NORMAL: { label: "Normal", hint: "Comfortable." },
  HOT: { label: "Too hot", hint: "Hot with motion." },
  ENERGY_WASTE: { label: "Energy waste", hint: "Bright and empty." },
};

export const MOTION_TEXT = { ON: "Occupied", OFF: "Empty" };

export const ERROR_TEXT = {
  E_TOKEN: "Only ON/OFF is accepted.",
  E_NUMBER: "Value must be numeric.",
  E_RANGE: "Value out of range.",
  E_UNKNOWN: "Unknown command.",
  E_TOPIC: "Invalid command topic.",
};

export const COMMAND_TEXT = {
  buzzer: "Buzzer mute",
  silence: "Buzzer silence",
  publish: "Telemetry",
  temp_threshold: "Temperature threshold",
  interval: "Publish interval",
  motion_hold: "Motion hold",
  light_threshold: "Light threshold",
  system: "System",
};

export const SERIES_COLOR = {
  temperature: "--temp",
  humidity: "--humidity",
  light: "--light",
};

export function statusInfo(code) {
  if (!code) {
    return { label: "No data", hint: "Waiting." };
  }
  return (
    STATUS_TEXT[code] || {
      label: code,
      hint: "Unknown.",
    }
  );
}
