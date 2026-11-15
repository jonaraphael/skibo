import { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useApp } from "../app/store";
import { Completion, Effort, RewardSize } from "../app/types";
import { EmptyState, PageHeader } from "../components/Shared";
import { Icon } from "../components/Icon";
import { RecordChart } from "../components/RecordChart";
import { useWorkspace } from "../components/Workspace";
import {
  availableMix,
  completions,
  forecastRewards,
  trayRewards,
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
  const { data, enjoy, saveReward, storageError } = useApp();
  const { openReward, now } = useWorkspace();
  const tray = trayRewards(data.events);
  const [size, setSize] = useState("all");
  const [range, setRange] = useState("week");
  const [showEnjoyed, setShowEnjoyed] = useState(false);
  const all = completions(data.events);
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
  const paid = filtered.filter((e) => e.reward).length;
  const enjoyedIds = new Set(
    liveEvents(data.events)
      .filter((e) => e.type === "enjoyed")
      .map((e) => e.target),
  );
  const earned = all.filter((e) => e.reward && enjoyedIds.has(e.id));
  const previousWeek = all.filter(
    (e) =>
      dayKey(new Date(e.at), data.preferences.dayStart) >= addDays(today, -6),
  );
  const week = weekStart(today);
  const bigThisWeek = all.filter(
    (e) =>
      e.reward?.size === "big" &&
      weekStart(dayKey(new Date(e.at), data.preferences.dayStart)) === week,
  ).length;
  const allowBig =
    data.preferences.bigRewardCap === null ||
    bigThisWeek < data.preferences.bigRewardCap;
  const forecast = forecastRewards(
    previousWeek.map(
      (e) => data.tasks.find((t) => t.id === e.taskId)?.effort ?? "solid",
    ),
    data.rewards,
    data.preferences.bigRewardCap,
  );
  const rows = showEnjoyed ? [...earned].reverse() : [...tray].reverse();
  const odds = (effort: Effort, rewardSize: RewardSize) =>
    `${Math.round(availableMix(effort, data.rewards, allowBig)[rewardSize] * 100)}%`;
  const rewardCard = (e: Completion) => (
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
      <h2>{e.reward!.title}</h2>
      <div className="reward-card-bottom">
        <span>
          From <strong>{e.taskTitle}</strong>
        </span>
        {!showEnjoyed ? (
          <button
            className="button reward-button"
            disabled={!!storageError}
            onClick={() => enjoy(e.id)}
          >
            Enjoy <Icon name="check" size={16} />
          </button>
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
        eyebrow="The good part"
        title={
          tab === "tray"
            ? "You've earned a little good."
            : tab === "menu"
              ? "Good things, chosen by you."
              : "Every little step, remembered."
        }
        description={
          tab === "tray"
            ? "No expiry dates. No rush. These are yours to enjoy."
            : tab === "menu"
              ? "Fill your menu with things that make the effort feel worth it."
              : "A record of showing up. And the good things along the way."
        }
      />
      <nav className="reward-tabs" aria-label="Rewards">
        <NavLink to="/rewards/tray">
          Your tray <span>{tray.length}</span>
        </NavLink>
        <NavLink to="/rewards/menu">The menu</NavLink>
        <NavLink to="/rewards/record">Your record</NavLink>
      </nav>
      {tab === "tray" && (
        <>
          <div className="list-heading">
            <h2>{showEnjoyed ? "Good things enjoyed" : "Waiting for you"}</h2>
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
                showEnjoyed
                  ? "Good things take their time."
                  : "Your next good thing is out there."
              }
            >
              {showEnjoyed
                ? "Rewards you enjoy will be remembered here."
                : "Finish an intention to take a chance. Each completion has a 30% chance of a reward when your menu has an eligible size."}
            </EmptyState>
          )}
          <p className="quiet-note">
            A reward is an invitation. You get to decide when to take it.
          </p>
        </>
      )}
      {tab === "menu" && (
        <>
          <section className="odds-banner">
            <Icon name="spark" size={21} />
            <p>
              <strong>A 3 in 10 chance, every time.</strong> Effort shapes the
              size. Your menu makes it meaningful.
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
          <div className="menu-grid">
            {data.rewards
              .filter((r) => size === "all" || size === r.size)
              .map((r) => (
                <article
                  key={r.id}
                  className={`menu-card ${!r.active ? "inactive" : ""}`}
                >
                  <span className="reward-label">
                    <i className="reward-dot" />
                    {r.size}
                  </span>
                  <h3>{r.title}</h3>
                  <div className="menu-card-footer">
                    <button className="text-link" onClick={() => openReward(r)}>
                      Edit
                    </button>
                    <button
                      className="pause-toggle"
                      aria-label={`${r.active ? "Pause" : "Resume"} ${r.title}`}
                      disabled={!!storageError}
                      onClick={() =>
                        saveReward({ ...r, active: !r.active }, r.id)
                      }
                    >
                      <i className={r.active ? "on" : ""} />
                      {r.active ? "On the menu" : "Paused"}
                    </button>
                  </div>
                </article>
              ))}
          </div>
          <section className="forecast panel">
            <div>
              <p className="eyebrow">At your recent pace</p>
              <h2>A little look ahead.</h2>
              <p>
                A fresh week at your last 7 days’ pace, with today's menu and
                your weekly cap. Actual draws vary.
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
            <p className="eyebrow">Nothing behind the curtain</p>
            <h2>When a roll wins, here's the size mix.</h2>
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
                  {filtered.length
                    ? `${Math.round((paid / filtered.length) * 100)}%`
                    : "—"}
                </strong>
                <span>
                  {paid} of {filtered.length} completions
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
              One step for every completion. An amber mark for every reward. The
              chance on each new roll is 30%; your observed rate will vary.
            </p>
          </section>
          <div className="group-label">
            <h3>What you've made happen</h3>
            <span>{filtered.length}</span>
          </div>
          <div className="activity-list">
            {[...filtered].reverse().map((e) => (
              <article key={e.id}>
                <span className={`activity-symbol ${e.reward ? "paid" : ""}`}>
                  <Icon name={e.reward ? "rewards" : "check"} size={19} />
                </span>
                <div>
                  <strong>{e.taskTitle}</strong>
                  <p>{e.reward ? e.reward.title : "A little progress made."}</p>
                </div>
                <time>
                  {prettyDate(
                    dayKey(new Date(e.at), data.preferences.dayStart),
                  )}
                  <small>Roll {e.roll.toFixed(4)}</small>
                </time>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <EmptyState title="A fresh page.">
              Your completions will build a record here, one step at a time.
            </EmptyState>
          )}
        </>
      )}
    </>
  );
};
