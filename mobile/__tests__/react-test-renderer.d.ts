// Minimal typing for the parts of react-test-renderer used in tests (no @types package installed).
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestRenderer {
    toJSON(): unknown;
  }
  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void): void;

  const renderer: { create: typeof create; act: typeof act };
  export default renderer;
}
