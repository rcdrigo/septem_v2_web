import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ModeladorPage } from './pages/modelador/ModeladorPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/modelador" replace /> },
        { path: 'modelador', element: <ModeladorPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
