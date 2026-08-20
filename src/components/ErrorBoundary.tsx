import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justify: 'center',
          padding: '40px 24px',
          margin: '20px auto',
          maxWidth: '600px',
          background: '#0c0f1d',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          color: '#f0f4f9',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <AlertCircle size={28} color="#ef4444" />
          </div>

          <h2 style={{
            fontFamily: 'Rajdhani',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            marginBottom: '8px',
            color: '#f87171'
          }}>
            Ocurrió un error inesperado en este componente
          </h2>

          <p style={{
            fontFamily: 'JetBrains Mono',
            fontSize: '12px',
            color: '#8a93b8',
            marginBottom: '20px',
            maxWidth: '480px',
            wordBreak: 'break-word'
          }}>
            {this.state.error?.message || 'Error desconocido al renderizar la vista.'}
          </p>

          <button
            onClick={this.handleReset}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontSize: '13px'
            }}
          >
            <RefreshCw size={14} /> Recargar Vista
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
