export interface VideoJob {
  id: string;
  filename: string;
  originalName: string;
  status: 'pending' | 'processing' | 'uploading' | 'completed' | 'failed';
  title?: string;
  description?: string;
  youtubeId?: string;
  error?: string;
  createdAt: number;
}

export interface ChannelStats {
  viewCount: string;
  subscriberCount: string;
  videoCount: string;
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  connected: boolean;
}
