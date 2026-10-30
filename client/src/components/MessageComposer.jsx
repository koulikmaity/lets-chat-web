import { Smile, Send } from 'lucide-react';
import AttachmentMenu from './AttachmentMenu';

export default function MessageComposer({ draft, onDraft, send, sending, onLocation, onUnsupportedFile }) {
  return <form className="composer" onSubmit={send}>
    <AttachmentMenu onLocation={onLocation} onUnsupportedFile={onUnsupportedFile}/>
    <input value={draft} maxLength={4000} onChange={e => onDraft(e.target.value)} placeholder="Type a message" aria-label="Type a message"/>
    <button type="button" className="icon-button emoji-button" title="Add emoji" onClick={() => onDraft(draft + '😊')}><Smile size={24}/></button>
    <button type="submit" className="send-button" disabled={!draft.trim() || sending} title="Send message" aria-label="Send message"><Send size={19}/></button>
  </form>;
}
