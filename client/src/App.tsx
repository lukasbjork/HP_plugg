// App-rot med React Router och global layout
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Practice } from './pages/Practice';
import { Simulation } from './pages/Simulation';
import { Library } from './pages/Library';
import { Statistics } from './pages/Statistics';
import { Flashcards } from './pages/Flashcards';

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/library" element={<Library />} />
          <Route path="/stats" element={<Statistics />} />
          <Route path="/flashcards" element={<Flashcards />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
