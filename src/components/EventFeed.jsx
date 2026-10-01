import { useState } from 'react';
import { formatTime } from '../api.mjs';
const combat=new Set(['ATTACK','DEATH','BETRAYAL','THEFT']);
const social=new Set(['CONVERSATION','TRADE','ALLIANCE_CREATED','COOPERATION','DECEPTION']);
export default function EventFeed({events,eventCount,expanded=false}){
  const [filter,setFilter]=useState('all');
  const filtered=events.filter(e=>filter==='all'||filter==='social'&&social.has(e.event)||filter==='conflict'&&combat.has(e.event)).slice().reverse();
  return <section className={`feed-panel ${expanded?'expanded':''}`} aria-label="Live world feed"><div className="panel-title"><span>LIVE WORLD FEED</span><span className="muted">{eventCount} EVENTS</span></div><div className="feed-tabs">{['all','social','conflict'].map(f=><button key={f} onClick={()=>setFilter(f)} className={f===filter?'active':''}>{f}</button>)}</div><div className="feed-events">{filtered.length?filtered.map(e=><div key={e.id} className="feed-event" data-event={e.event}><i className={combat.has(e.event)?'coral-bg':social.has(e.event)?'mint-bg':'amber-bg'}/><time>{formatTime(e.timestamp)}</time><p>{e.result}</p></div>):<p className="empty-message">Waiting for the next encounter…</p>}</div></section>;
}
