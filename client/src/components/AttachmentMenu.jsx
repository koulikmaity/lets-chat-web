import { useEffect, useRef, useState } from 'react';
import { Plus, FileText, Image, Camera, Headphones, MapPin } from 'lucide-react';

export default function AttachmentMenu({ onLocation, onUnsupportedFile }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const documentInput = useRef(null);
  const mediaInput = useRef(null);
  const cameraInput = useRef(null);
  const audioInput = useRef(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const choose = (ref) => {
    setOpen(false);
    ref.current?.click();
  };
  const picked = (event) => {
    const files = [...(event.target.files || [])];
    if (files.length) onUnsupportedFile(files);
    event.target.value = '';
  };

  return <div className="attachment-wrapper" ref={root}>
    <button type="button" className="attachment-toggle" title="Attach" aria-label="Attach" aria-expanded={open} onClick={() => setOpen(v => !v)}><Plus size={25} /></button>
    {open && <div className="attachment-menu" role="menu">
      <button type="button" role="menuitem" onClick={() => choose(documentInput)}><FileText size={20} color="#8b5cf6" />Document</button>
      <button type="button" role="menuitem" onClick={() => choose(mediaInput)}><Image size={20} color="#3b82f6" />Photos & videos</button>
      <button type="button" role="menuitem" onClick={() => choose(cameraInput)}><Camera size={20} color="#e15b83" />Camera</button>
      <button type="button" role="menuitem" onClick={() => choose(audioInput)}><Headphones size={20} color="#f59e0b" />Audio</button>
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onLocation(); }}><MapPin size={20} color="#10b981" />Location</button>
    </div>}
    <input hidden ref={documentInput} type="file" onChange={picked}/>
    <input hidden ref={mediaInput} type="file" accept="image/*,video/*" multiple onChange={picked}/>
    <input hidden ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={picked}/>
    <input hidden ref={audioInput} type="file" accept="audio/*" onChange={picked}/>
  </div>;
}
