// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ThemeControl,PublicThemeControl} from './ThemeControl';
import {readThemePreference,setThemePreference} from '../lib/theme';

beforeEach(()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 setThemePreference('light');localStorage.clear();
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();document.documentElement.removeAttribute('data-theme')});
describe('light-default appearance control',()=>{
 it('starts light even when the operating system is dark',()=>{
  render(<ThemeControl/>);expect(document.documentElement.dataset.theme).toBe('light');
  expect(screen.getByRole('button',{name:'Switch to dark theme'})).toBeTruthy();
 });
 it('persists dark mode and synchronizes all mounted controls',()=>{
  render(<><ThemeControl/><ThemeControl compact/></>);
  fireEvent.click(screen.getAllByRole('button',{name:'Switch to dark theme'})[0]!);
  expect(localStorage.getItem('permissionhub.theme')).toBe('dark');
  expect(screen.getAllByRole('button',{name:'Switch to light theme'})).toHaveLength(2);
  expect(document.documentElement.style.colorScheme).toBe('dark');
 });
 it('restores saved dark mode and switches back to light',()=>{
  localStorage.setItem('permissionhub.theme','dark');render(<ThemeControl/>);
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button',{name:'Switch to light theme'}));
  expect(localStorage.getItem('permissionhub.theme')).toBe('light');
 });
 it('responds to another tab changing or clearing the preference',()=>{
  render(<ThemeControl/>);localStorage.setItem('permissionhub.theme','dark');
  act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'permissionhub.theme'})));
  expect(document.documentElement.dataset.theme).toBe('dark');
  localStorage.clear();act(()=>window.dispatchEvent(new StorageEvent('storage',{key:null})));
  expect(document.documentElement.dataset.theme).toBe('light');
 });
 it('continues working when browser storage is blocked',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked')});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked')});
  render(<ThemeControl/>);fireEvent.click(screen.getByRole('button',{name:'Switch to dark theme'}));
  expect(readThemePreference()).toBe('dark');
 });
 it('uses light for an old system preference and provides the control on login',()=>{
  localStorage.setItem('permissionhub.theme','system');
  render(<MemoryRouter initialEntries={['/login']}><PublicThemeControl/></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Switch to dark theme'})).toBeTruthy();
 });
});
