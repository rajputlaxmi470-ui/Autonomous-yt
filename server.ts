import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { google } from 'googleapis';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import { VideoJob } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

// In-memory store for jobs (in a real app, use a DB)
const jobs: VideoJob[] = [];

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: 'yt-auto-secret',
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        sameSite: 'none',
        httpOnly: true,
      },
    })
  );

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'dummy_id',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret',
    `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`
  );

  // --- API Routes ---

  app.get('/api/auth/url', (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });

    res.json({ url });
  });

  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      (req.session as any).tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth Error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/user', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.json({ connected: false });
    }

    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      res.json({
        connected: true,
        name: userInfo.data.name,
        email: userInfo.data.email,
        picture: userInfo.data.picture,
      });
    } catch (error) {
      res.json({ connected: false });
    }
  });

  app.post('/api/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const job: VideoJob = {
      id: Math.random().toString(36).substring(7),
      filename: req.file.filename,
      originalName: req.file.originalname,
      status: 'pending',
      createdAt: Date.now(),
    };

    jobs.push(job);
    res.json(job);
  });

  app.get('/api/jobs', (req, res) => {
    res.json(jobs);
  });

  app.get('/api/stats', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

    try {
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const response = await youtube.channels.list({
        part: ['statistics'],
        mine: true,
      });

      const stats = response.data.items?.[0]?.statistics;
      res.json(stats || { viewCount: '0', subscriberCount: '0', videoCount: '0' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  app.post('/api/jobs/:id/metadata', (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const job = jobs.find(j => j.id === id);
    
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    job.title = title;
    job.description = description;
    job.status = 'uploading';
    
    res.json(job);
  });

  // --- Background Worker Simulation ---
  setInterval(async () => {
    // 1. Pending -> Processing
    const pendingJob = jobs.find(j => j.status === 'pending');
    if (pendingJob) {
      pendingJob.status = 'processing';
      console.log(`Job ${pendingJob.id} is now processing (waiting for AI metadata)`);
    }

    // 2. Uploading -> Completed/Failed
    const uploadingJob = jobs.find(j => j.status === 'uploading');
    if (uploadingJob) {
      // In a real app, you'd store tokens in a DB associated with the user
      // For this demo, we'll try to get it from the session if possible, 
      // but background tasks usually need a persistent store.
      
      try {
        console.log(`Uploading to YouTube: ${uploadingJob.id}`);
        // Simulate upload for demo if no tokens or in dev
        // In this environment, background tasks don't have easy access to session
        // So we'll simulate the upload part unless we implement a token store
        
        setTimeout(() => {
          uploadingJob.status = 'completed';
          uploadingJob.youtubeId = 'demo-id-' + Math.random().toString(36).substring(7);
          console.log(`Job ${uploadingJob.id} completed`);
        }, 5000);

      } catch (error) {
        console.error('Upload Error:', error);
        uploadingJob.status = 'failed';
        uploadingJob.error = 'YouTube upload failed';
      }
    }
  }, 10000);

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
