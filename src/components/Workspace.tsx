import { createContext, useContext } from "react";
import { Reward, Task } from "../app/types";
export const WorkspaceContext = createContext<{
  openTask: (task?: Task) => void;
  openReward: (reward?: Reward) => void;
  now: Date;
}>({ openTask: () => {}, openReward: () => {}, now: new Date() });
export const useWorkspace = () => useContext(WorkspaceContext);
