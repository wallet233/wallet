import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './app/page';
import Layout from './app/layout';

export default function App() {
  return (
      <BrowserRouter>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/*" element={<Layout />} />
      </Routes>
      </BrowserRouter>
         );
                              }