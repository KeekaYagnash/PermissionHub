import request from 'supertest';
import { describe,expect,it } from 'vitest';
import { app } from '../app.js';

describe('development authentication session',()=>{
 it('does not expose SSO login or callback routes',async()=>{await request(app).get('/api/auth/login').expect(404);await request(app).get('/api/auth/callback').expect(404);await request(app).get('/api/auth/providers').expect(404)});
 it('logs in with a rotated cookie and excludes demo AWS contexts in manual mode',async()=>{const agent=request.agent(app);const initial=await agent.get('/api/auth/session').expect(200);const login=await agent.post('/api/auth/development-login').set('X-CSRF-Token',initial.body.data.csrfToken).send({userId:'user_requester_dev'}).expect(200);expect(login.body.data.user.provider).toBe('development');const context=await agent.get('/api/auth/context').expect(200);expect(context.body.data.accounts).toEqual([]);expect(context.body.data.organisations).toEqual([]);expect(context.body.data.organisationalUnits).toEqual([]);await agent.post('/api/auth/select-account').set('X-CSRF-Token',login.body.data.csrfToken).send({accountId:'account_security_dev'}).expect(403)});
 it('redirects protected requests without a session',async()=>{await request(app).get('/api/requests').expect(401)});
});
