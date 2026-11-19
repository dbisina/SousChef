import { installNavGuard, NAV_GUARD_MS } from '@/lib/navGuard';

const makeRouter = () => ({
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
});

describe('installNavGuard', () => {
  it('drops a repeat of the same push inside the window', () => {
    const r = makeRouter();
    const push = r.push;
    let t = 1000;
    installNavGuard(r, () => t);
    r.push('/post/1');
    t += 100;
    r.push('/post/1');
    t += 100;
    r.push('/post/1');
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('lets the same push through again after the window', () => {
    const r = makeRouter();
    const push = r.push;
    let t = 1000;
    installNavGuard(r, () => t);
    r.push('/post/1');
    t += NAV_GUARD_MS + 1;
    r.push('/post/1');
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('never blocks a different address', () => {
    const r = makeRouter();
    const push = r.push;
    let t = 1000;
    installNavGuard(r, () => t);
    r.push('/post/1');
    t += 10;
    r.push('/post/2');
    r.push({ pathname: '/post/new', params: { a: 1 } });
    r.push({ pathname: '/post/new', params: { a: 2 } });
    expect(push).toHaveBeenCalledTimes(4);
  });

  it('treats push and replace separately and guards back taps', () => {
    const r = makeRouter();
    const { replace, back } = r;
    let t = 1000;
    installNavGuard(r, () => t);
    r.replace('/(tabs)');
    r.push('/(tabs)');
    r.back();
    r.back();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('installs only once', () => {
    const r = makeRouter();
    const push = r.push;
    let t = 1000;
    installNavGuard(r, () => t);
    installNavGuard(r, () => t);
    r.push('/a');
    expect(push).toHaveBeenCalledTimes(1);
  });
});
