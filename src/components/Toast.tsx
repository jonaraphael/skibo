import { useEffect, useRef, useState } from "react";
import { canEdit, useApp } from "../app/store";
import { Icon } from "./Icon";
export const Toast = () => {
  const toast = useApp((s) => s.toast);
  const disabled = useApp((s) => !canEdit(s));
  const notify = useApp((s) => s.notify);
  const box = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    setFocused(!!box.current?.contains(document.activeElement));
  }, [toast]);
  useEffect(() => {
    if (!toast || hovered || focused) return;
    const timer = window.setTimeout(
      () => notify(null),
      toast.undo ? 5000 : 4000,
    );
    return () => window.clearTimeout(timer);
  }, [toast, notify, hovered, focused]);
  if (!toast) return null;
  return (
    <div
      ref={box}
      className="toast"
      role="status"
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <Icon name="check" size={18} />
      <span>{toast.message}</span>
      {toast.undo && (
        <button disabled={disabled} onClick={toast.undo}>
          Undo
        </button>
      )}
      <button
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={() => notify(null)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
};
