#!/usr/bin/env node

import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const DEVICE_ID =
  process.env.DEVICE_ID || "comfortroom";
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 3000);

const TEMP_THRESHOLD = Number(process.env.TEMP_THRESHOLD || 30);
const LIGHT_THRESHOLD = Number(process.env.LIGHT_THRESHOLD || 2000);
const MOTION_HOLD_MS = Number(process.env.MOTION_HOLD_MS || 10000);

const PREFIX = `${DEVICE_ID}/room/`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noise = (amount) => (Math.random() - 0.5) * amount;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = (value) => Number(value.toFixed(1));

const client = mqtt.connect(MQTT_URL, {
  clientId: `comfortroom-simulator-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  reconnectPeriod: 4000,
  will: {
    topic: `${PREFIX}availability`,
    payload: "offline",
    qos: 0,
    retain: true,
  },
});

function publish(topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(
      `${PREFIX}${topic}`,
      String(payload),
      { qos: 0, retain: true },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

async function waitForConnection() {
  if (client.connected) return;
  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  });
}

let running = true;
let tick = 0;
let lastMotionAt = Date.now();
let lastStatus = null;

process.on("SIGINT", () => {
  running = false;
});

client.on("connect", () => {
  publish("availability", "online").catch((error) =>
    console.error(`availability publish failed: ${error.message}`),
  );
  console.log(`Connected to ${MQTT_URL}`);
});

client.on("error", (error) => {
  console.error(`MQTT error: ${error.message}`);
});

async function loop() {
  await waitForConnection();

  while (running) {
    if (!client.connected) {
      await sleep(INTERVAL_MS);
      continue;
    }

    const now = Date.now();

    const cycle = tick % 48;
    const rawMotion = cycle < 30;
    if (rawMotion) lastMotionAt = now;
    const someonePresent = now - lastMotionAt < MOTION_HOLD_MS;

    const hotPhase = cycle >= 20 && cycle < 28;
    const temperature = round1(
      clamp(23.5 + 2.5 * Math.sin(tick / 12) + (hotPhase ? 6 : 0) + noise(0.4), 18, 38),
    );
    const humidity = round1(clamp(52 - (temperature - 24) * 1.4 + noise(2), 30, 75));

    const lightsOn = cycle < 42;
    const light = Math.round(
      clamp((lightsOn ? 1100 : 2800) + 250 * Math.sin(tick / 5) + noise(120), 0, 4095),
    );

    const status =
      temperature > TEMP_THRESHOLD && rawMotion
        ? "HOT"
        : light < LIGHT_THRESHOLD && !someonePresent
          ? "ENERGY_WASTE"
          : "NORMAL";

    await Promise.all([
      publish("temperature", temperature),
      publish("humidity", humidity),
      publish("light", light),
      publish("motion", someonePresent ? "ON" : "OFF"),
    ]);

    if (status !== lastStatus) {
      lastStatus = status;
      await publish("status", status);
    }

    const time = new Date().toLocaleTimeString([], { hour12: false });
    console.log(
      `[${time}] ${temperature.toFixed(1)}C ${humidity.toFixed(1)}% light=${light} motion=${someonePresent ? "ON" : "OFF"} -> ${status}`,
    );

    tick += 1;
    await sleep(INTERVAL_MS);
  }

  await publish("availability", "offline").catch(() => {});
  client.end(true);
  console.log("Simulator stopped.");
}

loop().catch((error) => {
  console.error(error);
  client.end(true);
  process.exitCode = 1;
});
