// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Modal} from './ui';
afterEach(cleanup);
it('traps forward and reverse Tab from initial dialog focus and restores the opener',async()=>{
 const opener=document.createElement('button');document.body.append(opener);opener.focus();const close=vi.fn();const view=render(<Modal open onClose={close} title="Test dialog"><input aria-label="Example field"/><button>Save</button></Modal>);const dialog=screen.getByRole('dialog');await waitFor(()=>expect(document.activeElement).toBe(dialog));
 fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(screen.getByRole('button',{name:'Save'}));fireEvent.keyDown(document.activeElement!,{key:'Tab'});expect(document.activeElement).toBe(screen.getByRole('button',{name:'Close dialog'}));fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);view.unmount();expect(document.activeElement).toBe(opener);opener.remove();
});
