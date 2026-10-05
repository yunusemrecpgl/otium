import { Component, Fragment } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  resetKey?: string;
  onReset?: () => void;
}

export class ErrorBoundary extends Component<Props, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Otium render failed', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.retry();
  }

  retry = () => {
    this.props.onReset?.();
    this.setState(previous => ({ failed: false, attempt: previous.attempt + 1 }));
  };

  render() {
    return this.state.failed ? this.props.fallback(this.retry)
      : <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
