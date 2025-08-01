/**
 * React Hook for User Behavior Tracking
 * Provides easy integration of behavior tracking in React components
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { behaviorTracker } from '@/lib/analytics/behavior-tracker';
import { analytics } from '@/lib/analytics/analytics-engine';
import { abTesting } from '@/lib/analytics/ab-testing';

export interface UseBehaviorTrackingOptions {
  trackClicks?: boolean;
  trackHover?: boolean;
  trackTimeSpent?: boolean;
  trackVisibility?: boolean;
  trackEngagement?: boolean;
  customEvents?: string[];
}

export interface BehaviorTrackingReturn {
  trackEvent: (eventName: string, data?: Record<string, any>) => void;
  trackGoal: (goalName: string, value?: number) => void;
  getEngagementScore: () => number;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useBehaviorTracking(
  options: UseBehaviorTrackingOptions = {}
): BehaviorTrackingReturn {
  const {
    trackClicks = true,
    trackHover = false,
    trackTimeSpent = true,
    trackVisibility = true,
    trackEngagement = true,
    customEvents = []
  } = options;

  const elementRef = useRef<HTMLElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const visibilityTimeRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(false);

  // Track custom event
  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    analytics.track(eventName, data);
  }, []);

  // Track goal conversion
  const trackGoal = useCallback((goalName: string, value?: number) => {
    analytics.trackGoal(goalName, value);
  }, []);

  // Get current engagement score
  const getEngagementScore = useCallback((): number => {
    const summary = behaviorTracker.getBehaviorSummary();
    return summary.engagementScore;
  }, []);

  // Start behavior recording
  const startRecording = useCallback(() => {
    behaviorTracker.startTracking();
  }, []);

  // Stop behavior recording
  const stopRecording = useCallback(() => {
    behaviorTracker.stopTracking();
  }, []);

  // Element visibility tracking
  useEffect(() => {
    if (!trackVisibility) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isVisibleRef.current) {
            // Element became visible
            isVisibleRef.current = true;
            visibilityTimeRef.current = Date.now();
            
            trackEvent('element_in_view', {
              element: entry.target.tagName,
              intersectionRatio: entry.intersectionRatio
            });
          } else if (!entry.isIntersecting && isVisibleRef.current) {
            // Element left view
            isVisibleRef.current = false;
            const timeInView = Date.now() - visibilityTimeRef.current;
            
            trackEvent('element_out_of_view', {
              element: entry.target.tagName,
              timeInView
            });
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    // Observe all elements with data-track attribute
    const elements = document.querySelectorAll('[data-track-visibility]');
    elements.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [trackVisibility, trackEvent]);

  // Time spent tracking
  useEffect(() => {
    if (!trackTimeSpent) return;

    const handleBeforeUnload = () => {
      const timeSpent = Date.now() - startTimeRef.current;
      
      // Use sendBeacon for reliable data sending
      if (navigator.sendBeacon) {
        const data = new Blob([JSON.stringify({
          event: 'page_time_spent',
          timeSpent,
          path: window.location.pathname
        })], { type: 'application/json' });
        
        navigator.sendBeacon('/api/analytics/events', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [trackTimeSpent]);

  // Engagement tracking
  useEffect(() => {
    if (!trackEngagement) return;

    let engagementTimer: NodeJS.Timeout;
    let lastEngagementScore = 0;

    const checkEngagement = () => {
      const currentScore = getEngagementScore();
      
      if (currentScore !== lastEngagementScore) {
        // Engagement level changed
        if (currentScore > 80) {
          trackEvent('high_engagement_reached', { score: currentScore });
        } else if (currentScore < 20 && lastEngagementScore >= 20) {
          trackEvent('low_engagement_detected', { score: currentScore });
        }
        
        lastEngagementScore = currentScore;
      }
    };

    // Check engagement every 30 seconds
    engagementTimer = setInterval(checkEngagement, 30000);

    return () => {
      clearInterval(engagementTimer);
    };
  }, [trackEngagement, getEngagementScore, trackEvent]);

  // Initialize behavior tracking on mount
  useEffect(() => {
    startRecording();

    return () => {
      // Send final metrics
      const timeSpent = Date.now() - startTimeRef.current;
      const engagementScore = getEngagementScore();

      trackEvent('component_unmount', {
        timeSpent,
        engagementScore,
        path: window.location.pathname
      });
    };
  }, [startRecording, getEngagementScore, trackEvent]);

  return {
    trackEvent,
    trackGoal,
    getEngagementScore,
    startRecording,
    stopRecording
  };
}

// Hook for tracking specific UI elements
export function useElementTracking(
  elementId: string,
  options: {
    trackClicks?: boolean;
    trackHover?: boolean;
    trackScroll?: boolean;
    trackFocus?: boolean;
  } = {}
) {
  const {
    trackClicks = true,
    trackHover = false,
    trackScroll = false,
    trackFocus = false
  } = options;

  const elementRef = useRef<HTMLElement | null>(null);
  const hoverStartRef = useRef<number>(0);

  useEffect(() => {
    const element = document.getElementById(elementId);
    if (!element) return;

    elementRef.current = element;
    const handlers: Array<[string, EventListener]> = [];

    // Click tracking
    if (trackClicks) {
      const clickHandler = (e: Event) => {
        analytics.track('element_clicked', {
          elementId,
          text: (e.target as HTMLElement).textContent?.substring(0, 50)
        });
      };
      element.addEventListener('click', clickHandler);
      handlers.push(['click', clickHandler]);
    }

    // Hover tracking
    if (trackHover) {
      const mouseEnterHandler = () => {
        hoverStartRef.current = Date.now();
      };

      const mouseLeaveHandler = () => {
        const hoverDuration = Date.now() - hoverStartRef.current;
        analytics.track('element_hovered', {
          elementId,
          duration: hoverDuration
        });
      };

      element.addEventListener('mouseenter', mouseEnterHandler);
      element.addEventListener('mouseleave', mouseLeaveHandler);
      handlers.push(['mouseenter', mouseEnterHandler]);
      handlers.push(['mouseleave', mouseLeaveHandler]);
    }

    // Scroll tracking (for scrollable elements)
    if (trackScroll) {
      let lastScrollTop = element.scrollTop;
      
      const scrollHandler = () => {
        const scrollDepth = (element.scrollTop / element.scrollHeight) * 100;
        const scrollDirection = element.scrollTop > lastScrollTop ? 'down' : 'up';
        
        analytics.track('element_scrolled', {
          elementId,
          depth: scrollDepth,
          direction: scrollDirection
        });

        lastScrollTop = element.scrollTop;
      };

      element.addEventListener('scroll', scrollHandler);
      handlers.push(['scroll', scrollHandler]);
    }

    // Focus tracking (for form elements)
    if (trackFocus) {
      let focusStartTime = 0;

      const focusHandler = () => {
        focusStartTime = Date.now();
        analytics.track('element_focused', { elementId });
      };

      const blurHandler = () => {
        const focusDuration = Date.now() - focusStartTime;
        analytics.track('element_blurred', {
          elementId,
          duration: focusDuration
        });
      };

      element.addEventListener('focus', focusHandler);
      element.addEventListener('blur', blurHandler);
      handlers.push(['focus', focusHandler]);
      handlers.push(['blur', blurHandler]);
    }

    // Cleanup
    return () => {
      handlers.forEach(([event, handler]) => {
        element.removeEventListener(event, handler);
      });
    };
  }, [elementId, trackClicks, trackHover, trackScroll, trackFocus]);

  return elementRef;
}

// Hook for A/B testing
export function useABTest(testName: string, userId?: string) {
  const variant = abTesting.getVariant(testName, userId);
  const isEnabled = abTesting.isFeatureEnabled(testName, userId);

  const trackConversion = useCallback((goalName: string, value?: number) => {
    abTesting.trackConversion(testName, goalName, userId, value);
  }, [testName, userId]);

  return {
    variant,
    isEnabled,
    trackConversion
  };
}

// Hook for tracking form analytics
export function useFormTracking(formId: string) {
  const [fieldTimes, setFieldTimes] = useState<Record<string, number>>({});
  const [abandonedFields, setAbandonedFields] = useState<string[]>([]);
  const formStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;

    const fieldStartTimes: Record<string, number> = {};

    const handleFocus = (e: Event) => {
      const field = e.target as HTMLInputElement;
      const fieldName = field.name || field.id;
      
      if (fieldName) {
        fieldStartTimes[fieldName] = Date.now();
        
        analytics.track('form_field_focused', {
          formId,
          fieldName
        });
      }
    };

    const handleBlur = (e: Event) => {
      const field = e.target as HTMLInputElement;
      const fieldName = field.name || field.id;
      
      if (fieldName && fieldStartTimes[fieldName]) {
        const timeSpent = Date.now() - fieldStartTimes[fieldName];
        
        setFieldTimes(prev => ({
          ...prev,
          [fieldName]: (prev[fieldName] || 0) + timeSpent
        }));

        // Check if field was abandoned (empty after interaction)
        if (!field.value && timeSpent > 1000) {
          setAbandonedFields(prev => [...prev, fieldName]);
        }

        analytics.track('form_field_completed', {
          formId,
          fieldName,
          timeSpent,
          hasValue: !!field.value
        });
      }
    };

    const handleSubmit = (e: Event) => {
      const totalTime = Date.now() - formStartTime.current;
      
      analytics.track('form_submitted', {
        formId,
        totalTime,
        fieldTimes,
        abandonedFields: abandonedFields.length
      });
    };

    // Add listeners to all form fields
    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      field.addEventListener('focus', handleFocus as EventListener);
      field.addEventListener('blur', handleBlur as EventListener);
    });

    form.addEventListener('submit', handleSubmit);

    // Cleanup
    return () => {
      fields.forEach(field => {
        field.removeEventListener('focus', handleFocus as EventListener);
        field.removeEventListener('blur', handleBlur as EventListener);
      });
      form.removeEventListener('submit', handleSubmit);
    };
  }, [formId, fieldTimes, abandonedFields]);

  return {
    fieldTimes,
    abandonedFields,
    totalTime: Date.now() - formStartTime.current
  };
}

import { useState } from 'react';