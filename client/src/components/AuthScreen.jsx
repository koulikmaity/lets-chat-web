import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { LockKeyhole, MessageSquareText } from 'lucide-react';
import { auth } from '../firebase';
export default function AuthScreen() {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (register) {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(result.user, { displayName: name.trim().slice(0,80) });
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) { setError(err.code?.replace('auth/', '').replaceAll('-', ' ') || err.message); }
    finally { setBusy(false); }
  };
  return <div className="auth-page"><div className="auth-mark"><MessageSquareText size={27}/><span>let's chat</span></div><div className="auth-panel"><div className="auth-illustration"><div className="auth-icon"><MessageSquareText size={40}/></div><h1>Stay close, wherever you are.</h1><p>Meaningful conversations, beautifully simple.</p><div className="floating-chat one">Hi! How are you? <span>✌️</span></div><div className="floating-chat two">Good to hear from you! <span>💚</span></div></div><form onSubmit={submit} className="auth-form"><span className="eyebrow">WELCOME TO LET'S CHAT</span><h2>{register ? 'Create an account' : 'Welcome back'}</h2><p className="muted">{register ? 'Start chatting with people who matter.' : 'Enter your details to get back to your conversations.'}</p>{register && <label>Display name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>}<label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>{error && <p className="error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <span>→</span></button><p className="auth-switch">{register ? 'Already have an account?' : 'New to Let’s Chat?'} <button type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p><p className="secure"><LockKeyhole size={13}/> Secure sign in powered by Firebase</p></form></div></div>;
}
