/**
 * User Behavior Tracking System
 * Captures and analyzes user interactions and patterns
 */

import { analytics } from './analytics-engine';
import { abTesting } from './ab-testing';
import logger from '../monitoring/logger';

export interface UserBehavior {
  sessionId: string;
  userId?: string;
  events: BehaviorEvent[];
  mouseMovements: MouseMovement[];
  scrollData: ScrollData;
  clickMap: ClickMap;
  engagementScore: number;
  rageClicks: RageClick[];
  formInteractions: FormInteraction[];
  pageTransitions: PageTransition[];
}

export interface BehaviorEvent {
  timestamp: number;
  type: BehaviorEventType;
  target: string;
  data: Record<string, any>;
  duration?: number;
}

export type BehaviorEventType = 
  | 'click'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'resize'
  | 'copy'
  | 'paste'
  | 'selection'
  | 'visibility_change'
  | 'form_change'
  | 'form_submit'
  | 'video_play'
  | 'video_pause'
  | 'video_complete';

export interface MouseMovement {
  x: number;
  y: number;
  timestamp: number;
  velocity: number;
}

export interface ScrollData {
  maxDepth: number;
  averageSpeed: number;
  bounceDepth: number;
  scrollEvents: Array<{
    depth: number;
    timestamp: number;
    direction: 'up' | 'down';
  }>;
}

export interface ClickMap {
  clicks: Array<{
    x: number;
    y: number;
    element: string;
    timestamp: number;
  }>;
  heatmap?: HeatmapCell[][];
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
}

export interface RageClick {
  element: string;
  count: number;
  timestamp: number;
  coordinates: { x: number; y: number };
}

export interface FormInteraction {
  formId: string;
  fieldName: string;
  interactionType: 'focus' | 'blur' | 'change' | 'submit';
  timestamp: number;
  timeSpent?: number;
  abandoned?: boolean;
}

export interface PageTransition {
  from: string;
  to: string;
  timestamp: number;
  trigger: 'link' | 'back' | 'forward' | 'reload' | 'external';
  timeOnPage: number;
}

export class BehaviorTracker {
  private static instance: BehaviorTracker;
  private currentBehavior: UserBehavior;
  private observers: Map<string, MutationObserver | IntersectionObserver> = new Map();
  private eventHandlers: Map<string, EventListener> = new Map();
  private mouseTrail: MouseMovement[] = [];
  private clickBuffer: Array<{ element: string; timestamp: number }> = [];
  private formStartTimes: Map<string, number> = new Map();
  private pageStartTime: number = Date.now();
  private isTracking = false;

  private constructor() {
    this.currentBehavior = this.initializeBehavior();
  }

  static getInstance(): BehaviorTracker {
    if (!BehaviorTracker.instance) {
      BehaviorTracker.instance = new BehaviorTracker();
    }
    return BehaviorTracker.instance;
  }

  private initializeBehavior(): UserBehavior {
    return {
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      events: [],
      mouseMovements: [],
      scrollData: {
        maxDepth: 0,
        averageSpeed: 0,
        bounceDepth: 0,
        scrollEvents: []
      },
      clickMap: { clicks: [] },
      engagementScore: 0,
      rageClicks: [],
      formInteractions: [],
      pageTransitions: []
    };
  }

  startTracking(): void {
    if (this.isTracking || typeof window === 'undefined') return;

    try {
      // Install event listeners
      this.installClickTracking();
      this.installScrollTracking();
      this.installMouseTracking();
      this.installFormTracking();
      this.installVisibilityTracking();
      this.installCopyPasteTracking();
      this.installVideoTracking();
      this.installNavigationTracking();

      // Install observers
      this.installIntersectionObserver();
      this.installMutationObserver();

      // Start engagement calculation
      this.startEngagementTracking();

      this.isTracking = true;
      logger.info('Behavior tracking started');

    } catch (error) {
      logger.error('Failed to start behavior tracking', {
        component: 'BehaviorTracker',
        metadata: { error: (error as Error).message }
      });
    }
  }

  stopTracking(): void {
    if (!this.isTracking) return;

    // Remove event listeners
    this.eventHandlers.forEach((handler, key) => {
      const [element, event] = key.split(':');
      const el = element === 'window' ? window : 
                  element === 'document' ? document : 
                  document.querySelector(element);
      el?.removeEventListener(event, handler);
    });
    this.eventHandlers.clear();

    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();

    // Send final data
    this.sendBehaviorData();

    this.isTracking = false;
    logger.info('Behavior tracking stopped');
  }

  // Event Installation Methods

  private installClickTracking(): void {
    const handler: EventListener = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      const elementPath = this.getElementPath(target);

      // Record click
      this.currentBehavior.clickMap.clicks.push({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        element: elementPath,
        timestamp: Date.now()
      });

      // Track behavior event
      this.trackBehaviorEvent({
        type: 'click',
        target: elementPath,
        data: {
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
          button: mouseEvent.button,
          altKey: mouseEvent.altKey,
          ctrlKey: mouseEvent.ctrlKey,
          shiftKey: mouseEvent.shiftKey
        }
      });

      // Check for rage clicks
      this.detectRageClicks(elementPath, mouseEvent.clientX, mouseEvent.clientY);

      // Track analytics event
      analytics.track('user_click', {
        element: elementPath,
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        text: target.textContent?.substring(0, 50)
      });
    };

    document.addEventListener('click', handler, true);
    this.eventHandlers.set('document:click', handler);
  }

  private installScrollTracking(): void {
    let lastScrollY = window.scrollY;
    let lastScrollTime = Date.now();

    const handler = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const scrollDepth = this.calculateScrollDepth();
      const scrollSpeed = Math.abs(currentScrollY - lastScrollY) / (currentTime - lastScrollTime);

      // Update scroll data
      this.currentBehavior.scrollData.maxDepth = Math.max(
        this.currentBehavior.scrollData.maxDepth,
        scrollDepth
      );

      this.currentBehavior.scrollData.scrollEvents.push({
        depth: scrollDepth,
        timestamp: currentTime,
        direction: currentScrollY > lastScrollY ? 'down' : 'up'
      });

      // Calculate average speed
      const speeds = this.currentBehavior.scrollData.scrollEvents.map((e, i, arr) => {
        if (i === 0) return 0;
        return Math.abs(e.depth - arr[i - 1].depth) / (e.timestamp - arr[i - 1].timestamp);
      });
      this.currentBehavior.scrollData.averageSpeed = 
        speeds.reduce((a, b) => a + b, 0) / speeds.length;

      // Track behavior event
      this.trackBehaviorEvent({
        type: 'scroll',
        target: 'window',
        data: {
          depth: scrollDepth,
          speed: scrollSpeed,
          direction: currentScrollY > lastScrollY ? 'down' : 'up'
        }
      });

      lastScrollY = currentScrollY;
      lastScrollTime = currentTime;
    };

    window.addEventListener('scroll', this.throttle(handler, 100));
    this.eventHandlers.set('window:scroll', handler);
  }

  private installMouseTracking(): void {
    let lastMouseTime = Date.now();
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handler: EventListener = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const currentTime = Date.now();
      const timeDelta = currentTime - lastMouseTime;
      
      if (timeDelta < 50) return; // Throttle to 20 FPS

      const distance = Math.sqrt(
        Math.pow(mouseEvent.clientX - lastMouseX, 2) + 
        Math.pow(mouseEvent.clientY - lastMouseY, 2)
      );
      const velocity = distance / timeDelta;

      const movement: MouseMovement = {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        timestamp: currentTime,
        velocity
      };

      this.mouseTrail.push(movement);
      if (this.mouseTrail.length > 100) {
        this.mouseTrail.shift();
      }

      lastMouseX = mouseEvent.clientX;
      lastMouseY = mouseEvent.clientY;
      lastMouseTime = currentTime;
    };

    document.addEventListener('mousemove', handler);
    this.eventHandlers.set('document:mousemove', handler);
  }

  private installFormTracking(): void {
    // Focus tracking
    const focusHandler: EventListener = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const formId = this.getFormId(target);
        const fieldName = target.getAttribute('name') || target.getAttribute('id') || 'unnamed';
        
        this.formStartTimes.set(`${formId}:${fieldName}`, Date.now());

        this.trackBehaviorEvent({
          type: 'focus',
          target: this.getElementPath(target),
          data: { formId, fieldName }
        });

        this.currentBehavior.formInteractions.push({
          formId,
          fieldName,
          interactionType: 'focus',
          timestamp: Date.now()
        });
      }
    };

    // Blur tracking
    const blurHandler: EventListener = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const formId = this.getFormId(target);
        const fieldName = target.getAttribute('name') || target.getAttribute('id') || 'unnamed';
        const startTime = this.formStartTimes.get(`${formId}:${fieldName}`);
        
        const timeSpent = startTime ? Date.now() - startTime : 0;

        this.trackBehaviorEvent({
          type: 'blur',
          target: this.getElementPath(target),
          data: { formId, fieldName, timeSpent }
        });

        this.currentBehavior.formInteractions.push({
          formId,
          fieldName,
          interactionType: 'blur',
          timestamp: Date.now(),
          timeSpent
        });
      }
    };

    // Change tracking
    const changeHandler: EventListener = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const formId = this.getFormId(target);
        const fieldName = target.getAttribute('name') || target.getAttribute('id') || 'unnamed';

        this.trackBehaviorEvent({
          type: 'form_change',
          target: this.getElementPath(target),
          data: { formId, fieldName }
        });

        this.currentBehavior.formInteractions.push({
          formId,
          fieldName,
          interactionType: 'change',
          timestamp: Date.now()
        });
      }
    };

    // Submit tracking
    const submitHandler: EventListener = (event: Event) => {
      const form = event.target as HTMLFormElement;
      const formId = this.getFormId(form);

      this.trackBehaviorEvent({
        type: 'form_submit',
        target: this.getElementPath(form),
        data: { formId }
      });

      // Mark form as submitted
      this.currentBehavior.formInteractions
        .filter(fi => fi.formId === formId)
        .forEach(fi => fi.abandoned = false);

      analytics.track('form_submitted', { formId });
    };

    document.addEventListener('focus', focusHandler, true);
    document.addEventListener('blur', blurHandler, true);
    document.addEventListener('change', changeHandler, true);
    document.addEventListener('submit', submitHandler, true);

    this.eventHandlers.set('document:focus', focusHandler);
    this.eventHandlers.set('document:blur', blurHandler);
    this.eventHandlers.set('document:change', changeHandler);
    this.eventHandlers.set('document:submit', submitHandler);
  }

  private installVisibilityTracking(): void {
    const handler = () => {
      this.trackBehaviorEvent({
        type: 'visibility_change',
        target: 'document',
        data: {
          hidden: document.hidden,
          visibilityState: document.visibilityState
        }
      });

      if (document.hidden) {
        // User left, calculate engagement
        this.calculateEngagementScore();
      }
    };

    document.addEventListener('visibilitychange', handler);
    this.eventHandlers.set('document:visibilitychange', handler);
  }

  private installCopyPasteTracking(): void {
    const copyHandler: EventListener = (event: Event) => {
      const selection = window.getSelection()?.toString() || '';
      
      this.trackBehaviorEvent({
        type: 'copy',
        target: 'document',
        data: {
          textLength: selection.length,
          hasSelection: selection.length > 0
        }
      });

      analytics.track('content_copied', {
        length: selection.length
      });
    };

    const pasteHandler: EventListener = (event: Event) => {
      this.trackBehaviorEvent({
        type: 'paste',
        target: this.getElementPath(event.target as HTMLElement),
        data: {}
      });
    };

    document.addEventListener('copy', copyHandler);
    document.addEventListener('paste', pasteHandler);

    this.eventHandlers.set('document:copy', copyHandler);
    this.eventHandlers.set('document:paste', pasteHandler);
  }

  private installVideoTracking(): void {
    const videos = document.querySelectorAll('video');
    
    videos.forEach((video, index) => {
      const videoId = video.id || `video-${index}`;

      video.addEventListener('play', () => {
        this.trackBehaviorEvent({
          type: 'video_play',
          target: videoId,
          data: {
            currentTime: video.currentTime,
            duration: video.duration
          }
        });
      });

      video.addEventListener('pause', () => {
        this.trackBehaviorEvent({
          type: 'video_pause',
          target: videoId,
          data: {
            currentTime: video.currentTime,
            duration: video.duration,
            percentWatched: (video.currentTime / video.duration) * 100
          }
        });
      });

      video.addEventListener('ended', () => {
        this.trackBehaviorEvent({
          type: 'video_complete',
          target: videoId,
          data: {
            duration: video.duration
          }
        });

        analytics.track('video_completed', {
          videoId,
          duration: video.duration
        });
      });
    });
  }

  private installNavigationTracking(): void {
    // Track page transitions
    let lastUrl = window.location.href;

    const checkNavigation = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        const timeOnPage = Date.now() - this.pageStartTime;

        this.currentBehavior.pageTransitions.push({
          from: lastUrl,
          to: currentUrl,
          timestamp: Date.now(),
          trigger: 'link',
          timeOnPage
        });

        lastUrl = currentUrl;
        this.pageStartTime = Date.now();

        // Reset page-specific data
        this.currentBehavior.scrollData.maxDepth = 0;
        this.currentBehavior.clickMap.clicks = [];
      }
    };

    // Check for navigation changes
    setInterval(checkNavigation, 1000);

    // Track back/forward
    window.addEventListener('popstate', () => {
      checkNavigation();
    });
  }

  private installIntersectionObserver(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const elementPath = this.getElementPath(element);

          analytics.track('element_viewed', {
            element: elementPath,
            intersectionRatio: entry.intersectionRatio
          });
        }
      });
    }, {
      threshold: [0.25, 0.5, 0.75, 1.0]
    });

    // Observe important elements
    document.querySelectorAll('[data-track-view]').forEach(el => {
      observer.observe(el);
    });

    this.observers.set('intersection', observer);
  }

  private installMutationObserver(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Track dynamic content
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (element.hasAttribute('data-track-view')) {
                const intersectionObserver = this.observers.get('intersection') as IntersectionObserver;
                intersectionObserver?.observe(element);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('mutation', observer);
  }

  private startEngagementTracking(): void {
    // Track active time
    let activeTime = 0;
    let lastActiveTime = Date.now();
    let isActive = true;

    const updateActiveTime = () => {
      if (isActive) {
        activeTime += Date.now() - lastActiveTime;
      }
      lastActiveTime = Date.now();
    };

    // User is active when moving mouse or typing
    const activityHandler = () => {
      if (!isActive) {
        isActive = true;
        lastActiveTime = Date.now();
      }
    };

    const inactivityHandler = () => {
      isActive = false;
      updateActiveTime();
    };

    ['mousemove', 'keypress', 'scroll', 'click'].forEach(event => {
      document.addEventListener(event, activityHandler);
    });

    // Consider user inactive after 30 seconds
    let inactivityTimer: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(inactivityHandler, 30000);
    };

    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keypress', resetInactivityTimer);

    // Calculate engagement score periodically
    setInterval(() => {
      updateActiveTime();
      this.calculateEngagementScore();
    }, 60000); // Every minute
  }

  // Helper Methods

  private trackBehaviorEvent(event: Omit<BehaviorEvent, 'timestamp'>): void {
    const fullEvent: BehaviorEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.currentBehavior.events.push(fullEvent);

    // Keep only recent events
    if (this.currentBehavior.events.length > 1000) {
      this.currentBehavior.events = this.currentBehavior.events.slice(-500);
    }
  }

  private detectRageClicks(element: string, x: number, y: number): void {
    const now = Date.now();
    
    // Add to click buffer
    this.clickBuffer.push({ element, timestamp: now });

    // Remove old clicks (older than 2 seconds)
    this.clickBuffer = this.clickBuffer.filter(
      click => now - click.timestamp < 2000
    );

    // Count clicks on same element
    const sameElementClicks = this.clickBuffer.filter(
      click => click.element === element
    );

    if (sameElementClicks.length >= 3) {
      // Rage click detected
      this.currentBehavior.rageClicks.push({
        element,
        count: sameElementClicks.length,
        timestamp: now,
        coordinates: { x, y }
      });

      analytics.track('rage_click_detected', {
        element,
        count: sameElementClicks.length,
        x,
        y
      });

      // Clear buffer for this element
      this.clickBuffer = this.clickBuffer.filter(
        click => click.element !== element
      );
    }
  }

  private calculateScrollDepth(): number {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    
    return ((scrollTop + windowHeight) / documentHeight) * 100;
  }

  private calculateEngagementScore(): void {
    // Factors for engagement score
    const factors = {
      scrollDepth: Math.min(this.currentBehavior.scrollData.maxDepth / 100, 1) * 0.2,
      clicks: Math.min(this.currentBehavior.clickMap.clicks.length / 10, 1) * 0.2,
      timeOnPage: Math.min((Date.now() - this.pageStartTime) / 300000, 1) * 0.2, // 5 minutes max
      formInteractions: Math.min(this.currentBehavior.formInteractions.length / 5, 1) * 0.2,
      rageClicks: Math.max(0, 1 - (this.currentBehavior.rageClicks.length * 0.1)) * 0.2
    };

    this.currentBehavior.engagementScore = 
      Object.values(factors).reduce((sum, factor) => sum + factor, 0) * 100;

    analytics.track('engagement_calculated', {
      score: this.currentBehavior.engagementScore,
      factors
    });
  }

  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private getFormId(element: HTMLElement): string {
    const form = element.closest('form');
    if (form) {
      return form.id || form.getAttribute('name') || 'unnamed-form';
    }
    return 'no-form';
  }

  private throttle(func: Function, delay: number): EventListener {
    let timeoutId: NodeJS.Timeout | null;
    let lastExecTime = 0;

    return function (this: any, ...args: any[]) {
      const currentTime = Date.now();

      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  private getSessionId(): string {
    return sessionStorage.getItem('analytics_session_id') || 'unknown';
  }

  private getUserId(): string | undefined {
    return localStorage.getItem('analytics_user_id') || undefined;
  }

  private sendBehaviorData(): void {
    // Calculate final metrics
    this.calculateEngagementScore();

    // Send to analytics
    analytics.track('behavior_session_complete', {
      engagementScore: this.currentBehavior.engagementScore,
      totalEvents: this.currentBehavior.events.length,
      maxScrollDepth: this.currentBehavior.scrollData.maxDepth,
      totalClicks: this.currentBehavior.clickMap.clicks.length,
      rageClicks: this.currentBehavior.rageClicks.length,
      formInteractions: this.currentBehavior.formInteractions.length,
      pageTransitions: this.currentBehavior.pageTransitions.length
    });

    // Send detailed data to backend
    fetch('/api/analytics/behavior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.currentBehavior)
    }).catch(error => {
      logger.error('Failed to send behavior data', {
        component: 'BehaviorTracker',
        metadata: { error: (error as Error).message }
      });
    });

    // Reset behavior data
    this.currentBehavior = this.initializeBehavior();
  }

  // Public Methods

  getBehaviorSummary(): Record<string, any> {
    return {
      engagementScore: this.currentBehavior.engagementScore,
      totalEvents: this.currentBehavior.events.length,
      scrollDepth: this.currentBehavior.scrollData.maxDepth,
      clickCount: this.currentBehavior.clickMap.clicks.length,
      rageClicks: this.currentBehavior.rageClicks.length,
      timeOnPage: Date.now() - this.pageStartTime
    };
  }

  getHeatmapData(): HeatmapCell[][] {
    // Generate heatmap from click data
    const gridSize = 20;
    const width = window.innerWidth;
    const height = document.documentElement.scrollHeight;
    const rows = Math.ceil(height / gridSize);
    const cols = Math.ceil(width / gridSize);

    const heatmap: HeatmapCell[][] = Array(rows).fill(null).map((_, y) =>
      Array(cols).fill(null).map((_, x) => ({
        x: x * gridSize,
        y: y * gridSize,
        intensity: 0
      }))
    );

    // Calculate intensity from clicks
    this.currentBehavior.clickMap.clicks.forEach(click => {
      const row = Math.floor(click.y / gridSize);
      const col = Math.floor(click.x / gridSize);
      
      if (row < rows && col < cols) {
        heatmap[row][col].intensity++;
      }
    });

    // Normalize intensity
    const maxIntensity = Math.max(...heatmap.flat().map(cell => cell.intensity));
    if (maxIntensity > 0) {
      heatmap.forEach(row => {
        row.forEach(cell => {
          cell.intensity = cell.intensity / maxIntensity;
        });
      });
    }

    return heatmap;
  }
}

// Export singleton instance
export const behaviorTracker = BehaviorTracker.getInstance();