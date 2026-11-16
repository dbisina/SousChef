import { parseCookCommand } from '@/lib/cookCommands';

describe('cook voice commands', () => {
  it('moves between steps, with or without the wake word', () => {
    expect(parseCookCommand('next')).toEqual({ type: 'next' });
    expect(parseCookCommand('Sous chef, next step')).toEqual({ type: 'next' });
    expect(parseCookCommand('hey sue chef go back')).toEqual({ type: 'previous' });
    expect(parseCookCommand('Repeat that')).toEqual({ type: 'repeat' });
    expect(parseCookCommand('stop')).toEqual({ type: 'stop' });
  });

  it('sets timers from digits, words, hours and seconds', () => {
    expect(parseCookCommand('set a timer for 10 minutes')).toEqual({ type: 'timer', minutes: 10, label: 'Timer' });
    expect(parseCookCommand('start a timer for fifteen minutes')).toEqual({ type: 'timer', minutes: 15, label: 'Timer' });
    expect(parseCookCommand('sous chef set a timer for two hours')).toEqual({ type: 'timer', minutes: 120, label: 'Timer' });
    expect(parseCookCommand('timer for 90 seconds')).toEqual({ type: 'timer', minutes: 1.5, label: 'Timer' });
    expect(parseCookCommand('set a 5 minute timer')).toEqual({ type: 'timer', minutes: 5, label: 'Timer' });
  });

  it('changes servings', () => {
    expect(parseCookCommand('make it 6 servings')).toEqual({ type: 'servings', servings: 6 });
    expect(parseCookCommand('adjust to eight people')).toEqual({ type: 'servings', servings: 8 });
  });

  it('treats anything else as a question', () => {
    expect(parseCookCommand('Can I use less oil?')).toEqual({ type: 'ask', question: 'Can I use less oil?' });
    expect(parseCookCommand('how do I know the onions are done')).toMatchObject({ type: 'ask' });
  });

  it('ignores silence', () => {
    expect(parseCookCommand('')).toBeNull();
    expect(parseCookCommand('   ')).toBeNull();
    expect(parseCookCommand('sous chef')).toBeNull();
  });
});
