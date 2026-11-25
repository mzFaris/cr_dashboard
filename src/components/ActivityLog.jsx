import { For, Show } from "solid-js";

export default function ActivityLog(props) {
  return (
    <section class="card activity" aria-labelledby="logHeading">
      <div class="card-head">
        <h2 id="logHeading">Activity</h2>
        <button type="button" class="btn ghost small" id="clearLog" onClick={props.onClear}>
          Clear
        </button>
      </div>
      <ol class="log" id="log" aria-live="polite" aria-label="Activity log">
        <Show when={props.logs.length > 0} fallback={<li class="log-empty">No activity.</li>}>
          <For each={props.logs}>
            {(entry) => (
              <li class="log-item" data-kind={entry.kind}>
                <span class="log-time">{entry.time}</span>
                <span class="log-msg">{entry.message}</span>
              </li>
            )}
          </For>
        </Show>
      </ol>
    </section>
  );
}
