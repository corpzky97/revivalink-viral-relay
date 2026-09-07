export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({message:'Method not allowed'});
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({message:'Enter a valid email address.'});

  const key=process.env.THREEMIN_SUBSCRIBERS_WRITE_KEY;
  const url=process.env.THREEMIN_SUBSCRIBERS_API_URL||'https://api.3minapi.com/api/v1/data/moxql257ug9ol5w6v6pj2';
  if(!key) return res.status(503).json({message:'Newsletter signup is not connected yet.',code:'missing_key'});

  try{
    // Prevent duplicate active subscriptions by searching for the email first.
    const searchUrl=`${url}/search?q=${encodeURIComponent(email)}&limit=10`;
    const sr=await fetch(searchUrl,{headers:{Authorization:`Bearer ${key}`}});
    if(sr.ok){
      const sj=await sr.json();
      const rows=sj?.data||[];
      const duplicate=rows.some(row=>{
        const p=row?.payload||row?.data||row||{};
        return String(p.email||'').trim().toLowerCase()===email && String(p.status||'active').toLowerCase()==='active';
      });
      if(duplicate){
        return res.status(200).json({message:'You’re already subscribed to RevivaLink Daily.',code:'already_subscribed'});
      }
    }else{
      const st=await sr.text();
      console.error('3Min subscriber search error',sr.status,st);
      if(sr.status===401) return res.status(502).json({message:'Subscriber key is invalid.',code:'invalid_key',upstreamStatus:sr.status});
      if(sr.status===403) return res.status(502).json({message:'Subscriber key lacks read permission.',code:'missing_read_permission',upstreamStatus:sr.status});
      // If search is temporarily unavailable, continue to create rather than block a valid signup.
    }

    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
      body:JSON.stringify({email,first_name:'',source:'website',consent:true,subscribed_at:new Date().toISOString(),status:'active'})
    });
    const t=await r.text();
    if(!r.ok){
      console.error('3Min subscriber error',r.status,t);
      const code=r.status===401?'invalid_key':r.status===403?'wrong_key_or_permission':r.status===400?'payload_rejected':'upstream_error';
      const message=r.status===401?'Subscriber key is invalid.':r.status===403?'Subscriber key belongs to the wrong endpoint or lacks create permission.':r.status===400?'Subscriber service rejected the signup data.':'Unable to subscribe right now.';
      return res.status(502).json({message,code,upstreamStatus:r.status});
    }
    return res.status(200).json({message:'You’re subscribed to RevivaLink Daily.',code:'subscribed'});
  }catch(e){
    console.error(e);
    return res.status(500).json({message:'Unable to subscribe right now.',code:'network_error'});
  }
}
