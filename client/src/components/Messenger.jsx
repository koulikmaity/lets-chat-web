import { useEffect, useMemo, useRef, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { io } from 'socket.io-client';
import { auth } from '../firebase';
import { request, API } from '../lib/api';
import Rail from './Rail';
import ChatSidebar from './ChatSidebar';
import Conversation from './Conversation';
import ProfileModal from './ProfileModal';
import ErrorToast from './ErrorToast';
export default function Messenger({ user }) {
  const [me, setMe] = useState(null);
  const [unread, setUnread] = useState({});
  const [editProfile, setEditProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState('');
  const [online, setOnline] = useState([]);
  const [typing, setTyping] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('lets-chat-theme') === 'dark');
  const [error, setError] = useState('');
  const [mobileChat, setMobileChat] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const socket = useRef(null);
  const activeIdRef = useRef(activeId);
  const openedRoomRef = useRef(false);
  const typingTimeout = useRef(null);
  const messageRequest = useRef(0);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('lets-chat-theme', dark ? 'dark' : 'light'); }, [dark]);
  const refreshUnread = async () => { const counts = await request('/unread'); setUnread(counts); };
  const markSeen = async id => { if (!id) return; try { await request(`/conversations/${id}/seen`, { method: 'POST' }); setUnread(prev => ({ ...prev, [id]: 0 })); } catch { /* retry on next open or message */ } };
  const reload = async () => { const [people, conversations] = await Promise.all([request('/users'), request('/conversations')]); setUsers(people); setRooms(conversations); await refreshUnread(); };
  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const profile = await request('/me', { method: 'POST', body: JSON.stringify({ displayName: user.displayName || user.email?.split('@')[0], photoURL: user.photoURL || '' }) });
        if (!mounted) return;
        setMe(profile);
        await reload();
        if (!mounted) return;
        const token = await user.getIdToken();
        if (!mounted) return;
        const s = io(API, { auth: { token }, reconnection: true }); socket.current = s;
        s.on('connect', () => { setConnected(true); if (activeIdRef.current) s.emit('room:join', activeIdRef.current); reload().catch(() => {}); });
        s.on('disconnect', () => { setConnected(false); setOnline([]); });
        s.on('connect_error', () => setConnected(false));
        s.on('presence', setOnline);
        s.on('message:new', msg => { if (String(msg.conversationId) === activeIdRef.current) { setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]); if (msg.sender !== user.uid) markSeen(String(msg.conversationId)); } });
        s.on('conversation:updated', () => { request('/conversations').then(setRooms).catch(() => {}); refreshUnread().catch(() => {}); });
        s.on('unread:changed', () => refreshUnread().catch(() => {}));
        s.on('user:updated', updated => { setUsers(prev => prev.map(person => person.uid === updated.uid ? { ...person, ...updated } : person)); });
        s.on('conversation:new', () => reload().catch(() => {}));
        s.on('typing', ({ conversationId, uid, typing: isTyping }) => { if (conversationId === activeIdRef.current && uid !== user.uid) setTyping(isTyping); });
        s.on('messages:seen', ({ conversationId, uid }) => { if (conversationId === activeIdRef.current) setMessages(prev => prev.map(m => ({ ...m, seenBy: [...new Set([...(m.seenBy || []), uid])] }))); });
      } catch(e) { if (mounted) setError(e.message); }
    };
    start();
    return () => { mounted = false; socket.current?.disconnect(); socket.current = null; };
  }, [user.uid]);
  useEffect(() => {
    const id = ++messageRequest.current;
    if (!activeId) { setMessages([]); return; }
    setMessages([]); setTyping(false); setLoadingMessages(true);
    socket.current?.emit('room:join', activeId);
    request(`/conversations/${activeId}/messages`).then(data => { if (id === messageRequest.current) setMessages(data); }).catch(e => { if (id === messageRequest.current) setError(e.message); }).finally(() => { if (id === messageRequest.current) setLoadingMessages(false); });
    markSeen(activeId);
    return () => { socket.current?.emit('room:leave', activeId); };
  }, [activeId]);
  const userMap = useMemo(() => new Map([...users, ...(me ? [me] : [])].map(u => [u.uid, u])), [users, me]);
  const otherFor = room => userMap.get(room.members.find(uid => uid !== user.uid)) || { uid: room.members.find(uid => uid !== user.uid), displayName: 'Unknown user' };
  const activeRoom = rooms.find(r => r._id === activeId);
  const contact = activeRoom && otherFor(activeRoom);
  const sortedRooms = useMemo(() => [...rooms].sort((a,b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)), [rooms]);
  const filteredRooms = sortedRooms.filter(room => { const other = otherFor(room); return `${other.displayName} ${other.email}`.toLowerCase().includes(search.toLowerCase()); });
  const filteredPeople = users.filter(person => `${person.displayName} ${person.email}`.toLowerCase().includes(search.toLowerCase()));
  const selectRoom = id => { setActiveId(id); setMobileChat(true); setCompose(false); setDraft(''); };
  const startConversation = async recipient => {
    try { const room = await request('/conversations', { method: 'POST', body: JSON.stringify({ userId: recipient.uid }) }); setRooms(prev => prev.some(r => r._id === room._id) ? prev : [room, ...prev]); selectRoom(room._id); }
    catch(e) { setError(e.message); }
  };
  const send = async e => {
    e.preventDefault(); const text = draft.trim(); if (!text || !activeId || sending) return;
    setSending(true);
    try { const msg = await request(`/conversations/${activeId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }); setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]); setDraft(''); socket.current?.emit('typing', { conversationId: activeId, typing: false }); }
    catch(e) { setError(e.message); }
    finally { setSending(false); }
  };
  const onDraft = value => { setDraft(value); if (!activeId) return; socket.current?.emit('typing', { conversationId: activeId, typing: !!value.trim() }); clearTimeout(typingTimeout.current); typingTimeout.current = setTimeout(() => socket.current?.emit('typing', { conversationId: activeId, typing: false }), 1200); };
  const openProfile = () => { setProfileName(me?.displayName || user.displayName || ''); setProfilePhoto(me?.photoURL || user.photoURL || ''); setEditProfile(true); };
  const saveProfile = async e => { e.preventDefault(); if (profileSaving) return; setProfileSaving(true); try { const payload = { displayName: profileName.trim(), photoURL: profilePhoto.trim() }; if (!payload.displayName) throw new Error('Name is required'); await updateProfile(auth.currentUser, payload); const updated = await request('/me', { method: 'PATCH', body: JSON.stringify(payload) }); setMe(updated); setEditProfile(false); } catch (e) { setError(e.message); } finally { setProfileSaving(false); } };
  const onUnsupportedFile = (files) => setError(`${files.length} file(s) selected. File upload requires a backend upload endpoint; nothing was sent.`);
  const onLocation = () => {
    if (!activeId) return;
    if (!navigator.geolocation) return setError('Location sharing is not available in this browser.');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const conversationId = activeIdRef.current;
      if (!conversationId) return;
      try {
        const text = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        const msg = await request(`/conversations/${conversationId}/messages`, {
          method: 'POST', body: JSON.stringify({ text }),
        });
        if (activeIdRef.current === conversationId) {
          setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        }
      } catch (e) { setError(e.message); }
    }, (e) => setError(e.code === 1 ? 'Location permission denied.' : 'Unable to get your location.'), { timeout: 10000 });
  };
  return <div className="app-shell">
    <Rail dark={dark} setDark={setDark} openProfile={openProfile} me={me} user={user}/>
    <ChatSidebar mobileChat={mobileChat} rooms={rooms} compose={compose} setCompose={setCompose} search={search} setSearch={setSearch} filteredPeople={filteredPeople} filteredRooms={filteredRooms} online={online} startConversation={startConversation} otherFor={otherFor} activeId={activeId} selectRoom={selectRoom} unread={unread} connected={connected}/>
    <Conversation mobileChat={mobileChat} setMobileChat={setMobileChat} activeRoom={activeRoom} contact={contact} online={online} typing={typing} setError={setError} messages={messages} loadingMessages={loadingMessages} user={user} draft={draft} onDraft={onDraft} send={send} sending={sending} setCompose={setCompose} onLocation={onLocation} onUnsupportedFile={onUnsupportedFile}/>
    {editProfile && <ProfileModal setEditProfile={setEditProfile} saveProfile={saveProfile} profileName={profileName} setProfileName={setProfileName} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} profileSaving={profileSaving}/>}
    {error && <ErrorToast error={error} setError={setError}/>}
  </div>;
}
