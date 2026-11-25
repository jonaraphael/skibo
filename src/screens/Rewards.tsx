import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { canEdit, useApp } from "../app/store";
import { Effort, RewardSize } from "../app/types";
import { EmptyState, PageHeader } from "../components/Shared";
import { Icon } from "../components/Icon";
import { HoldNotice } from "../components/HoldNotice";
import { UndoCompletion } from "../components/UndoCompletion";
import { RewardRedraw } from "../components/RewardRedraw";
import { activeHolds, targetMisses } from "../lib/tasks/taxonomy";
import { RecordChart } from "../components/RecordChart";
import { useWorkspace } from "../components/Workspace";
import {
  availableMix,
  completions,
  forecastRewards,
  nextIntroductoryDraw,
  RewardCompletion,
  trayRewards,
  unrewardedDraws,
  weeklyBigWins,
} from "../lib/rewards/engine";
import {
  addDays,
  dayKey,
  liveEvents,
  prettyDate,
  weekStart,
} from "../lib/schedule/calendar";

export const Rewards = () => {
  const { tab = "tray" } = useParams();
  const { data, enjoy, saveReward } = useApp();
  const storageError = useApp((s) => !canEdit(s));
  const { openReward, now } = useWorkspace();
  const tray = trayRewards(data.events);
  const held = activeHolds(data, now).length > 0;
  const [size, setSize] = useState("all");
  const [range, setRange] = useState("week");
  const [showEnjoyed, setShowEnjoyed] = useState(false);
  const all = useMemo(() => completions(data.events), [data.events]);
  const today = dayKey(now, data.preferences.dayStart);
  const start =
    range === "week"
      ? weekStart(today)
      : range === "month"
        ? `${today.slice(0, 7)}-01`
        : "0000-00-00";
  const filtered = all.filter(
    (e) => dayKey(new Date(e.at), data.preferences.dayStart) >= start,
  );
  const draws = filtered.filter((e) => e.roll !== null);
  const misses = [
    ...liveEvents(data.events),
    ...targetMisses(data, now),
  ].filter(
    (e) =>
      (e.type === "skipped" || e.type === "missed") &&
      dayKey(new Date(e.at), data.preferences.dayStart) >= start,
  );
  const paid = filtered.filter((e) => e.reward).length;
  const enjoyedIds = new Set(
    liveEvents(data.events)
      .filter((e) => e.type === "enjoyed")
      .map((e) => e.target),
  );
  const earned = all.filter((e) => e.reward && enjoyedIds.has(e.id));
  const bigThisWeek = weeklyBigWins(all, now, data.preferences.dayStart);
  const streak = nextIntroductoryDraw(data) === null ? unrewardedDraws(data.events) : 0;
  const allowBig =
    data.preferences.bigRewardCap === null ||
    bigThisWeek < data.preferences.bigRewardCap;
  const forecast = useMemo(() => {
    if (tab !== "menu") return null;
    const start = addDays(today, -6);
    const efforts = all
      .filter((e) => e.roll !== null && dayKey(new Date(e.at), data.preferences.dayStart) >= start)
      .map((e) => data.tasks.find((t) => t.id === e.taskId)?.effort ?? "solid");
    return forecastRewards(efforts, data.rewards, data.preferences.bigRewardCap);
  }, [tab, all, today, data.preferences, data.rewards, data.tasks]);
  const rows = showEnjoyed ? [...earned].reverse() : [...tray].reverse();
  const odds = (effort: Effort, rewardSize: RewardSize) =>
    `${Math.round(availableMix(effort, data.rewards, allowBig, streak)[rewardSize] * 100)}%`;
  const rewardCard = (e: RewardCompletion) => (
    <article
      key={e.id}
      className={`reward-card ${showEnjoyed ? "enjoyed" : ""}`}
    >
      <div className="reward-card-top">
        <span className="reward-label">
          <i className="reward-dot" />
          {e.reward!.size} reward
        </span>
        <time>
          {prettyDate(dayKey(new Date(e.at), data.preferences.dayStart))}
        </time>
      </div>
      <h2 aria-live="polite">{e.reward!.title}</h2>
      <div className="reward-card-bottom">
        <span>
          From <strong>{e.taskTitle}</strong>
        </span>
        {!showEnjoyed ? (
          <div className="tray-actions">
            <RewardRedraw entry={e} />
            <button
              className={`button reward-button ${held ? "held" : ""}`}
              disabled={!!storageError || held}
              onClick={() => enjoy(e.id)}
            >
              {held ? "On hold" : "Enjoy"}
              {!held && <Icon name="check" size={16} />}
            </button>
          </div>
        ) : (
          <span className="enjoyed-label">
            <Icon name="check" size={14} /> Enjoyed
          </span>
        )}
      </div>
    </article>
  );
  return (
    <>
      <PageHeader
        title={
          tab === "tray"
            ? "Reward tray"
            : tab === "menu"
              ? "Reward menu"
              : "Record"
        }
      />
      <nav className="reward-tabs" aria-label="Rewards">
        <NavLink to="/rewards/tray">
          Tray <span>{tray.length}</span>
        </NavLink>
        <NavLink to="/rewards/menu">Menu</NavLink>
        <NavLink to="/rewards/record">Record</NavLink>
      </nav>
      {tab === "tray" && (
        <>
          <HoldNotice />
          <div className="list-heading">
            <h2>{showEnjoyed ? "Enjoyed rewards" : "Waiting rewards"}</h2>
            <button
              className="text-link"
              onClick={() => setShowEnjoyed(!showEnjoyed)}
            >
              {showEnjoyed ? "Back to tray" : `Enjoyed · ${earned.length}`}
            </button>
          </div>
          <div className="reward-grid">{rows.map(rewardCard)}</div>
          {!rows.length && (
            <EmptyState
              title={
                showEnjoyed ? "No enjoyed rewards yet." : "No rewards waiting."
              }
            >
              {showEnjoyed
                ? "Rewards you mark as enjoyed appear here."
                : "Complete a task to draw for a reward from your menu."}
            </EmptyState>
          )}
        </>
      )}
      {tab === "menu" && forecast && (
        <>
          <section className="odds-banner">
            <Icon name="rewards" size={21} />
            <p>
              <strong>
                Each standard draw has a 30% chance of a reward.
              </strong>{" "}
              Consecutive misses shift the size mix toward larger eligible gifts.
              A win resets the mix for the next draw.
            </p>
            <button
              className="button primary"
              disabled={!!storageError}
              onClick={() => openReward()}
            >
              <Icon name="plus" size={17} /> Add reward
            </button>
          </section>
          <div className="filter-pills menu-filters">
            {["all", "small", "medium", "big"].map((s) => (
              <button
                key={s}
                className={s === size ? "selected" : ""}
                aria-pressed={s === size}
                onClick={() => setSize(s)}
              >
                {s === "all" ? "All sizes" : s}
              </button>
            ))}
          </div>
          <div className="menu-list">
            {(["small", "medium", "big"] as const)
              .filter((s) => size === "all" || size === s)
              .map((s) => {
                const items = data.rewards.filter((r) => r.size === s);
                if (!items.length) return null;
                const paused = items.filter((r) => !r.active).length;
                return (
                  <section key={s} className="menu-section">
                    <div className="group-label">
                      <h2>{s} rewards</h2>
                      <span>
                        {items.length - paused} on the menu
                        {paused ? ` · ${paused} paused` : ""}
                      </span>
                    </div>
                    <ul>
                      {items.map((r) => (
                        <li
                          key={r.id}
                          className={`menu-item ${!r.active ? "inactive" : ""}`}
                        >
                          <h3>{r.title}</h3>
                          <button
                            className="pause-toggle"
                            aria-label={`${r.active ? "Pause" : "Resume"} ${r.title}`}
                            disabled={!!storageError}
                            onClick={() =>
                              saveReward({ ...r, active: !r.active }, r.id)
                            }
                          >
                            <i className={r.active ? "on" : ""} />
                            {r.active ? "On" : "Paused"}
                          </button>
                          <button
                            className="text-link"
                            aria-label={`Edit ${r.title}`}
                            onClick={() => openReward(r)}
                          >
                            Edit
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
          <section className="forecast panel">
            <div>
              <p className="eyebrow">At your recent pace</p>
              <h2>Expected rewards per week.</h2>
              <p>
                A fresh week at your last 7 days’ pace, using today’s menu and
                your weekly cap.
              </p>
            </div>
            <div className="forecast-numbers">
              {(["small", "medium", "big"] as const).map((s) => (
                <div key={s}>
                  <strong>{forecast[s].toFixed(1)}</strong>
                  <span>{s} / week</span>
                </div>
              ))}
            </div>
          </section>
          <section className="odds-table panel">
            <p className="eyebrow">Size odds</p>
            <h2>Size chances for your next win.</h2>
            <table>
              <thead>
                <tr>
                  <th>Task effort</th>
                  <th>Small</th>
                  <th>Medium</th>
                  <th>Big</th>
                </tr>
              </thead>
              <tbody>
                {(["light", "solid", "heavy"] as const).map((e) => (
                  <tr key={e}>
                    <th>{e}</th>
                    {(["small", "medium", "big"] as const).map((s) => (
                      <td key={s}>{odds(e, s)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Paused or missing sizes are removed and the other weights are
              scaled to 100%. If no eligible size is active, the completion is
              recorded without a reward.{" "}
              {data.preferences.bigRewardCap !== null
                ? `Big rewards: ${bigThisWeek} of ${data.preferences.bigRewardCap} this week. Once capped, rolls draw from the other active sizes.`
                : "There is no weekly cap on big rewards."}
            </p>
          </section>
        </>
      )}
      {tab === "record" && (
        <>
          <div className="toolbar">
            <h2>Your cumulative record</h2>
            <div className="segmented">
              {["week", "month", "all"].map((r) => (
                <button
                  key={r}
                  aria-pressed={range === r}
                  className={r === range ? "selected" : ""}
                  onClick={() => setRange(r)}
                >
                  {r === "all" ? "All time" : `This ${r}`}
                </button>
              ))}
            </div>
          </div>
          <section className="record-panel panel">
            <div className="record-stats">
              <div>
                <strong>{filtered.length}</strong>
                <span>tasks done</span>
              </div>
              <div className="reward-number">
                <strong>{paid}</strong>
                <span>rewards earned</span>
              </div>
              <div>
                <strong>
                  {draws.length
                    ? `${Math.round((paid / draws.length) * 100)}%`
                    : "—"}
                </strong>
                <span>
                  {paid} of {draws.length} draws
                </span>
              </div>
              <div>
                <strong>
                  {filtered.filter((e) => enjoyedIds.has(e.id)).length}
                </strong>
                <span>rewards enjoyed</span>
              </div>
            </div>
            <RecordChart events={filtered} />
            <p className="quiet-note">
              One step for every completion. A flower for every reward.
              Each standard draw has a 30% chance of a reward.
            </p>
          </section>
          <div className="group-label">
            <h3>Completions</h3>
            <span>{filtered.length}</span>
          </div>
          <div className="activity-list">
            {[...filtered].reverse().map((e) => (
              <article key={e.id}>
                <span className={`activity-symbol ${e.reward ? "paid" : ""}`}>
                  <Icon name={e.reward ? "rewards" : "leaf"} size={19} />
                </span>
                <div>
                  <strong>{e.taskTitle}</strong>
                  <p>
                    {e.reward
                      ? e.reward.title
                      : e.roll === null
                        ? e.noDrawReason === "empty-menu"
                          ? "No eligible rewards · no draw"
                          : "Clock restarted · no draw"
                        : "No reward"}
                  </p>
                </div>
                <time>
                  {prettyDate(
                    dayKey(new Date(e.at), data.preferences.dayStart),
                  )}
                  <small>
                    {e.roll === null ? "No draw" : `Roll ${e.roll.toFixed(4)}`}
                  </small>
                </time>
                <UndoCompletion entry={e} />
              </article>
            ))}
          </div>
          {misses.length > 0 && (
            <section className="miss-record">
              <div className="group-label">
                <h3>Misses</h3>
                <span>{misses.length}</span>
              </div>
              {misses.map((e) => (
                <div className="history-line" key={e.id}>
                  <span>
                    {"taskTitle" in e ? e.taskTitle : ""} ·{" "}
                    {e.type === "missed"
                      ? "Unmet target at deadline"
                      : "Declared miss"}
                  </span>
                  <time>
                    {prettyDate(
                      dayKey(new Date(e.at), data.preferences.dayStart),
                    )}
                  </time>
                </div>
              ))}
            </section>
          )}
          {!filtered.length && (
            <EmptyState title="No completions yet.">
              Completed tasks and their reward outcomes appear here.
            </EmptyState>
          )}
        </>
      )}
    </>
  );
};
