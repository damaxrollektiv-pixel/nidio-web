import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Supabase ──────────────────────────────────────────────
const SUPABASE_URL = 'https://raknbkruqhlrpiiswyou.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJha25ia3J1cWhscnBpaXN3eW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzkyODAsImV4cCI6MjA5NDA1NTI4MH0.q8oC8g2whEJWJmASf9NLZuk7BSKdWgzOFtlHgAeVNhU'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
const signUp = (email, password) => supabase.auth.signUp({ email, password })
const signOut = () => supabase.auth.signOut()

const getLocations = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select('*, media_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

const createLocation = async (location) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('locations')
    .insert({ ...location, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

const deleteLocation = async (id) => {
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw error
}

const uploadMedia = async (locationId, file, type) => {
  const { data: { user } } = await supabase.auth.getUser()
  const ext = file.name.split('.').pop()
  const path = `${user.id}/${locationId}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('nidio-media').upload(path, file)
  if (uploadError) throw uploadError
  const { data: { publicUrl } } = supabase.storage.from('nidio-media').getPublicUrl(path)
  const { data, error } = await supabase.from('media_items').insert({
    location_id: locationId, user_id: user.id, type,
    file_url: publicUrl, file_name: file.name, file_size: file.size,
  }).select().single()
  if (error) throw error
  return data
}

const addTextContent = async (locationId, title, content) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('media_items').insert({
    location_id: locationId, user_id: user.id, type: 'text', title, content,
  }).select().single()
  if (error) throw error
  return data
}

const deleteMediaItem = async (id) => {
  const { error } = await supabase.from('media_items').delete().eq('id', id)
  if (error) throw error
}

// ── Leaflet fix ───────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})
const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

// ── Constants ─────────────────────────────────────────────
const MEDIA_TYPES = [
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'photo', label: 'Foto', icon: '🖼' },
  { value: 'audio', label: 'Audio', icon: '🎵' },
  { value: 'video', label: 'Video', icon: '🎬' },
]
const ACCEPT = { photo: 'image/*', audio: 'audio/*', video: 'video/*' }

// ── Login ─────────────────────────────────────────────────
function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess('Bestätigungsmail gesendet – bitte E-Mail prüfen.')
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">nidio</span>
          <span className="login-tagline">Orte die sprechen.</span>
        </div>
        <div className="login-tabs">
          <button className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Anmelden</button>
          <button className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Registrieren</button>
        </div>
        <form onSubmit={handle} className="login-form">
          <div className="field">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required />
          </div>
          <div className="field">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div className="msg error">{error}</div>}
          {success && <div className="msg success">{success}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Lädt…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Map click handler ─────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) })
  return null
}

// ── Dashboard ─────────────────────────────────────────────
function Dashboard({ session }) {
  const [locations, setLocations] = useState([])
  const [selected, setSelected] = useState(null)
  const [pendingPin, setPendingPin] = useState(null)
  const [panel, setPanel] = useState('list')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [mediaType, setMediaType] = useState('text')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const load = async () => {
    try { const data = await getLocations(); setLocations(data || []) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])

  const handleMapClick = (latlng) => {
    if (panel === 'new-location' || panel === 'list') {
      setPendingPin(latlng); setPanel('new-location')
      setNewName(''); setNewDesc('')
    }
  }

  const saveLocation = async (e) => {
    e.preventDefault()
    if (!pendingPin) return
    setSaving(true); setError('')
    try {
      const loc = await createLocation({ name: newName, description: newDesc, lat: pendingPin.lat, lng: pendingPin.lng, radius_m: 5 })
      await load(); setSelected(loc); setPendingPin(null); setPanel('location-detail')
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Location und alle Medien löschen?')) return
    try { await deleteLocation(id); setSelected(null); setPanel('list'); await load() }
    catch (e) { setError(e.message) }
  }

  const handleDeleteMedia = async (mediaId) => {
    try {
      await deleteMediaItem(mediaId)
      const updated = await getLocations(); setLocations(updated || [])
      const refreshed = updated.find(l => l.id === selected?.id)
      if (refreshed) setSelected(refreshed)
    } catch (e) { setError(e.message) }
  }

  const saveMedia = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (mediaType === 'text') { await addTextContent(selected.id, textTitle, textContent) }
      else { if (!file) throw new Error('Bitte Datei auswählen'); await uploadMedia(selected.id, file, mediaType) }
      const updated = await getLocations(); setLocations(updated || [])
      const refreshed = updated.find(l => l.id === selected.id)
      if (refreshed) setSelected(refreshed)
      setPanel('location-detail'); setTextTitle(''); setTextContent(''); setFile(null)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const selectedLocation = selected ? locations.find(l => l.id === selected.id) || selected : null

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">nidio</span>
          <button className="btn-icon" title="Abmelden" onClick={signOut}>↪</button>
        </div>

        {panel === 'list' && (
          <div className="panel">
            <div className="panel-top"><h2>Deine Orte</h2><span className="count">{locations.length}</span></div>
            <p className="hint">Klick auf die Karte um einen neuen Ort zu setzen.</p>
            {locations.length === 0 && <div className="empty">Noch keine Orte. Klick auf die Karte!</div>}
            <div className="location-list">
              {locations.map(loc => (
                <div key={loc.id} className={`location-item ${selectedLocation?.id === loc.id ? 'active' : ''}`}
                  onClick={() => { setSelected(loc); setPanel('location-detail') }}>
                  <div className="loc-name">{loc.name}</div>
                  <div className="loc-meta">{loc.media_items?.length || 0} Medien · {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === 'new-location' && (
          <div className="panel">
            <button className="back-btn" onClick={() => { setPanel('list'); setPendingPin(null) }}>← Zurück</button>
            <h2>Neuer Ort</h2>
            {pendingPin && <div className="coords">📍 {pendingPin.lat.toFixed(5)}, {pendingPin.lng.toFixed(5)}</div>}
            {!pendingPin && <p className="hint">Klick auf die Karte um den Ort zu setzen.</p>}
            <form onSubmit={saveLocation} className="form">
              <div className="field"><label>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Brandenburger Tor" required /></div>
              <div className="field"><label>Beschreibung (optional)</label><textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Was gibt es hier zu entdecken?" rows={3} /></div>
              <div className="field"><label>Radius</label><div className="radius-display">5 Meter</div></div>
              {error && <div className="msg error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={saving || !pendingPin}>{saving ? 'Speichert…' : 'Ort speichern'}</button>
            </form>
          </div>
        )}

        {panel === 'location-detail' && selectedLocation && (
          <div className="panel">
            <button className="back-btn" onClick={() => setPanel('list')}>← Alle Orte</button>
            <div className="detail-header">
              <h2>{selectedLocation.name}</h2>
              <button className="btn-danger-sm" onClick={() => handleDelete(selectedLocation.id)}>🗑</button>
            </div>
            {selectedLocation.description && <p className="detail-desc">{selectedLocation.description}</p>}
            <div className="coords">📍 {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)} · {selectedLocation.radius_m}m</div>
            <div className="media-section">
              <div className="media-header">
                <span>Medien ({selectedLocation.media_items?.length || 0})</span>
                <button className="btn-add" onClick={() => setPanel('add-media')}>+ Hinzufügen</button>
              </div>
              <div className="media-list">
                {(selectedLocation.media_items || []).map(item => (
                  <div key={item.id} className="media-item">
                    <div className="media-icon">{item.type === 'text' ? '📝' : item.type === 'photo' ? '🖼' : item.type === 'audio' ? '🎵' : '🎬'}</div>
                    <div className="media-info">
                      <div className="media-name">{item.title || item.file_name || item.type}</div>
                      <div className="media-type">{item.type}</div>
                    </div>
                    <button className="btn-icon-sm" onClick={() => handleDeleteMedia(item.id)}>×</button>
                  </div>
                ))}
                {(!selectedLocation.media_items || selectedLocation.media_items.length === 0) && (
                  <div className="empty-media">Noch keine Medien. Füge etwas hinzu!</div>
                )}
              </div>
            </div>
          </div>
        )}

        {panel === 'add-media' && selectedLocation && (
          <div className="panel">
            <button className="back-btn" onClick={() => setPanel('location-detail')}>← Zurück</button>
            <h2>Medien hinzufügen</h2>
            <p className="hint">zu: <strong>{selectedLocation.name}</strong></p>
            <div className="type-tabs">
              {MEDIA_TYPES.map(t => (
                <button key={t.value} className={`type-tab ${mediaType === t.value ? 'active' : ''}`}
                  onClick={() => { setMediaType(t.value); setFile(null) }}>{t.icon} {t.label}</button>
              ))}
            </div>
            <form onSubmit={saveMedia} className="form">
              {mediaType === 'text' && (<>
                <div className="field"><label>Titel</label><input value={textTitle} onChange={e => setTextTitle(e.target.value)} placeholder="Überschrift" /></div>
                <div className="field"><label>Text</label><textarea value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Was soll hier zu lesen sein?" rows={6} required /></div>
              </>)}
              {mediaType !== 'text' && (
                <div className="field">
                  <label>{MEDIA_TYPES.find(t => t.value === mediaType)?.label} auswählen</label>
                  <div className="file-drop" onClick={() => fileRef.current?.click()}>
                    {file ? <span className="file-name">{file.name}</span> : <span className="file-hint">Klicken um Datei auszuwählen</span>}
                    <input ref={fileRef} type="file" accept={ACCEPT[mediaType]} style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                  </div>
                </div>
              )}
              {error && <div className="msg error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Lädt hoch…' : 'Speichern'}</button>
            </form>
          </div>
        )}
      </aside>

      <main className="map-container">
        <MapContainer center={[52.52, 13.405]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onMapClick={handleMapClick} />
          {pendingPin && <Marker position={pendingPin} icon={selectedIcon}><Popup>Neuer Ort hier</Popup></Marker>}
          {locations.map(loc => (
            <div key={loc.id}>
              <Circle center={[loc.lat, loc.lng]} radius={loc.radius_m}
                pathOptions={{ color: selectedLocation?.id === loc.id ? '#7F77DD' : '#1D9E75', fillColor: selectedLocation?.id === loc.id ? '#7F77DD' : '#1D9E75', fillOpacity: 0.15, weight: 2 }} />
              <Marker position={[loc.lat, loc.lng]}
                icon={selectedLocation?.id === loc.id ? selectedIcon : new L.Icon.Default()}
                eventHandlers={{ click: () => { setSelected(loc); setPanel('location-detail') } }}>
                <Popup><strong>{loc.name}</strong><br />{loc.media_items?.length || 0} Medien<br />Radius: {loc.radius_m}m</Popup>
              </Marker>
            </div>
          ))}
        </MapContainer>
      </main>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session) })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="loading-screen"><div className="loading-logo">nidio</div></div>
  return session ? <Dashboard session={session} /> : <Login />
}
