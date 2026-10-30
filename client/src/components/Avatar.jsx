export default function Avatar({ user, size = 44, online = false }) {
  const name = user?.displayName || user?.email || 'User';
  const palettes = ['#e4c4b6','#c7d8ce','#d2c7e2','#bfd8e8','#e9d0a9','#bfd9c4'];
  const color = palettes[[...name].reduce((a,c) => a + c.charCodeAt(0), 0) % palettes.length];
  return <span className="avatar-wrap" style={{ width: size, height: size, flexBasis: size }}>
    {user?.photoURL ? <img className="avatar" src={user.photoURL} alt={name} /> : <span className="avatar avatar-fallback" style={{ background: color, fontSize: size * .36 }}>{name.slice(0,1).toUpperCase()}</span>}
    {online && <span className="presence-dot" />}
  </span>;
}
