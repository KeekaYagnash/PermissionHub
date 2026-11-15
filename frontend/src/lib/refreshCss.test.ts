import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles/refresh.css',import.meta.url),'utf8');
describe('responsive visual refresh contracts',()=>{
 it('keeps primary/secondary/muted text readable against each theme surface',()=>{
  const luminance=(hex:string)=>{
   const rgb=hex.match(/[a-f\d]{2}/gi)!.map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
   return rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722;
  };
  for(const theme of ['light','dark']){
   const block=css.split(`:root[data-theme="${theme}"]`)[1]!.split('}')[0]!;
   const token=(name:string)=>block.match(new RegExp(`${name}: (#[a-fA-F0-9]{6})`))![1]!;
   for(const text of ['--ph-text-primary','--ph-text-secondary','--ph-text-muted'])for(const surface of ['--ph-bg-page','--ph-bg-surface','--ph-bg-muted','--ph-bg-raised']){
    const a=luminance(token(text)),b=luminance(token(surface));
    expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),`${theme}: ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
   }
  }
 });
 it('defines the supplied accent palette and both semantic themes',()=>{
  for(const color of ['#0499F2','#00D0F1','#00DFD9','#26F596'])expect(css).toContain(color);
  expect(css).toContain(':root[data-theme="light"]');expect(css).toContain(':root[data-theme="dark"]');
 });
 it('keeps compact navigation, dialog constraints, touch targets and reduced motion',()=>{
  for(const declaration of ['min-width: 1024px','max-width: 1023px','max-width: 720px','max-height: calc(100dvh - 24px)','min-height: 44px','prefers-reduced-motion','focus-visible','.skip-link:focus','overscroll-behavior-x: contain'])expect(css).toContain(declaration);
  expect(css).toContain('.mobile-bottom-nav > * { flex: 1; min-width: 0; }');
 });
});
