import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plane, BedDouble, Train, Car, Ship, MapPin, Clock, Sparkles, Trash2, Pencil,
  ChevronRight, ChevronLeft, Loader2, Users, AlertTriangle, Search, Copy, Check,
  Calendar, CalendarCheck, CalendarX, CalendarPlus,
  Bell, BellOff, X,
} from 'lucide-react';

// --- Supabase ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- Design tokens ---
const COLORS = {
  bg: '#0E1A1D', surface: '#15292C', surfaceRaised: '#1C3236',
  border: '#1C3236', borderInput: '#25403F',
  amber: '#FDB454', teal: '#5FD3C4',
  text: '#F4F1E8', textMuted: '#84999B', textFaint: '#5A6E70',
  danger: '#FF6B5E',
};

const CATEGORY_META = {
  flight: { label: 'Flyg', Icon: Plane },
  hotel:  { label: 'Hotell', Icon: BedDouble },
  train:  { label: 'Tåg', Icon: Train },
  ferry:  { label: 'Färja', Icon: Ship },
  car:    { label: 'Hyrbil', Icon: Car },
  other:  { label: 'Övrigt', Icon: MapPin },
};
const LIVE_STATUS_CATEGORIES = ['flight', 'ferry', 'train'];

const FAMILY = [
  { name: 'Mats',    color: '#FDB454' },
  { name: 'Nanny',   color: '#5FD3C4' },
  { name: 'Simon',   color: '#9B8CF2' },
  { name: 'Vanessa', color: '#F27DAA' },
];

// --- Helpers ---
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function toggleTraveler(list, name) {
  const c = list || [];
  return c.includes(name) ? c.filter(n => n !== name) : [...c, name];
}
function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
function formatDateLong(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function groupByTrip(bookings) {
  const map = new Map();
  for (const b of bookings) {
    const key = b.tripLabel || 'Okänd resa';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  const trips = [];
  for (const [label, items] of map.entries()) {
    const sorted = [...items].sort((a,b) => new Date(a.startDateTime) - new Date(b.startDateTime));
    const start = sorted[0]?.startDateTime;
    const end = sorted.reduce((latest, it) => {
      const e = it.endDateTime || it.startDateTime;
      return !latest || new Date(e) > new Date(latest) ? e : latest;
    }, null);
    const categories = Array.from(new Set(sorted.map(b => b.category)));
    trips.push({ label, bookings: sorted, start, end, categories });
  }
  trips.sort((a,b) => new Date(a.start) - new Date(b.start));
  return trips;
}
function diffParts(targetISO, nowMs) {
  let diff = Math.max(0, new Date(targetISO).getTime() - nowMs);
  const days = Math.floor(diff / 86400000); diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  return { days, hours, minutes };
}
function splitDigits(value, length) {
  return String(Math.max(0, value)).padStart(length, '0').split('');
}

// --- Push helpers ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

// --- Components ---
function Avatar({ member, size = 28, selected = true, onClick }) {
  const m = FAMILY.find(f => f.name === member) || { name: member, color: COLORS.textFaint };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={member}
      className="rounded-full flex items-center justify-center text-xs font-semibold"
      style={{ width: size, height: size, flexShrink: 0, background: selected ? m.color : 'transparent',
        color: selected ? COLORS.bg : m.color, border: `1.5px solid ${m.color}`,
        cursor: onClick ? 'pointer' : 'default', fontFamily: "'Space Grotesk', sans-serif" }}>
      {m.name[0]}
    </Tag>
  );
}
function TravelerPicker({ selected, onToggle }) {
  return (
    <div className="flex gap-2">
      {FAMILY.map(m => <Avatar key={m.name} member={m.name} selected={(selected||[]).includes(m.name)} onClick={() => onToggle(m.name)} />)}
    </div>
  );
}
function TravelerStack({ names }) {
  if (!names?.length) return null;
  return <div className="flex gap-1">{names.map(n => <Avatar key={n} member={n} size={22} />)}</div>;
}
function FlapDigit({ value }) {
  return (
    <span className="flap-anim" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:'1.6em', height:'1.6em', background: COLORS.surfaceRaised, color: COLORS.amber,
      fontFamily:"'Space Mono', monospace", fontWeight:700, fontSize:'1.1rem', borderRadius:'4px',
      position:'relative', overflow:'hidden', boxShadow:`inset 0 0 0 1px rgba(253,180,84,0.15)` }}>
      {value}
      <span style={{ position:'absolute', left:0, right:0, top:'50%', height:'1px', background:'rgba(0,0,0,0.4)' }} />
    </span>
  );
}
function FlapGroup({ value, length, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">{splitDigits(value, length).map((d,i) => <FlapDigit key={i} value={d} />)}</div>
      <span className="text-xs" style={{ color: COLORS.textFaint, letterSpacing:'0.08em' }}>{label}</span>
    </div>
  );
}
function LabeledInput({ label, value, onChange, type='text', placeholder }) {
  return (
    <div>
      <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>{label}</label>
      <input type={type} value={value??''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm mt-1"
        style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text }} />
    </div>
  );
}
function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm mt-1"
        style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function TripCard({ trip, onOpen }) {
  const travelers = Array.from(new Set(trip.bookings.flatMap(b => b.travelers||[])));
  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl p-4 flex items-center justify-between"
      style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
      <div>
        <p className="font-semibold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{trip.label}</p>
        <p className="text-sm mt-0.5" style={{ color: COLORS.textMuted }}>{formatDateShort(trip.start)} – {formatDateShort(trip.end)}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex gap-2">
            {trip.categories.map(c => { const I = (CATEGORY_META[c]||CATEGORY_META.other).Icon; return <I key={c} size={14} style={{ color: COLORS.teal }} />; })}
          </div>
          <TravelerStack names={travelers} />
        </div>
      </div>
      <ChevronRight size={18} style={{ color: COLORS.textFaint, flexShrink:0 }} />
    </button>
  );
}
function BookingRow({ booking, onDelete, onEdit, onAddToCalendar, calendarState, onToggleTraveler, onCheckStatus, status }) {
  const meta = CATEGORY_META[booking.category]||CATEGORY_META.other;
  const Icon = meta.Icon;
  const time = formatTime(booking.startDateTime);
  const showStatus = LIVE_STATUS_CATEGORIES.includes(booking.category);
  return (
    <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl p-2" style={{ background: COLORS.surfaceRaised, flexShrink:0 }}>
            <Icon size={18} style={{ color: COLORS.amber }} />
          </div>
          <div>
            <p className="font-semibold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{booking.title||meta.label}</p>
            <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: COLORS.textMuted }}>
              {formatDateLong(booking.startDateTime)}
              {time && <span className="flex items-center gap-1"><Clock size={12}/>{time}</span>}
            </p>
            {booking.location && <p className="text-sm flex items-center gap-1 mt-1" style={{ color: COLORS.textMuted }}><MapPin size={12}/>{booking.location}</p>}
            {booking.confirmationCode && <p className="text-xs mt-2" style={{ color: COLORS.teal, fontFamily:"'Space Mono', monospace" }}>REF {booking.confirmationCode}</p>}
            {booking.details && <p className="text-sm mt-2" style={{ color:'#A8B8B9' }}>{booking.details}</p>}
          </div>
        </div>
        <div className="flex gap-2" style={{ flexShrink:0 }}>
          <button onClick={onEdit} title="Redigera" style={{ color: COLORS.textFaint }}><Pencil size={15}/></button>
          <button onClick={onAddToCalendar} title="Lägg till i Google Kalender" disabled={calendarState?.loading}
            style={{ color: calendarState?.added ? COLORS.teal : calendarState?.error ? COLORS.danger : COLORS.textFaint }}>
            {calendarState?.loading ? <Loader2 size={15} className="animate-spin"/> :
             calendarState?.added  ? <CalendarCheck size={15}/> :
             calendarState?.error  ? <CalendarX size={15}/> :
             <CalendarPlus size={15}/>}
          </button>
          <button onClick={onDelete} title="Ta bort" style={{ color: COLORS.textFaint }}><Trash2 size={15}/></button>
        </div>
      </div>
      {showStatus && (
        <div className="mt-3 pt-3" style={{ borderTop:`1px solid ${COLORS.border}` }}>
          <button onClick={() => onCheckStatus(booking)} disabled={status?.loading}
            className="flex items-center gap-2 text-sm font-semibold disabled:opacity-50" style={{ color: COLORS.teal }}>
            {status?.loading ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
            {status?.loading ? 'Söker...' : 'Kolla senaste status'}
          </button>
          {status?.text && <p className="text-sm mt-2" style={{ color: COLORS.text }}>{status.text}</p>}
          {status?.error && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{status.error}</p>}
          {status?.updatedAt && <p className="text-xs mt-1" style={{ color: COLORS.textFaint }}>Uppdaterad {new Date(status.updatedAt).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})}</p>}
        </div>
      )}
      <div className="mt-3 pt-3" style={{ borderTop:`1px solid ${COLORS.border}` }}>
        <p className="text-xs uppercase mb-2" style={{ color: COLORS.textFaint, letterSpacing:'0.06em' }}>Vem reser</p>
        <TravelerPicker selected={booking.travelers} onToggle={name => onToggleTraveler(booking.id, name)} />
      </div>
    </div>
  );
}
function emptyBooking(rawText) {
  return { id: uid(), category:'other', title:'', provider:'', startDateTime: new Date().toISOString(),
    endDateTime:null, location:'', confirmationCode:'', passengers:'', price:null, currency:'',
    details:'', tripLabel:'Ny resa', travelers: FAMILY.map(f=>f.name), rawText:rawText||'', addedAt: new Date().toISOString() };
}

// --- Main App ---
export default function FardplanApp() {
  const [bookings, setBookings] = useState([]);
  const bookingsRef = useRef(bookings);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);

  const [loading, setLoading]         = useState(true);
  const [saveError, setSaveError]     = useState(null);
  const [view, setView]               = useState({ type:'list' });
  const [pasteText, setPasteText]     = useState('');
  const [parsing, setParsing]         = useState(false);
  const [parseError, setParseError]   = useState(null);
  const [previewBooking, setPreviewBooking] = useState(null);
  const [showPast, setShowPast]       = useState(false);
  const [statusMap, setStatusMap]     = useState({});
  const [backupOpen, setBackupOpen]   = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);
  const [importText, setImportText]   = useState('');
  const [importError, setImportError] = useState(null);
  const [now, setNow]                 = useState(Date.now());
  const [googleToken, setGoogleToken]           = useState(null);
  const [googleTokenExpiry, setGoogleTokenExpiry] = useState(null);
  const [calendarStatus, setCalendarStatus]     = useState(null);
  const tokenClientRef = useRef(null);
  const [quickTripOpen, setQuickTripOpen]       = useState(false);
  const [quickTrip, setQuickTrip]               = useState({ tripLabel:'', startDate:'', endDate:'', travelers: FAMILY.map(f=>f.name) });

  // Push notifications
  const [pushStatus, setPushStatus]         = useState('idle'); // idle|loading|subscribed|denied|unsupported
  const [pushPickerOpen, setPushPickerOpen] = useState(false);
  const [pushUserName, setPushUserName]     = useState(null);

  // Edit + confirm delete
  const [editingBooking, setEditingBooking] = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null); // {type:'booking'|'trip', id?, label?}

  // Per-bokning kalender-status
  const [calendarMap, setCalendarMap]       = useState({});

  // Fonts
  useEffect(() => {
    if (!document.getElementById('fardplan-fonts')) {
      const link = document.createElement('link');
      link.id = 'fardplan-fonts'; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Countdown ticker
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);

  // Google Identity Services
  useEffect(() => {
    if (document.getElementById('gis-script')) return;
    const script = document.createElement('script');
    script.id = 'gis-script'; script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true;
    script.onload = () => {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (response) => {
          if (response.access_token) {
            setGoogleToken(response.access_token);
            setGoogleTokenExpiry(Date.now() + (response.expires_in - 60) * 1000);
          }
        },
      });
    };
    document.head.appendChild(script);
  }, []);

  // Register Service Worker + check existing push subscription
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (sub) setPushStatus('subscribed'); })
      .catch(err => console.warn('SW registration failed:', err));
  }, []);

  async function subscribePush(userName) {
    setPushStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_name: userName,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      setPushStatus('subscribed');
      setPushUserName(userName);
      setPushPickerOpen(false);
    } catch (e) {
      setPushStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
      console.warn('Push subscribe failed:', e);
    }
  }

  function connectGoogle() {
    if (!tokenClientRef.current) return;
    tokenClientRef.current.requestAccessToken();
  }
  const googleConnected = googleToken && googleTokenExpiry > Date.now();

  async function addBookingToCalendar(booking, token) {
    const emojiMap = { flight:'✈️', train:'🚂', ferry:'⛴️', hotel:'🏨', car:'🚗', other:'📍' };
    const emoji = emojiMap[booking.category] || '📍';
    const end = booking.endDateTime ||
      new Date(new Date(booking.startDateTime).getTime() + 3600000).toISOString();
    const desc = [
      booking.provider && `Leverantör: ${booking.provider}`,
      booking.confirmationCode && `Bokningsnr: ${booking.confirmationCode}`,
      booking.details,
      booking.travelers?.length && `Resenärer: ${booking.travelers.join(', ')}`,
    ].filter(Boolean).join('\n');
    const event = {
      summary: `${emoji} ${booking.title}`,
      location: booking.location || undefined,
      description: desc || undefined,
      start: { dateTime: booking.startDateTime, timeZone: 'Europe/Stockholm' },
      end: { dateTime: end, timeZone: 'Europe/Stockholm' },
    };
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Calendar error: ${res.status}`);
  }

  // Load from Supabase
  useEffect(() => {
    supabase.from('bookings')
      .select('booking_data')
      .order('start_date_time', { ascending: true })
      .then(({ data, error }) => {
        if (data) {
          const loaded = data.map(r => r.booking_data);
          setBookings(loaded);
          bookingsRef.current = loaded;
        }
        if (error) console.error('Supabase load error:', error);
        setLoading(false);
      });
  }, []);

  // Realtime — synka live när annan familjemedlem gör ändringar
  useEffect(() => {
    const reload = () => {
      supabase.from('bookings')
        .select('booking_data')
        .order('start_date_time', { ascending: true })
        .then(({ data }) => {
          if (data) {
            const loaded = data.map(r => r.booking_data);
            setBookings(loaded);
            bookingsRef.current = loaded;
          }
        });
    };
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Persist: diff old vs new, upsert changed, delete removed
  const persist = useCallback(async (next) => {
    const prev = bookingsRef.current;
    setBookings(next);
    bookingsRef.current = next;
    setSaveError(null);

    try {
      const prevIds = new Set(prev.map(b => b.id));
      const nextIds = new Set(next.map(b => b.id));

      // Delete removed
      const toDelete = [...prevIds].filter(id => !nextIds.has(id));
      if (toDelete.length) {
        const { error } = await supabase.from('bookings').delete().in('id', toDelete);
        if (error) throw error;
      }

      // Upsert new or changed
      const toUpsert = next.filter(b => {
        const old = prev.find(p => p.id === b.id);
        return !old || JSON.stringify(old) !== JSON.stringify(b);
      });
      if (toUpsert.length) {
        const { error } = await supabase.from('bookings').upsert(
          toUpsert.map(b => ({ id: b.id, trip_label: b.tripLabel, start_date_time: b.startDateTime, booking_data: b }))
        );
        if (error) throw error;
      }
    } catch (e) {
      setSaveError({ message: `Kunde inte spara: ${e.message}`, retry: next });
    }
  }, []);

  // AI parse via Edge Function
  async function handleParse() {
    if (!pasteText.trim()) return;
    setParsing(true); setParseError(null);
    try {
      const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
        body: { type: 'parse', text: pasteText }
      });
      if (error) throw error;
      const textBlocks = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
      const parsed = JSON.parse(textBlocks.replace(/```json|```/g,'').trim());
      setPreviewBooking({
        ...emptyBooking(pasteText),
        category: parsed.category||'other', title: parsed.title||'',
        provider: parsed.provider||'', startDateTime: parsed.startDateTime||new Date().toISOString(),
        endDateTime: parsed.endDateTime||null, location: parsed.location||'',
        confirmationCode: parsed.confirmationCode||'', passengers: parsed.passengers||'',
        price: parsed.price??null, currency: parsed.currency||'',
        details: parsed.details||'', tripLabel: parsed.tripLabelSuggestion||'Ny resa',
      });
    } catch (e) {
      setParseError('Kunde inte tolka texten automatiskt. Fyll i uppgifterna manuellt nedan.');
      setPreviewBooking(emptyBooking(pasteText));
    } finally { setParsing(false); }
  }

  // Live status via Edge Function
  async function checkStatus(booking) {
    setStatusMap(prev => ({ ...prev, [booking.id]: { loading:true, error:null } }));
    try {
      const { data, error } = await supabase.functions.invoke('anthropic-proxy', {
        body: { type: 'status', booking }
      });
      if (error) throw error;
      const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ').trim();
      setStatusMap(prev => ({ ...prev, [booking.id]: { loading:false, text: text||'Ingen aktuell info hittades.', updatedAt: new Date().toISOString() } }));
    } catch (e) {
      setStatusMap(prev => ({ ...prev, [booking.id]: { loading:false, error:'Kunde inte hämta status.' } }));
    }
  }

  const updatePreview = (field, value) => setPreviewBooking(prev => ({ ...prev, [field]: value }));
  async function handleSavePreview() {
    if (!previewBooking.title.trim()||!previewBooking.startDateTime) return;
    const booking = previewBooking;
    persist([...bookingsRef.current, booking]);
    setView({ type:'detail', label: booking.tripLabel });
    setPreviewBooking(null); setPasteText(''); setParseError(null);
    if (googleConnected) {
      setCalendarStatus('adding');
      try {
        await addBookingToCalendar(booking, googleToken);
        setCalendarStatus('added');
        setTimeout(() => setCalendarStatus(null), 3000);
      } catch {
        setCalendarStatus('error');
        setTimeout(() => setCalendarStatus(null), 4000);
      }
    }
  }
  async function handleSaveQuickTrip() {
    if (!quickTrip.tripLabel.trim() || !quickTrip.startDate) return;
    const booking = {
      ...emptyBooking(''),
      title: quickTrip.tripLabel.trim(),
      tripLabel: quickTrip.tripLabel.trim(),
      category: 'other',
      startDateTime: new Date(quickTrip.startDate).toISOString(),
      endDateTime: quickTrip.endDate ? new Date(quickTrip.endDate).toISOString() : null,
      travelers: quickTrip.travelers,
    };
    persist([...bookingsRef.current, booking]);
    setView({ type:'detail', label: booking.tripLabel });
    setQuickTripOpen(false);
    setQuickTrip({ tripLabel:'', startDate:'', endDate:'', travelers: FAMILY.map(f=>f.name) });
    if (googleConnected) {
      setCalendarStatus('adding');
      try {
        await addBookingToCalendar(booking, googleToken);
        setCalendarStatus('added');
        setTimeout(() => setCalendarStatus(null), 3000);
      } catch {
        setCalendarStatus('error');
        setTimeout(() => setCalendarStatus(null), 4000);
      }
    }
  }

  function handleDelete(id) { persist(bookingsRef.current.filter(b => b.id !== id)); }
  function handleDeleteTrip(label) { persist(bookingsRef.current.filter(b => b.tripLabel !== label)); setView({ type:'list' }); }
  function confirmDeleteNow() {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'booking') handleDelete(confirmDelete.id);
    if (confirmDelete.type === 'trip') handleDeleteTrip(confirmDelete.label);
    setConfirmDelete(null);
  }

  async function handleAddToCalendar(booking) {
    if (!googleConnected) { connectGoogle(); return; }
    setCalendarMap(prev => ({ ...prev, [booking.id]: { loading: true } }));
    try {
      await addBookingToCalendar(booking, googleToken);
      setCalendarMap(prev => ({ ...prev, [booking.id]: { added: true } }));
      setTimeout(() => setCalendarMap(prev => ({ ...prev, [booking.id]: null })), 3000);
    } catch {
      setCalendarMap(prev => ({ ...prev, [booking.id]: { error: true } }));
      setTimeout(() => setCalendarMap(prev => ({ ...prev, [booking.id]: null })), 4000);
    }
  }

  function handleSaveEdit() {
    if (!editingBooking?.title?.trim() || !editingBooking?.startDateTime) return;
    persist(bookingsRef.current.map(b => b.id === editingBooking.id ? editingBooking : b));
    setEditingBooking(null);
  }

  function handleToggleTraveler(id, name) {
    persist(bookingsRef.current.map(b => b.id===id ? { ...b, travelers: toggleTraveler(b.travelers, name) } : b));
  }
  async function handleCopyBackup() {
    try { await navigator.clipboard.writeText(JSON.stringify(bookingsRef.current)); setBackupCopied(true); setTimeout(()=>setBackupCopied(false), 2000); } catch {}
  }
  function handleImportBackup() {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error();
      persist(parsed); setImportText(''); setImportError(null); setBackupOpen(false);
    } catch { setImportError('Ogiltigt format. Kontrollera att du klistrat in hela texten.'); }
  }

  const trips = useMemo(() => groupByTrip(bookings), [bookings]);
  const tripLabels = useMemo(() => Array.from(new Set(bookings.map(b=>b.tripLabel).filter(Boolean))), [bookings]);
  const startOfToday = useMemo(() => { const d=new Date(); d.setHours(0,0,0,0); return d; }, []);
  const upcomingTrips = trips.filter(t => new Date(t.end||t.start) >= startOfToday);
  const pastTrips = [...trips.filter(t => new Date(t.end||t.start) < startOfToday)].reverse();
  const nearestTrip = upcomingTrips[0];
  const countdown = nearestTrip ? diffParts(nearestTrip.start, now) : null;
  const isExistingTrip = previewBooking ? tripLabels.includes(previewBooking.tripLabel) : false;
  const detailTrip = view.type==='detail' ? trips.find(t=>t.label===view.label) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg, color: COLORS.textMuted }}>
        <Loader2 className="animate-spin" size={20}/>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: COLORS.bg, color: COLORS.text, fontFamily:"'Inter', sans-serif" }}>
      <style>{`
        @keyframes flapIn { from { transform:translateY(-6px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        .flap-anim { animation: flapIn 0.3s ease; }
        select option { background:${COLORS.surfaceRaised}; color:${COLORS.text}; }
      `}</style>

      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase" style={{ color: COLORS.teal, letterSpacing:'0.16em' }}>Familjens</p>
          <h1 className="text-3xl font-bold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Färdplan</h1>
        </div>
        <div className="flex flex-col items-end gap-2 mt-1">
          <div className="flex items-center gap-1 text-xs" style={{ color: COLORS.textFaint }}>
            <Users size={14}/> Delad
          </div>
          <button onClick={connectGoogle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: googleConnected ? 'rgba(95,211,196,0.12)' : COLORS.surfaceRaised,
              color: googleConnected ? COLORS.teal : COLORS.textMuted,
              border: `1px solid ${googleConnected ? COLORS.teal : COLORS.border}` }}>
            {googleConnected ? <CalendarCheck size={13}/> : <Calendar size={13}/>}
            {googleConnected ? 'Kalender ansluten' : 'Anslut Kalender'}
          </button>
          {pushStatus !== 'unsupported' && (
            <button
              onClick={() => pushStatus === 'subscribed' ? null : setPushPickerOpen(o => !o)}
              disabled={pushStatus === 'loading'}
              title={pushStatus === 'subscribed' ? `Notiser på${pushUserName ? ` (${pushUserName})` : ''}` : pushStatus === 'denied' ? 'Notiser blockerade i webbläsaren' : 'Aktivera push-notiser'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
              style={{
                background: pushStatus === 'subscribed' ? 'rgba(253,180,84,0.12)' : COLORS.surfaceRaised,
                color: pushStatus === 'subscribed' ? COLORS.amber : pushStatus === 'denied' ? COLORS.danger : COLORS.textMuted,
                border: `1px solid ${pushStatus === 'subscribed' ? COLORS.amber : pushStatus === 'denied' ? COLORS.danger : COLORS.border}`,
              }}>
              {pushStatus === 'loading' ? <Loader2 size={13} className="animate-spin"/> :
               pushStatus === 'denied'  ? <BellOff size={13}/> : <Bell size={13}/>}
              {pushStatus === 'subscribed' ? 'Notiser på' : pushStatus === 'denied' ? 'Blockerade' : 'Notiser'}
            </button>
          )}
        </div>
      </div>

      {/* Push-picker */}
      {pushPickerOpen && (
        <div className="px-5 mb-3">
          <div className="rounded-2xl p-4" style={{ background: COLORS.surfaceRaised, border:`1px solid ${COLORS.border}` }}>
            <p className="text-sm font-semibold mb-1" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Vem använder den här enheten?</p>
            <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Du får notiser om dina bokningar.</p>
            <div className="flex gap-2 flex-wrap">
              {FAMILY.map(m => (
                <button key={m.name} onClick={() => subscribePush(m.name)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
                  style={{ background: COLORS.bg, color: m.color, border:`1.5px solid ${m.color}` }}>
                  <Avatar member={m.name} size={20}/> {m.name}
                </button>
              ))}
            </div>
            <button onClick={() => setPushPickerOpen(false)} className="text-xs mt-3 block" style={{ color: COLORS.textFaint }}>Avbryt</button>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-5 pb-8" style={{ background:'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
            <p className="font-semibold mb-1" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>
              {confirmDelete.type==='trip' ? 'Ta bort hela resan?' : 'Ta bort bokning?'}
            </p>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
              {confirmDelete.type==='trip'
                ? `"${confirmDelete.label}" och alla ${confirmDelete.count} bokningar tas bort permanent.`
                : `"${confirmDelete.label}" tas bort permanent.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: COLORS.textMuted }}>Avbryt</button>
              <button onClick={confirmDeleteNow} className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: COLORS.danger, color: '#fff' }}>Ta bort</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit booking modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto px-5 py-8" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="max-w-sm mx-auto rounded-2xl p-5" style={{ background: COLORS.surfaceRaised, border:`1px solid ${COLORS.borderInput}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Redigera bokning</p>
              <button onClick={()=>setEditingBooking(null)} style={{ color: COLORS.textFaint }}><X size={18}/></button>
            </div>
            <div className="flex flex-col gap-3">
              <LabeledInput label="Titel" value={editingBooking.title}
                onChange={v=>setEditingBooking(b=>({...b,title:v}))} placeholder="T.ex. SAS SK1421"/>
              <div className="grid grid-cols-2 gap-3">
                <LabeledSelect label="Typ" value={editingBooking.category}
                  onChange={v=>setEditingBooking(b=>({...b,category:v}))}
                  options={Object.entries(CATEGORY_META).map(([value,m])=>({value,label:m.label}))}/>
                <LabeledInput label="Leverantör" value={editingBooking.provider}
                  onChange={v=>setEditingBooking(b=>({...b,provider:v}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput type="datetime-local" label="Start" value={toLocalInput(editingBooking.startDateTime)}
                  onChange={v=>setEditingBooking(b=>({...b,startDateTime:fromLocalInput(v)}))}/>
                <LabeledInput type="datetime-local" label="Slut" value={toLocalInput(editingBooking.endDateTime)}
                  onChange={v=>setEditingBooking(b=>({...b,endDateTime:fromLocalInput(v)}))}/>
              </div>
              <LabeledInput label="Plats" value={editingBooking.location}
                onChange={v=>setEditingBooking(b=>({...b,location:v}))}/>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Bokningsnummer" value={editingBooking.confirmationCode}
                  onChange={v=>setEditingBooking(b=>({...b,confirmationCode:v}))}/>
                <LabeledInput label="Pris" value={editingBooking.price??''}
                  onChange={v=>setEditingBooking(b=>({...b,price:v}))}/>
              </div>
              <LabeledInput label="Övrigt" value={editingBooking.details}
                onChange={v=>setEditingBooking(b=>({...b,details:v}))}/>
              <div>
                <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>Vem reser</label>
                <div className="mt-1">
                  <TravelerPicker selected={editingBooking.travelers}
                    onToggle={name=>setEditingBooking(b=>({...b,travelers:toggleTraveler(b.travelers,name)}))}/>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setEditingBooking(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: COLORS.textMuted }}>Avbryt</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: COLORS.teal, color: COLORS.bg }}>Spara ändringar</button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar status toast */}
      {calendarStatus && (
        <div className="px-5 mb-2">
          <div className="rounded-xl px-4 py-2 flex items-center gap-2 text-sm"
            style={{ background: calendarStatus==='added' ? 'rgba(95,211,196,0.1)' : 'rgba(255,107,94,0.08)',
              border: `1px solid ${calendarStatus==='added' ? COLORS.teal : COLORS.danger}`,
              color: calendarStatus==='added' ? COLORS.teal : COLORS.danger }}>
            {calendarStatus==='adding' && <Loader2 size={14} className="animate-spin"/>}
            {calendarStatus==='added' && <CalendarCheck size={14}/>}
            {calendarStatus==='error' && <CalendarX size={14}/>}
            {calendarStatus==='adding' && 'Lägger till i Google Kalender…'}
            {calendarStatus==='added' && 'Lagt till i Google Kalender ✓'}
            {calendarStatus==='error' && 'Kunde inte lägga till i kalender'}
          </div>
        </div>
      )}

      {/* Countdown */}
      <div className="px-5">
        <div className="rounded-2xl p-5" style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
          {nearestTrip ? (
            <>
              <p className="text-xs uppercase mb-3" style={{ color: COLORS.textMuted, letterSpacing:'0.1em' }}>Nästa avgång</p>
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <p className="text-xl font-semibold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{nearestTrip.label}</p>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>{formatDateLong(nearestTrip.start)}</p>
                  <div className="mt-2"><TravelerStack names={Array.from(new Set(nearestTrip.bookings.flatMap(b=>b.travelers||[])))}/></div>
                </div>
                <button onClick={() => setView({ type:'detail', label: nearestTrip.label })}><ChevronRight size={20} style={{ color: COLORS.textFaint }}/></button>
              </div>
              <div className="flex gap-4">
                <FlapGroup value={countdown.days} length={countdown.days>99?3:2} label="DAGAR"/>
                <FlapGroup value={countdown.hours} length={2} label="TIMMAR"/>
                <FlapGroup value={countdown.minutes} length={2} label="MIN"/>
              </div>
            </>
          ) : (
            <p className="text-sm text-center py-2" style={{ color: COLORS.textMuted }}>Inga kommande resor. Klistra in en bokning nedan för att börja.</p>
          )}
        </div>
      </div>

      {/* List view */}
      {view.type==='list' && (
        <>
          {/* Add booking */}
          <div className="px-5 mt-6">
            <div className="rounded-2xl p-5" style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} style={{ color: COLORS.amber }}/>
                <p className="text-sm font-semibold" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Lägg till bokning</p>
              </div>
              <p className="text-sm mb-3" style={{ color: COLORS.textMuted }}>Klistra in texten från bokningsbekräftelsen.</p>
              <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
                placeholder="Klistra in bekräftelsemailet här..." rows={5}
                className="w-full rounded-xl p-3 text-sm"
                style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text, resize:'vertical' }}/>
              {parseError && (
                <div className="flex items-start gap-2 mt-2 text-sm" style={{ color: COLORS.danger }}>
                  <AlertTriangle size={14} className="mt-0.5" style={{ flexShrink:0 }}/>{parseError}
                </div>
              )}
              <div className="flex justify-between items-center mt-3">
                <button onClick={() => setQuickTripOpen(o => !o)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: COLORS.surfaceRaised, color: COLORS.teal, border:`1px solid ${COLORS.teal}` }}>
                  <MapPin size={16}/>Snabbresa
                </button>
                <button onClick={handleParse} disabled={parsing||!pasteText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: COLORS.amber, color: COLORS.bg }}>
                  {parsing ? <><Loader2 size={16} className="animate-spin"/>Tolkar...</> : <><Sparkles size={16}/>Tolka bokning</>}
                </button>
              </div>

              {/* Snabbresa form */}
              {quickTripOpen && (
                <div className="mt-4 pt-4" style={{ borderTop:`1px solid ${COLORS.border}` }}>
                  <p className="text-sm font-semibold mb-3" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Snabbresa</p>
                  <div className="flex flex-col gap-3">
                    <LabeledInput label="Resans namn" value={quickTrip.tripLabel}
                      onChange={v => setQuickTrip(q=>({...q, tripLabel:v}))}
                      placeholder="T.ex. Mats Resa Skåne"/>
                    <div className="grid grid-cols-2 gap-3">
                      <LabeledInput type="date" label="Startdatum" value={quickTrip.startDate}
                        onChange={v => setQuickTrip(q=>({...q, startDate:v}))}/>
                      <LabeledInput type="date" label="Slutdatum" value={quickTrip.endDate}
                        onChange={v => setQuickTrip(q=>({...q, endDate:v}))}/>
                    </div>
                    <div>
                      <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>Vem reser</label>
                      <div className="mt-1">
                        <TravelerPicker selected={quickTrip.travelers}
                          onToggle={name => setQuickTrip(q=>({...q, travelers: toggleTraveler(q.travelers, name)}))}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setQuickTripOpen(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: COLORS.textMuted }}>Avbryt</button>
                    <button onClick={handleSaveQuickTrip} disabled={!quickTrip.tripLabel.trim()||!quickTrip.startDate}
                      className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: COLORS.teal, color: COLORS.bg }}>Lägg till resa</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview form */}
          {previewBooking && (
            <div className="px-5 mt-4">
              <div className="rounded-2xl p-5" style={{ background: COLORS.surfaceRaised, border:`1px solid ${COLORS.borderInput}` }}>
                <p className="text-sm font-semibold mb-3" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Kontrollera uppgifterna</p>
                <div className="flex flex-col gap-3">
                  <LabeledInput label="Titel" value={previewBooking.title} onChange={v=>updatePreview('title',v)} placeholder="T.ex. SAS SK1421 ARN–AYT"/>
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledSelect label="Typ" value={previewBooking.category} onChange={v=>updatePreview('category',v)}
                      options={Object.entries(CATEGORY_META).map(([value,m])=>({value,label:m.label}))}/>
                    <LabeledInput label="Leverantör" value={previewBooking.provider} onChange={v=>updatePreview('provider',v)}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledInput type="datetime-local" label="Start" value={toLocalInput(previewBooking.startDateTime)} onChange={v=>updatePreview('startDateTime',fromLocalInput(v))}/>
                    <LabeledInput type="datetime-local" label="Slut" value={toLocalInput(previewBooking.endDateTime)} onChange={v=>updatePreview('endDateTime',fromLocalInput(v))}/>
                  </div>
                  <LabeledInput label="Plats" value={previewBooking.location} onChange={v=>updatePreview('location',v)}/>
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledInput label="Bokningsnummer" value={previewBooking.confirmationCode} onChange={v=>updatePreview('confirmationCode',v)}/>
                    <LabeledInput label="Pris" value={previewBooking.price??''} onChange={v=>updatePreview('price',v)}/>
                  </div>
                  <LabeledInput label="Övrigt" value={previewBooking.details} onChange={v=>updatePreview('details',v)}/>
                  <div>
                    <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>Vem reser</label>
                    <div className="mt-1">
                      <TravelerPicker selected={previewBooking.travelers} onToggle={name=>updatePreview('travelers',toggleTraveler(previewBooking.travelers,name))}/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase" style={{ color: COLORS.textMuted, letterSpacing:'0.06em' }}>Resa</label>
                    <div className="flex flex-col gap-2 mt-1">
                      <select value={isExistingTrip ? previewBooking.tripLabel : '__new__'}
                        onChange={e=>updatePreview('tripLabel', e.target.value==='__new__' ? '' : e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text }}>
                        {tripLabels.map(l=><option key={l} value={l}>{l}</option>)}
                        <option value="__new__">+ Ny resa</option>
                      </select>
                      {!isExistingTrip && (
                        <input value={previewBooking.tripLabel} onChange={e=>updatePreview('tripLabel',e.target.value)}
                          placeholder="Namn på resan, t.ex. Alanya juli 2026"
                          className="w-full rounded-lg px-3 py-2 text-sm"
                          style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text }}/>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={()=>setPreviewBooking(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: COLORS.textMuted }}>Avbryt</button>
                  <button onClick={handleSavePreview} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: COLORS.teal, color: COLORS.bg }}>Spara i resan</button>
                </div>
              </div>
            </div>
          )}

          {/* Trip list */}
          <div className="px-5 mt-6">
            <p className="text-sm font-semibold mb-2" style={{ color: COLORS.textMuted, fontFamily:"'Space Grotesk', sans-serif" }}>Kommande resor</p>
            {upcomingTrips.length===0
              ? <p className="text-sm" style={{ color: COLORS.textFaint }}>Inga kommande resor.</p>
              : <div className="flex flex-col gap-3">{upcomingTrips.map(t=><TripCard key={t.label} trip={t} onOpen={()=>setView({type:'detail',label:t.label})}/>)}</div>
            }
            {pastTrips.length>0 && (
              <>
                <button onClick={()=>setShowPast(s=>!s)} className="flex items-center gap-1 text-sm mt-6 mb-2" style={{ color: COLORS.textMuted }}>
                  {showPast ? 'Dölj tidigare resor' : 'Visa tidigare resor'}
                </button>
                {showPast && <div className="flex flex-col gap-3">{pastTrips.map(t=><TripCard key={t.label} trip={t} onOpen={()=>setView({type:'detail',label:t.label})}/>)}</div>}
              </>
            )}
          </div>
        </>
      )}

      {/* Detail view */}
      {view.type==='detail' && detailTrip && (
        <div className="px-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>setView({type:'list'})} className="flex items-center gap-1 text-sm" style={{ color: COLORS.textMuted }}>
              <ChevronLeft size={16}/>Alla resor
            </button>
            <button onClick={()=>setConfirmDelete({type:'trip', label: detailTrip.label, count: detailTrip.bookings.length})}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl"
              style={{ color: COLORS.danger, border:`1px solid rgba(255,107,94,0.3)` }}>
              <Trash2 size={13}/> Ta bort resa
            </button>
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{detailTrip.label}</h2>
          <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>{formatDateLong(detailTrip.start)} – {formatDateLong(detailTrip.end)}</p>
          <div className="flex flex-col gap-3">
            {detailTrip.bookings.map(b=>(
              <BookingRow key={b.id} booking={b}
                onDelete={()=>setConfirmDelete({type:'booking', id: b.id, label: b.title||b.category})}
                onEdit={()=>setEditingBooking({...b})}
                onAddToCalendar={()=>handleAddToCalendar(b)}
                calendarState={calendarMap[b.id]}
                onToggleTraveler={handleToggleTraveler} onCheckStatus={checkStatus} status={statusMap[b.id]}/>
            ))}
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="px-5 mt-4">
          <div className="rounded-xl p-3 flex items-center justify-between gap-3"
            style={{ background:'rgba(255,107,94,0.08)', border:`1px solid ${COLORS.danger}` }}>
            <p className="text-sm" style={{ color: COLORS.danger }}>{saveError.message}</p>
            <button onClick={()=>persist(saveError.retry)} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: COLORS.danger, color: COLORS.bg, flexShrink:0 }}>Försök igen</button>
          </div>
        </div>
      )}

      {/* Backup */}
      <div className="px-5 mt-8">
        <button onClick={()=>setBackupOpen(o=>!o)} className="text-sm" style={{ color: COLORS.textMuted }}>
          {backupOpen ? 'Dölj säkerhetskopiering' : 'Säkerhetskopiera eller återställ resor'}
        </button>
        {backupOpen && (
          <div className="rounded-2xl p-4 mt-2" style={{ background: COLORS.surface, border:`1px solid ${COLORS.border}` }}>
            <p className="text-sm font-semibold mb-1" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Kopiera all data</p>
            <textarea readOnly value={JSON.stringify(bookings)} rows={3} onFocus={e=>e.target.select()}
              className="w-full rounded-lg p-2 text-xs"
              style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.textMuted, fontFamily:"'Space Mono', monospace", resize:'vertical' }}/>
            <button onClick={handleCopyBackup} className="flex items-center gap-2 text-sm font-semibold mt-2" style={{ color: COLORS.teal }}>
              {backupCopied ? <><Check size={14}/>Kopierat</> : <><Copy size={14}/>Kopiera till urklipp</>}
            </button>
            <p className="text-sm font-semibold mt-4 mb-1" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>Återställ från kopia</p>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)}
              placeholder="Klistra in en tidigare kopierad text här..." rows={3}
              className="w-full rounded-lg p-2 text-xs"
              style={{ background: COLORS.bg, border:`1px solid ${COLORS.borderInput}`, color: COLORS.text, fontFamily:"'Space Mono', monospace", resize:'vertical' }}/>
            {importError && <p className="text-sm mt-1" style={{ color: COLORS.danger }}>{importError}</p>}
            <button onClick={handleImportBackup} disabled={!importText.trim()}
              className="text-sm font-semibold mt-2 px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: COLORS.teal, color: COLORS.bg }}>Importera</button>
          </div>
        )}
      </div>
    </div>
  );
}
