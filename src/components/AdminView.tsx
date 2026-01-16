import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import './SongForm.css';

interface Song {
  id: string;
  title: string;
  artist: string;
  singer_first_name: string;
  singer_last_name: string;
  created_at: string;
}

interface Config {
  songs_per_turn: number;
}

export default function AdminView() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [config, setConfig] = useState<Config>({ songs_per_turn: 1 });
  const [loading, setLoading] = useState(false);

  // 1. Algoritmo de organización (Memorizado para estabilidad)
  const organizeQueue = useCallback((rawSongs: Song[], limit: number) => {
    const queue: Song[] = [];
    const pool = [...rawSongs];
    let userTurns: Record<string, number> = {};

    while (pool.length > 0) {
      let found = false;
      for (let i = 0; i < pool.length; i++) {
        const userId = (pool[i].singer_first_name + pool[i].singer_last_name).toLowerCase();
        userTurns[userId] = userTurns[userId] || 0;

        if (userTurns[userId] < limit) {
          queue.push(pool[i]);
          userTurns[userId]++;
          pool.splice(i, 1);
          found = true;
          break;
        }
      }
      if (!found) userTurns = {}; 
    }
    return queue;
  }, []);

  // 2. Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: true });
      
      const { data: configData } = await supabase
        .from('karaoke_config')
        .select('songs_per_turn')
        .single();

      if (configData) setConfig(configData);
      if (songsData) {
        const organized = organizeQueue(songsData as Song[], configData?.songs_per_turn || 1);
        setSongs(organized);
      }
    } finally {
      setLoading(false);
    }
  }, [organizeQueue]);

  // 3. Login y carga inicial inmediata
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('karaoke_config').select('admin_password').single();
    
    if (passwordInput === data?.admin_password) {
      setIsAuthenticated(true);
      fetchData(); // Se llama aquí para evitar el error de renderizado en cascada
    } else {
      alert("Contraseña Incorrecta");
    }
  };

  // 4. Suscripción Realtime (Solo se activa al estar autenticado)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        fetchData(); 
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'karaoke_config' }, () => {
        fetchData();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchData]);

  const updateTurns = async (val: number) => {
    await supabase.from('karaoke_config').update({ songs_per_turn: val }).eq('id', 1);
    fetchData();
  };

  const deleteSong = async (id: string) => {
    await supabase.from('songs').delete().eq('id', id);
  };

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="glass-card" style={{ maxWidth: '400px', padding: '30px' }}>
          <div className="header">
            <h2 style={{ fontSize: '1.8rem' }}>Admin Access 🔐</h2>
          </div>
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              className="modern-input" 
              placeholder="Contraseña" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
            />
            <button className="submit-btn" style={{ marginTop: '20px' }}>ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ flexDirection: 'column', gap: '20px', padding: '30px 20px' }}>
      
      {/* Configuración */}
      <div className="glass-card" style={{ maxWidth: '900px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Turnos por cantante:</span>
          <select 
            className="modern-input" 
            style={{ width: '250px', cursor: 'pointer', fontSize: '1rem' }} 
            value={config.songs_per_turn}
            onChange={(e) => updateTurns(parseInt(e.target.value))}
          >
            <option value={1}>1 Canción</option>
            <option value={2}>2 Canciones</option>
          </select>
        </div>
      </div>

      {/* Lista de Gestión */}
      <div className="glass-card" style={{ maxWidth: '900px', width: '100%', padding: '30px' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h2 style={{ fontSize: '2.2rem', margin: 0 }}>Fila de Cantantes 🎤</h2>
            <p style={{ opacity: 0.7 }}>{loading ? 'Sincronizando...' : 'Actualización en vivo activa'}</p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="submit-btn" style={{ width: 'auto', padding: '10px 20px', background: '#334155' }}>Salir</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {songs.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.5, padding: '60px', fontSize: '1.2rem' }}>No hay solicitudes pendientes.</p>
          ) : (
            songs.map((song, index) => (
              <div key={song.id} style={itemStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={circleStyle}>{index + 1}</div>
                  <div>
                    <strong style={{ color: '#fff', fontSize: '1.8rem', display: 'block' }}>{song.title}</strong>
                    <div style={{ marginTop: '5px' }}>
                      <span style={{ color: '#c084fc', fontSize: '1.3rem', fontWeight: 'bold' }}>{song.singer_first_name}</span>
                      <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}> — {song.artist}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteSong(song.id)}
                  style={doneBtnStyle}
                >
                  TERMINAR
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Estilos Equilibrados
const itemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '20px 25px',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.1)'
};

const circleStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
  minWidth: '50px',
  height: '50px',
  borderRadius: '12px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.4rem',
  fontWeight: 'bold',
  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
};

const doneBtnStyle: React.CSSProperties = {
  background: '#10b981',
  color: 'white',
  border: 'none',
  padding: '12px 20px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.9rem'
};