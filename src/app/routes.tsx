import { Navigate, useRoutes } from "react-router-dom";
import { Dashboard } from "../screens/Dashboard";
import { Plan } from "../screens/Plan";
import { Rewards } from "../screens/Rewards";
import { Settings } from "../screens/Settings";
export const AppRoutes = () =>
  useRoutes([
    { path: "/", element: <Dashboard /> },
    { path: "/plan", element: <Plan /> },
    { path: "/rewards", element: <Navigate to="/rewards/tray" replace /> },
    { path: "/rewards/:tab", element: <Rewards /> },
    { path: "/settings", element: <Settings /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ]);
