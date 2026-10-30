import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { MessageSquareText } from 'lucide-react';
import { auth } from './firebase';
import AuthScreen from './components/AuthScreen';
import Messenger from './components/Messenger';
export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="loading-screen"><MessageSquareText size={42}/> Connecting to Let's Chat…</div>;
  return user ? <Messenger key={user.uid} user={user}/> : <AuthScreen/>;
}
