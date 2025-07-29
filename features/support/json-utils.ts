/**
 * JSON Utilities for BDD Tests
 * Handles common JSON parsing errors and API response issues
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export class JsonUtils {
  /**
   * Safely parse JSON response with error handling
   */
  static async safeJsonParse<T = any>(response: Response): Promise<ApiResponse<T>> {
    try {
      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0' || response.status === 204) {
        return {
          success: response.ok,
          data: undefined,
          status: response.status
        };
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        return {
          success: false,
          error: `Expected JSON response, got ${contentType}. Body: ${text.substring(0, 100)}`,
          status: response.status
        };
      }

      // Attempt to parse JSON
      const text = await response.text();
      if (!text.trim()) {
        return {
          success: response.ok,
          data: undefined,
          status: response.status
        };
      }

      const data = JSON.parse(text);
      return {
        success: response.ok,
        data,
        status: response.status
      };

    } catch (error) {
      return {
        success: false,
        error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: response.status
      };
    }
  }

  /**
   * Make API call with comprehensive error handling
   */
  static async apiCall<T = any>(
    url: string, 
    options: RequestInit = {},
    timeout = 10000
  ): Promise<ApiResponse<T>> {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      return await this.safeJsonParse<T>(response);

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Request timeout after ${timeout}ms`,
            status: 408
          };
        }
        return {
          success: false,
          error: error.message,
          status: 0
        };
      }
      return {
        success: false,
        error: 'Unknown API error',
        status: 0
      };
    }
  }

  /**
   * Mock API responses for testing
   */
  static createMockResponse<T>(data: T, status = 200): ApiResponse<T> {
    return {
      success: status >= 200 && status < 300,
      data,
      status
    };
  }

  /**
   * Validate required fields in API response
   */
  static validateResponse<T>(
    response: ApiResponse<T>, 
    requiredFields: string[] = []
  ): boolean {
    if (!response.success || !response.data) {
      return false;
    }

    if (requiredFields.length === 0) {
      return true;
    }

    const data = response.data as any;
    return requiredFields.every(field => 
      data.hasOwnProperty(field) && data[field] !== undefined
    );
  }
}

/**
 * Retry utility for flaky operations
 */
export class RetryUtils {
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2
  ): Promise<T> {
    let lastError: Error;
    let delay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }
}