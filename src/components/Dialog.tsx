import { ReactNode, useEffect, useRef } from "react";
import { Icon } from "./Icon";
export const Dialog = ({
  title,
  children,
  close,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected && !previous.matches(":disabled")) {
        previous.focus({ preventScroll: true });
      } else {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      className={`sheet ${className}`}
      ref={ref}
      aria-label={title}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="sheet-top">
        <p className="eyebrow">{title}</p>
        <button
          className="icon-button"
          aria-label={`Close ${title}`}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
};
