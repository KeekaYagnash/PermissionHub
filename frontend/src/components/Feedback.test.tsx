// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {FeedbackCenter} from './Feedback';
import {feedback,useFeedbackStore} from '../store/feedback';
afterEach(()=>{cleanup();useFeedbackStore.setState({items:[]});vi.useRealTimers()});
it('deduplicates notifications and dismisses a completed operation after five seconds',()=>{
 vi.useFakeTimers();render(<FeedbackCenter/>);act(()=>{feedback.show('one','Saved','success');feedback.show('one','Saved','success')});expect(screen.getAllByText('Saved')).toHaveLength(1);act(()=>vi.advanceTimersByTime(4999));expect(screen.getByText('Saved')).toBeTruthy();act(()=>vi.advanceTimersByTime(1));expect(screen.queryByText('Saved')).toBeNull();
});
it('pauses the remaining lifetime on hover and keyboard focus',()=>{
 vi.useFakeTimers();render(<FeedbackCenter/>);act(()=>feedback.show('one','Warning','warning'));const toast=screen.getByText('Warning').closest('.feedback-toast')!;
 act(()=>vi.advanceTimersByTime(2000));fireEvent.mouseEnter(toast);act(()=>vi.advanceTimersByTime(6000));expect(screen.getByText('Warning')).toBeTruthy();fireEvent.mouseLeave(toast);fireEvent.focus(screen.getByRole('button',{name:'Dismiss notification'}));act(()=>vi.advanceTimersByTime(6000));expect(screen.getByText('Warning')).toBeTruthy();fireEvent.blur(screen.getByRole('button',{name:'Dismiss notification'}));act(()=>vi.advanceTimersByTime(3000));expect(screen.queryByText('Warning')).toBeNull();
});
it('keeps pending feedback visible and exposes failures as alerts with a close button',()=>{
 vi.useFakeTimers();render(<FeedbackCenter/>);act(()=>feedback.show('pending','Saving…','loading'));act(()=>vi.advanceTimersByTime(30000));expect(screen.getByRole('status').textContent).toContain('Saving');act(()=>feedback.show('pending','Could not save','error'));expect(screen.getByRole('alert').textContent).toContain('Could not save');fireEvent.click(screen.getByRole('button',{name:'Dismiss notification'}));expect(screen.queryByRole('alert')).toBeNull();
});
