// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {ProductLogo} from './ProductLogo';

afterEach(cleanup);
it('uses only the supplied theme logo assets with meaningful alternatives and original proportions',()=>{
 render(<ProductLogo/>);
 const images=screen.getAllByAltText('IAMOps');
 expect(images.map(image=>image.getAttribute('src'))).toEqual(['/iamops_black.png','/iamops_white.png']);
 for(const image of images){expect(image.getAttribute('width')).toBe('3000');expect(image.getAttribute('height')).toBe('3000')}
});
it('switches artwork with the existing theme attribute and keeps the mobile logo responsive',()=>{
 const css=readFileSync(resolve('src/styles/branding.css'),'utf8');
 expect(css).toMatch(/\.product-logo \.product-logo-light\s*\{ display: block/);
 expect(css).toMatch(/\.product-logo \.product-logo-dark\s*\{ display: none/);
 expect(css).toMatch(/:root\[data-theme="dark"\] \.product-logo \.product-logo-light\s*\{ display: none/);
 expect(css).toMatch(/:root\[data-theme="dark"\] \.product-logo \.product-logo-dark\s*\{ display: block/);
 expect(css).toContain('height: auto');expect(css).toContain('max-width: 100%');expect(css).toContain('clamp(80px, 23vw, 140px)');
});
it('rebrands public metadata while retaining the exact Disraptor favicon link and bytes',()=>{
 const html=readFileSync(resolve('index.html'),'utf8');
 expect(html).toContain('<title>IAMOps · AWS Permission Requests</title>');
 expect(html).toContain('property="og:title" content="IAMOps · AWS permission requests"');
 expect(html).toContain('name="twitter:title" content="IAMOps · AWS permission requests"');
 expect(html).toContain('property="og:image" content="/iamops_black.png"');
 expect(html).toContain('<link rel="icon" type="image/png" href="/DR_Icon_Colour.png"/>');
 const favicon=readFileSync(resolve('public/DR_Icon_Colour.png'));
 expect(createHash('sha256').update(favicon).digest('hex')).toBe('b0b772f93541d1f9590302933a467288b7685daaf98de4a1a8e3bdcf86cf4784');
});
