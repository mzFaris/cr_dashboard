import { createEffect, onCleanup, onMount } from "solid-js";
import { SERIES_COLOR } from "../constants";

export default function Sparkline(props) {
  let canvas;
  let frame = 0;

  const draw = () => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    const values = props.values;
    const color =
      getComputedStyle(document.documentElement)
        .getPropertyValue(SERIES_COLOR[props.series])
        .trim() || "#5eead4";

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = 5;
    if (values.length < 1) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, height / 2);
      ctx.lineTo(width - pad, height / 2);
      ctx.stroke();
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const innerWidth = width - pad * 2;
    const innerHeight = height - pad * 2;

    const xAt = (index) =>
      pad + (values.length === 1 ? innerWidth : (index / (values.length - 1)) * innerWidth);
    const yAt = (value) => pad + innerHeight - ((value - min) / span) * innerHeight;

    const gradient = ctx.createLinearGradient(0, pad, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");

    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(values[0]));
    for (let i = 1; i < values.length; i += 1) {
      ctx.lineTo(xAt(i), yAt(values[i]));
    }
    ctx.lineTo(xAt(values.length - 1), height - pad);
    ctx.lineTo(xAt(0), height - pad);
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(values[0]));
    for (let i = 1; i < values.length; i += 1) {
      ctx.lineTo(xAt(i), yAt(values[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    const lastX = xAt(values.length - 1);
    const lastY = yAt(values[values.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  };

  createEffect(() => {

    props.values.length;
    draw();
  });

  onMount(() => {
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);
    onCleanup(() => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    });
  });

  return <canvas ref={canvas} height="52" aria-hidden="true" />;
}
