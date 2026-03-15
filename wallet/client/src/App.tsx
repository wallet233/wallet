import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './app/layout';
import LandingPage from './app/page';
import DashboardPage from './app/dashboard/page';
import AutomationPage from './app/automation/page';
import RecoveryPage from './app/recovery/page';
import SettingsPage from './app/settings/page';

const pages = {
  dashboard: DashboardPage,
  automation: AutomationPage,
  recovery: RecoveryPage,
  settings: SettingsPage,
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          {Object.entries(pages).map(([path, Component]) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
