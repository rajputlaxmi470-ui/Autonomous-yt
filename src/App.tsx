import React, { useState, useEffect } from 'react';
import { Layout, Upload, Settings, Play, CheckCircle, AlertCircle, Loader2, Youtube, LogOut, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoJob, ChannelStats, UserProfile } from './types';
import { generateVideoMetadata } from './lib/gemini';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      setUser(data.connected ? data : null);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
      
      // Check if any jobs need AI metadata
      for (const job of data) {
        if (job.status === 'processing' && !job.title) {
          handleAutoMetadata(job);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoMetadata = async (job: VideoJob) => {
    try {
      const metadata = await generateVideoMetadata(job.originalName);
      await fetch(`/api/jobs/${job.id}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      fetchJobs();
    } catch (e) {
      console.error('Metadata generation failed:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchUser();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (user) {
      fetchStats();
      const interval = setInterval(() => {
        fetchJobs();
        fetchStats();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleConnect = async () => {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('video', e.target.files[0]);

    try {
      await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      fetchJobs();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500 selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Youtube className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-xl tracking-tighter">YT-AUTO</span>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-white/50">{user.email}</p>
            </div>
            <img src={user.picture} alt="" className="w-10 h-10 rounded-full border border-white/20" />
          </div>
        ) : (
          <button 
            onClick={handleConnect}
            className="bg-white text-black px-4 py-2 rounded-full font-medium text-sm hover:bg-orange-500 hover:text-white transition-colors"
          >
            Connect YouTube
          </button>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!user ? (
          <div className="text-center py-24">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl sm:text-8xl font-black tracking-tighter mb-8"
            >
              AUTONOMOUS<br />
              <span className="text-orange-500">YOUTUBE</span>
            </motion.h1>
            <p className="text-white/50 max-w-xl mx-auto mb-12 text-lg">
              Connect your channel and let AI handle the heavy lifting. 
              Autonomous uploads, AI-generated titles, and smart descriptions.
            </p>
            <button 
              onClick={handleConnect}
              className="bg-orange-500 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-white transition-all hover:scale-105"
            >
              Get Started Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Stats Section */}
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Subscribers', value: stats?.subscriberCount || '0', icon: Youtube },
                  { label: 'Total Views', value: stats?.viewCount || '0', icon: Play },
                  { label: 'Videos', value: stats?.videoCount || '0', icon: CheckCircle },
                ].map((stat, i) => (
                  <motion.div 
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 border border-white/10 p-6 rounded-3xl"
                  >
                    <stat.icon className="w-5 h-5 text-orange-500 mb-4" />
                    <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-1">{stat.label}</p>
                    <p className="text-3xl font-black">{Number(stat.value).toLocaleString()}</p>
                  </motion.div>
                ))}
              </div>

              {/* Jobs List */}
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-bold uppercase tracking-widest text-sm">Autonomous Queue</h2>
                  <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-1 rounded-full font-bold">
                    {jobs.length} Active
                  </span>
                </div>
                <div className="divide-y divide-white/10">
                  {jobs.length === 0 ? (
                    <div className="p-12 text-center text-white/30">
                      <p>No videos in queue. Upload one to start.</p>
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            job.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                            job.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                            'bg-orange-500/20 text-orange-500'
                          }`}>
                            {job.status === 'completed' ? <CheckCircle className="w-6 h-6" /> :
                             job.status === 'failed' ? <AlertCircle className="w-6 h-6" /> :
                             <Loader2 className="w-6 h-6 animate-spin" />}
                          </div>
                          <div>
                            <p className="font-bold">{job.originalName}</p>
                            <p className="text-xs text-white/50 uppercase tracking-wider">{job.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/30">{new Date(job.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar / Actions */}
            <div className="space-y-8">
              <div className="bg-orange-500 text-black p-8 rounded-3xl relative overflow-hidden group">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black leading-tight mb-4">UPLOAD NEW<br />VIDEO</h3>
                  <label className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full font-bold cursor-pointer hover:bg-white hover:text-black transition-all">
                    <Plus className="w-5 h-5" />
                    <span>SELECT FILE</span>
                    <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Youtube className="w-48 h-48" />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
                <h3 className="font-bold uppercase tracking-widest text-sm mb-6">Autonomous Settings</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">AI Metadata</p>
                      <p className="text-xs text-white/50">Auto-generate titles/desc</p>
                    </div>
                    <div className="w-12 h-6 bg-orange-500 rounded-full relative p-1">
                      <div className="w-4 h-4 bg-black rounded-full ml-auto" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Auto-Upload</p>
                      <p className="text-xs text-white/50">Publish immediately</p>
                    </div>
                    <div className="w-12 h-6 bg-white/10 rounded-full relative p-1">
                      <div className="w-4 h-4 bg-white/20 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
