import { Express, Request, Response } from 'express';
import { sendMagicLinkEmail, verifyMagicLinkToken } from './email-service';
import { db, pool } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import session from 'express-session';
import { randomBytes } from 'crypto';

// Define the session interface to include user information
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    isAuthenticated: boolean;
    currentTenantId?: number;
  }
}

export function setupAuth(app: Express) {
  // Set up session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
      resave: true,
      saveUninitialized: true,
      cookie: {
        secure: false, // Set to false for development
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
      },
    })
  );

  // Development-only direct login (bypasses magic link)
  app.post('/api/auth/dev-login', async (req: Request, res: Response) => {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Development login only available in development mode' });
    }

    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Find user by email
      const userQuery = `
        SELECT * FROM users WHERE email = $1
      `;
      const userResult = await pool.query(userQuery, [email]);
      const user = userResult.rows[0];
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Set up session directly with save callback to ensure persistence
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAuthenticated = true;
      req.session.currentTenantId = user.current_tenant_id;

      req.session.save((err) => {
        if (err) {
          console.error("Error saving dev login session:", err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        console.log(`Development login successful for user: ${email}`);
        return res.status(200).json({ 
          message: 'Development login successful',
          user: {
            id: user.id,
            username: user.username,
            currentTenantId: user.current_tenant_id
          }
        });
      });
    } catch (error) {
      console.error('Development login error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Magic link login request
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Send magic link email
      const success = await sendMagicLinkEmail(email);
      
      if (success) {
        // In development, provide a more detailed message
        if (process.env.NODE_ENV === 'development') {
          return res.status(200).json({ 
            message: 'Magic link created. Check server logs for the login link.',
            dev: true
          });
        } else {
          return res.status(200).json({ 
            message: 'If an account with that email exists, a magic link has been sent' 
          });
        }
      } else {
        return res.status(500).json({ error: 'Failed to send magic link' });
      }
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Magic link verification
  app.get('/api/auth/verify', async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      // Verify the token
      const result = await verifyMagicLinkToken(token);

      if (!result.valid) {
        return res.status(401).json({ error: result.error });
      }

      // Get the user
      const query = `
        SELECT * FROM users 
        WHERE id = $1
      `;
      
      const userResult = await pool.query(query, [result.userId]);
      const user = userResult.rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Set up the session with save callback to ensure it's stored before redirect
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAuthenticated = true;
      req.session.currentTenantId = user.current_tenant_id;
      
      console.log("Session data set:", {
        userId: user.id,
        username: user.username,
        isAuthenticated: true,
        currentTenantId: user.current_tenant_id
      });
      
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ error: 'Session error' });
        }
        
        // Redirect to the main application
        return res.redirect('/');
      });
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // Get current user information
  app.get('/api/auth/user', (req: Request, res: Response) => {
    console.log("Session data in auth/user:", req.session);
    
    if (!req.session.isAuthenticated) {
      console.log("User not authenticated, session ID:", req.sessionID);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log("User authenticated, returning user data");
    return res.status(200).json({
      id: req.session.userId,
      username: req.session.username,
      currentTenantId: req.session.currentTenantId,
    });
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }

      res.clearCookie('connect.sid'); // Clear the session cookie
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  });
}