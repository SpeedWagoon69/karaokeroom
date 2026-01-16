import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './SongForm.css';

export default function SongForm() {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // Estado para el modal
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    singer_first_name: '',
    singer_last_name: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación de seguridad extra
    if (!formData.title || !formData.artist || !formData.singer_first_name || !formData.singer_last_name) {
      alert("Por favor rellena todos los campos obligatorios");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('songs')
      .insert([formData]);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      // En lugar de alert(), mostramos nuestro modal
      setShowSuccess(true);
      setFormData({ title: '', artist: '', singer_first_name: '', singer_last_name: '', description: '' });
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="container">
      {/* MODAL PERSONALIZADO */}
      {showSuccess && (
        <div className="modal-overlay">
          <div className="success-modal">
            <span className="success-icon">✨</span>
            <h3>¡Recibido!</h3>
            <p style={{color: '#cbd5e1'}}>Tu canción ha sido agregada a la lista de espera con éxito.</p>
            <button 
              className="close-modal-btn" 
              onClick={() => setShowSuccess(false)}
            >
              GENIAL
            </button>
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="header">
          <h2>Karaoke Night 🎤</h2>
          <p>Pide tu cancion y brilla en el escenario</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Canción *</label>
            <input
              name="title"
              className="modern-input"
              type="text"
              placeholder="Ej. Bésame Mucho"
              value={formData.title}
              onChange={handleChange}
              required // Obligatorio
            />
          </div>

          <div className="form-group">
            <label>Artista Original *</label>
            <input
              name="artist"
              className="modern-input"
              type="text"
              placeholder="Ej. Luis Miguel"
              value={formData.artist}
              onChange={handleChange}
              required // Obligatorio
            />
          </div>

          <div className="row">
            <div className="form-group">
              <label>Tu Nombre *</label>
              <input
                name="singer_first_name"
                className="modern-input"
                type="text"
                value={formData.singer_first_name}
                onChange={handleChange}
                required // Obligatorio
              />
            </div>
            <div className="form-group">
              <label>Tu Apellido *</label>
              <input
                name="singer_last_name"
                className="modern-input"
                type="text"
                value={formData.singer_last_name}
                onChange={handleChange}
                required // Obligatorio
              />
            </div>
          </div>

          <div className="form-group">
            <label>Dedicatoria (Opcional)</label>
            <textarea
              name="description"
              className="modern-input"
              rows={3}
              placeholder="Para alguien especial..."
              value={formData.description}
              onChange={handleChange}
              // Sin 'required'
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Enviando...' : '🚀 Enviar Pedido'}
          </button>
        </form>
      </div>
    </div>
  );
}