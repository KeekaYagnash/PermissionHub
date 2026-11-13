import type {ReactNode} from 'react';

export function ConnectionGuideStep({number,title,children}:{number:number;title:string;children:ReactNode}){
 return <section className="connection-guide-step"><span aria-hidden="true">{number}</span><div><h3>{title}</h3>{children}</div></section>;
}

export function SecurityNotice({children,tone='warning'}:{children:ReactNode;tone?:'warning'|'info'}){
 return <div className={`connection-guide-notice ${tone}`} role="note">{children}</div>;
}
