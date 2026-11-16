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
  expect(css).toContain('--mobile-bottom-nav-height: 0px');
  expect(css).toContain('.mobile-context-strip .context-bar { display: flex;');
  expect(css).toContain('.theme-toggle.compact svg { display: block; }');
 });
 it('reserves safe-area space for fixed navigation and confines overflow to the bottom sheet',()=>{
  expect(css).toContain('--mobile-bottom-nav-height:68px');expect(css).toContain('grid-auto-columns:minmax(0,1fr)');expect(css).toContain('overflow:hidden;background:var(--ph-bg-surface)');expect(css).toContain('max-height:min(84dvh,760px);overflow-y:auto;overscroll-behavior:contain');expect(css).toContain('padding-bottom:calc(var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom) + 24px)');
 });
 it('disables the restrained session spinner for reduced-motion preferences',()=>{expect(css).toContain('.session-loading-spinner{animation:none}');expect(css).toContain('color:var(--ph-link);animation:feedback-spin 1s linear infinite')});
 it('uses readable danger colors in both themes and hides desktop navigation overflow',()=>{
  const lum=(value:string)=>{const rgb=value.match(/[a-f\d]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722};
  for(const theme of ['light','dark']){const block=css.split(`:root[data-theme="${theme}"]`)[1]!.split('}')[0]!,text=lum(block.match(/--ph-danger-text: (#[a-f\d]{6})/i)![1]!),bg=lum(block.match(/--ph-danger-bg: (#[a-f\d]{6})/i)![1]!);expect((Math.max(text,bg)+.05)/(Math.min(text,bg)+.05)).toBeGreaterThanOrEqual(4.5)}
  expect(css).toContain('.desktop-sidebar,.desktop-sidebar .desktop-nav{overflow:hidden}');expect(css).toContain('background:var(--ph-danger-bg);color:var(--ph-danger-text)');
 });
});
