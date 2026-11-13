import { Link } from 'react-router-dom';
export default function Unauthorised(){return <main className="auth-page"><section className="auth-card"><h1>Access not authorised</h1><p>Your signed-in identity does not have permission for this tenant, account, or action.</p><Link className="btn primary" to="/">Return to overview</Link></section></main>}
