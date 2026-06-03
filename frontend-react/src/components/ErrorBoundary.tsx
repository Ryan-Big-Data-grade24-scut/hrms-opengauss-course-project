import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ErrorBoundary:', error, info) }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 p-8">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <h3 className="text-base font-semibold text-stone-700">页面异常</h3>
          <p className="text-sm text-stone-400 text-center max-w-md">{this.state.error?.message || '未知错误'}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition">
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
