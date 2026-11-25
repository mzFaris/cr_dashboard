import Sparkline from "./Sparkline";

export default function MetricCard(props) {
  return (
    <article class="card metric" data-series={props.series}>
      <header class="metric-head">
        <h3>{props.title}</h3>
        <span class="metric-unit">{props.unit}</span>
      </header>
      <p class="metric-value">
        <span>{props.value}</span>
      </p>
      <Sparkline series={props.series} values={props.values} />
      <p class="metric-meta" classList={{ warn: props.warn }}>
        {props.meta}
      </p>
    </article>
  );
}
