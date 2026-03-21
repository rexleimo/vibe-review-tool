import { createBrowserRouter } from "react-router-dom";
import DownloadPage from "./pages/DownloadPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

export const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage locale="en" /> },
    { path: "/download", element: <DownloadPage locale="en" /> },
    { path: "/zh", element: <HomePage locale="zh" /> },
    { path: "/zh/download", element: <DownloadPage locale="zh" /> },
    { path: "*", element: <NotFoundPage /> },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
