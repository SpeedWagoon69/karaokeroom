import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SongForm from './components/SongForm';
import AdminView from './components/AdminView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SongForm />} />
        <Route path="/admin-panel" element={<AdminView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;