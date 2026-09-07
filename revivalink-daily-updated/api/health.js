export default function handler(req,res){
  const daily=process.env.THREEMIN_DAILY_READ_KEY||'';
  const subscriber=process.env.THREEMIN_SUBSCRIBERS_WRITE_KEY||'';
  res.json({
    ok:true,
    service:'revivalink-daily',
    dailyKeyPresent:!!daily,
    subscriberKeyPresent:!!subscriber,
    dailyKeyLooksProduction:daily.startsWith('tm_live_'),
    subscriberKeyLooksProduction:subscriber.startsWith('tm_live_'),
    subscriberApiConfigured:!!process.env.THREEMIN_SUBSCRIBERS_API_URL,
    time:new Date().toISOString()
  });
}
