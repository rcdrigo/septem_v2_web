import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ModeladorPage } from './pages/ModeladorPage';
import { FormularioPage } from './pages/FormularioPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/modelador" replace /> },
      { path: 'modelador', element: <ModeladorPage /> },
      { path: 'formulario', element: <FormularioPage /> },
    ],
  },
]);
