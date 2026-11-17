import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {can} from '../lib/authz';
import {useAuthStore} from '../store/auth';
import {OrganizationCreation} from '../components/OrganizationCreation';
import {PendingInvitations} from '../components/PendingInvitations';
import {LinkedInvitation} from '../components/LinkedInvitation';
import {OrganizationPicker} from '../components/OrganizationPicker';
import {PageHeader} from '../components/ui';

export default function Organizations(){
 const session=useAuthStore(state=>state.session),[proof,setProof]=useState(()=>sessionStorage.getItem('permissionhub.invitation')??'');
 const location=useLocation(),invitationsRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(location.hash!=='#pending-invitations')return;invitationsRef.current?.scrollIntoView?.({block:'start'});invitationsRef.current?.focus({preventScroll:true})},[location.hash]);
 const memberships=session?.user?.memberships.filter(item=>item.status==='ACTIVE')??[];
 return <div className="page organizations-page"><PageHeader eyebrow="Administration" title="Organizations" description="Your memberships and invitations. Organization settings remain restricted to authorized administrators." actions={<OrganizationCreation/>}/>
  <nav className="tabs organization-section-nav" aria-label="Administration sections">{can(session,'ADMINISTRATION_VIEW')&&<Link className="btn secondary" to="/administration">Organization settings</Link>}<Link className="btn secondary active" aria-current="page" to="/administration/organizations">Organizations</Link></nav>
  <section className="panel"><h2>Your organizations</h2>{!memberships.length?<p>You have no active memberships. Accept an invitation below or create your own organization.</p>:<><OrganizationPicker/><div className="membership-list">{memberships.map(item=><article key={item.id}><span><strong>{item.tenantName}</strong><small>{item.role.replaceAll('_',' ')}{item.tenantId===session?.user?.activeTenantId?' · Active organization':''}</small></span>{item.role==='ORGANISATION_ADMIN'&&item.tenantId===session?.user?.activeTenantId&&<Link className="btn secondary" to="/administration?tab=memberships">Manage members</Link>}{item.role==='ORGANISATION_ADMIN'&&item.tenantId!==session?.user?.activeTenantId&&<small>Switch to this organization to manage it.</small>}</article>)}</div></> }</section>
  {proof&&<LinkedInvitation proof={proof} onResolved={()=>setProof('')}/>}
  <section className="panel pending-invitations-anchor" id="pending-invitations" ref={invitationsRef} tabIndex={-1} aria-label="Pending organization invitations"><PendingInvitations onResolved={()=>setProof('')}/></section>
 </div>;
}
