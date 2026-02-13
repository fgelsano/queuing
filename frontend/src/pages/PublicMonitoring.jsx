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
  const [videoSource, setVideoSource] = useState('youtube');
  const [localFolderError, setLocalFolderError] = useState(null);
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const videosRef = useRef([]);
  videosRef.current = videos;
  const previousWindowsRef = useRef([]);
  const hasAnnouncedOnceRef = useRef(false);
  const announcementQueueRef = useRef([]);
  const isProcessingAnnouncementRef = useRef(false);
  const lastAnnouncedKeyRef = useRef(null);
  const lastAnnouncedTimeRef = useRef(0);
  const COLLISION_WINDOW_MS = 8000;
  const DEFAULT_VIDEO_VOLUME = 0.05;
  const [dingSoundUrl, setDingSoundUrl] = useState(null);
  const dingSoundUrlRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef(null);
  const [showUnlockOverlay, setShowUnlockOverlay] = useState(false);
  const [videoVolumePercent, setVideoVolumePercent] = useState(5); // 0–100 default

  useEffect(() => {
    loadData();
    loadDingSound();
    const interval = setInterval(loadData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadVideoSourceAndVideos();
  }, []);

  useEffect(() => {
    if (videos.length > 0 && !audioUnlockedRef.current) {
      setShowUnlockOverlay(true);
    }
  }, [videos]);

  const unlockAudioRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = () => unlockAudioRef.current?.();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (videos.length > 0 && !currentVideo) {
      setCurrentVideo(videos[0]);
    }
  }, [videos, currentVideo]);

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      videos.forEach((v) => {
        if (v._blobUrl && v.url) URL.revokeObjectURL(v.url);
      });
    };
  }, [videos]);

  // Local video element: handle ended, autoplay
  useEffect(() => {
    if (videoSource !== 'local' || !videoRef.current || !currentVideo) return;
    const video = videoRef.current;

    const handleEnded = () => {
      const currentIndex = videos.findIndex((v) => v.url === currentVideo.url);
      const nextIndex = (currentIndex + 1) % videos.length;
      setCurrentVideo(videos[nextIndex]);
    };

    video.addEventListener('ended', handleEnded);
    video.volume = DEFAULT_VIDEO_VOLUME;
    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => { video.muted = false; })
        .catch(() => {
          video.muted = true;
          video.play().catch(console.error);
        });
    }

    return () => video.removeEventListener('ended', handleEnded);
  }, [currentVideo, videos, videoSource]);

  // YouTube: load IFrame API and create/update player
  useEffect(() => {
    if (videoSource !== 'youtube' || !currentVideo?.id) return;

    const createOrUpdatePlayer = (videoId) => {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.loadVideoById(videoId);
        const volumeScalar = Math.max(0, Math.min(100, videoVolumePercent)) / 100;
        youtubePlayerRef.current.setVolume(Math.round(volumeScalar * 100));
        return;
      }
      const container = youtubeContainerRef.current;
      if (!container) return;
      const div = document.createElement('div');
      div.id = 'youtube-player-' + Date.now();
      container.innerHTML = '';
      container.appendChild(div);

      youtubePlayerRef.current = new window.YT.Player(div.id, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (e) => {
            const volumeScalar = Math.max(0, Math.min(100, videoVolumePercent)) / 100;
            e.target.setVolume(Math.round(volumeScalar * 100));
            if (audioUnlockedRef.current) {
              e.target.unMute();
            }
          },
          onStateChange: (e) => {
            if (e.data === 0) {
              const list = videosRef.current;
              const idx = list.findIndex((v) => v.id === videoId);
              const next = (idx + 1) % list.length;
              if (list[next]) setCurrentVideo(list[next]);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createOrUpdatePlayer(currentVideo.id);
      return () => {};
    }
    if (window.YTLoadReady) {
      window.YT.ready(() => createOrUpdatePlayer(currentVideo.id));
      return () => {};
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      window.YTLoadReady = true;
      if (prevReady) prevReady();
      createOrUpdatePlayer(currentVideo.id);
    };

    return () => {};
  }, [currentVideo, videos, videoSource, videoVolumePercent]);

  // Cleanup YouTube player on unmount
  useEffect(() => {
    return () => {
      if (youtubePlayerRef.current) {
        try { youtubePlayerRef.current.destroy(); } catch (_) {}
        youtubePlayerRef.current = null;
      }
      if (youtubeContainerRef.current) youtubeContainerRef.current.innerHTML = '';
    };
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/queue/public/windows');
      const newWindows = res.data.windows || [];

      // Defer TTS to next tick to avoid blocking main thread (can cause browser freeze)
      const prev = previousWindowsRef.current;
      setWindows(newWindows);
      previousWindowsRef.current = newWindows;

      setTimeout(() => {
        try {
          handleNowServingAnnouncements(prev, newWindows);
        } catch (announceError) {
          console.error('Failed to run TTS announcements:', announceError);
        }
      }, 0);
    } catch (error) {
      console.error('Failed to load windows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDingSound = async () => {
    try {
      const res = await api.get('/admin/settings/ding-sound');
      const url = res.data.dingSoundUrl || null;
      setDingSoundUrl(url);
      dingSoundUrlRef.current = url;
    } catch (error) {
      console.error('Failed to load ding sound URL:', error);
      setDingSoundUrl(null);
      dingSoundUrlRef.current = null;
    }
  };


  const playDing = (onDone) => {
    // Safety: max wait before TTS, even if audio events fail
    const MAX_WAIT_MS = 7000;

    if (typeof window === 'undefined') {
      console.log('playDing: window undefined');
      if (onDone) setTimeout(onDone, MAX_WAIT_MS);
      return;
    }

    console.log('playDing: starting');
    let done = false;
    let ultimateTimeoutId = null;
    
    // Ultimate safety: ensure safeDone is called within MAX_WAIT_MS no matter what
    ultimateTimeoutId = setTimeout(() => {
      if (!done) {
        console.warn('playDing: Ultimate timeout reached, forcing safeDone');
        done = true;
        if (onDone) {
          try {
            onDone();
          } catch (err) {
            console.error('playDing: Error in onDone callback:', err);
          }
        }
      }
    }, MAX_WAIT_MS);
    
    const safeDone = () => {
      if (done) {
        console.log('playDing: safeDone called but already done');
        return;
      }
      done = true;
      if (ultimateTimeoutId) {
        clearTimeout(ultimateTimeoutId);
        ultimateTimeoutId = null;
      }
      console.log('playDing: done - calling onDone callback');
      if (onDone) {
        try {
          onDone();
        } catch (err) {
          console.error('playDing: Error in onDone callback:', err);
        }
      } else {
        console.warn('playDing: No onDone callback provided');
      }
    };

    try {
      // Prefer the uploaded MP3 ding if configured (use ref so we always have latest URL)
      const dingUrl = dingSoundUrlRef.current || dingSoundUrl;
      if (dingUrl && typeof dingUrl === 'string') {
        const url = dingUrl.startsWith('http') ? dingUrl : `${window.location.origin}${dingUrl.startsWith('/') ? '' : '/'}${dingUrl}`;
        console.log('playDing: Using custom ding sound:', url);
        const audio = new Audio(url);
        audio.volume = 1.0;
        let customDingPlayed = false;

        const tryFallbackChime = () => {
          if (done) return;
          console.log('playDing: Trying synthesized chime fallback');
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) {
            console.warn('playDing: No AudioContext available');
            safeDone();
            return;
          }
          
          let ctx = audioContextRef.current;
          if (!ctx) {
            try {
              ctx = new AudioCtx();
              // Check if context is usable
              if (ctx.state === 'suspended') {
                // Context created but suspended - will need resume
                audioContextRef.current = ctx;
              } else {
                audioContextRef.current = ctx;
              }
            } catch (createErr) {
              console.warn('playDing: Cannot create AudioContext (needs user gesture):', createErr);
              // Still call safeDone so TTS can proceed
              if (!done) safeDone();
              return;
            }
          }
          
          // If we still don't have a context, give up
          if (!ctx) {
            console.warn('playDing: No AudioContext available');
            if (!done) safeDone();
            return;
          }
          
          const playChime = () => {
            if (done) return;
            try {
              console.log('playDing: Playing synthesized chime');
              const osc1 = ctx.createOscillator();
              const osc2 = ctx.createOscillator();
              const gain = ctx.createGain();

              osc1.type = 'sine';
              osc2.type = 'sine';

              const now = ctx.currentTime;
              osc1.frequency.setValueAtTime(880, now);
              osc2.frequency.setValueAtTime(1175, now + 0.08);

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

              setTimeout(() => {
                if (!done) {
                  console.log('playDing: Synthesized chime finished');
                  safeDone();
                }
              }, 500);
            } catch (chimeErr) {
              console.error('playDing: Failed to play chime:', chimeErr);
              if (!done) safeDone();
            }
          };
          
          if (ctx.state === 'suspended' && ctx.resume) {
            ctx.resume().then(() => {
              if (!done) playChime();
            }).catch((resumeErr) => {
              console.warn('playDing: AudioContext resume failed:', resumeErr);
              if (!done) safeDone();
            });
          } else {
            playChime();
          }
        };

        const handleEnded = () => {
          if (done) return;
          console.log('playDing: Audio ended event fired, currentTime:', audio.currentTime, 'duration:', audio.duration);
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('loadeddata', handleCanPlay);
          
          // Check if audio actually played
          const playedEnough = audio.currentTime >= Math.min(0.1, audio.duration * 0.1);
          if (playedEnough || audio.duration === 0) {
            console.log('playDing: Custom ding played successfully');
            customDingPlayed = true;
            safeDone();
          } else {
            console.warn('playDing: Custom ding ended immediately, trying fallback chime');
            tryFallbackChime();
          }
        };

        const handleError = (err) => {
          console.error('Failed to play custom ding sound:', err);
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('loadeddata', handleCanPlay);
          tryFallbackChime();
        };

        const attemptPlay = () => {
          console.log('playDing: Audio ready, attempting to play, readyState:', audio.readyState, 'duration:', audio.duration, 'currentTime:', audio.currentTime);
          // Reset to beginning in case audio was previously played
          audio.currentTime = 0;
          
          // Small delay to ensure currentTime reset takes effect
          setTimeout(() => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log('playDing: Audio playing successfully, paused:', audio.paused, 'currentTime:', audio.currentTime, 'duration:', audio.duration);
                // Verify audio is actually playing
                setTimeout(() => {
                  if (audio.paused && !done && !customDingPlayed) {
                    console.warn('playDing: Audio paused after play() promise resolved, may be blocked by autoplay policy. Will try fallback chime.');
                    handleError(new Error('Autoplay blocked'));
                  } else if (!audio.paused) {
                    console.log('playDing: Audio confirmed playing, currentTime:', audio.currentTime);
                  }
                }, 100);
              }).catch((err) => {
                console.error('Failed to start custom ding sound:', err);
                handleError(err);
              });
            } else {
              console.warn('playDing: play() returned undefined');
              setTimeout(() => {
                if (audio.paused && !done && !customDingPlayed) {
                  console.warn('playDing: Audio is paused after play(), treating as error. Will try fallback chime.');
                  handleError(new Error('Audio did not start playing'));
                }
              }, 100);
            }
          }, 10);
        };

        const handleCanPlay = () => {
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('loadeddata', handleCanPlay);
          attemptPlay();
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        
        // Check if already ready, otherwise wait for load
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          console.log('playDing: Audio already loaded, playing immediately');
          attemptPlay();
        } else {
          audio.addEventListener('canplaythrough', handleCanPlay);
          audio.addEventListener('loadeddata', handleCanPlay);
          audio.load();
        }

        // Hard safety timeout - if custom ding didn't play, try fallback chime
        setTimeout(() => {
          if (!done && !customDingPlayed) {
            console.warn('playDing: Custom ding timeout (2s), trying fallback chime');
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('loadeddata', handleCanPlay);
            tryFallbackChime();
          }
        }, 2000);
        
        return; // Return here - handlers will call tryFallbackChime or safeDone
      }

      // Fallback: synthesized chime (use context unlocked by user gesture if available)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = audioContextRef.current || new AudioCtx();
        
        // Resume context if suspended - wait for it to resume before playing
        const playChime = () => {
          console.log('playDing: Playing synthesized chime');
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
          setTimeout(() => {
            console.log('playDing: Synthesized chime finished');
            safeDone();
          }, 500);
        };
        
        if (ctx.state === 'suspended' && ctx.resume) {
          ctx.resume().then(() => {
            playChime();
          }).catch(() => {
            // If resume fails, try playing anyway
            playChime();
          });
        } else {
          playChime();
        }
        return;
      }
      
      // If we get here, tryFallbackChime was called but AudioContext not available
      console.warn('playDing: No AudioContext available, cannot play chime');
      safeDone();
    } catch (err) {
      console.error('Failed to play ding sound:', err);
    }

    // Last resort if nothing above worked
    setTimeout(safeDone, MAX_WAIT_MS);
  };

  const duckVideoVolume = (volume) => {
    const vid = videoRef.current;
    if (vid) vid.volume = Math.max(0, Math.min(1, volume));
    const yt = youtubePlayerRef.current;
    if (yt && typeof yt.setVolume === 'function') {
      yt.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
    }
  };

  const fallbackSpeech = (text, resolve) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    } else {
      resolve();
    }
  };

  const playTTSAndWait = (text) => {
    return new Promise((resolve) => {
      if (!text || typeof text !== 'string' || !text.trim()) {
        console.warn('TTS: Empty or invalid text provided');
        resolve();
        return;
      }
      
      api.post('/tts', { text }, { responseType: 'arraybuffer' })
        .then((response) => {
          const contentType = (response.headers && response.headers['content-type']) || '';
          const isAudio = contentType.includes('audio/') || contentType.includes('mpeg');
          if (response.status !== 200 || !isAudio || !response.data) {
            console.warn('TTS: Invalid response, falling back to speechSynthesis');
            fallbackSpeech(text, resolve);
            return;
          }
          const audioData = response.data;
          const blob = new Blob([audioData], { type: 'audio/mpeg' });
          const ttsUrl = URL.createObjectURL(blob);
          const audio = new Audio(ttsUrl);
          audio.volume = 1.0; // TTS at 100% by default

          const cleanup = () => {
            // Clear audio source first to stop any pending loads
            audio.src = '';
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            // Small delay before revoking to ensure audio element has released the URL
            setTimeout(() => URL.revokeObjectURL(ttsUrl), 100);
          };

          const handleEnded = () => {
            cleanup();
            resolve();
          };

          const handleError = (err) => {
            console.error('TTS audio playback error:', err);
            cleanup();
            fallbackSpeech(text, resolve);
          };

          audio.addEventListener('ended', handleEnded);
          audio.addEventListener('error', handleError);
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.error('TTS audio play() failed:', err);
              cleanup();
              fallbackSpeech(text, resolve);
            });
          }
        })
        .catch((err) => {
          console.error('TTS API call failed:', err);
          fallbackSpeech(text, resolve);
        });
    });
  };

  const playDingAsync = () => {
    return new Promise((resolve) => playDing(resolve));
  };

  const processNextAnnouncement = async () => {
    if (isProcessingAnnouncementRef.current) {
      console.log('Already processing announcement, skipping');
      return;
    }
    if (announcementQueueRef.current.length === 0) {
      console.log('No announcements in queue');
      return;
    }
    
    console.log(`Processing announcement, queue length: ${announcementQueueRef.current.length}`);
    isProcessingAnnouncementRef.current = true;
    const item = announcementQueueRef.current.shift();
    if (!item) {
      console.log('No item to process');
      isProcessingAnnouncementRef.current = false;
      if (announcementQueueRef.current.length > 0) processNextAnnouncement();
      return;
    }
    const { text } = item;
    console.log('Starting announcement:', text);
    try {
      duckVideoVolume(0.05);
      console.log('Playing ding...');
      await playDingAsync();
      console.log('Ding finished, playing TTS...');
      await playTTSAndWait(text);
      console.log('TTS finished');
      markAnnouncementDone(item.key);
    } catch (err) {
      console.error('Announcement playback error:', err);
    } finally {
      duckVideoVolume(DEFAULT_VIDEO_VOLUME);
      isProcessingAnnouncementRef.current = false;
      if (announcementQueueRef.current.length > 0) {
        processNextAnnouncement();
      }
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

    const now = Date.now();
    const queueSet = new Set(announcementQueueRef.current.map((i) => i.key).filter(Boolean));
    const toAnnounce = [];
    (newWindows || []).forEach((w) => {
      if (!w || !w.id || !w.currentServing) return;
      const newQueueNumber = w.currentServing.queueNumber;
      const clientName = w.currentServing.clientName;
      const oldQueueNumber = oldMap.get(w.id);
      if (!newQueueNumber || newQueueNumber === oldQueueNumber) return;

      const key = `${w.id}:${newQueueNumber}`;
      if (queueSet.has(key)) return;
      if (lastAnnouncedKeyRef.current === key && now - lastAnnouncedTimeRef.current < COLLISION_WINDOW_MS) return;
      queueSet.add(key);

      const rawCounter = getQueueCounter ? getQueueCounter(newQueueNumber) : newQueueNumber;
      let spokenCounter = rawCounter;
      const parsed = parseInt(rawCounter, 10);
      if (!Number.isNaN(parsed)) spokenCounter = String(parsed);

      const windowLabel = w.label || 'Window';
      const clientNamePart = clientName ? `, ${clientName}` : '';
      // Hardcoded Cebuano announcement template
      const template = 'Ang atong {{window}},... mu assist na sa kyu number, {{queueNumber}}. {{clientNamePart}}, please proceed to {{window}}.';
      const text = template
        .replace(/{{\s*window\s*}}/gi, windowLabel)
        .replace(/{{\s*queueNumber\s*}}/gi, spokenCounter)
        .replace(/{{\s*clientNamePart\s*}}/gi, clientNamePart);

      console.log('Announcement queued:', { windowLabel, spokenCounter, text });
      toAnnounce.push({ text, key });
    });

    if (toAnnounce.length > 0) {
      console.log(`Adding ${toAnnounce.length} announcement(s) to queue`);
      toAnnounce.forEach((item) => announcementQueueRef.current.push(item));
      processNextAnnouncement();
    }
  };

  const markAnnouncementDone = (key) => {
    if (key) {
      lastAnnouncedKeyRef.current = key;
      lastAnnouncedTimeRef.current = Date.now();
    }
  };

  const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];

  function extractYoutubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const u = url.trim();
    const m1 = u.match(/[?&]v=([^&]+)/);
    if (m1) return m1[1];
    const m2 = u.match(/youtu\.be\/([^?&]+)/);
    if (m2) return m2[1];
    const m3 = u.match(/youtube\.com\/embed\/([^?&]+)/);
    if (m3) return m3[1];
    return null;
  }

  const loadVideoSourceAndVideos = async () => {
    try {
      const [sourceRes, volumeRes] = await Promise.all([
        api.get('/admin/settings/video-source'),
        api.get('/admin/settings/video-volume').catch(() => null),
      ]);
      const source = sourceRes.data.videoSource || 'youtube';
      setVideoSource(source);

      if (volumeRes && typeof volumeRes.data?.videoVolumePercent === 'number') {
        const v = volumeRes.data.videoVolumePercent;
        setVideoVolumePercent(Math.max(0, Math.min(100, Math.round(v))));
      }

      if (source === 'youtube') {
        const res = await api.get('/admin/settings/youtube-playlist');
        const urls = res.data.urls || [];
        const youtubeVideos = urls
          .map((url) => {
            const id = extractYoutubeId(url);
            return id ? { id, url, name: id } : null;
          })
          .filter(Boolean);
        setVideos(youtubeVideos);
        setVideoError(false);
        setLocalFolderError(null);
      } else {
        setVideos([]);
        setLocalFolderError(null);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
      setVideoError(true);
      setVideos([]);
    }
  };

  const pickLocalFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      setLocalFolderError('Not supported in this browser. Use Chrome or Edge.');
      return;
    }
    try {
      setLocalFolderError(null);
      const dirHandle = await window.showDirectoryPicker();
      const localVideos = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const ext = '.' + (entry.name.split('.').pop() || '').toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            const file = await entry.getFile();
            const url = URL.createObjectURL(file);
            localVideos.push({
              filename: entry.name,
              name: entry.name.replace(/\.[^/.]+$/, ''),
              url,
              _blobUrl: true,
            });
          }
        }
      }
      if (localVideos.length > 0) {
        setVideos(localVideos);
        setVideoError(false);
      } else {
        setLocalFolderError('No video files found in that folder.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to pick folder:', err);
        setLocalFolderError(err.message || 'Failed to access folder.');
      }
    }
  };

  const handleVideoSelect = (video) => {
    setCurrentVideo(video);
  };

  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setShowUnlockOverlay(false);
    try {
      const volumeScalar = Math.max(0, Math.min(100, videoVolumePercent)) / 100;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioContextRef.current) {
        const ctx = new Ctx();
        audioContextRef.current = ctx;
        if (ctx.resume) ctx.resume();
      }
      const yt = youtubePlayerRef.current;
      if (yt && typeof yt.unMute === 'function') {
        yt.unMute();
        yt.setVolume(Math.round(volumeScalar * 100));
      }
      const vid = videoRef.current;
      if (vid) {
        vid.muted = false;
        vid.volume = volumeScalar;
      }
    } catch (_) {}
  };
  unlockAudioRef.current = unlockAudio;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        overflow: 'hidden',
      }}
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
      role="presentation"
    >
      {showUnlockOverlay && videos.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={unlockAudio}
          onKeyDown={(e) => { e.key !== 'Tab' && unlockAudio(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            cursor: 'pointer',
          }}
        >
          <div style={{ color: '#e5e7eb', fontSize: '24px', fontWeight: 600, textAlign: 'center', padding: '0 24px' }}>
            Press any key or tap to start
          </div>
          <div style={{ color: '#9ca3af', fontSize: '16px', textAlign: 'center', padding: '0 24px' }}>
            Use your remote&apos;s OK/Enter button, or tap the screen
          </div>
        </div>
      )}
      {/* Main content: left video (75%) + right stacked cards (25%) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
        }}
      >
        {/* Left: Video with overlaid logo/title */}
        <div
          style={{
            flex: 3,
            minWidth: 0,
            background: '#000',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Overlayed logo + site title (from settings) */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'none',
            }}
          >
            <Logo size="monitor" showText={false} showTitle={true} variant="monitor" gap="8px" />
          </div>

          {/* Powered by overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 42,
              left: 16,
              zIndex: 10,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              pointerEvents: 'none',
            }}
          >
            Powered by: CreativeDevLabs
          </div>

          {videos.length > 0 && !videoError ? (
            videoSource === 'youtube' ? (
              <div
                ref={youtubeContainerRef}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              />
            ) : (
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
                  objectFit: 'cover',
                }}
              />
            )
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  color: '#9ca3af',
                  fontSize: '22px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                {videoSource === 'local' ? 'Select a video folder' : 'No YouTube playlist configured'}
              </div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '16px',
                }}
              >
                {videoSource === 'local'
                  ? 'Choose a folder on this computer containing video files (mp4, webm, ogg, mov, avi).'
                  : 'Add YouTube URLs in Admin → Settings → Videos.'}
              </div>
              {videoSource === 'local' && localFolderError && (
                <div style={{ color: '#ef4444', fontSize: '14px' }}>{localFolderError}</div>
              )}
              {videoSource === 'local' && (
                <button
                  type="button"
                  onClick={pickLocalFolder}
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'white',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Select folder
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Window cards stacked */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            borderLeft: '1px solid #1f2937',
            background: '#020617',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {/* Only show windows with an active assigned staff */}
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loading />
            </div>
          ) : (() => {
            const activeWindows = windows.filter((w) => w.staff);
            if (activeWindows.length === 0) {
              return (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    background: '#0b1120',
                    borderRadius: '12px',
                    color: '#64748b',
                    border: '1px solid #1f2937',
                  }}
                >
                  No active windows at the moment
                </div>
              );
            }
            const cardCount = activeWindows.length;
            const cardFlex = cardCount <= 3 ? '0 0 20vh' : '1 1 0';
            return activeWindows.map((window) => (
              <div
                key={window.id}
                style={{
                  flex: cardFlex,
                  minHeight: cardCount > 3 ? 0 : undefined,
                  display: 'flex',
                }}
              >
                <WindowCard window={window} compact={cardCount > 3} />
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
