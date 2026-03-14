import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './app/layout';
import LandingPage from './app/page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout wraps all inner pages */}
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />       {/* Landing page */}
          <Route path="dashboard" element={<div>Dashboard</div>} />
          <Route path="automation" element={<div>Automation</div>} />
          <Route path="recovery" element={<div>Recovery</div>} />
          <Route path="settings" element={<div>Settings</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
