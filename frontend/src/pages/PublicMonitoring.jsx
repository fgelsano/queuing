import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import WindowCard from '../components/WindowCard';
import Loading from '../components/Loading';
import Logo from '../components/Logo';
import { getQueueCounter } from '../utils/queueNumber';

export default function PublicMonitoring() {
  const [windows, setWindows] = useState([]);
  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);
  const previousWindowsRef = useRef([]);
  const hasAnnouncedOnceRef = useRef(false);
  const announcementQueueRef = useRef([]);
  const isProcessingAnnouncementRef = useRef(false);
  const [dingSoundUrl, setDingSoundUrl] = useState(null);
  const [announcementTemplate, setAnnouncementTemplate] = useState('');

  useEffect(() => {
    loadData();
    loadDingSound();
    loadAnnouncementTemplate();
    const interval = setInterval(loadData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    if (videos.length > 0 && !currentVideo) {
      setCurrentVideo(videos[0]);
    }
  }, [videos, currentVideo]);

  useEffect(() => {
    if (videoRef.current && currentVideo) {
      const video = videoRef.current;
      
      const handleEnded = () => {
        // Find next video or loop back
        const currentIndex = videos.findIndex(v => v.url === currentVideo.url);
        const nextIndex = (currentIndex + 1) % videos.length;
        setCurrentVideo(videos[nextIndex]);
      };

      video.addEventListener('ended', handleEnded);
      video.volume = 1.0;
      video.load();

      // Try to autoplay with sound, fallback to muted autoplay
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Autoplay started successfully, try to unmute
            video.muted = false;
          })
          .catch(() => {
            // Autoplay was prevented, play muted instead
            video.muted = true;
            video.play().catch(console.error);
          });
      }

      return () => {
        video.removeEventListener('ended', handleEnded);
      };
    }
  }, [currentVideo, videos]);

  const loadData = async () => {
    try {
      const res = await api.get('/queue/public/windows');
      const newWindows = res.data.windows || [];

      // Trigger text-to-speech announcements for any changes in "now serving"
      try {
        handleNowServingAnnouncements(previousWindowsRef.current, newWindows);
      } catch (announceError) {
        // Fail silently if speech synthesis is not available or any other error occurs
        console.error('Failed to run TTS announcements:', announceError);
      }

      setWindows(newWindows);
      previousWindowsRef.current = newWindows;
    } catch (error) {
      console.error('Failed to load windows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDingSound = async () => {
    try {
      const res = await api.get('/admin/settings/ding-sound');
      setDingSoundUrl(res.data.dingSoundUrl || null);
    } catch (error) {
      console.error('Failed to load ding sound URL:', error);
      setDingSoundUrl(null);
    }
  };

  const loadAnnouncementTemplate = async () => {
    try {
      const res = await api.get('/admin/settings/tts-announcement');
      if (res.data.template) {
        setAnnouncementTemplate(res.data.template);
      }
    } catch (error) {
      console.error('Failed to load TTS announcement template:', error);
    }
  };

  const playDing = (onDone) => {
    // Safety: max wait before TTS, even if audio events fail
    const MAX_WAIT_MS = 7000;

    if (typeof window === 'undefined') {
      if (onDone) setTimeout(onDone, MAX_WAIT_MS);
      return;
    }

    let done = false;
    const safeDone = () => {
      if (done) return;
      done = true;
      if (onDone) onDone();
    };

    try {
      // Prefer the uploaded MP3 ding if configured
      if (dingSoundUrl) {
        const audio = new Audio(dingSoundUrl);
        audio.volume = 1.0;

        audio.addEventListener('ended', safeDone);
        audio.addEventListener('error', (err) => {
          console.error('Failed to play custom ding sound:', err);
          safeDone();
        });

        audio.play().catch((err) => {
          console.error('Failed to start custom ding sound:', err);
          safeDone();
        });

        // Hard safety timeout in case the ended event never fires
        setTimeout(safeDone, MAX_WAIT_MS);
        return;
      }

      // Fallback: synthesized chime
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        const now = ctx.currentTime;
        osc1.frequency.setValueAtTime(880, now); // A5
        osc2.frequency.setValueAtTime(1175, now + 0.08); // ~D6

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        osc1.start(now);
        osc2.start(now + 0.08);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);

        // Synth chime is ~0.4s; call done shortly after
        setTimeout(safeDone, 500);
        return;
      }
    } catch (err) {
      console.error('Failed to play ding sound:', err);
    }

    // Last resort if nothing above worked
    setTimeout(safeDone, MAX_WAIT_MS);
  };

  const duckVideoVolume = (volume) => {
    const vid = videoRef.current;
    if (vid) vid.volume = Math.max(0, Math.min(1, volume));
  };

  const playTTSAndWait = (text) => {
    return new Promise((resolve) => {
      api.post('/tts', { text }, { responseType: 'arraybuffer' })
        .then((response) => {
          const audioData = response.data;
          if (!audioData) {
            resolve();
            return;
          }
          const blob = new Blob([audioData], { type: 'audio/mpeg' });
          const ttsUrl = URL.createObjectURL(blob);
          const audio = new Audio(ttsUrl);
          audio.addEventListener('ended', () => {
            URL.revokeObjectURL(ttsUrl);
            resolve();
          });
          audio.addEventListener('error', () => {
            URL.revokeObjectURL(ttsUrl);
            resolve();
          });
          audio.play().catch(() => resolve());
        })
        .catch(() => {
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          } else {
            resolve();
          }
        });
    });
  };

  const playDingAsync = () => {
    return new Promise((resolve) => playDing(resolve));
  };

  const processNextAnnouncement = async () => {
    if (isProcessingAnnouncementRef.current || announcementQueueRef.current.length === 0) return;
    isProcessingAnnouncementRef.current = true;
    const { text } = announcementQueueRef.current.shift();

    duckVideoVolume(0.5);
    await playDingAsync();
    await playTTSAndWait(text);
    duckVideoVolume(1.0);

    isProcessingAnnouncementRef.current = false;
    if (announcementQueueRef.current.length > 0) {
      processNextAnnouncement();
    }
  };

  const handleNowServingAnnouncements = (oldWindows, newWindows) => {
    if (typeof window === 'undefined') return;

    if (!hasAnnouncedOnceRef.current) {
      hasAnnouncedOnceRef.current = true;
      return;
    }

    const oldMap = new Map();
    (oldWindows || []).forEach((w) => {
      if (w && w.id && w.currentServing) {
        oldMap.set(w.id, w.currentServing.queueNumber);
      }
    });

    const toAnnounce = [];
    (newWindows || []).forEach((w) => {
      if (!w || !w.id || !w.currentServing) return;
      const newQueueNumber = w.currentServing.queueNumber;
      const clientName = w.currentServing.clientName;
      const oldQueueNumber = oldMap.get(w.id);
      if (!newQueueNumber || newQueueNumber === oldQueueNumber) return;

      const rawCounter = getQueueCounter ? getQueueCounter(newQueueNumber) : newQueueNumber;
      let spokenCounter = rawCounter;
      const parsed = parseInt(rawCounter, 10);
      if (!Number.isNaN(parsed)) spokenCounter = String(parsed);

      const windowLabel = w.label || 'Window';
      const clientNamePart = clientName ? `, or client name ${clientName}` : '';
      const baseTemplate = announcementTemplate ||
        'Window {{window}} will now serve queue number {{queueNumber}}{{clientNamePart}}.';

      const text = baseTemplate
        .replace(/{{\s*(window|window number)\s*}}/gi, windowLabel)
        .replace(/{{\s*(queueNumber|queue number)\s*}}/gi, spokenCounter)
        .replace(/{{\s*clientNamePart\s*}}/gi, clientNamePart)
        .replace(/{{\s*(clientName|client name)\s*}}/gi, clientName || '');

      toAnnounce.push({ text });
    });

    toAnnounce.forEach((item) => announcementQueueRef.current.push(item));
    processNextAnnouncement();
  };

  const loadVideos = async () => {
    try {
      const res = await api.get('/videos');
      setVideos(res.data.videos || []);
      setVideoError(false);
    } catch (error) {
      console.error('Failed to load videos:', error);
      setVideoError(true);
      setVideos([]);
    }
  };

  const handleVideoSelect = (video) => {
    setCurrentVideo(video);
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8fafc',
      overflow: 'hidden',
    }}>
      {/* Top half: header + cards (scrollable if needed) */}
      <div style={{
        flex: '0 0 50vh',
        minHeight: 0,
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '20px',
          maxWidth: '1400px',
          margin: '0 auto',
        }}>
          {/* Navbar with Logo and Title */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '8px 0',
          }}>
            <Logo size="large" />
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
            }}>
              Queue Monitoring
            </h1>
          </div>

          {loading ? (
            <Loading />
          ) : (
            <div style={{
              display: 'grid',
              gap: '16px',
              marginBottom: '24px',
            }}
            className="grid-responsive">
              {windows.length > 0 ? (
                windows.map((window) => (
                  <WindowCard key={window.id} window={window} />
                ))
              ) : (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '40px',
                  background: 'white',
                  borderRadius: '12px',
                  color: '#64748b',
                }}>
                  No active windows at the moment
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom half: video player (stuck at bottom, exactly 50vh) */}
      <div style={{
        flex: '0 0 50vh',
        minHeight: 0,
        background: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {videos.length > 0 && !videoError ? (
          <div style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            background: '#000',
          }}>
            <video
              ref={videoRef}
              src={currentVideo?.url}
              controls
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 40px',
            textAlign: 'center',
          }}>
            <div style={{
              color: '#94a3b8',
              fontSize: '18px',
              fontWeight: '500',
              marginBottom: '8px',
            }}>
              No video playlist set yet
            </div>
            <div style={{
              color: '#64748b',
              fontSize: '14px',
            }}>
              Please configure the video folder path in the admin settings
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
