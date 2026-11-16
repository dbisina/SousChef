import React, { forwardRef, useState } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type View,
} from 'react-native';

/**
 * Drop-in replacement for React Native's Pressable.
 *
 * NativeWind's css-interop merges `style` into an array, so a function `style` (or function `children`)
 * is never called on device and the whole style is lost (no background, size or radius). This wrapper
 * resolves the function itself and hands React Native plain values.
 */
export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  { style, children, onPressIn, onPressOut, ...rest },
  ref
) {
  const dynamic = typeof style === 'function' || typeof children === 'function';
  const [pressed, setPressed] = useState(false);

  if (!dynamic) {
    return (
      <RNPressable ref={ref} style={style} onPressIn={onPressIn} onPressOut={onPressOut} {...rest}>
        {children}
      </RNPressable>
    );
  }

  const state = { pressed, hovered: false, focused: false } as PressableStateCallbackType;
  const resolvedStyle = typeof style === 'function' ? style(state) : style;
  const resolvedChildren = typeof children === 'function' ? children(state) : children;

  return (
    <RNPressable
      ref={ref}
      {...rest}
      style={resolvedStyle}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
    >
      {resolvedChildren}
    </RNPressable>
  );
});
