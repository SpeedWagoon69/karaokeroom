import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import './SongForm.css';

interface Song {
  id: string;
  title: string;
  artist: string;
  description?: string; 
  singer_first_name: string;
  singer_last_name: string;
  created_at: string;
}

export default function AdminView() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsPerTurn, setSongsPerTurn] = useState(1);
  const [loading, setLoading] = useState(false);

  // --- NOTIFICACIONES ---
  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Este navegador no soporta notificaciones');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  };

  const showNewSongNotification = (song: Song) => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification('🎤 Nueva canción en la fila', {
        body: `${song.singer_first_name} ${song.singer_last_name} — ${song.title}`,
        // icon: '/icon.png' // opcional: añade ruta a un icono si quieres
      });
    } catch (err) {
      // No bloquear en caso de error con las notificaciones
      // eslint-disable-next-line no-console
      console.error('Error mostrando notificación', err);
    }
  };
  // -----------------------

  // 1. Algoritmo de organización (Puro y directo)
  // Reemplaza la función organizeQueue existente por esta versión
const organizeQueue = (rawSongs: Song[], limit: number) => {
  if (!rawSongs || rawSongs.length === 0) return [];

  const singerKey = (s: Song) =>
    `${(s.singer_first_name || '').trim().toLowerCase()}_${(s.singer_last_name || '').trim().toLowerCase()}`;

  const bySinger: Record<string, Song[]> = {};
  const sorted = [...rawSongs].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const song of sorted) {
    const k = singerKey(song);
    if (!bySinger[k]) bySinger[k] = [];
    bySinger[k].push(song);
  }

  const queue: Song[] = [];

  while (true) {
    const available = Object.values(bySinger).filter(arr => arr.length > 0);
    if (available.length === 0) break;

    available.sort((a, b) =>
      new Date(a[0].created_at).getTime() - new Date(b[0].created_at).getTime()
    );

    const chosenArr = available[0];
    const take = Math.min(limit, chosenArr.length);

    for (let i = 0; i < take; i++) {
      queue.push(chosenArr.shift()!);
    }
  }

  return queue;
};



  // 2. Carga de datos unificada
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Traemos canciones y config al mismo tiempo para evitar desajustes
      const [songsRes, configRes] = await Promise.all([
        supabase.from('songs').select('*').order('created_at', { ascending: true }),
        supabase.from('karaoke_config').select('songs_per_turn').single()
      ]);

      if (configRes.data) {
        setSongsPerTurn(configRes.data.songs_per_turn);
        if (songsRes.data) {
          // Organizamos inmediatamente con el límite que acaba de llegar de la DB
          const organized = organizeQueue(songsRes.data as Song[], configRes.data.songs_per_turn);
          setSongs(organized);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('karaoke_config').select('admin_password').single();
    if (passwordInput === data?.admin_password) {
      // Pedimos permiso de notificaciones al iniciar sesión
      const allowed = await requestNotificationPermission();
      if (!allowed) {
        // aviso no obligatorio para continuar, pero recomendable
        alert("Necesitas aceptar notificaciones para recibir avisos de nuevas canciones");
      }

      setIsAuthenticated(true);
      fetchData();
    } else {
      alert("Contraseña Incorrecta");
    }
  };

  // 3. Suscripción Realtime Total
useEffect(() => {
  if (!isAuthenticated) return;

  const channel = supabase.channel('admin_main_channel')
    // Notificar/actualizar cuando entre una nueva canción
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'songs' },
      (payload: { new: Song }) => {
        const newSong = payload.new as Song;
        showNewSongNotification(newSong);
        fetchData();
      }
    )
    // Escuchar DELETE para refrescar cuando alguien borre una canción desde otra instancia
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'songs' },
      () => {
        fetchData();
      }
    )
    // Seguimos escuchando cambios en la configuración
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'karaoke_config' }, () => fetchData())
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
}, [isAuthenticated, fetchData]);



  const updateTurns = async (val: number) => {
    // Actualizamos en DB; el evento Realtime hará que fetchData() se ejecute en todos lados
    await supabase.from('karaoke_config').update({ songs_per_turn: val }).eq('id', 1);
  };

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="glass-card" style={{ maxWidth: '400px', padding: '30px' }}>
          <h2>Admin Access 🔐</h2>
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
    <div className="container" style={{ flexDirection: 'column', gap: '20px', padding: '20px' }}>
      
      <div className="glass-card" style={{ maxWidth: '800px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>Configuración de Turnos:</span>
          <select 
            className="modern-input" 
            style={{ width: '200px' }} 
            value={songsPerTurn}
            onChange={(e) => updateTurns(parseInt(e.target.value))}
          >
            <option value={1}>1 Canción p/p</option>
            <option value={2}>2 Canciones p/p</option>
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ maxWidth: '800px', width: '100%', padding: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Fila 🎤 {loading && "..."}</h2>
          <button onClick={() => setIsAuthenticated(false)} className="submit-btn" style={{ width: 'auto', padding: '5px 15px', fontSize: '0.8rem' }}>Salir</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {songs.map((song, index) => (
            <div key={song.id} style={itemStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={circleStyle}>{index + 1}</div>
                <div>
                  <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{song.title}</strong>
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{song.singer_first_name}</span>
                    {' '}
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{song.singer_last_name}</span>
                    <span style={{ color: '#94a3b8' }}> — {song.artist}</span>
                  </div>
                  {song.description && (
                    <div style={descStyle}>📝 {song.description}</div>
                  )}
                </div>
              </div>
              <button
  onClick={async () => {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', song.id);

    if (error) {
      console.error('Error al eliminar canción:', error.message);
      alert('No se pudo eliminar la canción');
    }
  }}
  style={doneBtnStyle}
>
  LISTO
</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Estilos
const itemStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 18px', background: 'rgba(255,255,255,0.05)',
  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)'
};

const descStyle: React.CSSProperties = {
  marginTop: '5px', fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic'
};

const circleStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
  minWidth: '35px', height: '35px', borderRadius: '8px',
  display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.9rem'
};

const doneBtnStyle: React.CSSProperties = {
  background: '#10b981', color: 'white', border: 'none',
  padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
};
