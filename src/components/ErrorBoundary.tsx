import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: any) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render(): React.ReactNode {
    const { hasError } = (this as any).state as State;
    const { children } = (this as any).props as Props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-5xl">warning</span>
          </div>
          <h1 className="text-4xl font-bold text-on-surface mb-4">Something went wrong.</h1>
          <p className="text-on-surface-variant max-w-md font-medium text-sm leading-relaxed mb-8">
            The page ran into an unexpected error. Please return home and try again.
          </p>
          <button
            className="px-8 py-3 bg-primary text-white font-bold rounded-md text-sm hover:bg-primary-container transition-colors"
            onClick={() => window.location.href = '/'}
          >
            Return home
          </button>
        </div>
      );
    }

    return children;
  }
}
