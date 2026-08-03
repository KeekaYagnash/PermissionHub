import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { cn, statusTone } from '../lib/utils';

export function PageHeader({title,description,eyebrow='Governance',actions}:{title:string;description:string;eyebrow?:string;actions?:ReactNode}){return <div className="page-header"><div><div className="breadcrumbs"><span>PermissionHub</span><ChevronRight size={12}/><span>{eyebrow}</span></div><h1>{title}</h1><p>{description}</p></div>{actions&&<div className="page-actions">{actions}</div>}</div>}
export function Button({children,variant='primary',className='',...props}:{children:ReactNode;variant?:'primary'|'secondary'|'ghost'|'danger';className?:string}&React.ButtonHTMLAttributes<HTMLButtonElement>){return <button className={cn('btn',`btn-${variant}`,className)} {...props}>{children}</button>}
export function Card({children,className='',delay=0}:{children:ReactNode;className?:string;delay?:number}){return <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay,duration:.28}} className={cn('card',className)}>{children}</motion.div>}
export function Badge({children,tone}:{children:ReactNode;tone?:string}){return <span className={cn('badge',`badge-${tone??statusTone(String(children))}`)}><i/>{children}</span>}
export function StatusBadge({status}:{status:string}){return <span className={`status ${status.toLowerCase().replaceAll(' ','-')}`}>{status}</span>}
export function Avatar({name,size='md'}:{name:string;size?:'sm'|'md'|'lg'}){return <span className={cn('avatar',`avatar-${size}`)}>{name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>}
export function SearchBox({value,onChange,placeholder='Search…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="search-box"><Search size={15}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button onClick={()=>onChange('')} aria-label="Clear"><X size={13}/></button>}</label>}
export function EmptyState({title,body}:{title:string;body:string}){return <div className="empty"><Search size={30}/><strong>{title}</strong><span>{body}</span></div>}
export function ErrorState({title,body,onRetry}:{title:string;body:string;onRetry?:()=>void}){return <div className="empty error-state"><AlertTriangle size={28}/><strong>{title}</strong><span>{body}</span>{onRetry&&<Button variant="secondary" onClick={onRetry}>Retry</Button>}</div>}
export function LoadingSkeleton({rows=5}:{rows?:number}){return <div className="skeleton-list">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}
export function ServiceIcon({service}:{service:string}){return <span className="service-icon">{service==='Secrets Manager'?'SM':service==='API Gateway'?'API':service.slice(0,3)}</span>}
export function SkeletonRows(){return <div className="skeleton-list">{[1,2,3,4,5].map(i=><div className="skeleton" key={i}/>)}</div>}
export function Modal({open,onClose,title,children,wide=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;wide?:boolean}){if(!open)return null;return <div className="modal-backdrop" onMouseDown={onClose}><motion.div initial={{opacity:0,scale:.98,y:12}} animate={{opacity:1,scale:1,y:0}} className={cn('modal',wide&&'modal-wide')} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Secure workflow</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>{children}</motion.div></div>}
export function Stat({label,value,delta,icon}:{label:string;value:string;delta?:string;icon:ReactNode}){return <Card className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong>{delta&&<small>{delta}</small>}</Card>}

export interface TableColumn<T>{
 key:string;
 header:string;
 priority?:'high'|'medium'|'low';
 className?:string;
 render:(row:T)=>ReactNode;
 mobileLabel?:string;
 align?:'left'|'right';
}

export function SearchToolbar({children,resultCount}:{children:ReactNode;resultCount?:number}){return <div className="search-toolbar">{children}{typeof resultCount==='number'&&<span className="result-count">{resultCount.toLocaleString()} results</span>}</div>}

export function ResponsiveTable<T>({rows,columns,getRowKey,onRowClick,selectedKey,emptyTitle='No records found',emptyBody='Try adjusting the search or filters.',rowActionLabel='View details'}:{rows:T[];columns:TableColumn<T>[];getRowKey:(row:T)=>string;onRowClick?:(row:T)=>void;selectedKey?:string;emptyTitle?:string;emptyBody?:string;rowActionLabel?:string}){
 if(!rows.length)return <EmptyState title={emptyTitle} body={emptyBody}/>;
 return <div className="responsive-table">
  <div className="table-wrap"><table><thead><tr>{columns.map(column=><th key={column.key} className={cn(column.priority&&`priority-${column.priority}`,column.align==='right'&&'align-right')}>{column.header}</th>)}</tr></thead><tbody>{rows.map(row=>{const rowKey=getRowKey(row),selected=selectedKey===rowKey;return <tr key={rowKey} className={selected?'selected':''} onClick={()=>onRowClick?.(row)} tabIndex={onRowClick?0:undefined} onKeyDown={event=>{if(onRowClick&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onRowClick(row)}}}>{columns.map(column=><td key={column.key} className={cn(column.className,column.priority&&`priority-${column.priority}`,column.align==='right'&&'align-right')} title={typeof column.render(row)==='string'?String(column.render(row)):undefined}>{column.render(row)}</td>)}</tr>})}</tbody></table></div>
  <div className="mobile-data-list">{rows.map(row=><div role={onRowClick?'button':undefined} tabIndex={onRowClick?0:undefined} className={selectedKey===getRowKey(row)?'mobile-data-card selected':'mobile-data-card'} key={getRowKey(row)} onClick={()=>onRowClick?.(row)} onKeyDown={event=>{if(onRowClick&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onRowClick(row)}}}><div className="mobile-data-card-head">{columns[0]&&<strong>{columns[0].render(row)}</strong>}<span>{rowActionLabel}</span></div>{columns.slice(1).filter(column=>column.priority!=='low').map(column=><dl key={column.key}><dt>{column.mobileLabel??column.header}</dt><dd>{column.render(row)}</dd></dl>)}</div>)}</div>
 </div>
}

export function FormField({label,required,helper,error,children,full=false}:{label:string;required?:boolean;helper?:string;error?:string;children:ReactNode;full?:boolean}){return <label className={full?'field full':'field'}><span>{label}{required&&<em aria-hidden="true"> *</em>}</span>{children}{helper&&<small>{helper}</small>}{error&&<small className="field-error">{error}</small>}</label>}
export function ReadOnlyField({label,value,helper}:{label:string;value:ReactNode;helper?:string}){return <div className="field readonly-field"><span>{label}</span><div>{value}</div>{helper&&<small>{helper}</small>}</div>}
export function InlineSpinner({label='Loading'}:{label?:string}){return <span className="inline-spinner"><Loader2 size={14}/>{label}</span>}
