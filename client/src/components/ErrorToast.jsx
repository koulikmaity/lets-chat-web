import { WifiOff, X } from 'lucide-react';
export default function ErrorToast({error,setError}) {
return (<div className="toast" role="alert"><WifiOff size={18}/><span>{error}</span><button title="Dismiss" onClick={() => setError('')}><X size={17}/></button></div>);
}
