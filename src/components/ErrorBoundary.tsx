import { Component, ReactNode, JSX } from 'react';
import { Container, Title, Text, Button, Stack, Paper } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: any) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any): void {
    // Log the error to our logging service
    logger.error('Uncaught error in component tree', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo);
      }

      // Default fallback UI
      return (
        <Container size="sm" py="xl">
          <Paper shadow="md" p="xl" withBorder>
            <Stack gap="lg" align="center">
              <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />
              
              <Title order={2} ta="center">
                Something went wrong
              </Title>
              
              <Text c="dimmed" ta="center">
                We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
              </Text>

              {import.meta.env.DEV && this.state.error && (
                <Paper p="md" bg="gray.0" w="100%">
                  <Text size="sm" fw={500} mb="xs">Error Details (Development Only):</Text>
                  <Text size="xs" ff="monospace" c="red">
                    {this.state.error.message}
                  </Text>
                  {this.state.error.stack && (
                    <Text size="xs" ff="monospace" c="dimmed" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
                      {this.state.error.stack}
                    </Text>
                  )}
                </Paper>
              )}

              <Stack gap="sm" w="100%">
                <Button onClick={this.handleReset} fullWidth variant="light">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} fullWidth variant="default">
                  Reload Page
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, errorInfo: any) => ReactNode
): React.ComponentType<P> {
  return function WithErrorBoundary(props: P): JSX.Element {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}


