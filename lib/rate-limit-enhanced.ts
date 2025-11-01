import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limit storage
// For production, consider using Redis for distributed rate limiting
const requestCounts = new Map<string, RateLimitRecord>();

// Cleanup old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Rate limiting middleware for API routes
 * @param limit Maximum number of requests allowed in the time window
 * @param windowMs Time window in milliseconds
 * @returns Middleware function that wraps the handler
 */
export function rateLimitBySession(limit = 30, windowMs = 60000) {
  return async (req: NextRequest, handler: Function) => {
    // Identify requester by session cookie, IP, or anonymous
    const sessionCookie = req.cookies.get('admin_session')?.value;
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.ip || 'unknown';
    const identifier = sessionCookie || ip;
    
    const now = Date.now();
    
    // Get or create rate limit record
    let record = requestCounts.get(identifier);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      requestCounts.set(identifier, record);
    }
    
    // Check if limit exceeded
    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      console.warn(`⚠️ Rate limit exceeded for ${identifier.substring(0, 10)}...`);
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter 
        },
        { 
          status: 429,
          headers: { 
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(record.resetAt / 1000))
          }
        }
      );
    }
    
    // Increment count and call handler
    record.count++;
    
    const response = await handler(req);
    
    // Add rate limit headers to response
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', String(limit));
      response.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit - record.count)));
      response.headers.set('X-RateLimit-Reset', String(Math.floor(record.resetAt / 1000)));
    }
    
    return response;
  };
}

/**
 * Stricter rate limiting for sensitive operations
 */
export function strictRateLimit() {
  return rateLimitBySession(10, 60000); // 10 requests per minute
}

/**
 * Moderate rate limiting for normal operations
 */
export function moderateRateLimit() {
  return rateLimitBySession(30, 60000); // 30 requests per minute
}

/**
 * Lenient rate limiting for read operations
 */
export function lenientRateLimit() {
  return rateLimitBySession(100, 60000); // 100 requests per minute
}

