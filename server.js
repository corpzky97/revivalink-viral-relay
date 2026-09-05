import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 8787;
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const YT = 'https://www.googleapis.com/youtube/v3';
const apiKey = process.env.YOUTUBE_API_KEY;

const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, n));
function hoursSince(iso){ return Math.max(1, (Date.now() - new Date(iso).getTime()) / 36e5); }
function parseISODuration(iso='PT0S') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m) return 0;
  return (+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+(+m[4]||0);
}
function viralScore(v){
  const views = Number(v.statistics?.viewCount || 0);
  const likes = Number(v.statistics?.likeCount || 0);
  const comments = Number(v.statistics?.commentCount || 0);
  const ageH = hoursSince(v.snippet?.publishedAt);
  const vph = views / ageH;
  const engagement = views ? ((likes + comments * 2) / views) * 100 : 0;
  const velocityScore = clamp(Math.log10(vph + 1) * 20);
  const engagementScore = clamp(engagement * 12);
  const freshnessScore = clamp(100 - Math.log10(ageH + 1) * 25);
  const commentScore = clamp(Math.log10(comments + 1) * 25);
  const clipPotential = parseISODuration(v.contentDetails?.duration) >= 240 ? 85 : 65;
  return Math.round(velocityScore*.35 + engagementScore*.25 + freshnessScore*.15 + commentScore*.10 + clipPotential*.15);
}
function rights(v){
  const license = v.status?.license || 'youtube';
  if(license === 'creativeCommon') return {status:'SAFE_WITH_TERMS', label:'Creative Commons', commercialReview:true};
  return {status:'INSPIRATION_ONLY', label:'Standard YouTube License / review required', commercialReview:true};
}

app.get('/health', (req,res)=>res.json({ok:true, service:'revivalink-viral-relay'}));

app.get('/api/youtube/search', async (req,res)=>{
  try{
    if(!apiKey) return res.status(500).json({error:'YOUTUBE_API_KEY not configured'});
    const q = String(req.query.q || 'christian sermon').slice(0,200);
    const maxResults = Math.min(50, Math.max(1, Number(req.query.maxResults || 25)));
    const license = req.query.license === 'creativeCommon' ? 'creativeCommon' : undefined;
    const duration = ['short','medium','long'].includes(req.query.duration) ? req.query.duration : undefined;
    const params = new URLSearchParams({part:'snippet', type:'video', q, maxResults:String(maxResults), key:apiKey, safeSearch:'moderate'});
    if(license) params.set('videoLicense', license);
    if(duration) params.set('videoDuration', duration);
    const r1 = await fetch(`${YT}/search?${params}`);
    const s = await r1.json();
    if(!r1.ok) return res.status(r1.status).json(s);
    const ids = (s.items||[]).map(x=>x.id.videoId).filter(Boolean);
    if(!ids.length) return res.json({items:[]});
    const params2 = new URLSearchParams({part:'snippet,statistics,contentDetails,status', id:ids.join(','), key:apiKey});
    const r2 = await fetch(`${YT}/videos?${params2}`);
    const d = await r2.json();
    if(!r2.ok) return res.status(r2.status).json(d);
    const items = (d.items||[]).map(v=>({
      id:v.id,
      url:`https://www.youtube.com/watch?v=${v.id}`,
      title:v.snippet?.title,
      channelTitle:v.snippet?.channelTitle,
      publishedAt:v.snippet?.publishedAt,
      description:v.snippet?.description,
      duration:v.contentDetails?.duration,
      captions:v.contentDetails?.caption === 'true',
      licensedContent:Boolean(v.contentDetails?.licensedContent),
      views:Number(v.statistics?.viewCount||0),
      likes:Number(v.statistics?.likeCount||0),
      comments:Number(v.statistics?.commentCount||0),
      license:v.status?.license || 'youtube',
      embeddable:v.status?.embeddable,
      rights:rights(v),
      viralScore:viralScore(v)
    })).sort((a,b)=>b.viralScore-a.viralScore);
    res.json({query:q, items});
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/api/queue', (req,res)=>{
  const item = req.body || {};
  if(!item.sourceUrl) return res.status(400).json({error:'sourceUrl required'});
  const record = {id:`q_${Date.now()}`, createdAt:new Date().toISOString(), status:'REVIEW', ...item};
  res.status(201).json(record);
});

app.listen(port, ()=>console.log(`RevivaLink relay listening on :${port}`));
