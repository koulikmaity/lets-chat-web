import { Sun, Moon, LogOut, MessageSquareText } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Avatar from './Avatar';
export default function Rail({dark,setDark,openProfile,me,user}) {
return (<>    <aside className="rail"><div className="rail-top"><div className="brand-mark"><MessageSquareText size={23}/></div><button className="rail-icon selected" title="Chats"><MessageSquareText size={22}/></button></div><div className="rail-bottom"><button className="rail-icon" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={21}/> : <Moon size={21}/>}</button><button className="rail-icon" title="Sign out" onClick={() => signOut(auth)}><LogOut size={21}/></button><button className="rail-icon profile-trigger" onClick={openProfile} title="Edit profile" aria-label="Edit profile"><Avatar user={me || user} size={35}/></button></div></aside>
</>);
}
