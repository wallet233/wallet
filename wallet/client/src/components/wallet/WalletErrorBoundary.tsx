import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class WalletErrorBoundary extends Component<Props, State> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Wallet overlay error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) return <div>Wallet failed to load</div>;
    return this.props.children;
  }
}
