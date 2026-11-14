import React from 'react';
import { Text } from 'react-native';
import renderer, { type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from '@/components/ui/Pressable';

type Json = { type: string; props: Record<string, unknown>; children?: Json[] | string[] | null };

const render = (el: React.ReactElement): Json => {
  let tree!: ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(el);
  });
  return tree.toJSON() as Json;
};

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

describe('Pressable', () => {
  it('resolves a function style into plain values (the NativeWind css-interop bug)', () => {
    const json = render(
      React.createElement(Pressable, {
        style: ({ pressed }: { pressed: boolean }) => ({ height: 58, borderRadius: 29, opacity: pressed ? 0.5 : 1 }),
      })
    );
    const style = flat(json.props.style);
    expect(style.height).toBe(58);
    expect(style.borderRadius).toBe(29);
    expect(style.opacity).toBe(1);
  });

  it('passes a static style through untouched', () => {
    const json = render(React.createElement(Pressable, { style: { width: 52, height: 56 } }));
    const style = flat(json.props.style);
    expect(style.width).toBe(52);
    expect(style.height).toBe(56);
  });

  it('resolves function children', () => {
    // Function children are valid for Pressable at runtime; createElement's typing only allows nodes.
    const renderChildren = ({ pressed }: { pressed: boolean }) =>
      React.createElement(Text, null, pressed ? 'down' : 'up');
    const json = render(React.createElement(Pressable, null, renderChildren as unknown as React.ReactNode));
    expect(JSON.stringify(json.children)).toContain('up');
  });
});
