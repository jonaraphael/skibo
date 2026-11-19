import { canEdit, useApp } from "../app/store";
import { Completion } from "../app/types";

export const UndoCompletion = ({ entry }: { entry: Completion }) => {
  const undo = useApp((s) => s.undo);
  const editable = useApp(canEdit);
  return (
    <button
      type="button"
      className="text-link"
      aria-label={`Undo completion of ${entry.taskTitle} at ${new Date(entry.at).toLocaleTimeString()}`}
      disabled={!editable}
      onClick={() => undo(entry.id)}
    >
      Undo
    </button>
  );
};
