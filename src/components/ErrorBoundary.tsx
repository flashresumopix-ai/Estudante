import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Ops! Algo deu errado.</h2>
            <p className="text-slate-600 mb-6">Ocorreu um erro inesperado no aplicativo.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full gradient-brand text-white py-3 rounded-xl font-medium"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
