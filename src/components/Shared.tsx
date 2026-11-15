import { ReactNode } from "react";
import { Effort } from "../app/types";
import { Icon } from "./Icon";
export const EffortPips = ({ effort }: { effort: Effort }) => (
  <span
    className="effort-pips"
    aria-label={`${effort} effort`}
    title={`${effort} effort`}
  >
    {[0, 1, 2].map((i) => (
      <i
        key={i}
        className={
          i <= ["light", "solid", "heavy"].indexOf(effort) ? "filled" : ""
        }
      />
    ))}
  </span>
);
export const PageHeader = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) => (
  <header className="page-heading">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="lede">{description}</p>}
    </div>
    {children}
  </header>
);
export const EmptyState = ({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="empty-state">
    <div className="empty-symbol">
      <Icon name="leaf" size={28} />
    </div>
    <h3>{title}</h3>
    <p>{children}</p>
    {action}
  </div>
);
