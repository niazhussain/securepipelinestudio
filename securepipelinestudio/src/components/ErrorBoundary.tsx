import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">The page hit an unexpected error. Your workflow was not sent anywhere.</p>
        <button className="button" type="button" onClick={() => this.setState({ failed: false })}>
          Try again
        </button>
      </div>
    )
  }
}
