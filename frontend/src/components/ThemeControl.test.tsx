// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ThemeControl,PublicThemeControl} from './ThemeControl';
import {readThemePreference,setThemePreference} from '../lib/theme';

let systemDark=false;
let mediaListeners:Set<()=>void>;
beforeEach(()=>{
 localStorage.clear();systemDark=false;mediaListeners=new Set();
 vi.stubGlobal('matchMedia',vi.fn(()=>({get matches(){return systemDark},media:'(prefers-color-scheme: dark)',addEventListener:(_event:string,listener:()=>void)=>mediaListeners.add(listener),removeEventListener:(_event:string,listener:()=>void)=>mediaListeners.delete(listener)})));
 setThemePreference('system');localStorage.clear();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();document.documentElement.removeAttribute('data-theme')});
describe('shared appearance control',()=>{
 it('respects the OS before a choice is saved and follows subsequent OS changes',()=>{
  systemDark=true;render(<ThemeControl/>);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('permissionhub.theme')).toBeNull();
  systemDark=false;act(()=>mediaListeners.forEach(listener=>listener()));
  expect(document.documentElement.dataset.theme).toBe('light');
 });
 it('persists an explicit choice and synchronizes every mounted control',()=>{
  render(<><ThemeControl/><ThemeControl compact/></>);
  const controls=screen.getAllByRole('combobox',{name:'Colour theme'}) as HTMLSelectElement[];
  fireEvent.change(controls[0]!,{target:{value:'dark'}});
  expect(localStorage.getItem('permissionhub.theme')).toBe('dark');
  expect(controls[1]!.value).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  systemDark=false;act(()=>mediaListeners.forEach(listener=>listener()));
  expect(document.documentElement.dataset.theme).toBe('dark');
 });
 it('restores saved theme and responds to another tab changing it',()=>{
  localStorage.setItem('permissionhub.theme','light');render(<ThemeControl/>);
  localStorage.setItem('permissionhub.theme','dark');act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'permissionhub.theme'})));
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
 });
 it('continues working if browser storage is unavailable',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked')});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked')});
  act(()=>setThemePreference('system'));render(<ThemeControl/>);
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'light'}});
  expect(readThemePreference()).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
 });
 it('offers appearance settings on login without changing login routes or state',()=>{
  render(<MemoryRouter initialEntries={['/login']}><PublicThemeControl/></MemoryRouter>);
  expect(screen.getByRole('combobox',{name:'Colour theme'})).toBeTruthy();
 });
 it('keeps controls synchronized when storage is readable but writes fail',()=>{
  render(<><ThemeControl/><ThemeControl compact/></>);
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota exceeded')});
  const controls=screen.getAllByRole('combobox') as HTMLSelectElement[];
  fireEvent.change(controls[0]!,{target:{value:'dark'}});
  expect(controls[1]!.value).toBe('dark');expect(readThemePreference()).toBe('dark');
 });
});
